# v2.5.0 Home Relationship Dashboard Design

## Goal

Replace the low-signal Home dashboard graphs with relationship-management views. The Home dashboard should help answer: where is relationship attention needed, what service pressure exists, and where is open pipeline concentrated?

## Current State

The `v2.4.0` Home page improved framing with daily focus, book-health metrics, and dashboard takeaways. The underlying chart area still contains:

- Pipeline by stage bar chart
- Forecast by close date donut
- Aging pipeline bar chart

The pipeline stage view is useful but should be a dollar-allocation pie. The forecast and aging charts are pipeline-management artifacts and are not useful enough for relationship-management work.

## Recommended Approach

Keep the existing Home data and add two lightweight Account aggregate counts:

- Accounts touched in the last 30 days
- Accounts stale or missing activity

Then replace the dashboard chart area with:

1. **Pipeline Allocation Pie**
   - Slices by stage
   - Percent of total open pipeline dollars
   - Amount and opportunity count per stage

2. **Relationship Coverage**
   - Recently touched accounts
   - Stale/no-activity accounts
   - Accounts not represented in either bucket

3. **Service Pressure**
   - High-priority/open case pressure by account using the existing case signal data

4. **Next Relationship Actions**
   - Worklist-style actions derived from cases, stale relationship coverage, agenda items, and recent account movement

## Boundaries

- Do not add financial-account rollups in this pass.
- Do not hardcode Salesforce IDs, credentials, org URLs, or demo account names.
- Keep the dashboard compact and operational; avoid decorative charting.
- Keep the existing daily focus, book-health, news, intelligence queue, agenda, and chat rail.

## Testing

Add deterministic helper tests for:

- Pipeline stage allocation percentages by open pipeline dollars.
- Relationship coverage summary from total/recent/stale counts.
- Service pressure rows from high-priority case signals.
- Next action ranking across service, stale coverage, agenda, and recent movement.
