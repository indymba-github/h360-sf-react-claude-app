# Risk Briefing Heuristics

How the Account Risk Briefing computes risk severity, why the design is deterministic, and how to customize the thresholds.

 ## The core idea: policy as code

The Account Risk Briefing surfaces engagement and pipeline risk on an account. Behind the briefing is a set of risk heuristics — rules that map raw Salesforce data to severity levels (Low, Medium, High) and contributing factors.

These rules live in a single file: `dashboard/lib/risk-heuristics.ts`. The bank's risk policy is captured here as plain TypeScript values. Editing a threshold immediately changes how the agent assesses risk across every account.

This is intentional. The agent is doing the data gathering and the natural-language summary, but the *judgment* — what counts as risky — is the bank's, not the model's. Three reasons this matters:

1. **Determinism.** Same data yields the same severity, every time. The agent doesn't improvise.
2. **Auditability.** When a banker asks "why is this account flagged?", the answer is in the file. The rules are visible, not buried in a model's weights.
3. **Customer ownership.** A bank's risk team can codify their actual policies. Different banks have different tolerance for engagement gaps, different definitions of "stalled," different lookback windows. The rules adapt to each customer; the framework stays the same.

For SE conversations: this is the answer to "how do I trust the AI's judgment?" The model isn't making the judgment. The customer's rules are. The model is applying them.

## How the briefing works

When a user asks for a risk briefing on an account, the flow is:

1. **Agent gathers data.** Using whatever tools are available in the current mode (Salesforce's hosted MCP via SOQL, the local MCP server's specific tools, or eventually Agentforce actions), the agent queries:
   - Tasks for the account (past-dated only)
   - Events for the account (past-dated only)
   - Contact count for the account
   - Open opportunities (`IsClosed = FALSE`)
   - Closed-Lost opportunities in the configured lookback window

2. **Agent applies the heuristics.** The system prompt includes the rules from `risk-heuristics.ts` verbatim. The agent computes each signal's contribution (Low, Medium, High) and rolls them up by the defined logic.

3. **Agent calls the render tool.** With the structured assessment — severity, summary, metrics, contributing factors — the agent calls `render_account_risk_briefing`. The tool packages this into a render directive; the frontend displays the briefing card.

The render tool itself does **no fetching and no computing**. It's a pure UI surface. The agent does all the analysis, guided by the rules.

## The two risk dimensions

### Engagement Risk

Measures how actively the relationship is being maintained.

| Signal | What it measures | Data source |
|---|---|---|
| Signal A | Days since last past-dated activity | Tasks + Events |
| Signal B | Activities (Tasks + Events) in the last 90 days | Tasks + Events |
| Signal C | Contact count on the account | Contacts |

Each signal independently contributes Low, Medium, or High. The overall Engagement severity is computed by roll-up:

- If **any** signal is High → overall High
- If **two or more** signals are Medium (and none High) → overall Medium
- Otherwise → Low

### Pipeline Risk

Measures whether revenue momentum is healthy.

| Signal | What it measures | Data source |
|---|---|---|
| Signal D | Open opportunity coverage (any vs. zero with recent losses) | Opportunities |
| Signal E | Stalled opportunity ratio (unchanged in 30+ days) | Open Opportunities |
| Signal F | Recent loss volume (closed-lost in last 180 days) | Opportunities |
| Signal G | Average days since last opportunity update | Open Opportunities |

Roll-up logic is the same: any High → overall High; two+ Medium → overall Medium; otherwise Low.

## Customizing the thresholds

The thresholds live in `dashboard/lib/risk-heuristics.ts`. The file exports two constant objects: `ENGAGEMENT_HEURISTICS` and `PIPELINE_HEURISTICS`. Each property maps to one of the signals above. Edit a value, save, restart the dashboard, and the agent immediately applies the new policy.

### What each threshold controls

**`ENGAGEMENT_HEURISTICS`:**

- `daysSinceLastActivity.lowMax` — max days for Signal A to score Low. Default: 30. Decrease for stricter engagement standards (e.g., "we expect contact every 2 weeks").
- `daysSinceLastActivity.mediumMax` — max days for Signal A to score Medium (above this is High). Default: 60.
- `activitiesLast90Days.lowMin` — minimum activity count in 90 days to score Low. Default: 5. Decrease if the bank's typical cadence is lower.
- `activitiesLast90Days.mediumMin` — minimum activity count in 90 days to score Medium (below is High). Default: 2.
- `contactCount.lowMin` — minimum contacts to score Low. Default: 3. Increase if the bank emphasizes multi-threaded relationships.
- `contactCount.mediumMin` — minimum contacts to score Medium (below is High). Default: 2.

**`PIPELINE_HEURISTICS`:**

- `openOpportunityCoverage.lossesLookbackDays` — how far back to look for recent closed-lost when no open opps exist. Default: 180.
- `stalledOppRatio.stalledThresholdDays` — open opps unchanged for this many days count as "stalled." Default: 30. Increase for slower-moving sales cycles, decrease for faster ones.
- `stalledOppRatio.mediumThreshold` — ratio of stalled-to-open opps that triggers Medium. Default: 0.25 (25%).
- `stalledOppRatio.highThreshold` — ratio that triggers High. Default: 0.50 (50%).
- `recentLossVolume.lookbackDays` — how far back to count closed-lost opportunities. Default: 180.
- `avgDaysSinceOppUpdate.lowMax` — average days since opp update that still scores Low. Default: 30.
- `avgDaysSinceOppUpdate.mediumMax` — average days that scores Medium (above is High). Default: 60.

### How to edit and verify

1. Open `dashboard/lib/risk-heuristics.ts`.
2. Edit the threshold values. The file is heavily commented; each line indicates what it controls.
3. Save the file.
4. Restart the dashboard:
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
cd dashboard && npm run dev
5. Ask the AI Assistant for a risk briefing on a known account. The new thresholds take effect immediately.

### Worked example: tightening engagement standards

Suppose the bank's risk team says: "We want any account untouched for more than two weeks to flag as elevated risk."

1. Open `dashboard/lib/risk-heuristics.ts`.
2. Change `daysSinceLastActivity.lowMax` from `30` to `14`.
3. Save and restart.
4. Find an account whose "Days Since Touch" was, say, 22. Before the change, that account's Engagement scored Low. After the change, the same data scores Medium — and the briefing now shows a contributing factor: "Last touchpoint was 22 days ago."

Same data, same agent, different policy → different result. Predictable and explainable.

### Worked example: looser pipeline standards for long sales cycles

Suppose the bank's commercial lending team has 90-day sales cycles. The default 30-day stalled threshold flags too aggressively.

1. Change `stalledOppRatio.stalledThresholdDays` from `30` to `90`.
2. Save and restart.
3. Opportunities now need to go 90+ days without modification to count as stalled. Pipeline severity becomes much more forgiving — appropriate for the team's actual cadence.

## What's NOT yet configurable

The current architecture covers tuning **thresholds within the existing signals**. Some things require code changes, not just config edits:

- **New signals.** Adding a brand-new risk signal (e.g., "credit utilization above 80%") requires extending the heuristics file's type definition, adding the data-gathering instruction to the system prompt, and updating the agent's roll-up logic.
- **New risk dimensions.** The briefing currently has two dimensions (Engagement, Pipeline). Adding a third (e.g., Compliance Risk, Credit Risk) requires changes to the briefing component, the render tool's input schema, and the system prompt.
- **Different roll-up rules.** The "any High → High; two+ Medium → Medium" logic is currently fixed. Changing to (say) a weighted scoring model would require updating both the system prompt and the heuristics file's documentation.
- **Per-account-type rules.** Right now the same rules apply to all accounts. Differentiating (e.g., stricter rules for high-value accounts) would require adding account-type detection to the agent's process.

These are all reasonable extensions. None are far reaches architecturally. The current configurability is a starting point, not a ceiling.

## Demo notes for SE conversations

When showing this to customers:

- **Open the file on screen.** Don't just describe it. The visual of `lowMax: 30` is more persuasive than any slide.
- **Make a live edit.** Change a value, restart, show the same account scoring differently. Takes 90 seconds. Lands the customizability story like nothing else.
- **Frame it as "policy as code."** This phrasing resonates with risk teams who think in terms of policy, governance, and audit.
- **Emphasize "the agent applies the bank's rules, not its own."** This addresses the trust concern directly. The model is not making the call — the customer's rules are.
- **Point out that the rules are visible.** Compared to a black-box ML risk model, having every rule readable in 50 lines of TypeScript is itself a feature.

# Example Code Block
export const ENGAGEMENT_HEURISTICS: EngagementHeuristics = {
  daysSinceLastActivity: {
    // Max days for an account to score LOW on Signal A.
    // Decrease for stricter engagement standards (e.g., 14 = 
    // "we expect contact every 2 weeks"). Increase if the 
    // typical relationship cadence is longer.
    lowMax: 30,
    // Max days to score MEDIUM. Above this scores HIGH.
    // Typically 2x lowMax.
    mediumMax: 60,
  },
  activitiesLast90Days: {
    // Minimum activity count in 90 days to score LOW.
    // Increase if the bank emphasizes high-touch relationships.
    lowMin: 5,
    // Minimum activity count to score MEDIUM. Below scores HIGH.
    mediumMin: 2,
  },
  contactCount: {
    // Minimum contacts on account to score LOW.
    // Increase if the bank wants to surface single-threaded
    // relationship risk more aggressively (e.g., 5).
    lowMin: 3,
    // Minimum contacts to score MEDIUM. Below scores HIGH.
    mediumMin: 2,
  },
};

export const PIPELINE_HEURISTICS: PipelineHeuristics = {
  openOpportunityCoverage: {
    // How far back to look for closed-lost opps when an account
    // has zero open opps. Sets the window for "recent losses 
    // matter."
    lossesLookbackDays: 180,
  },
  stalledOppRatio: {
    // Open opps unchanged for this many days are "stalled".
    // Increase for long sales cycles (commercial lending, 
    // complex deals). Decrease for fast-moving products 
    // (consumer accounts).
    stalledThresholdDays: 30,
    // Ratio of stalled-to-open opps that triggers MEDIUM.
    // 0.25 = "if a quarter of open opps are stalled, that's 
    // medium risk."
    mediumThreshold: 0.25,
    // Ratio that triggers HIGH.
    // 0.50 = "if half or more of open opps are stalled, 
    // that's serious."
    highThreshold: 0.50,
  },
  recentLossVolume: {
    // How far back to count closed-lost opportunities.
    // Default 180 days = looking at the prior half-year for 
    // trends.
    lookbackDays: 180,
  },
  avgDaysSinceOppUpdate: {
    // Average days since open opps were last modified that 
    // still scores LOW.
    lowMax: 30,
    // Average days to score MEDIUM. Above scores HIGH.
    mediumMax: 60,
  },
};