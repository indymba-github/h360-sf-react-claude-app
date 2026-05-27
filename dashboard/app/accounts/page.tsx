import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import { queryAccounts, getAccountIndustries } from "@/lib/salesforce";
import ChatPanel from "@/components/ChatPanel";
import PageHeading from "@/components/PageHeading";
import AccountsListClient from "@/components/AccountsListClient";

export default async function AccountsPage() {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) redirect("/");

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);

  const [initial, industries] = await Promise.all([
    queryAccounts(session.instanceUrl, session.accessToken, {
      pageSize: 200,
      sortBy: "name-asc",
    }).catch(() => ({ accounts: [], hasMore: false, totalCount: 0 })),
    getAccountIndustries(session.instanceUrl, session.accessToken),
  ]);

  return (
    <div className="flex h-full">
      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto min-w-0" style={{ background: "var(--color-paper)" }}>
        <div className="px-8 pt-8 pb-12">

          {/* Page heading */}
          <div className="mb-8">
            <PageHeading
              categoryLabel={`Directory · ${initial.totalCount.toLocaleString()} account${initial.totalCount !== 1 ? "s" : ""}`}
              headline="Accounts."
            />
          </div>

          {/* Client-side list with pagination */}
          <AccountsListClient
            instanceUrl={session.instanceUrl}
            initialAccounts={initial.accounts}
            initialHasMore={initial.hasMore}
            initialTotalCount={initial.totalCount}
            industries={industries}
          />

        </div>
      </div>

      {/* ── AI chat panel ── */}
      <ChatPanel initialMcpMode={effectiveMcpMode} hasMcpToken={!!session.mcpAccessToken} />
    </div>
  );
}
