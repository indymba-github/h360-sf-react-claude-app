import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import {
  getAccount,
  getAccountOpportunities,
  getAccountContacts,
  getAccountCases,
  getFinancialAccounts,
  getFinancialAccountRoles,
  getAccountRelationships,
  type SFFinancialAccount,
  type SFFinancialAccountRole,
  type SFAccountRelationship,
} from "@/lib/salesforce";
import ChatPanel from "@/components/ChatPanel";

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function maskAccountNumber(acctNum: string | null): string {
  if (!acctNum) return "—";
  return `•••• ${acctNum.slice(-4)}`;
}

function caseStatusClass(status: string): string {
  switch (status) {
    case "New": return "bg-blue-50 text-blue-700";
    case "Working": return "bg-yellow-50 text-yellow-700";
    case "Escalated": return "bg-red-50 text-red-700";
    case "Closed": return "bg-green-50 text-green-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function faStatusClass(status: string | null): string {
  if (status === "Open") return "bg-green-50 text-green-700";
  return "bg-gray-100 text-gray-600";
}

function isLoanType(recordTypeName: string | null): boolean {
  if (!recordTypeName) return false;
  const name = recordTypeName.toLowerCase();
  return name.includes("loan") || name.includes("mortgage");
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-gray-400">{message}</div>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    redirect("/");
  }

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);
  const { id } = await params;

  const [account, opps, contacts, cases, financialAccountsResult, relationshipsResult] =
    await Promise.allSettled([
      getAccount(session.instanceUrl!, session.accessToken!, id),
      getAccountOpportunities(session.instanceUrl!, session.accessToken!, id),
      getAccountContacts(session.instanceUrl!, session.accessToken!, id),
      getAccountCases(session.instanceUrl!, session.accessToken!, id),
      getFinancialAccounts(session.instanceUrl!, session.accessToken!, id),
      getAccountRelationships(session.instanceUrl!, session.accessToken!, id),
    ]);

  // Redirect on session expiry (FSC functions catch all errors, so only check core queries)
  for (const result of [account, opps, contacts, cases]) {
    if (result.status === "rejected" && result.reason?.message === "SF_SESSION_EXPIRED") {
      redirect("/api/auth/login");
    }
  }

  const acct = account.status === "fulfilled" ? account.value : null;
  if (!acct) notFound();

  const opportunities = opps.status === "fulfilled" ? opps.value : [];
  const contactList = contacts.status === "fulfilled" ? contacts.value : [];
  const caseList = cases.status === "fulfilled" ? cases.value : [];
  const financialAccountList: SFFinancialAccount[] =
    financialAccountsResult.status === "fulfilled" ? financialAccountsResult.value : [];
  const relationshipList: SFAccountRelationship[] =
    relationshipsResult.status === "fulfilled" ? relationshipsResult.value : [];

  // Phase 2: fan out roles for each financial account
  const rolesResults = await Promise.allSettled(
    financialAccountList.map((fa) =>
      getFinancialAccountRoles(session.instanceUrl!, session.accessToken!, fa.Id)
    )
  );
  const rolesMap = new Map<string, SFFinancialAccountRole[]>();
  financialAccountList.forEach((fa, i) => {
    const result = rolesResults[i];
    rolesMap.set(fa.Id, result.status === "fulfilled" ? result.value : []);
  });

  const sfRecordUrl = `${session.instanceUrl}/lightning/r/Account/${acct.Id}/view`;

  // Group financial accounts by record type
  const faByType = new Map<string, SFFinancialAccount[]>();
  for (const fa of financialAccountList) {
    const type = fa.RecordType?.Name ?? "Other";
    const existing = faByType.get(type) ?? [];
    existing.push(fa);
    faByType.set(type, existing);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
          <a href="/accounts" className="hover:text-gray-600">Accounts</a>
          <span>/</span>
          <span className="text-gray-700 font-medium truncate max-w-xs">{acct.Name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{acct.Name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {acct.Type && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                  {acct.Type}
                </span>
              )}
              {acct.Industry && (
                <span className="text-sm text-gray-400">{acct.Industry}</span>
              )}
            </div>
          </div>
          <a
            href={sfRecordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            <ExternalLinkIcon />
            View in Salesforce
          </a>
        </div>

        {/* Detail grid */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Details</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Field label="Revenue" value={formatCurrency(acct.AnnualRevenue)} />
            <Field label="Employees" value={acct.NumberOfEmployees?.toLocaleString()} />
            <Field label="Phone" value={acct.Phone} />
            <Field
              label="Website"
              value={
                acct.Website ? (
                  <a href={acct.Website} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {acct.Website}
                  </a>
                ) : null
              }
            />
            <Field label="Location" value={[acct.BillingCity, acct.BillingState].filter(Boolean).join(", ")} />
            <Field label="Owner" value={acct.Owner?.Name} />
            <Field label="Created" value={formatDate(acct.CreatedDate)} />
            <Field label="Last Modified" value={formatDate(acct.LastModifiedDate)} />
          </dl>
          {acct.Description && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</dt>
              <dd className="text-sm text-gray-700 whitespace-pre-line">{acct.Description.slice(0, 500)}</dd>
            </div>
          )}
        </div>

        {/* Opportunities */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Opportunities{" "}
              {opportunities.length > 0 && (
                <span className="text-gray-400 font-normal">({opportunities.length})</span>
              )}
            </h2>
            <a
              href={`${sfRecordUrl}?ws=%2Flightning%2Fr%2FOpportunity%2FRelatedList%2FAccount%2F${acct.Id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
              title="View in Salesforce"
            >
              <ExternalLinkIcon />
            </a>
          </div>
          {opportunities.length === 0 ? (
            <EmptySection message="No opportunities found for this account." />
          ) : (
            <div className="divide-y divide-gray-100">
              {opportunities.map((o) => (
                <div key={o.Id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.Name}</p>
                    <p className="text-xs text-gray-400">
                      {o.StageName} · Close {formatDate(o.CloseDate)}
                      {o.Probability != null && ` · ${o.Probability}%`}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(o.Amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Contacts{" "}
              {contactList.length > 0 && (
                <span className="text-gray-400 font-normal">({contactList.length})</span>
              )}
            </h2>
            <a
              href={`${session.instanceUrl}/lightning/r/Account/${acct.Id}/related/Contacts/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
              title="View in Salesforce"
            >
              <ExternalLinkIcon />
            </a>
          </div>
          {contactList.length === 0 ? (
            <EmptySection message="No contacts found for this account." />
          ) : (
            <div className="divide-y divide-gray-100">
              {contactList.map((c) => (
                <div key={c.Id} className="flex items-start justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.Name}</p>
                    <p className="text-xs text-gray-400">
                      {[c.Title, c.Department].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    {c.Email && <p className="text-xs text-gray-500">{c.Email}</p>}
                    {c.Phone && <p className="text-xs text-gray-400">{c.Phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cases */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Cases{" "}
              {caseList.length > 0 && (
                <span className="text-gray-400 font-normal">({caseList.length})</span>
              )}
            </h2>
            <a
              href={`${session.instanceUrl}/lightning/r/Account/${acct.Id}/related/Cases/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
              title="View in Salesforce"
            >
              <ExternalLinkIcon />
            </a>
          </div>
          {caseList.length === 0 ? (
            <EmptySection message="No cases found for this account." />
          ) : (
            <div className="divide-y divide-gray-100">
              {caseList.map((c) => (
                <div key={c.Id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      #{c.CaseNumber} {c.Subject ?? "(no subject)"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(c.CreatedDate)}
                      {c.Contact?.Name && ` · ${c.Contact.Name}`}
                      {c.Owner?.Name && ` · ${c.Owner.Name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.Priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        c.Priority === "High" ? "bg-red-50 text-red-700" :
                        c.Priority === "Medium" ? "bg-yellow-50 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {c.Priority}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${caseStatusClass(c.Status)}`}>
                      {c.Status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Financial Accounts */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Financial Accounts{" "}
              {financialAccountList.length > 0 && (
                <span className="text-gray-400 font-normal">({financialAccountList.length})</span>
              )}
            </h2>
          </div>
          {financialAccountList.length === 0 ? (
            <EmptySection message="No financial accounts found." />
          ) : (
            <div className="px-5 py-4 space-y-6">
              {Array.from(faByType.entries()).map(([type, accounts]) => (
                <div key={type}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{type}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {accounts.map((fa) => {
                      const roles = rolesMap.get(fa.Id) ?? [];
                      const displayName = fa.Name || fa.FinServ__Nickname__c || "—";
                      const loan = isLoanType(fa.RecordType?.Name ?? null);
                      const rateLabel = fa.FinServ__APY__c != null ? "APY" : fa.FinServ__InterestRate__c != null ? "Rate" : null;
                      const rateValue = fa.FinServ__APY__c ?? fa.FinServ__InterestRate__c;
                      return (
                        <div key={fa.Id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{maskAccountNumber(fa.FinServ__FinancialAccountNumber__c)}</p>
                            </div>
                            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${faStatusClass(fa.FinServ__Status__c)}`}>
                              {fa.FinServ__Status__c ?? "—"}
                            </span>
                          </div>
                          <p className="text-xl font-bold text-gray-900 mb-3">
                            {formatCurrency(fa.FinServ__Balance__c)}
                          </p>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                            {fa.FinServ__FinancialAccountType__c && (
                              <>
                                <dt className="text-gray-400">Type</dt>
                                <dd className="text-gray-700">{fa.FinServ__FinancialAccountType__c}</dd>
                              </>
                            )}
                            {rateLabel && rateValue != null && (
                              <>
                                <dt className="text-gray-400">{rateLabel}</dt>
                                <dd className="text-gray-700">{(rateValue * 100).toFixed(2)}%</dd>
                              </>
                            )}
                            {loan && fa.FinServ__LoanAmount__c != null && (
                              <>
                                <dt className="text-gray-400">Loan Amount</dt>
                                <dd className="text-gray-700">{formatCurrency(fa.FinServ__LoanAmount__c)}</dd>
                              </>
                            )}
                            {loan && fa.FinServ__PrincipalBalance__c != null && (
                              <>
                                <dt className="text-gray-400">Principal</dt>
                                <dd className="text-gray-700">{formatCurrency(fa.FinServ__PrincipalBalance__c)}</dd>
                              </>
                            )}
                            {loan && fa.FinServ__PaymentAmount__c != null && (
                              <>
                                <dt className="text-gray-400">Payment</dt>
                                <dd className="text-gray-700">{formatCurrency(fa.FinServ__PaymentAmount__c)}</dd>
                              </>
                            )}
                            {loan && fa.FinServ__PaymentDueDate__c && (
                              <>
                                <dt className="text-gray-400">Due Date</dt>
                                <dd className="text-gray-700">{formatDate(fa.FinServ__PaymentDueDate__c)}</dd>
                              </>
                            )}
                          </dl>
                          {roles.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 select-none">
                                Show roles ({roles.length})
                              </summary>
                              <ul className="mt-2 space-y-1">
                                {roles.map((role) => {
                                  const personName =
                                    role.FinServ__RelatedContact__r?.Name ??
                                    role.FinServ__RelatedAccount__r?.Name ??
                                    "—";
                                  return (
                                    <li key={role.Id} className="flex items-center gap-2 text-xs text-gray-600">
                                      <span className="font-medium">{personName}</span>
                                      {role.FinServ__Role__c && (
                                        <span className="text-gray-400">· {role.FinServ__Role__c}</span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Relationships */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Key Relationships{" "}
              {relationshipList.length > 0 && (
                <span className="text-gray-400 font-normal">({relationshipList.length})</span>
              )}
            </h2>
          </div>
          {relationshipList.length === 0 ? (
            <EmptySection message="No relationships found." />
          ) : (
            <div className="divide-y divide-gray-100">
              {relationshipList.map((rel) => {
                const isSide1 = rel.FinServ__Account__c === acct.Id;
                const otherName = isSide1
                  ? rel.FinServ__RelatedAccount__r?.Name
                  : rel.FinServ__Account__r?.Name;
                const myRole = isSide1
                  ? rel.FinServ__Role__r?.Name
                  : rel.FinServ__InverseRelationship__r?.FinServ__Role__r?.Name;
                const theirRole = isSide1
                  ? rel.FinServ__InverseRelationship__r?.FinServ__Role__r?.Name
                  : rel.FinServ__Role__r?.Name;
                const rolesLabel = [myRole, theirRole].filter(Boolean).join(" / ");
                return (
                  <div key={rel.Id} className="flex items-start justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{otherName ?? "—"}</p>
                      {rolesLabel && (
                        <p className="text-xs text-gray-400">{rolesLabel}</p>
                      )}
                    </div>
                    {rel.FinServ__AssociationType__c && (
                      <span className="text-xs text-gray-400 shrink-0 ml-4">{rel.FinServ__AssociationType__c}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI chat panel */}
      <ChatPanel
        initialContext={`I'm looking at the account: ${acct.Name} (ID: ${acct.Id})`}
        initialMcpMode={effectiveMcpMode}
        hasMcpToken={!!session.mcpAccessToken}
      />
    </div>
  );
}
