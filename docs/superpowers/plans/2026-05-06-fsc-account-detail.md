# FSC Account Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Financial Accounts, enhanced Cases, and Key Relationships sections to the account detail page at `/app/accounts/[id]/page.tsx`, backed by four new/updated fetch functions in `/lib/salesforce.ts`.

**Architecture:** All data fetching is server-side in a two-phase `Promise.allSettled` pattern. Phase 1 fetches account, opps, contacts, cases, financial accounts, and relationships in parallel. Phase 2 fans out `getFinancialAccountRoles` for each financial account. FSC functions catch all errors and return `[]` so non-FSC orgs degrade gracefully. Rendering uses native `<details>`/`<summary>` for role expansion — no client components needed.

**Tech Stack:** Next.js 14 (App Router, server components), TypeScript, Tailwind CSS, Salesforce REST API v59.0. No test framework installed — TypeScript (`npx tsc --noEmit`) and Next.js build (`npm run build`) serve as verification.

---

## File Map

| File | Change |
|---|---|
| `dashboard/lib/salesforce.ts` | Update `SFCase` + `getAccountCases`; add `SFFinancialAccount`, `SFFinancialAccountRole`, `SFAccountRelationship` interfaces and their fetch functions |
| `dashboard/app/accounts/[id]/page.tsx` | Two-phase fetch, enhanced Cases UI, new Financial Accounts section, new Key Relationships section |

---

## Task 1: Update `SFCase` interface and `getAccountCases`

**Files:**
- Modify: `dashboard/lib/salesforce.ts`

- [ ] **Step 1: Replace `SFCase` interface**

In `dashboard/lib/salesforce.ts`, replace:
```typescript
export interface SFCase {
  Id: string;
  CaseNumber: string;
  Subject: string | null;
  Status: string;
  Priority: string | null;
  CreatedDate: string;
}
```
With:
```typescript
export interface SFCase {
  Id: string;
  CaseNumber: string;
  Subject: string | null;
  Status: string;
  Priority: string | null;
  CreatedDate: string;
  ClosedDate: string | null;
  Description: string | null;
  Contact: { Name: string } | null;
  Owner: { Name: string } | null;
}
```

- [ ] **Step 2: Replace `getAccountCases` function body**

In `dashboard/lib/salesforce.ts`, replace the existing `getAccountCases` function:
```typescript
export async function getAccountCases(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFCase[]> {
  const safe = accountId.replace(/'/g, "\\'");
  return sfQuery<SFCase>(
    instanceUrl,
    accessToken,
    `SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate,
            ClosedDate, Description, Contact.Name, Owner.Name
     FROM Case WHERE AccountId = '${safe}' ORDER BY CreatedDate DESC LIMIT 20`
  );
}
```

- [ ] **Step 3: Verify TypeScript**

Run from `dashboard/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/salesforce.ts
git commit -m "feat: extend SFCase with ClosedDate, Description, Contact, Owner"
```

---

## Task 2: Add `SFFinancialAccount` interface and `getFinancialAccounts`

**Files:**
- Modify: `dashboard/lib/salesforce.ts`

- [ ] **Step 1: Add `SFFinancialAccount` interface**

Append to `dashboard/lib/salesforce.ts` (after the last existing interface, before `listAccounts`):
```typescript
export interface SFFinancialAccount {
  Id: string;
  Name: string;
  FinServ__FinancialAccountNumber__c: string | null;
  FinServ__FinancialAccountType__c: string | null;
  FinServ__Status__c: string | null;
  FinServ__Balance__c: number | null;
  FinServ__InterestRate__c: number | null;
  FinServ__APY__c: number | null;
  FinServ__OpenDate__c: string | null;
  FinServ__LoanAmount__c: number | null;
  FinServ__PrincipalBalance__c: number | null;
  FinServ__PaymentAmount__c: number | null;
  FinServ__PaymentDueDate__c: string | null;
  FinServ__Nickname__c: string | null;
  FinServ__HoldingCount__c: number | null;
  RecordType: { Name: string } | null;
}
```

- [ ] **Step 2: Add `getFinancialAccounts` function**

Append to `dashboard/lib/salesforce.ts`:
```typescript
export async function getFinancialAccounts(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFFinancialAccount[]> {
  const safe = accountId.replace(/'/g, "\\'");
  try {
    return await sfQuery<SFFinancialAccount>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinServ__FinancialAccountNumber__c, FinServ__FinancialAccountType__c,
              FinServ__Status__c, FinServ__Balance__c, FinServ__InterestRate__c, FinServ__APY__c,
              FinServ__OpenDate__c, FinServ__LoanAmount__c, FinServ__PrincipalBalance__c,
              FinServ__PaymentAmount__c, FinServ__PaymentDueDate__c, FinServ__Nickname__c,
              FinServ__HoldingCount__c, RecordType.Name
       FROM FinServ__FinancialAccount__c
       WHERE FinServ__PrimaryOwner__c = '${safe}'
       ORDER BY FinServ__Balance__c DESC NULLS LAST`
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/salesforce.ts
git commit -m "feat: add SFFinancialAccount interface and getFinancialAccounts"
```

---

## Task 3: Add `SFFinancialAccountRole` interface and `getFinancialAccountRoles`

**Files:**
- Modify: `dashboard/lib/salesforce.ts`

- [ ] **Step 1: Add `SFFinancialAccountRole` interface**

Append to `dashboard/lib/salesforce.ts`:
```typescript
export interface SFFinancialAccountRole {
  Id: string;
  Name: string;
  FinServ__Role__c: string | null;
  FinServ__Active__c: boolean;
  FinServ__RelatedAccount__c: string | null;
  FinServ__RelatedAccount__r: { Name: string } | null;
  FinServ__RelatedContact__c: string | null;
  FinServ__RelatedContact__r: { Name: string } | null;
}
```

- [ ] **Step 2: Add `getFinancialAccountRoles` function**

Append to `dashboard/lib/salesforce.ts`:
```typescript
export async function getFinancialAccountRoles(
  instanceUrl: string,
  accessToken: string,
  financialAccountId: string
): Promise<SFFinancialAccountRole[]> {
  const safe = financialAccountId.replace(/'/g, "\\'");
  try {
    return await sfQuery<SFFinancialAccountRole>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinServ__Role__c,
              FinServ__RelatedAccount__c, FinServ__RelatedAccount__r.Name,
              FinServ__RelatedContact__c, FinServ__RelatedContact__r.Name,
              FinServ__Active__c
       FROM FinServ__FinancialAccountRole__c
       WHERE FinServ__FinancialAccount__c = '${safe}'
       AND FinServ__Active__c = true`
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/salesforce.ts
git commit -m "feat: add SFFinancialAccountRole interface and getFinancialAccountRoles"
```

---

## Task 4: Add `SFAccountRelationship` interface and `getAccountRelationships`

**Files:**
- Modify: `dashboard/lib/salesforce.ts`

- [ ] **Step 1: Add `SFAccountRelationship` interface**

Append to `dashboard/lib/salesforce.ts`:
```typescript
export interface SFAccountRelationship {
  Id: string;
  FinServ__Active__c: boolean;
  FinServ__AssociationType__c: string | null;
  FinServ__Account__c: string;
  FinServ__Account__r: { Name: string } | null;
  FinServ__RelatedAccount__c: string;
  FinServ__RelatedAccount__r: { Name: string } | null;
  FinServ__Role__r: { Name: string } | null;
  FinServ__InverseRelationship__r: { FinServ__Role__r: { Name: string } | null } | null;
}
```

- [ ] **Step 2: Add `getAccountRelationships` function**

Append to `dashboard/lib/salesforce.ts`:
```typescript
export async function getAccountRelationships(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFAccountRelationship[]> {
  const safe = accountId.replace(/'/g, "\\'");
  try {
    return await sfQuery<SFAccountRelationship>(
      instanceUrl,
      accessToken,
      `SELECT Id,
              FinServ__Account__c, FinServ__Account__r.Name,
              FinServ__RelatedAccount__c, FinServ__RelatedAccount__r.Name,
              FinServ__AssociationType__c,
              FinServ__Role__r.Name,
              FinServ__InverseRelationship__r.FinServ__Role__r.Name,
              FinServ__Active__c
       FROM FinServ__AccountAccountRelation__c
       WHERE (FinServ__Account__c = '${safe}'
         OR FinServ__RelatedAccount__c = '${safe}')
       AND FinServ__Active__c = true`
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/salesforce.ts
git commit -m "feat: add SFAccountRelationship interface and getAccountRelationships"
```

---

## Task 5: Update page.tsx — imports and two-phase data fetch

**Files:**
- Modify: `dashboard/app/accounts/[id]/page.tsx`

- [ ] **Step 1: Update import statement**

In `dashboard/app/accounts/[id]/page.tsx`, replace the existing import block:
```typescript
import {
  getAccount,
  getAccountOpportunities,
  getAccountContacts,
  getAccountCases,
} from "@/lib/salesforce";
```
With:
```typescript
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
```

- [ ] **Step 2: Replace the `Promise.allSettled` call and result extraction**

In `dashboard/app/accounts/[id]/page.tsx`, replace:
```typescript
  const [account, opps, contacts, cases] = await Promise.allSettled([
    getAccount(session.instanceUrl, session.accessToken, id),
    getAccountOpportunities(session.instanceUrl, session.accessToken, id),
    getAccountContacts(session.instanceUrl, session.accessToken, id),
    getAccountCases(session.instanceUrl, session.accessToken, id),
  ]);

  // Redirect on session expiry
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
```
With:
```typescript
  const [account, opps, contacts, cases, financialAccountsResult, relationshipsResult] =
    await Promise.allSettled([
      getAccount(session.instanceUrl, session.accessToken, id),
      getAccountOpportunities(session.instanceUrl, session.accessToken, id),
      getAccountContacts(session.instanceUrl, session.accessToken, id),
      getAccountCases(session.instanceUrl, session.accessToken, id),
      getFinancialAccounts(session.instanceUrl, session.accessToken, id),
      getAccountRelationships(session.instanceUrl, session.accessToken, id),
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
      getFinancialAccountRoles(session.instanceUrl, session.accessToken, fa.Id)
    )
  );
  const rolesMap = new Map<string, SFFinancialAccountRole[]>();
  financialAccountList.forEach((fa, i) => {
    const result = rolesResults[i];
    rolesMap.set(fa.Id, result.status === "fulfilled" ? result.value : []);
  });
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/accounts/[id]/page.tsx
git commit -m "feat: two-phase parallel fetch for FSC data on account detail page"
```

---

## Task 6: Add helper functions and enhance Cases section UI

**Files:**
- Modify: `dashboard/app/accounts/[id]/page.tsx`

- [ ] **Step 1: Add helper functions**

In `dashboard/app/accounts/[id]/page.tsx`, add these helpers after the existing `formatDate` function (around line 20):

```typescript
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
```

- [ ] **Step 2: Update Cases section JSX**

In `dashboard/app/accounts/[id]/page.tsx`, replace the Cases section (the `{/* Cases */}` block) with:

```tsx
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
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/accounts/[id]/page.tsx
git commit -m "feat: enhance Cases section with colored status badge, contact, owner"
```

---

## Task 7: Add Financial Accounts section

**Files:**
- Modify: `dashboard/app/accounts/[id]/page.tsx`

- [ ] **Step 1: Build the group map and add Financial Accounts section JSX**

In `dashboard/app/accounts/[id]/page.tsx`, directly before the closing `</div>` of the main scroll area (the one wrapping all sections, before `{/* AI chat panel */}`), insert the Financial Accounts section:

First add the group-by logic just before the `return` statement (after the `rolesMap` construction):
```typescript
  // Group financial accounts by record type
  const faByType = new Map<string, SFFinancialAccount[]>();
  for (const fa of financialAccountList) {
    const type = fa.RecordType?.Name ?? "Other";
    const existing = faByType.get(type) ?? [];
    existing.push(fa);
    faByType.set(type, existing);
  }
```

Then add the Financial Accounts section JSX after the Cases section (before the closing `</div>` of the scroll container, before the `{/* AI chat panel */}` comment):

```tsx
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/accounts/[id]/page.tsx
git commit -m "feat: add Financial Accounts section with role expansion"
```

---

## Task 8: Add Key Relationships section

**Files:**
- Modify: `dashboard/app/accounts/[id]/page.tsx`

- [ ] **Step 1: Add Key Relationships section JSX**

In `dashboard/app/accounts/[id]/page.tsx`, directly after the Financial Accounts section (still before `{/* AI chat panel */}`), add:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/accounts/[id]/page.tsx
git commit -m "feat: add Key Relationships section to account detail page"
```

---

## Task 9: Full build verification

**Files:** none changed

- [ ] **Step 1: Run Next.js build**

From `dashboard/`:
```bash
npm run build
```
Expected: build completes with no type errors or fatal warnings. (Salesforce API errors are runtime-only and won't appear here.)

- [ ] **Step 2: If build fails, fix errors before continuing**

Common issues:
- Missing `"use client"` — not needed here; all components are server components
- Import not found — verify the export name in `salesforce.ts` matches the import in `page.tsx`
- Type mismatch — check that `rolesMap.get(fa.Id)` is typed as `SFFinancialAccountRole[] | undefined` and the `?? []` fallback is present

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: resolve build errors from FSC account detail changes"
```
