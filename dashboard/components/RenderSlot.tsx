'use client'

import { useEffect } from 'react'
import { RenderDirective } from '@/lib/render-directives'
import { resolveRenderComponent } from '@/lib/render-registry'

type Props = {
  directive: RenderDirective | null
  onClose: () => void
  accountId?: string
}

export default function RenderSlot({
  directive,
  onClose,
  accountId
}: Props) {
  useEffect(() => {
    if (!directive) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [directive, onClose])

  if (!directive) return null

  const Component = resolveRenderComponent(directive.component)
  if (!Component) {
    console.warn('RenderSlot: no component for', directive.component)
    return null
  }

  return (
    <div className="render-slot-overlay">
      <div className="render-slot-backdrop" onClick={onClose} />
      <div className="render-slot-card">
        <div className="render-slot-header">
          <button
            type="button"
            className="render-slot-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="render-slot-content">
          <Component
            {...directive.props}
            accountId={accountId ?? directive.accountId}
          />
        </div>
      </div>

      <style jsx>{`
        .render-slot-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
          padding-bottom: 40px;
          z-index: 9000;
          pointer-events: none;
        }

        .render-slot-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(2px);
          pointer-events: auto;
        }

        .render-slot-card {
          position: relative;
          background: var(--color-paper);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          width: min(700px, calc(100vw - 80px));
          max-height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
          pointer-events: auto;
          overflow: hidden;
          animation: slot-enter 0.2s ease-out;
        }

        @keyframes slot-enter {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .render-slot-header {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 1;
        }

        .render-slot-close {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-ink-soft);
          font-size: 14px;
          transition: all 0.15s;
        }

        .render-slot-close:hover {
          color: var(--color-ink);
          background: var(--color-paper);
        }

        .render-slot-content {
          overflow-y: auto;
          padding: 32px;
        }
      `}</style>
    </div>
  )
}
