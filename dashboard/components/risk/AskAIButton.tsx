'use client'

type Props = {
  question: string
  onAsk: (question: string) => void
}

export default function AskAIButton({ question, onAsk }: Props) {
  return (
    <button
      type="button"
      className="ask-ai-button"
      onClick={() => onAsk(question)}
    >
      <span className="ask-ai-icon">✨</span>
      Ask AI about this
      <style jsx>{`
        .ask-ai-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          color: var(--color-accent-text);
          cursor: pointer;
          transition: all 0.15s;
        }

        .ask-ai-button:hover {
          background: var(--color-surface);
          border-color: var(--color-accent);
        }

        .ask-ai-icon {
          font-size: 11px;
        }
      `}</style>
    </button>
  )
}
