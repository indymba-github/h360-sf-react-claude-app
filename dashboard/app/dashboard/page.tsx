import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import {
  getPipelineSummary,
  getTopAccountsByRevenue,
  getRecentActivity,
  getWinLossStats,
} from "@/lib/salesforce";
import ChatPanel from "@/components/ChatPanel";
import PipelineChart from "@/components/PipelineChart";

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-secondary)" }}>{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    redirect("/");
  }

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);
  const needsMcpAuth = effectiveMcpMode === "hosted" && !session.mcpAccessToken;

  const [pipelineRes, topAccountsRes, recentRes, winLossRes] = await Promise.allSettled([
    getPipelineSummary(session.instanceUrl, session.accessToken),
    getTopAccountsByRevenue(session.instanceUrl, session.accessToken, 5),
    getRecentActivity(session.instanceUrl, session.accessToken),
    getWinLossStats(session.instanceUrl, session.accessToken),
  ]);

  const stages = pipelineRes.status === "fulfilled" ? pipelineRes.value : [];
  const topAccounts = topAccountsRes.status === "fulfilled" ? topAccountsRes.value : [];
  const recentItems = recentRes.status === "fulfilled" ? recentRes.value : [];
  const winLoss = winLossRes.status === "fulfilled"
    ? winLossRes.value
    : { closedWon: 0, closedLost: 0, winRate: 0, avgDealSize: null };

  const totalPipeline = stages.reduce((sum, s) => sum + (s.totalAmt ?? 0), 0);
  const totalOpenOpps = stages.reduce((sum, s) => sum + s.cnt, 0);

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8 min-w-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Good day, {session.displayName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s your pipeline at a glance.
          </p>
        </div>

        {/* MCP connection banner */}
        {needsMcpAuth && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">AI assistant not connected</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Connect your Salesforce MCP access to enable the AI chat panel.
              </p>
            </div>
            <a
              href="/api/auth/mcp-login"
              className="ml-6 shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 active:bg-amber-700 transition-colors"
            >
              Connect MCP
            </a>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          <KpiCard
            label="Open Pipeline"
            value={formatCurrency(totalPipeline)}
            sub={`${totalOpenOpps} open deal${totalOpenOpps !== 1 ? "s" : ""}`}
          />
          <KpiCard
            label="Open Deals"
            value={String(totalOpenOpps)}
            sub={`${stages.length} stage${stages.length !== 1 ? "s" : ""}`}
          />
          <KpiCard
            label="Win Rate"
            value={`${winLoss.winRate}%`}
            sub={`${winLoss.closedWon}W / ${winLoss.closedLost}L`}
          />
          <KpiCard
            label="Avg Deal (Won)"
            value={formatCurrency(winLoss.avgDealSize)}
            sub="closed won"
          />
        </div>

        {/* Chart + top accounts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Pipeline bar chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by Stage</h2>
            <PipelineChart stages={stages} />
          </div>

          {/* Top accounts by revenue */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Top Accounts</h2>
              <a href="/accounts" className="text-xs font-medium transition-colors" style={{ color: "var(--color-secondary)" }}>
                View all →
              </a>
            </div>
            {topAccounts.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-400">No data</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {topAccounts.map((a, i) => (
                  <a
                    key={a.Id}
                    href={`/accounts/${a.Id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium text-gray-300 w-4 shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.Name}</p>
                        <p className="text-xs text-gray-400">{a.Industry ?? "—"}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 shrink-0 ml-2">
                      {formatCurrency(a.AnnualRevenue)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
          </div>
          {recentItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-gray-400">No recent activity</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentItems.map((item) => (
                <a
                  key={`${item.objectType}-${item.Id}`}
                  href={item.objectType === "Account" ? `/accounts/${item.Id}` : "#"}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                      style={
                        item.objectType === "Account"
                          ? { background: "#eff6ff", color: "#2563eb" }
                          : { background: "color-mix(in srgb, var(--color-secondary) 12%, white)", color: "var(--color-secondary)" }
                      }
                    >
                      {item.objectType === "Account" ? "A" : "O"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.Name}</p>
                      <p className="text-xs text-gray-400">
                        {item.objectType}{item.detail ? ` · ${item.detail}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-4">
                    {formatDate(item.LastModifiedDate)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI chat panel */}
      <ChatPanel initialMcpMode={effectiveMcpMode} hasMcpToken={!!session.mcpAccessToken} />
    </div>
  );
}
