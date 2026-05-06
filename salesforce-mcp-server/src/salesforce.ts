import { Connection, Record as SFRecord } from "jsforce";
import crypto from "node:crypto";
import fs from "node:fs";
import { SalesforceAuthError, SalesforceQueryError } from "./utils/errors.js";

export type SFConnection = Connection;

// All custom record types must be compatible with jsforce's Record shape
export type SFQueryRecord = SFRecord & { [field: string]: unknown };

// ── Config ─────────────────────────────────────────────────────────────────

interface JwtConfig {
  loginUrl: string;
  clientId: string;
  username: string;
  privateKey: string; // PEM string
}

function getConfig(): JwtConfig {
  const loginUrl = process.env["SF_LOGIN_URL"];
  const clientId = process.env["SF_CLIENT_ID"];
  const username = process.env["SF_USERNAME"];
  const privateKeyPath = process.env["SF_PRIVATE_KEY_PATH"];

  if (!loginUrl || !clientId || !username || !privateKeyPath) {
    throw new SalesforceAuthError(
      "Missing required env vars: SF_LOGIN_URL, SF_CLIENT_ID, SF_USERNAME, SF_PRIVATE_KEY_PATH"
    );
  }

  let privateKey: string;
  try {
    privateKey = fs.readFileSync(privateKeyPath, "utf-8");
  } catch (err) {
    throw new SalesforceAuthError(
      `Cannot read private key at "${privateKeyPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return { loginUrl, clientId, username, privateKey };
}

// ── JWT signing ────────────────────────────────────────────────────────────

function buildJwtAssertion(config: JwtConfig): string {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: config.clientId,
      sub: config.username,
      aud: config.loginUrl,
      exp: now + 300, // JWT assertion itself valid for 5 min; access_token lifetime is org-controlled
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  const signature = signer.sign(config.privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

// ── Token request ──────────────────────────────────────────────────────────

interface SFTokenResponse {
  access_token: string;
  instance_url: string;
  error?: string;
  error_description?: string;
}

async function requestAccessToken(
  loginUrl: string,
  jwtAssertion: string
): Promise<{ accessToken: string; instanceUrl: string }> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwtAssertion,
  });

  let response: Response;
  try {
    response = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (err) {
    throw new SalesforceAuthError(
      `Network error reaching ${loginUrl}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const data = (await response.json()) as SFTokenResponse;

  if (!response.ok || data.error) {
    throw new SalesforceAuthError(
      `JWT token request failed (HTTP ${response.status}): ${data.error ?? "unknown"} — ${data.error_description ?? ""}`
    );
  }

  return { accessToken: data.access_token, instanceUrl: data.instance_url };
}

// ── Connection management ──────────────────────────────────────────────────

let connection: SFConnection | null = null;
let connectionEstablishedAt = 0;

// Proactively refresh before the token can expire.
// Salesforce's default session timeout is 2 hours; 55 minutes is conservative.
// Override with SF_TOKEN_LIFETIME_MINUTES if your org uses a shorter timeout.
const TOKEN_LIFETIME_MS =
  parseInt(process.env["SF_TOKEN_LIFETIME_MINUTES"] ?? "55", 10) * 60 * 1000;

async function createConnection(): Promise<SFConnection> {
  const config = getConfig();
  const assertion = buildJwtAssertion(config);
  const { accessToken, instanceUrl } = await requestAccessToken(config.loginUrl, assertion);

  const conn = new Connection({
    instanceUrl,
    accessToken,
    // jsforce calls refreshFn automatically on INVALID_SESSION_ID.
    // We re-sign a fresh JWT assertion and exchange it for a new access token.
    refreshFn: (_, callback) => {
      buildJwtAssertion(config);
      requestAccessToken(config.loginUrl, buildJwtAssertion(config))
        .then(({ accessToken: newToken }) => {
          connectionEstablishedAt = Date.now();
          callback(null, newToken);
        })
        .catch((err) => {
          callback(err instanceof Error ? err : new Error(String(err)));
        });
    },
  });

  return conn;
}

export async function getConnection(): Promise<SFConnection> {
  const now = Date.now();

  // ── Passthrough mode ────────────────────────────────────────────────────
  // When spawned by the Next.js frontend, the user's OAuth access token and
  // instance URL are injected as env vars so Salesforce RBAC is enforced
  // per-user. No JWT signing needed in this mode.
  const passthroughToken = process.env["SF_ACCESS_TOKEN"];
  const passthroughInstance = process.env["SF_INSTANCE_URL"];

  if (passthroughToken && passthroughInstance) {
    if (connection === null || connection.accessToken !== passthroughToken) {
      connection = new Connection({
        instanceUrl: passthroughInstance,
        accessToken: passthroughToken,
      });
      connectionEstablishedAt = now;
    }
    return connection;
  }

  // ── JWT Bearer flow (standalone / CLI use) ─────────────────────────────
  // Proactive refresh: reconnect if the token is approaching expiry
  if (connection !== null && now - connectionEstablishedAt > TOKEN_LIFETIME_MS) {
    connection = null;
  }

  if (connection === null) {
    try {
      connection = await createConnection();
      connectionEstablishedAt = now;
    } catch (err) {
      if (err instanceof SalesforceAuthError) throw err;
      throw new SalesforceAuthError(
        `Salesforce JWT authentication failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return connection;
}

// ── Public API ─────────────────────────────────────────────────────────────

const SF_API_VERSION = "v62.0";

/** Convenience accessor — works in both passthrough and JWT modes. */
export async function getInstanceUrl(): Promise<string> {
  const conn = await getConnection();
  return conn.instanceUrl ?? "";
}

/**
 * Create a record via the Salesforce REST API.
 * Returns the new record Id and the org's instance URL for building Lightning URLs.
 */
export async function sfCreate(
  objectType: string,
  fields: Record<string, unknown>
): Promise<{ id: string; instanceUrl: string }> {
  const conn = await getConnection();
  const instanceUrl = conn.instanceUrl;
  const accessToken = conn.accessToken;
  if (!accessToken) throw new SalesforceAuthError("No access token available");

  const res = await fetch(
    `${instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${objectType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
    }
  );

  if (res.status === 401) {
    connection = null;
    throw new SalesforceAuthError("SF_SESSION_EXPIRED");
  }

  interface CreateResponse { id: string; success: boolean; errors?: Array<{ message: string }> }
  const data = (await res.json()) as CreateResponse | Array<{ message: string; errorCode: string }>;

  if (!res.ok) {
    const errors = Array.isArray(data) ? data : [(data as CreateResponse)];
    throw new SalesforceQueryError(
      `Create ${objectType} failed: ${errors.map((e) => (e as { message?: string }).message ?? "Unknown error").join("; ")}`
    );
  }

  return { id: (data as CreateResponse).id, instanceUrl };
}

/**
 * Update a record via the Salesforce REST API (PATCH).
 * Returns the org's instance URL for building Lightning URLs.
 */
export async function sfUpdate(
  objectType: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<{ instanceUrl: string }> {
  const conn = await getConnection();
  const instanceUrl = conn.instanceUrl;
  const accessToken = conn.accessToken;
  if (!accessToken) throw new SalesforceAuthError("No access token available");

  const res = await fetch(
    `${instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${objectType}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
    }
  );

  if (res.status === 401) {
    connection = null;
    throw new SalesforceAuthError("SF_SESSION_EXPIRED");
  }

  if (!res.ok) {
    const data = (await res.json()) as Array<{ message: string; errorCode: string }>;
    const errors = Array.isArray(data) ? data : [data];
    throw new SalesforceQueryError(
      `Update ${objectType} ${recordId} failed: ${errors.map((e) => e.message ?? "Unknown error").join("; ")}`
    );
  }

  // 204 No Content on success — nothing to parse
  return { instanceUrl };
}

export async function query<T extends SFQueryRecord>(soql: string): Promise<T[]> {
  const conn = await getConnection();
  try {
    const result = await conn.query<T>(soql);
    return result.records;
  } catch (err) {
    // If refreshFn itself failed, clear the cached connection so the next call starts fresh
    if (isSessionError(err)) connection = null;
    throw new SalesforceQueryError(
      `SOQL query failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

export async function search(sosl: string): Promise<SFRecord[]> {
  const conn = await getConnection();
  try {
    const result = await conn.search(sosl);
    return result.searchRecords ?? [];
  } catch (err) {
    if (isSessionError(err)) connection = null;
    throw new SalesforceQueryError(
      `SOSL search failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

function isSessionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { errorCode?: string }).errorCode;
  return (
    code === "INVALID_SESSION_ID" ||
    err.message.includes("INVALID_SESSION_ID") ||
    err.message.includes("expired access/refresh token")
  );
}
