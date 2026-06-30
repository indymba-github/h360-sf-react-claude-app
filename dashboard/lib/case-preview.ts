import type { SFCase } from "./salesforce";

export type CasePreview = {
  visibleCases: SFCase[];
  hiddenCount: number;
  hiddenOpenCount: number;
  hiddenHighPriorityCount: number;
  hiddenSummary: string | null;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function isOpenCase(item: SFCase): boolean {
  return item.Status !== "Closed";
}

export function buildCasePreview(cases: SFCase[], visibleLimit = 3): CasePreview {
  const visibleCases = cases.slice(0, visibleLimit);
  const hiddenCases = cases.slice(visibleLimit);
  const hiddenOpenCount = hiddenCases.filter(isOpenCase).length;
  const hiddenHighPriorityCount = hiddenCases.filter((item) => item.Priority === "High").length;

  const details = [
    hiddenOpenCount > 0 ? plural(hiddenOpenCount, "open case", "open") : null,
    hiddenHighPriorityCount > 0 ? plural(hiddenHighPriorityCount, "high priority case", "high priority") : null,
  ].filter(Boolean);

  const hiddenSummary = hiddenCases.length > 0
    ? `${plural(hiddenCases.length, "more case")} not shown${details.length > 0 ? ` - ${details.join(", ")}` : ""}.`
    : null;

  return {
    visibleCases,
    hiddenCount: hiddenCases.length,
    hiddenOpenCount,
    hiddenHighPriorityCount,
    hiddenSummary,
  };
}
