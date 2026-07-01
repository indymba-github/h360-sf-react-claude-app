"use client";

import dynamic from "next/dynamic";
import type { HomeRelationshipDashboard as HomeRelationshipDashboardModel } from "@/lib/home-relationship-dashboard";
import type { SFPipelineStage } from "@/lib/salesforce";

const PipelineChart = dynamic(() => import("@/components/PipelineChart"), { ssr: false });

const COVERAGE_COLORS: Record<HomeRelationshipDashboardModel["coverage"]["segments"][number]["id"], string> = {
  recent: "var(--color-success)",
  stale: "var(--color-stall)",
  unclassified: "var(--color-ink-soft)",
};

function PanelKicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "9px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-ink-soft)",
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  );
}

function Panel({
  kicker,
  title,
  detail,
  children,
}: {
  kicker: string;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", padding: "14px 16px", minHeight: "100%" }}>
      <PanelKicker>{kicker}</PanelKicker>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 500, color: "var(--color-ink)", lineHeight: 1.1 }}>
          {title}
        </h3>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)", lineHeight: 1.4, maxWidth: 320 }}>
          {detail}
        </p>
      </div>
      {children}
    </section>
  );
}

function CoveragePanel({ summary }: { summary: HomeRelationshipDashboardModel }) {
  return (
    <Panel
      kicker="Relationship coverage"
      title={`${summary.coverage.totalCount} relationships`}
      detail={summary.coverage.takeaway}
    >
      <div style={{ display: "flex", height: 10, overflow: "hidden", border: "0.5px solid var(--color-border)", marginBottom: 12 }}>
        {summary.coverage.segments.map((segment) => (
          <span
            key={segment.id}
            aria-hidden="true"
            style={{
              width: `${segment.percent}%`,
              minWidth: segment.count > 0 ? 8 : 0,
              background: COVERAGE_COLORS[segment.id],
            }}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
        {summary.coverage.segments.map((segment) => (
          <div key={segment.id} style={{ display: "grid", gridTemplateColumns: "10px minmax(0, 1fr)", alignItems: "start", gap: 7 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, background: COVERAGE_COLORS[segment.id], marginTop: 5 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--color-ink)", lineHeight: 1 }}>
                  {segment.percent}%
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)" }}>
                  {segment.count}
                </p>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {segment.label}
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", marginTop: 2 }}>
                {segment.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ServicePressurePanel({ summary }: { summary: HomeRelationshipDashboardModel }) {
  return (
    <Panel
      kicker="Service pressure"
      title={`${summary.servicePressure.rows.length} accounts`}
      detail={summary.servicePressure.takeaway}
    >
      {summary.servicePressure.rows.length === 0 ? (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)", lineHeight: 1.45 }}>
          No high-priority service pressure is visible.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {summary.servicePressure.rows.map((row) => {
            const content = (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "0.5px solid var(--color-border)" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--color-ink)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.accountName}
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.latestSubject} · {row.latestStatus}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--color-stall)", lineHeight: 1 }}>
                    {row.caseCount}
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-soft)", marginTop: 3 }}>
                    Cases
                  </p>
                </div>
              </div>
            );

            return row.href ? (
              <a key={row.accountId ?? row.accountName} href={row.href} style={{ color: "inherit", textDecoration: "none" }}>
                {content}
              </a>
            ) : (
              <div key={row.accountId ?? row.accountName}>{content}</div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function NextActionsPanel({ summary }: { summary: HomeRelationshipDashboardModel }) {
  const primaryAction = summary.nextActions[0];

  return (
    <Panel
      kicker="Next relationship actions"
      title={`${summary.nextActions.length} moves`}
      detail={primaryAction?.detail ?? "No urgent relationship action is visible."}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {summary.nextActions.map((action, index) => {
          const content = (
            <div style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 11, padding: "10px 0", borderTop: "0.5px solid var(--color-border)" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", paddingTop: 2 }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--color-accent-text)", marginBottom: 4 }}>
                  {action.label}
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--color-ink)", lineHeight: 1.2 }}>
                  {action.title}
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)", lineHeight: 1.45, marginTop: 4 }}>
                  {action.detail}
                </p>
              </div>
            </div>
          );

          return action.href ? (
            <a key={action.id} href={action.href} style={{ color: "inherit", textDecoration: "none" }}>
              {content}
            </a>
          ) : (
            <div key={action.id}>{content}</div>
          );
        })}
      </div>
    </Panel>
  );
}

export default function HomeRelationshipDashboard({
  summary,
  pipelineStages,
}: {
  summary: HomeRelationshipDashboardModel;
  pipelineStages: SFPipelineStage[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 6 }}>
        <Panel
          kicker="Pipeline allocation"
          title="Open dollars by stage"
          detail={summary.pipeline.takeaway}
        >
          <PipelineChart stages={pipelineStages} />
        </Panel>
        <CoveragePanel summary={summary} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 6 }}>
        <ServicePressurePanel summary={summary} />
        <NextActionsPanel summary={summary} />
      </div>
    </div>
  );
}
