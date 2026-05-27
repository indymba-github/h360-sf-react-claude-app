interface SectionHeaderProps {
  number: string;
  title: string;
  meta?: string;
}

export default function SectionHeader({ number, title, meta }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '9px',
          letterSpacing: '0.14em',
          color: 'var(--color-ink-soft)',
          marginRight: '8px',
          flexShrink: 0,
        }}
      >
        {number}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-ink)',
          flex: 1,
        }}
      >
        {title}
      </span>
      {meta && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '9px',
            color: 'var(--color-ink-soft)',
            textAlign: 'right',
          }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}
