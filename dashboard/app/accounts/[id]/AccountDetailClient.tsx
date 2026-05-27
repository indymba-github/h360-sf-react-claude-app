'use client'

import { useState } from 'react'
import ChatPanel, { type AccountContext } from '@/components/ChatPanel'
import RenderSlot from '@/components/RenderSlot'
import type { RenderDirective } from '@/lib/render-directives'
import type { McpMode } from '@/lib/mcp-config'

type Props = {
  accountContext: AccountContext
  initialMcpMode: McpMode
  hasMcpToken: boolean
}

export default function AccountDetailClient({
  accountContext,
  initialMcpMode,
  hasMcpToken,
}: Props) {
  const [renderDirective, setRenderDirective] = useState<RenderDirective | null>(null)

  return (
    <>
      <ChatPanel
        accountContext={accountContext}
        initialMcpMode={initialMcpMode}
        hasMcpToken={hasMcpToken}
        onRender={setRenderDirective}
      />
      <RenderSlot
        directive={renderDirective}
        accountId={accountContext.accountId}
        onClose={() => setRenderDirective(null)}
      />
    </>
  )
}
