interface PageHeadingProps {
  /** Small-caps label above the headline. Pass just the label — no date is auto-appended. */
  categoryLabel?: string;
  headline: string;
  /** If provided, the last word of headline is replaced with an italic brass em. */
  italicWord?: string;
  subtitle?: string;
}

export default function PageHeading({ categoryLabel, headline, italicWord, subtitle }: PageHeadingProps) {
  let headlineStart = headline;
  if (italicWord) {
    const lastSpace = headline.lastIndexOf(" ");
    headlineStart = lastSpace >= 0 ? headline.slice(0, lastSpace + 1) : "";
  }

  return (
    <div>
      {categoryLabel && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-soft)",
            margin: "0 0 6px 0",
          }}
        >
          {categoryLabel}
        </p>
      )}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "26px",
          fontWeight: 500,
          lineHeight: 1.15,
          color: "var(--color-ink)",
          margin: 0,
        }}
      >
        {italicWord ? (
          <>
            {headlineStart}
            <em style={{ color: "var(--color-accent-text)", fontStyle: "italic" }}>
              {italicWord}
            </em>
          </>
        ) : (
          headline
        )}
      </h1>
      {subtitle && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            color: "var(--color-ink-muted)",
            margin: "6px 0 0",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
