# v2.4.0 Home Command Center Design

## Goal

Rework the authenticated Home page (`/dashboard`) into a daily FINS command center. The page should answer "what needs my attention today?" first, then show book-performance dashboards as supporting context.

## Current State

The Home page already fetches useful data:

- Open pipeline rollup
- Recent account updates
- High-priority open cases
- Account count
- Closed won/lost count
- News alerts
- Pipeline stage summary
- Aging opportunities
- Today's events and tasks

The gap is meaning. The page shows metrics and charts, but it does not rank the work or explain what the dashboards imply.

## Recommended Approach

Keep the existing Salesforce data fetches and add a deterministic data-shaping helper that turns those records into:

- Daily focus items
- Book-health metrics
- Chart takeaways

Render those summaries above and around the existing charts. Avoid new Salesforce dependencies in the first pass.

## Home Page Structure

### Daily Focus

Place a focused action strip directly below the page heading. It should rank the day in this order:

1. High-priority service cases
2. Stalled or high-value pipeline
3. Today's meetings/tasks that need prep
4. Recent account movement

If nothing needs attention, show a calm "quiet book" state.

### Book Health

Replace the generic KPI grid with more meaningful book-health metrics:

- Open pipeline
- Stalled pipeline
- High-priority service load
- Accounts touched this week

Each metric should include a short detail line, not just a number.

### Dashboard Takeaways

Keep the existing charts, but add a compact takeaway row:

- Pipeline by stage: where open money is concentrated
- Forecast: what can move soon
- Aging pipeline: what is stuck

The chart panels should feel like work surfaces, not presentation slides.

### Existing Sections

Keep:

- News alerts, when present
- Pipeline charts
- Intelligence queue
- Today's agenda
- AI chat rail

Update copy and placement to support the daily command-center framing.

## Boundaries

- Do not add new Salesforce objects or queries in the first Home pass.
- Do not hardcode Salesforce IDs, org-specific values, credentials, or demo-only account names.
- Use existing theme tokens and layout style.
- Keep cards compact and scannable.
- Keep the main Accounts page out of scope for this pass.

## Testing

Add focused tests for the deterministic helper:

- Builds ranked focus items when service, pipeline, agenda, and recent account signals exist.
- Produces a quiet-state focus item when no signals exist.
- Builds book-health metrics with meaningful detail text.
- Builds chart takeaways from stage, forecast, and aging data.

Run focused helper tests, TypeScript, lint, build, and smoke tests before calling the pass complete.
