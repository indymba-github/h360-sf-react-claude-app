import type { SFOpportunity } from "./salesforce";
import { formatCurrency } from "./format";

export type OpportunityPreview = {
  openOpportunities: SFOpportunity[];
  openPipelineTotal: number;
  closedCount: number;
  closedWonCount: number;
  closedLostCount: number;
  closedWonTotal: number;
  closedSummary: string | null;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function isClosed(stageName: string): boolean {
  return stageName.toLowerCase().startsWith("closed");
}

export function buildOpportunityPreview(opportunities: SFOpportunity[]): OpportunityPreview {
  const openOpportunities = opportunities.filter((item) => !isClosed(item.StageName));
  const closedOpportunities = opportunities.filter((item) => isClosed(item.StageName));
  const closedWon = closedOpportunities.filter((item) => item.StageName === "Closed Won");
  const closedLost = closedOpportunities.filter((item) => item.StageName === "Closed Lost");
  const closedWonTotal = closedWon.reduce((sum, item) => sum + (item.Amount ?? 0), 0);
  const details = [
    closedWon.length > 0 ? `${closedWon.length} won (${formatCurrency(closedWonTotal)})` : null,
    closedLost.length > 0 ? `${closedLost.length} lost` : null,
  ].filter(Boolean);

  return {
    openOpportunities,
    openPipelineTotal: openOpportunities.reduce((sum, item) => sum + (item.Amount ?? 0), 0),
    closedCount: closedOpportunities.length,
    closedWonCount: closedWon.length,
    closedLostCount: closedLost.length,
    closedWonTotal,
    closedSummary:
      closedOpportunities.length > 0
        ? `${plural(closedOpportunities.length, "closed opportunity", "closed opportunities")} not shown${details.length > 0 ? ` - ${details.join(", ")}` : ""}.`
        : null,
  };
}
