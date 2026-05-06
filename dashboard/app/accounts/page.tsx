import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import { listAccounts, getAccountCount } from "@/lib/salesforce";
import AccountSearch from "@/components/AccountSearch";
import ChatPanel from "@/components/ChatPanel";

export default async function AccountsPage() {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    redirect("/");
  }

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);

  const [accounts, totalCount] = await Promise.all([
    listAccounts(session.instanceUrl, session.accessToken, 50, 0).catch(() => []),
    getAccountCount(session.instanceUrl, session.accessToken).catch(() => 0),
  ]);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 md:p-8 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        </div>

        <AccountSearch accounts={accounts} totalCount={totalCount} instanceUrl={session.instanceUrl} />
      </div>

      <ChatPanel initialMcpMode={effectiveMcpMode} hasMcpToken={!!session.mcpAccessToken} />
    </div>
  );
}
