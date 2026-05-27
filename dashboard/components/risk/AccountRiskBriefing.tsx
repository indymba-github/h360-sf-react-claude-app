'use client'

import RiskSection from './RiskSection'

export type RiskDimension = {
  severity: 'low' | 'medium' | 'high' | 'unknown'
  summary: string
  metrics?: { label: string; value: string }[]
  factors?: string[]
  emptyState?: boolean
}

type Props = {
  accountId?: string
  accountName: string
  engagementRisk: RiskDimension
  pipelineRisk: RiskDimension
}

export default function AccountRiskBriefing({
  accountId,
  accountName,
  engagementRisk,
  pipelineRisk,
}: Props) {
  function askAboutSection(question: string) {
    window.dispatchEvent(new CustomEvent('chat:ask', {
      detail: { question, accountId }
    }))
  }

  return (
    <div className="risk-briefing">
      <div className="briefing-header">
        <div className="briefing-eyebrow">RISK BRIEFING</div>
        <h2 className="briefing-title">{accountName}</h2>
      </div>

      <RiskSection
        title="Engagement Risk"
        severity={engagementRisk.severity}
        summary={engagementRisk.summary}
        metrics={engagementRisk.metrics}
        factors={engagementRisk.factors}
        emptyState={engagementRisk.emptyState}
        askPrompt={`Tell me more about the engagement risk on ${accountName}. What's driving it?`}
        onAsk={askAboutSection}
      />

      <RiskSection
        title="Pipeline Risk"
        severity={pipelineRisk.severity}
        summary={pipelineRisk.summary}
        metrics={pipelineRisk.metrics}
        factors={pipelineRisk.factors}
        emptyState={pipelineRisk.emptyState}
        askPrompt={`Tell me more about the pipeline risk on ${accountName}. What's stalled or at risk?`}
        onAsk={askAboutSection}
      />

      <style jsx>{`
        .risk-briefing {
          font-family: var(--font-body);
          color: var(--color-ink);
        }

        .briefing-header {
          margin-bottom: 24px;
        }

        .briefing-eyebrow {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1.5px;
          color: var(--color-ink-soft);
          margin-bottom: 4px;
        }

        .briefing-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 600;
          color: var(--color-ink);
        }
      `}</style>
    </div>
  )
}
