import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import PageHeading from "@/components/PageHeading";
import ChatPanel from "@/components/ChatPanel";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session.accessToken) redirect("/");

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto min-w-0" style={{ background: "var(--color-paper)" }}>
        <div className="px-8 pt-8 pb-16 max-w-2xl">
          <div className="mb-10">
            <PageHeading
              categoryLabel="Workspace · Profile · Branding · Prompts"
              headline="Settings."
            />
          </div>
          <SettingsClient
            displayName={session.displayName ?? null}
          />
        </div>
      </div>
      <ChatPanel initialMcpMode={effectiveMcpMode} hasMcpToken={!!session.mcpAccessToken} />
    </div>
  );
}
