# v2.4.0 Accounts Directory Cockpit Design

## Goal

Rework the main Accounts page into a more useful FINS directory cockpit. The page should help scan which customers are current, stale, incomplete, or worth opening next without becoming a full account-detail workspace.

## Current State

The Accounts page already supports:

- Server-backed search
- Industry filtering
- Sort by name, revenue, or last activity
- Client-side starring
- Paginated account cards
- Basic revenue, employee, and region details

The gap is signal. The page shows records, but it does not summarize the visible book or flag stale/incomplete account records.

## Recommended Approach

Keep the existing Account query and pagination. Add a pure helper that turns the currently visible accounts into:

- Directory summary metrics
- Display-ready account card metadata
- Client-side quick-filter behavior

Avoid new Salesforce queries in this pass. Financial account rollups and relationship value belong in a later account-list enrichment pass because they require heavier aggregation.

## Page Structure

### Directory Summary

Add a compact summary strip above the search controls:

- Total accounts
- Recently touched accounts
- Stale or no-activity accounts
- Accounts with missing key firmographic data

The summary should reflect the currently loaded account set while still showing the server total count.

### Quick Filters

Keep existing search, industry, and sort controls. Add client-side quick filters:

- All
- Starred
- Recently touched
- Needs attention

`Needs attention` means stale/no activity or multiple data gaps in the visible Account fields.

### Account Cards

Make cards more scannable:

- Show industry/name as today.
- Show market as city/state when available.
- Show last activity freshness.
- Show revenue/employees when available.
- Show a compact status line for stale/no activity or missing fields.

## Boundaries

- Do not add new Salesforce objects or queries.
- Do not hardcode IDs, credentials, org URLs, or demo-only account names.
- Keep card density moderate: more meaningful than today, but not a spreadsheet.
- Keep account detail and Home page behavior unchanged except for shared helper imports if needed.

## Testing

Add helper tests for:

- Summary metrics for recent, stale, and missing-data accounts.
- Display metadata for market, last activity, and status.
- Quick filters for starred, recent, and needs-attention views.
