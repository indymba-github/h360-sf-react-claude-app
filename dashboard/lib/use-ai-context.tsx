"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { SuggestedPrompt } from "./prompts";

interface AccountContext {
  accountId: string;
  accountName: string;
  industry?: string | null;
}

interface AiContext {
  prompts: SuggestedPrompt[];
  accountContext: AccountContext | null;
  pendingPrompt: string | null;
  setPrompts: (prompts: SuggestedPrompt[]) => void;
  setAccountContext: (ctx: AccountContext | null) => void;
  sendPrompt: (text: string) => void;
  clearPendingPrompt: () => void;
}

const AiContextCtx = createContext<AiContext>({
  prompts: [],
  accountContext: null,
  pendingPrompt: null,
  setPrompts: () => {},
  setAccountContext: () => {},
  sendPrompt: () => {},
  clearPendingPrompt: () => {},
});

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [prompts, setPrompts] = useState<SuggestedPrompt[]>([]);
  const [accountContext, setAccountContext] = useState<AccountContext | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const sendPrompt = useCallback((text: string) => {
    setPendingPrompt(text);
  }, []);

  const clearPendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  return (
    <AiContextCtx.Provider value={{
      prompts, accountContext, pendingPrompt,
      setPrompts, setAccountContext, sendPrompt, clearPendingPrompt,
    }}>
      {children}
    </AiContextCtx.Provider>
  );
}

export function useAiContext() {
  return useContext(AiContextCtx);
}
