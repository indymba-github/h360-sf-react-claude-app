# FSC Account Detail Page — Design Spec
**Date:** 2026-05-06
**Status:** Approved

## Summary

Add Financial Services Cloud (FSC) data to the account detail page at `/app/accounts/[id]/page.tsx`. Three new/enhanced sections appear below the existing Opportunities and Contacts sections: an enhanced Cases section, a new Financial Accounts section, and a new Key Relationships section. All data is scoped to the account being viewed — no standalone routes.

---

## Data Layer (`/lib/salesforce.ts`)

### Updated: `SFCase`
Add four fields to the existing interface:
- `ClosedDate: string | null`
- `Description: string | null`
- `Contact: { Name: string } | null`
- `Owner: { Name: string } | null`

### Updated: `getAccountCases`
- Extend SELECT to include `ClosedDate`, `Description`, `Contact.Name`, `Owner.Name`
- Raise LIMIT from 10 → 20

### New interface: `SFFinancialAccount`
All fields from `FinServ__FinancialAccount__c`:
- `Id`, `Name`, `FinServ__FinancialAccountNumber__c`, `FinServ__FinancialAccountType__c`
- `FinServ__Status__c`, `FinServ__Balance__c`, `FinServ__InterestRate__c`, `FinServ__APY__c`
- `FinServ__OpenDate__c`, `FinServ__LoanAmount__c`, `FinServ__PrincipalBalance__c`
- `FinServ__PaymentAmount__c`, `FinServ__PaymentDueDate__c`, `FinServ__Nickname__c`
- `FinServ__HoldingCount__c`
- `RecordType: { Name: string } | null`

### New interface: `SFFinancialAccountRole`
Fields from `FinServ__FinancialAccountRole__c`:
- `Id`, `Name`, `FinServ__Role__c`, `FinServ__Active__c`
- `FinServ__RelatedAccount__c`, `FinServ__RelatedAccount__r: { Name: string } | null`
- `FinServ__RelatedContact__c`, `FinServ__RelatedContact__r: { Name: string } | null`

### New interface: `SFAccountRelationship`
Fields from `FinServ__AccountAccountRelation__c`:
- `Id`, `FinServ__Active__c`, `FinServ__AssociationType__c`
- `FinServ__Account__c`, `FinServ__Account__r: { Name: string } | null`
- `FinServ__RelatedAccount__c`, `FinServ__RelatedAccount__r: { Name: string } | null`
- `FinServ__Role__r: { Name: string } | null`
- `FinServ__InverseRelationship__r: { FinServ__Role__r: { Name: string } | null } | null`

### New function: `getFinancialAccounts(instanceUrl, accessToken, accountId)`
- Queries `FinServ__FinancialAccount__c WHERE FinServ__PrimaryOwner__c = '{accountId}' ORDER BY FinServ__Balance__c DESC NULLS LAST`
- Wraps entire call in try/catch — returns `[]` on any error (handles orgs without FSC installed)

### New function: `getFinancialAccountRoles(instanceUrl, accessToken, financialAccountId)`
- Queries `FinServ__FinancialAccountRole__c WHERE FinServ__FinancialAccount__c = '{financialAccountId}' AND FinServ__Active__c = true`
- Wraps in try/catch, returns `[]` on error

### New function: `getAccountRelationships(instanceUrl, accessToken, accountId)`
- Queries `FinServ__AccountAccountRelation__c WHERE (FinServ__Account__c = '{accountId}' OR FinServ__RelatedAccount__c = '{accountId}') AND FinServ__Active__c = true`
- Wraps in try/catch, returns `[]` on error

---

## Page Data Fetching (`/app/accounts/[id]/page.tsx`)

### Phase 1 — `Promise.allSettled` (6 queries in parallel)
```
account, opps, contacts, cases, financialAccounts, relationships
```
Session-expiry loop checks `account`, `opps`, `contacts`, `cases`. FSC functions swallow all errors and never throw `SF_SESSION_EXPIRED`, so they are excluded from the expiry check.

### Phase 2 — Roles fan-out
After Phase 1, fan out `getFinancialAccountRoles` for each financial account in parallel (`Promise.allSettled`). Build a `Map<financialAccountId, SFFinancialAccountRole[]>` for use during render.

---

## UI

### Page section order (after changes)
1. Details (unchanged)
2. Opportunities (unchanged)
3. Contacts (unchanged)
4. Cases (enhanced in place)
5. Financial Accounts (new)
6. Key Relationships (new)

All sections use the existing `bg-white rounded-xl border border-gray-200` card pattern with `px-5 py-4 border-b` headers and `divide-y divide-gray-100` rows.

### Cases Section (enhanced)
- Status badge now colored: New=blue, Working=yellow, Escalated=red, Closed=green
- Priority badge retains existing colors (High=red, Medium=yellow, Low=gray)
- Each row adds `Contact.Name` as a secondary line if present
- `Owner.Name` shown as tertiary text if present
- Layout structure unchanged

### Financial Accounts Section (new)
- Appears below Cases
- Grouped by `RecordType.Name` (e.g., "Checking", "Savings", "Investment", "Loan")
- Each group has a subheading; within each group, cards are in a responsive 2-column grid (1 column on mobile)
- **Each card shows:**
  - Name (or Nickname if Name is absent)
  - Account number masked to last 4 digits: `•••• 1234`
  - Balance as currency (large, prominent)
  - Status badge: Open=green, Closed=gray, other=gray
  - Interest Rate or APY labeled accordingly (whichever is non-null)
  - For loan types (RecordType.Name contains "Loan" or "Mortgage"): Loan Amount, Principal Balance, Payment Amount, Payment Due Date
- **Roles via `<details>`/`<summary>`:** "Show roles" at bottom of card; expands to list related person/account name and role label. Omitted entirely if no roles.
- **Empty state:** "No financial accounts found."

### Key Relationships Section (new)
- Appears below Financial Accounts
- `divide-y` list, same pattern as Contacts
- Each row shows:
  - Related account name (the *other* party — determined by comparing `FinServ__Account__c` vs current `accountId`)
  - Roles formatted as `"Role / Inverse Role"` (e.g., "Household Member / Member Of")
  - Association type if present
- **Empty state:** "No relationships found."

---

## Error Handling

- FSC functions catch all errors and return `[]` — standard orgs show empty states rather than crashing
- Non-FSC failures (Opportunities, Contacts, Cases) continue to fall through to the existing `Promise.allSettled` / empty-array pattern
- 401 on core queries redirects to login as before

---

## Out of Scope

- Financial Accounts are not displayed outside the account detail page
- No standalone Financial Accounts route or list view
- No client-side interactivity beyond native `<details>` expand for roles
