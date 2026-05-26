import { getConnection, query } from "./salesforce.js";

// ── Resource definitions ────────────────────────────────────────────────────

export const RESOURCES = [
  {
    uri: "salesforce://schema/objects",
    name: "Salesforce Object Schema",
    description:
      "All queryable sObjects with their labels and key fields. " +
      "Read once at session start to know what's available without guessing.",
    mimeType: "application/json",
  },
  {
    uri: "salesforce://user/profile",
    name: "Current User Profile",
    description:
      "Authenticated user's name, role, profile, and permission set assignments. " +
      "Use to personalise responses and gate write operations.",
    mimeType: "application/json",
  },
  {
    uri: "salesforce://picklists/opportunity-stages",
    name: "Opportunity Stage Values",
    description:
      "All active StageName picklist values for Opportunity. " +
      "Use the exact labels from this list in SOQL filters.",
    mimeType: "application/json",
  },
  {
    uri: "salesforce://picklists/industries",
    name: "Account Industry Values",
    description:
      "All active Industry picklist values for Account. " +
      "Use the exact labels from this list in SOQL filters.",
    mimeType: "application/json",
  },
];

// ── Resource fetchers ───────────────────────────────────────────────────────

async function fetchSchemaObjects(): Promise<unknown> {
  const conn = await getConnection();
  const result = await conn.describeGlobal();

  return result.sobjects
    .filter((o) => o.queryable)
    .map((o) => ({
      name: o.name,
      label: o.label,
      labelPlural: o.labelPlural,
      keyPrefix: o.keyPrefix,
      custom: o.custom,
    }));
}

async function fetchUserProfile(): Promise<unknown> {
  // Use the SOAP API's UserInfo endpoint to get the running user
  const conn = await getConnection();
  const userInfo = await conn.identity();

  // Fetch the full User record plus Profile name
  type UserRecord = {
    Id: string;
    Name: string;
    Email: string;
    Title: string;
    UserType: string;
    IsActive: boolean;
    Profile: { Name: string };
    UserRole: { Name: string } | null;
  };

  const rows = await query<UserRecord & { [k: string]: unknown }>(
    `SELECT Id, Name, Email, Title, UserType, IsActive,
            Profile.Name, UserRole.Name
     FROM User
     WHERE Id = '${userInfo.user_id}'
     LIMIT 1`
  );

  if (rows.length === 0) return { userId: userInfo.user_id };

  const u = rows[0];
  return {
    id: u.Id,
    name: u.Name,
    email: u.Email,
    title: u.Title ?? null,
    userType: u.UserType,
    isActive: u.IsActive,
    profile: (u.Profile as { Name?: string })?.Name ?? null,
    role: (u.UserRole as { Name?: string } | null)?.Name ?? null,
    organizationId: userInfo.organization_id,
  };
}

async function fetchPicklist(objectName: string, fieldName: string): Promise<unknown> {
  const conn = await getConnection();
  const meta = await conn.describe(objectName);
  const field = meta.fields.find((f) => f.name === fieldName);
  if (!field || !field.picklistValues) return [];

  return field.picklistValues
    .filter((v) => v.active)
    .map((v) => ({ label: v.label, value: v.value, defaultValue: v.defaultValue }));
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function readResource(uri: string): Promise<string> {
  let data: unknown;

  switch (uri) {
    case "salesforce://schema/objects":
      data = await fetchSchemaObjects();
      break;
    case "salesforce://user/profile":
      data = await fetchUserProfile();
      break;
    case "salesforce://picklists/opportunity-stages":
      data = await fetchPicklist("Opportunity", "StageName");
      break;
    case "salesforce://picklists/industries":
      data = await fetchPicklist("Account", "Industry");
      break;
    default:
      throw new Error(`Unknown resource URI: ${uri}`);
  }

  return JSON.stringify(data, null, 2);
}
