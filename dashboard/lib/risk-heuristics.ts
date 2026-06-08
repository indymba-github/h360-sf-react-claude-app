/**
 * Risk Briefing Heuristics
 *
 * This file is the bank's risk policy as code. It defines the thresholds and
 * rules the AI agent uses to assess Engagement Risk and Pipeline Risk for any
 * Salesforce account. Editing values here is the only change required to retune
 * risk sensitivity for your org — no other files need to change.
 *
 * HOW IT WORKS
 * The agent gathers raw account data (activities, contacts, opportunities) and
 * then applies these rules deterministically: same data always yields the same
 * severity and the same contributing factors. The agent writes one natural-
 * language summary sentence per dimension, but severity, metrics, and factors
 * are fully mechanical outputs of this config.
 *
 * SEVERITY SIGNALS
 * Each dimension is assessed across several independent signals. Each signal
 * independently resolves to Low, Medium, or High based on the thresholds below.
 *
 * ROLL-UP RULE (same for both Engagement and Pipeline)
 *   • Any signal is High  → overall severity is High
 *   • Two or more signals are Medium, none High → overall is Medium
 *   • Otherwise → Low
 *
 * TUNING GUIDANCE
 * Raise thresholds to make the system more lenient (fewer Medium/High results).
 * Lower them to make it more sensitive. Consider your org's typical activity
 * cadence when calibrating — what's "healthy" at a high-touch wealth management
 * firm differs from a transactional lending book.
 *
 * After editing, restart the dashboard dev server. No rebuild required for the
 * MCP server — these values only affect the frontend system prompt and the
 * route-level render tool handler.
 */

export type SignalSeverity = 'low' | 'medium' | 'high'

export type EngagementHeuristics = {
  /**
   * Signal A — Days since the most recent past-dated Task or Event on the account.
   * Measures recency of the last direct touchpoint with the client.
   * Future-dated activities are excluded (they haven't happened yet).
   * Accounts with no recorded activities at all are treated as High.
   */
  daysSinceLastActivity: {
    // Accounts touched within this many days are considered well-engaged.
    // Raise if your RMs have longer natural cadence (e.g., quarterly clients → 90).
    lowMax: number

    // Accounts between lowMax+1 and mediumMax days since last touch get a Medium signal.
    // Above mediumMax → High. Raise to widen the "watch" band before escalating to High.
    mediumMax: number
  }

  /**
   * Signal B — Count of past-dated activities (Tasks + Events) in the trailing 90 days.
   * Measures engagement frequency, not just recency. A single recent call is not the
   * same as a consistently active relationship.
   */
  activitiesLast90Days: {
    // Accounts with at least this many activities in 90 days are considered healthy.
    // Lower for high-touch books; raise for accounts with naturally sparse interaction.
    lowMin: number

    // Accounts with at least this many but fewer than lowMin get a Medium signal.
    // Below mediumMin → High. Raise mediumMin to catch thin engagement earlier.
    mediumMin: number
  }

  /**
   * Signal C — Number of contacts on the account record.
   * Single-threaded relationships are fragile: if the one contact leaves or goes
   * unresponsive, the bank loses its foothold entirely.
   */
  contactCount: {
    // Accounts with at least this many contacts are considered well-covered.
    // Lower for smaller clients where 2 contacts is genuinely good coverage.
    lowMin: number

    // Exactly mediumMin contacts (but fewer than lowMin) → Medium signal.
    // Fewer than mediumMin → High. Tune based on how aggressively you want to
    // flag single-contact accounts.
    mediumMin: number
  }
}

export type PipelineHeuristics = {
  /**
   * Signal D — Open opportunity coverage.
   * Answers: does this account have any active pipeline at all?
   * An account with no open opps is concerning; the degree of concern depends on
   * whether there were recent losses (which could explain the gap).
   */
  openOpportunityCoverage: {
    // How far back to look for closed-lost opportunities when there are no open opps.
    // Raise to give more runway after a loss before flagging; lower to flag sooner.
    // Used in both Signal D and Signal F — they share the same lookback window.
    lossesLookbackDays: number
    // Scoring: 1+ open opps → Low. 0 open + 0 recent losses → Medium.
    //          0 open + 1+ recent losses → High. (Not tunable — these are the three states.)
  }

  /**
   * Signal E — Stalled opportunity ratio.
   * Answers: of the open opportunities, how many have gone quiet?
   * A "stalled" opp is one whose LastModifiedDate hasn't changed in stalledThresholdDays.
   * Ratio = stalled count / total open count. Only evaluated when open opps exist.
   */
  stalledOppRatio: {
    // An open opportunity not updated in this many days is considered stalled.
    // Lower to catch drift earlier; raise for orgs where long sales cycles are normal.
    stalledThresholdDays: number

    // Ratio at or above this level triggers a Medium signal (e.g., 0.25 = 1 of 4 stalled).
    // Lower to be more sensitive to any stall; raise to only flag significant stall rates.
    mediumThreshold: number

    // Ratio above this level triggers a High signal (e.g., 0.50 = majority stalled).
    // Must be greater than mediumThreshold.
    highThreshold: number
  }

  /**
   * Signal F — Recent loss volume.
   * Answers: how many opportunities have been lost in the recent window?
   * Even one loss on an account is a yellow flag; two or more is a red flag.
   * Uses the same lookbackDays window as openOpportunityCoverage.lossesLookbackDays.
   */
  recentLossVolume: {
    // How far back to look for closed-lost opportunities.
    // Shorter window = stricter (only recent losses count); longer = more lenient.
    // Should match openOpportunityCoverage.lossesLookbackDays for consistent scoring.
    lookbackDays: number
    // Scoring: 0 losses → Low. 1 loss → Medium. 2+ losses → High. (Not tunable.)
  }

  /**
   * Signal G — Average days since last opportunity update (across all open opps).
   * Complements Signal E: where E is about proportion stalled, G is about the
   * overall freshness of the pipeline. An account with many open opps that were
   * all last touched 45 days ago has a different risk profile than one touched yesterday.
   * Only evaluated when open opps exist.
   */
  avgDaysSinceOppUpdate: {
    // Open opp pipelines updated within this many days on average → Low signal.
    // Raise for orgs with longer natural sales cycle update frequency.
    lowMax: number

    // Average between lowMax and mediumMax days since update → Medium signal.
    // Above mediumMax → High. Raise mediumMax to widen the "watch" band.
    mediumMax: number
  }
}

export const ENGAGEMENT_HEURISTICS: EngagementHeuristics = {
  daysSinceLastActivity: {
    lowMax: 30,    // Touched within a month → healthy
    mediumMax: 60, // 31–60 days → watch; 61+ days (or no activity) → at risk
  },
  activitiesLast90Days: {
    lowMin: 5,    // 5+ activities in 90 days → active relationship
    mediumMin: 2, // 2–4 → thin but present; 0–1 → at risk
  },
  contactCount: {
    lowMin: 3,    // 3+ contacts → multi-threaded
    mediumMin: 2, // 2 → narrow; 0–1 → single-threaded (fragile)
  },
}

export const PIPELINE_HEURISTICS: PipelineHeuristics = {
  openOpportunityCoverage: {
    lossesLookbackDays: 180, // Look back 6 months for losses when pipeline is empty
  },
  stalledOppRatio: {
    stalledThresholdDays: 30, // Opp not touched in 30+ days = stalled
    mediumThreshold: 0.25,    // ≥25% stalled → Medium signal
    highThreshold: 0.50,      // >50% stalled → High signal
  },
  recentLossVolume: {
    lookbackDays: 180, // Count losses in the past 6 months
  },
  avgDaysSinceOppUpdate: {
    lowMax: 30,    // Pipeline updated within 30 days on average → healthy
    mediumMax: 60, // 30–60 days avg → watch; 60+ days → stagnant
  },
}

/**
 * Produce natural-language heuristics text for injection into the
 * system prompt. The agent reads this and applies the rules
 * deterministically when computing a risk briefing.
 */
export function heuristicsToPromptText(): string {
  const e = ENGAGEMENT_HEURISTICS
  const p = PIPELINE_HEURISTICS

  return `ENGAGEMENT RISK HEURISTICS (the bank's policy):

Signal A — Days since last past-dated activity (Task or Event):
  • 0 to ${e.daysSinceLastActivity.lowMax} days → LOW
  • ${e.daysSinceLastActivity.lowMax + 1} to ${e.daysSinceLastActivity.mediumMax} days → MEDIUM
  • More than ${e.daysSinceLastActivity.mediumMax} days → HIGH
  • No past-dated activity on record → HIGH

Signal B — Past-dated activities in last 90 days:
  • ${e.activitiesLast90Days.lowMin} or more → LOW
  • ${e.activitiesLast90Days.mediumMin} to ${e.activitiesLast90Days.lowMin - 1} → MEDIUM
  • Fewer than ${e.activitiesLast90Days.mediumMin} → HIGH

Signal C — Contact count on the account:
  • ${e.contactCount.lowMin} or more → LOW
  • ${e.contactCount.mediumMin} contacts → MEDIUM
  • Fewer than ${e.contactCount.mediumMin} → HIGH

Engagement severity roll-up:
  • If ANY signal is HIGH → overall severity is HIGH
  • If TWO OR MORE signals are MEDIUM (none HIGH) → overall is MEDIUM
  • Otherwise → LOW

PIPELINE RISK HEURISTICS (the bank's policy):

Signal D — Open opportunity coverage:
  • 1 or more open opportunities → LOW
  • Zero open AND zero closed-lost in last ${p.openOpportunityCoverage.lossesLookbackDays} days → MEDIUM
  • Zero open AND 1+ closed-lost in last ${p.openOpportunityCoverage.lossesLookbackDays} days → HIGH

Signal E — Stalled opportunity ratio (only if there are open opps):
  • A "stalled" opp is one not modified in ${p.stalledOppRatio.stalledThresholdDays}+ days
  • Ratio = stalled count / total open count
  • Ratio < ${p.stalledOppRatio.mediumThreshold} → LOW
  • Ratio ${p.stalledOppRatio.mediumThreshold} to ${p.stalledOppRatio.highThreshold} → MEDIUM
  • Ratio above ${p.stalledOppRatio.highThreshold} → HIGH

Signal F — Recent loss volume (closed-lost in last ${p.recentLossVolume.lookbackDays} days):
  • 0 losses → LOW
  • 1 loss → MEDIUM
  • 2 or more losses → HIGH

Signal G — Average days since last opportunity update (only if there are open opps):
  • Less than ${p.avgDaysSinceOppUpdate.lowMax} days → LOW
  • ${p.avgDaysSinceOppUpdate.lowMax} to ${p.avgDaysSinceOppUpdate.mediumMax} days → MEDIUM
  • More than ${p.avgDaysSinceOppUpdate.mediumMax} days → HIGH

Pipeline severity roll-up:
  • If ANY signal is HIGH → overall severity is HIGH
  • If TWO OR MORE signals are MEDIUM (none HIGH) → overall is MEDIUM
  • Otherwise → LOW`
}
