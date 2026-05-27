"use client";

interface StatItem {
  label: string;
  value: string;
}

interface AccountCardProps {
  id: string;
  industry?: string | null;
  name: string;
  stats: StatItem[];
}

export default function AccountCard({ id, industry, name, stats }: AccountCardProps) {
  return (
    <a
      href={`/accounts/${id}`}
      style={{
        display: 'block',
        backgroundColor: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        padding: '11px 13px',
        textDecoration: 'none',
        transition: 'opacity 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
      }}
    >
      {industry && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-soft)',
            margin: '0 0 4px 0',
          }}
        >
          {industry}
        </p>
      )}

      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        {name}
      </p>

      {stats.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '8px',
          }}
        >
          {stats.slice(0, 3).map((stat) => (
            <div key={stat.label}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '9px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-soft)',
                  margin: '0 0 2px 0',
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-ink)',
                  margin: 0,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </a>
  );
}
