'use client'

import AskAIButton from './AskAIButton'

type Severity = 'low' | 'medium' | 'high' | 'unknown'

type Props = {
  title: string
  severity: Severity
  summary: string
  metrics?: { label: string; value: string }[]
  factors?: string[]
  askPrompt: string
  onAsk: (q: string) => void
  emptyState?: boolean
}

export default function RiskSection({
  title,
  severity,
  summary,
  metrics,
  factors,
  askPrompt,
  onAsk,
  emptyState,
}: Props) {
  if (emptyState) {
    return (
      <div className="risk-section risk-section-empty">
        <div className="risk-header">
          <h3 className="risk-title">{title}</h3>
          <span className="severity-badge severity-unknown">NO DATA</span>
        </div>

        <p className="risk-summary empty-summary">{summary}</p>

        <style jsx>{`
          .risk-section-empty {
            background: var(--color-surface);
            border: 1px dashed var(--color-border);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 16px;
          }

          .risk-section-empty:last-child {
            margin-bottom: 0;
          }

          .risk-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .risk-title {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--color-ink);
          }

          .severity-badge {
            font-size: 10px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 10px;
            letter-spacing: 0.5px;
          }

          .severity-unknown {
            background: var(--color-border);
            color: var(--color-ink-soft);
          }

          .empty-summary {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
            color: var(--color-ink-muted);
            font-style: italic;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="risk-section">
      <div className="risk-header">
        <h3 className="risk-title">{title}</h3>
        <span className={`severity-badge severity-${severity}`}>
          {severity.toUpperCase()}
        </span>
      </div>

      <p className="risk-summary">{summary}</p>

      {metrics && metrics.length > 0 && (
        <div className="risk-metrics">
          {metrics.map((m, i) => (
            <div key={i} className="metric">
              <span className="metric-label">{m.label}</span>
              <span className="metric-value">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {factors && factors.length > 0 && (
        <div className="risk-factors">
          <div className="factors-label">Contributing factors</div>
          <ul>
            {factors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="risk-action">
        <AskAIButton question={askPrompt} onAsk={onAsk} />
      </div>

      <style jsx>{`
        .risk-section {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .risk-section:last-child {
          margin-bottom: 0;
        }

        .risk-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .risk-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .severity-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 10px;
          letter-spacing: 0.5px;
        }

        .severity-low {
          background: rgba(45, 106, 79, 0.15);
          color: #2D6A4F;
        }

        .severity-medium {
          background: rgba(160, 104, 0, 0.15);
          color: #A06800;
        }

        .severity-high {
          background: rgba(139, 47, 47, 0.15);
          color: #8B2F2F;
        }

        .risk-summary {
          margin: 0 0 12px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--color-ink);
        }

        .risk-metrics {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .metric-label {
          font-size: 10px;
          color: var(--color-ink-soft);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-value {
          font-size: 16px;
          font-weight: 500;
          color: var(--color-ink);
        }

        .risk-factors {
          margin-bottom: 12px;
        }

        .factors-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-ink-soft);
          margin-bottom: 4px;
        }

        .risk-factors ul {
          margin: 0;
          padding-left: 18px;
          font-size: 12px;
          color: var(--color-ink-muted);
        }

        .risk-factors li {
          margin-bottom: 2px;
        }

        .risk-action {
          margin-top: 8px;
        }
      `}</style>
    </div>
  )
}
