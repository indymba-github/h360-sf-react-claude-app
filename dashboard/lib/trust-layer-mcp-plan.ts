export interface TrustLayerMcpCall {
  toolName: string;
  title: string;
  args: Record<string, unknown>;
}

export interface TrustLayerMcpToolInfo {
  name: string;
  inputSchema?: unknown;
}

export interface BuildTrustLayerMcpCallsInput {
  availableToolNames?: Iterable<string>;
  availableTools?: Iterable<TrustLayerMcpToolInfo>;
  accountId?: string;
}

export function buildTrustLayerMcpCalls({
  availableToolNames,
  availableTools,
  accountId,
}: BuildTrustLayerMcpCallsInput): TrustLayerMcpCall[] {
  const { available, inputSchemas } = collectAvailableTools(availableToolNames, availableTools);
  const localCalls = buildLocalToolCalls(available, accountId);
  if (localCalls.length > 0) return localCalls;

  const soqlToolName = selectSoqlToolName(available);
  if (!soqlToolName) return [];

  return buildSoqlToolCalls(
    soqlToolName,
    accountId,
    selectSoqlArgumentName(soqlToolName, inputSchemas.get(soqlToolName)),
  );
}

function collectAvailableTools(
  availableToolNames?: Iterable<string>,
  availableTools?: Iterable<TrustLayerMcpToolInfo>,
): { available: Set<string>; inputSchemas: Map<string, unknown> } {
  const available = new Set<string>();
  const inputSchemas = new Map<string, unknown>();

  for (const toolName of availableToolNames ?? []) {
    available.add(toolName);
  }

  for (const tool of availableTools ?? []) {
    available.add(tool.name);
    if (tool.inputSchema) inputSchemas.set(tool.name, tool.inputSchema);
  }

  return { available, inputSchemas };
}

function buildLocalToolCalls(available: Set<string>, accountId?: string): TrustLayerMcpCall[] {
  const calls: TrustLayerMcpCall[] = [];
  const addIfAvailable = (toolName: string, title: string, args: Record<string, unknown>) => {
    if (available.has(toolName)) calls.push({ toolName, title, args });
  };

  if (accountId) {
    const accountArgs = { account_id: accountId };
    addIfAvailable("sf_get_account", "ACCOUNT", accountArgs);
    addIfAvailable("sf_get_opportunities", "OPPORTUNITIES", { ...accountArgs, limit: 20 });
    addIfAvailable("sf_get_contacts", "CONTACTS", { ...accountArgs, limit: 20 });
    addIfAvailable("sf_get_cases", "CASES", { ...accountArgs, limit: 20 });
    addIfAvailable("sf_get_financial_accounts", "FINANCIAL ACCOUNTS", { ...accountArgs, limit: 20 });
    addIfAvailable("sf_get_news_alerts", "NEWS ALERTS", { ...accountArgs, limit: 10 });
    addIfAvailable("sf_get_tasks", "TASKS", { ...accountArgs, limit: 20 });
    return calls;
  }

  addIfAvailable("sf_get_pipeline_summary", "PIPELINE SUMMARY", {});
  addIfAvailable("sf_get_recent_activity", "RECENT ACTIVITY", { limit: 20 });
  addIfAvailable("sf_list_accounts", "ACCOUNTS", { limit: 20 });
  addIfAvailable("sf_get_news_alerts", "NEWS ALERTS", { limit: 10 });
  return calls;
}

function selectSoqlToolName(available: Set<string>): string | null {
  if (available.has("soqlQuery")) return "soqlQuery";
  if (available.has("sf_run_soql")) return "sf_run_soql";
  for (const toolName of available) {
    if (toolName.startsWith("soqlQuery")) return toolName;
  }
  for (const toolName of available) {
    if (toolName.startsWith("sf_run_soql")) return toolName;
  }
  return null;
}

type SoqlArgumentName = "query" | "q";

function buildSoqlToolCalls(
  toolName: string,
  accountId?: string,
  queryArgName: SoqlArgumentName = "query",
): TrustLayerMcpCall[] {
  const argsForQuery = (query: string) => ({ [queryArgName]: query });
  if (accountId) {
    const id = escapeSoqlLiteral(accountId);
    return [
      {
        toolName,
        title: "ACCOUNT",
        args: argsForQuery(
          `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website, BillingCity, BillingState, Type, Owner.Name FROM Account WHERE Id = '${id}' LIMIT 1`,
        ),
      },
      {
        toolName,
        title: "OPPORTUNITIES",
        args: argsForQuery(
          `SELECT Id, Name, Amount, StageName, CloseDate, IsClosed, IsWon, LastModifiedDate FROM Opportunity WHERE AccountId = '${id}' ORDER BY IsClosed ASC, CloseDate ASC LIMIT 20`,
        ),
      },
      {
        toolName,
        title: "CONTACTS",
        args: argsForQuery(
          `SELECT Id, Name, Title, Email, Phone FROM Contact WHERE AccountId = '${id}' ORDER BY LastModifiedDate DESC LIMIT 20`,
        ),
      },
      {
        toolName,
        title: "CASES",
        args: argsForQuery(
          `SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate FROM Case WHERE AccountId = '${id}' ORDER BY CreatedDate DESC LIMIT 20`,
        ),
      },
      {
        toolName,
        title: "RECENT ACTIVITY",
        args: argsForQuery(
          `SELECT Id, Subject, Status, ActivityDate, LastModifiedDate FROM Task WHERE WhatId = '${id}' ORDER BY LastModifiedDate DESC LIMIT 20`,
        ),
      },
    ];
  }

  return [
    {
      toolName,
      title: "PIPELINE SUMMARY",
      args: argsForQuery(
        "SELECT StageName, COUNT(Id) RecordCount, SUM(Amount) TotalAmount FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY StageName ASC",
      ),
    },
    {
      toolName,
      title: "OPEN OPPORTUNITIES",
      args: argsForQuery(
        "SELECT Id, Name, Account.Name, Amount, StageName, CloseDate FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate ASC LIMIT 20",
      ),
    },
    {
      toolName,
      title: "RECENT ACCOUNTS",
      args: argsForQuery(
        "SELECT Id, Name, Industry, AnnualRevenue, Type, LastModifiedDate FROM Account ORDER BY LastModifiedDate DESC LIMIT 20",
      ),
    },
  ];
}

function selectSoqlArgumentName(toolName: string, inputSchema?: unknown): SoqlArgumentName {
  if (hasInputProperty(inputSchema, "q")) return "q";
  if (hasInputProperty(inputSchema, "query")) return "query";
  if (toolName.startsWith("soqlQuery") && toolName !== "soqlQuery") return "q";
  return "query";
}

function hasInputProperty(inputSchema: unknown, propertyName: string): boolean {
  if (!inputSchema || typeof inputSchema !== "object") return false;
  const properties = (inputSchema as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") return false;
  return Object.prototype.hasOwnProperty.call(properties, propertyName);
}

function escapeSoqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\r\n]/g, " ");
}
