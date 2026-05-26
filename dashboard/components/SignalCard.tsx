interface SignalCardProps {
  variant: 'dark' | 'light';
  priority?: 'high' | 'medium' | 'low';
  category: string;
  timestamp: string;
  headline: string;
  body?: string;
  meta?: string;
  accent?: boolean;
}

export default function SignalCard({
  variant,
  category,
  timestamp,
  headline,
  body,
  meta,
  accent,
}: SignalCardProps) {
  const isDark = variant === 'dark';

  const cardStyle: React.CSSProperties = isDark
    ? {
        backgroundColor: 'var(--color-ink-deep)',
        padding: '11px 13px',
        border: 'none',
      }
    : {
        backgroundColor: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        padding: '11px 13px',
      };

  // Dark variant has an always-dark background (--color-ink-deep). Its text must use
  // light values regardless of global theme, so we pin to the light-mode token literals.
  const categoryColor = isDark
    ? accent ? '#C7A968' : '#8A8D95'
    : accent ? 'var(--color-accent-text)' : 'var(--color-ink-soft)';

  const headlineColor = isDark ? '#F4F1EA' : 'var(--color-ink)';

  const bodyColor = isDark ? '#B0B3BA' : 'var(--color-ink-muted)';

  const metaColor = isDark ? '#C7A968' : 'var(--color-ink-soft)';

  const metaBorderColor = isDark ? '#3A3F4A' : 'var(--color-border)';

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: 'var(--font-body)',
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: categoryColor,
        }}
      >
        <span>{category}</span>
        <span>{timestamp}</span>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 500,
          color: headlineColor,
          margin: '4px 0 0 0',
          lineHeight: 1.3,
        }}
      >
        {headline}
      </p>

      {body && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            lineHeight: 1.5,
            color: bodyColor,
            margin: '4px 0 0 0',
          }}
        >
          {body}
        </p>
      )}

      {meta && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            color: metaColor,
            margin: '8px 0 0 0',
            paddingTop: '8px',
            borderTop: `0.5px solid ${metaBorderColor}`,
          }}
        >
          {meta}
        </p>
      )}
    </div>
  );
}
