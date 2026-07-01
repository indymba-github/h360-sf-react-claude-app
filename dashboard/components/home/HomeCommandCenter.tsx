import type { HomeCommandCenter as HomeCommandCenterModel, HomeFocusTone } from "@/lib/home-command-center";

function toneStyles(tone: HomeFocusTone): { border: string; background: string; label: string; value: string } {
  if (tone === "critical") {
    return {
      border: "color-mix(in srgb, var(--color-danger) 38%, var(--color-border))",
      background: "color-mix(in srgb, var(--color-danger) 7%, var(--color-surface))",
      label: "var(--color-danger)",
      value: "var(--color-danger)",
    };
  }

  if (tone === "watch") {
    return {
      border: "color-mix(in srgb, var(--color-stall) 34%, var(--color-border))",
      background: "color-mix(in srgb, var(--color-stall) 7%, var(--color-surface))",
      label: "var(--color-stall)",
      value: "var(--color-stall)",
    };
  }

  if (tone === "momentum") {
    return {
      border: "color-mix(in srgb, var(--color-success) 34%, var(--color-border))",
      background: "color-mix(in srgb, var(--color-success) 7%, var(--color-surface))",
      label: "var(--color-success)",
      value: "var(--color-success)",
    };
  }

  if (tone === "prep") {
    return {
      border: "color-mix(in srgb, var(--color-accent) 34%, var(--color-border))",
      background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
      label: "var(--color-accent-text)",
      value: "var(--color-accent-text)",
    };
  }

  return {
    border: "var(--color-border)",
    background: "var(--color-surface)",
    label: "var(--color-ink-soft)",
    value: "var(--color-ink)",
  };
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "9px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-ink-soft)",
        marginBottom: 8,
      }}
    >
      {children}
    </p>
  );
}

function FocusCard({ item, index }: { item: HomeCommandCenterModel["focusItems"][number]; index: number }) {
  const styles = toneStyles(item.tone);
  const content = (
    <div
      style={{
        minHeight: 136,
        height: "100%",
        background: styles.background,
        border: `0.5px solid ${styles.border}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: styles.label,
          }}
        >
          {item.label}
        </p>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "26px", lineHeight: 1, color: styles.value }}>
          {item.value}
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: 1.25,
            color: "var(--color-ink)",
            marginTop: 8,
          }}
        >
          {item.title}
        </p>
      </div>

      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", lineHeight: 1.45, color: "var(--color-ink-muted)", marginTop: "auto" }}>
        {item.detail}
      </p>
    </div>
  );

  if (!item.href) return content;

  return (
    <a href={item.href} style={{ display: "block", height: "100%", textDecoration: "none" }}>
      {content}
    </a>
  );
}

function HealthMetric({ metric }: { metric: HomeCommandCenterModel["healthMetrics"][number] }) {
  const styles = toneStyles(metric.tone);

  return (
    <div
      style={{
        minHeight: 98,
        background: "var(--color-surface)",
        border: `0.5px solid ${styles.border}`,
        padding: "11px 13px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "9px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: styles.label,
          marginBottom: 8,
        }}
      >
        {metric.label}
      </p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "23px", fontWeight: 500, lineHeight: 1, color: "var(--color-ink)" }}>
        {metric.value}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", lineHeight: 1.45, color: "var(--color-ink-muted)", marginTop: 8 }}>
        {metric.detail}
      </p>
    </div>
  );
}

export default function HomeCommandCenter({ summary }: { summary: HomeCommandCenterModel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section>
        <SectionKicker>Today&apos;s focus</SectionKicker>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 6,
          }}
        >
          {summary.focusItems.map((item, index) => (
            <FocusCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </section>

      <section>
        <SectionKicker>Book health</SectionKicker>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 6,
          }}
        >
          {summary.healthMetrics.map((metric) => (
            <HealthMetric key={metric.id} metric={metric} />
          ))}
        </div>
      </section>
    </div>
  );
}
