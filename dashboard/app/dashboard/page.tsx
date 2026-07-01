import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import { sfQuery, getNewsAlerts, getPipelineSummary } from "@/lib/salesforce";
import { timeOfDayGreeting } from "@/lib/greeting";
import { buildHomeCommandCenter, type HomeAgingOpportunitySignal, type HomeForecastBucket } from "@/lib/home-command-center";
import { buildHomeRelationshipDashboard } from "@/lib/home-relationship-dashboard";
import ChatPanel from "@/components/ChatPanel";
import HomeCommandCenter from "@/components/home/HomeCommandCenter";
import HomeRelationshipDashboard from "@/components/home/HomeRelationshipDashboard";
import PageHeading from "@/components/PageHeading";
import SectionHeader from "@/components/SectionHeader";
import dynamic from "next/dynamic";
import type { AgendaItem } from "@/components/TodaysAgenda";

const NewsAlertsSection   = dynamic(() => import("@/components/NewsAlertsSection"),   { ssr: false });
const TodaysAgenda        = dynamic(() => import("@/components/TodaysAgenda"),        { ssr: false });
const ClickableSignalCard = dynamic(() => import("@/components/ClickableSignalCard"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────

interface PipelineRollup {
  totalOpen: number | null;
  totalOpenAmount: number | null;
}

interface RecentAccount {
  Id: string;
  Name: string;
  LastModifiedDate: string;
  Industry: string | null;
}

interface HighPriorityCase {
  Id: string;
  Subject: string | null;
  Priority: string;
  Status: string;
  Account: { Id: string; Name: string } | null;
  CreatedDate: string;
}

interface AccountCountRow {
  total: number | null;
}

interface WinLossRow {
  StageName: string;
  cnt: number;
}

interface AgingOppRow {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  AccountId: string | null;
  CloseDate: string | null;
  LastModifiedDate: string;
}

interface SFEvent {
  Id: string;
  Subject: string | null;
  ActivityDateTime: string | null;
  EndDateTime: string | null;
  IsAllDayEvent: boolean;
  WhoId: string | null;
  Who: { Name: string } | null;
  WhatId: string | null;
  What: { Name: string } | null;
}

interface SFTaskItem {
  Id: string;
  Subject: string | null;
  ActivityDate: string | null;
  Status: string;
  Priority: string | null;
  WhoId: string | null;
  Who: { Name: string } | null;
  WhatId: string | null;
  What: { Name: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function countModifiedThisWeek(accounts: RecentAccount[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return accounts.filter((a) => new Date(a.LastModifiedDate).getTime() > weekAgo).length;
}

function daysAgoDateLiteral(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function buildForecastBuckets(opps: AgingOppRow[]): HomeForecastBucket[] {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startOfNext  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endOfNext    = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const plus30       = new Date(now.getTime() + 30 * 86400000);
  const plus60       = new Date(now.getTime() + 60 * 86400000);

  const buckets: HomeForecastBucket[] = [
    { label: "This month", range: `${startOfMonth.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${endOfMonth.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`, amount: 0, count: 0 },
    { label: "Next month", range: `${startOfNext.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${endOfNext.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`, amount: 0, count: 0 },
    { label: "60 days",    range: `${plus30.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${plus60.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`, amount: 0, count: 0 },
    { label: "90+ days",   range: `Beyond ${plus60.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`, amount: 0, count: 0 },
  ];

  for (const opp of opps) {
    if (!opp.CloseDate) continue;
    const d = new Date(opp.CloseDate);
    const amt = opp.Amount ?? 0;
    if (d >= startOfMonth && d <= endOfMonth)     { buckets[0].amount += amt; buckets[0].count++; }
    else if (d >= startOfNext && d <= endOfNext)  { buckets[1].amount += amt; buckets[1].count++; }
    else if (d > plus30 && d <= plus60)           { buckets[2].amount += amt; buckets[2].count++; }
    else if (d > plus60)                          { buckets[3].amount += amt; buckets[3].count++; }
  }
  return buckets;
}

function buildAgingOpps(opps: AgingOppRow[]): HomeAgingOpportunitySignal[] {
  const now = Date.now();
  return opps
    .map(o => ({
      id: o.Id,
      accountId: o.AccountId,
      name: o.Name,
      stageName: o.StageName,
      amount: o.Amount,
      daysStalled: Math.floor((now - new Date(o.LastModifiedDate).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysStalled - a.daysStalled)
    .slice(0, 10);
}

function buildAgendaItems(tasks: SFTaskItem[], events: SFEvent[]): AgendaItem[] {
  const timedEvents: AgendaItem[] = events
    .filter(e => !e.IsAllDayEvent && e.ActivityDateTime)
    .map(e => ({
      id: e.Id, type: "event" as const,
      subject: e.Subject ?? "(no subject)",
      startTime: e.ActivityDateTime,
      endTime: e.EndDateTime,
      isAllDay: false,
      whoName: e.Who?.Name ?? null,
      whatName: e.What?.Name ?? null,
      whatId: e.WhatId,
    }))
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  const allDayEvents: AgendaItem[] = events
    .filter(e => e.IsAllDayEvent)
    .map(e => ({
      id: e.Id, type: "event" as const,
      subject: e.Subject ?? "(no subject)",
      startTime: null, endTime: null, isAllDay: true,
      whoName: e.Who?.Name ?? null,
      whatName: e.What?.Name ?? null,
      whatId: e.WhatId,
    }));

  const taskItems: AgendaItem[] = tasks.map(t => ({
    id: t.Id, type: "task" as const,
    subject: t.Subject ?? "(no subject)",
    whoName: t.Who?.Name ?? null,
    whatName: t.What?.Name ?? null,
    whatId: t.WhatId,
    priority: t.Priority,
  }));

  return [...timedEvents, ...allDayEvents, ...taskItems];
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) redirect("/");

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);
  const userId = (session.userId ?? "").replace(/['"\\]/g, "");
  const touchedSince = daysAgoDateLiteral(30);
  const staleBefore = daysAgoDateLiteral(90);

  const [
    pipelineRes, recentRes, casesRes, accountCountRes, recentCoverageRes, staleCoverageRes, winLossRes,
    newsRes, pipelineStagesRes, agingOppsRes, eventsRes, tasksRes,
  ] = await Promise.allSettled([
    sfQuery<PipelineRollup>(session.instanceUrl, session.accessToken,
      `SELECT COUNT(Id) totalOpen, SUM(Amount) totalOpenAmount FROM Opportunity WHERE IsClosed = false AND OwnerId = '${userId}'`),
    sfQuery<RecentAccount>(session.instanceUrl, session.accessToken,
      `SELECT Id, Name, LastModifiedDate, Industry FROM Account WHERE OwnerId = '${userId}' ORDER BY LastModifiedDate DESC NULLS LAST LIMIT 5`),
    sfQuery<HighPriorityCase>(session.instanceUrl, session.accessToken,
      `SELECT Id, Subject, Priority, Status, Account.Id, Account.Name, CreatedDate FROM Case WHERE Status != 'Closed' AND Priority = 'High' ORDER BY CreatedDate DESC LIMIT 3`),
    sfQuery<AccountCountRow>(session.instanceUrl, session.accessToken,
      `SELECT COUNT(Id) total FROM Account WHERE OwnerId = '${userId}'`),
    sfQuery<AccountCountRow>(session.instanceUrl, session.accessToken,
      `SELECT COUNT(Id) total FROM Account WHERE OwnerId = '${userId}' AND LastActivityDate >= ${touchedSince}`),
    sfQuery<AccountCountRow>(session.instanceUrl, session.accessToken,
      `SELECT COUNT(Id) total FROM Account WHERE OwnerId = '${userId}' AND (LastActivityDate = null OR LastActivityDate < ${staleBefore})`),
    sfQuery<WinLossRow>(session.instanceUrl, session.accessToken,
      `SELECT StageName, COUNT(Id) cnt FROM Opportunity WHERE IsClosed = true AND OwnerId = '${userId}' GROUP BY StageName`),
    getNewsAlerts(session.instanceUrl, session.accessToken),
    getPipelineSummary(session.instanceUrl, session.accessToken),
    sfQuery<AgingOppRow>(session.instanceUrl, session.accessToken,
      `SELECT Id, Name, StageName, Amount, AccountId, CloseDate, LastModifiedDate FROM Opportunity WHERE IsClosed = false AND OwnerId = '${userId}' ORDER BY LastModifiedDate ASC NULLS FIRST LIMIT 10`),
    sfQuery<SFEvent>(session.instanceUrl, session.accessToken,
      `SELECT Id, Subject, ActivityDateTime, EndDateTime, IsAllDayEvent, WhoId, Who.Name, WhatId, What.Name FROM Event WHERE OwnerId = '${userId}' AND ActivityDate = TODAY ORDER BY ActivityDateTime ASC NULLS LAST LIMIT 20`),
    sfQuery<SFTaskItem>(session.instanceUrl, session.accessToken,
      `SELECT Id, Subject, ActivityDate, Status, Priority, WhoId, Who.Name, WhatId, What.Name FROM Task WHERE OwnerId = '${userId}' AND ActivityDate = TODAY AND IsClosed = false ORDER BY Priority ASC NULLS LAST LIMIT 20`),
  ]);

  const pipeline      = pipelineRes.status === "fulfilled" ? pipelineRes.value[0] : null;
  const recent        = recentRes.status === "fulfilled" ? recentRes.value : [];
  const cases         = casesRes.status === "fulfilled" ? casesRes.value : [];
  const accountCount  = accountCountRes.status === "fulfilled" ? (accountCountRes.value[0]?.total ?? 0) : 0;
  const recentlyTouchedRaw = recentCoverageRes.status === "fulfilled" ? (recentCoverageRes.value[0]?.total ?? 0) : null;
  const staleAccountCount = staleCoverageRes.status === "fulfilled" ? (staleCoverageRes.value[0]?.total ?? 0) : 0;
  const winLossRows   = winLossRes.status === "fulfilled" ? winLossRes.value : [];
  const newsAlerts    = newsRes.status === "fulfilled" ? newsRes.value : [];
  const pipelineStages = pipelineStagesRes.status === "fulfilled" ? pipelineStagesRes.value : [];
  const agingOppRows  = agingOppsRes.status === "fulfilled" ? agingOppsRes.value : [];
  const events        = eventsRes.status === "fulfilled" ? eventsRes.value : [];
  const tasks         = tasksRes.status === "fulfilled" ? tasksRes.value : [];

  const won      = winLossRows.find(r => r.StageName === "Closed Won")?.cnt ?? 0;
  const lost     = winLossRows.find(r => r.StageName === "Closed Lost")?.cnt ?? 0;
  const winRate  = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  const modifiedThisWeek = countModifiedThisWeek(recent);
  const recentlyTouchedCount = recentlyTouchedRaw ?? modifiedThisWeek;
  const firstName  = session.displayName?.split(" ")[0] ?? "there";
  const greeting   = timeOfDayGreeting();
  const dateLabel  = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  let subtitle = "Your pipeline is on track.";
  const parts: string[] = [];
  if (cases.length > 0) parts.push(`${cases.length} high-priority case${cases.length !== 1 ? "s" : ""} open`);
  if (modifiedThisWeek > 0) parts.push(`${modifiedThisWeek} account${modifiedThisWeek !== 1 ? "s" : ""} modified this week`);
  if (parts.length > 0) subtitle = parts.join(". ") + ".";

  const signalMeta = `${cases.length} alert${cases.length !== 1 ? "s" : ""} · ${recent.length} update${recent.length !== 1 ? "s" : ""}`;
  const forecastBuckets = buildForecastBuckets(agingOppRows);
  const agingOpps = buildAgingOpps(agingOppRows);
  const agendaItems = buildAgendaItems(tasks, events);
  const highPriorityCaseSignals = cases.map((c) => ({
    id: c.Id,
    subject: c.Subject,
    accountId: c.Account?.Id ?? null,
    accountName: c.Account?.Name ?? null,
    status: c.Status,
    createdDate: c.CreatedDate,
  }));
  const recentAccountSignals = recent.map((a) => ({
    id: a.Id,
    name: a.Name,
    industry: a.Industry,
    lastModifiedDate: a.LastModifiedDate,
  }));
  const agendaSignals = agendaItems.map((item) => ({
    id: item.id,
    type: item.type,
    subject: item.subject,
    relatedName: item.whatName ?? item.whoName ?? null,
    relatedId: item.whatId,
  }));
  const homeCommandCenter = buildHomeCommandCenter({
    accountCount,
    openPipelineAmount: pipeline?.totalOpenAmount ?? null,
    openPipelineCount: pipeline?.totalOpen ?? null,
    winRate,
    modifiedThisWeek,
    highPriorityCases: highPriorityCaseSignals,
    recentAccounts: recentAccountSignals,
    agendaItems: agendaSignals,
    agingOpportunities: agingOpps,
    forecastBuckets,
    pipelineStages,
  });
  const relationshipDashboard = buildHomeRelationshipDashboard({
    accountCount,
    recentlyTouchedCount,
    staleAccountCount,
    pipelineStages,
    highPriorityCases: highPriorityCaseSignals,
    recentAccounts: recentAccountSignals,
    agendaItems: agendaSignals,
  });

  return (
    <div className="flex h-full">
      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto min-w-0" style={{ background: "var(--color-paper)" }}>
        <div className="px-8 pt-8 pb-12">

          {/* Page heading */}
          <div className="mb-8">
            <PageHeading
              categoryLabel={dateLabel}
              headline={`${greeting}, ${firstName}.`}
              italicWord={`${firstName}.`}
              subtitle={subtitle}
            />
          </div>

          {/* Daily command center */}
          <div className="mb-10">
            <HomeCommandCenter summary={homeCommandCenter} />
          </div>

          {/* News Alerts */}
          {newsAlerts.length > 0 && (
            <div className="mb-8">
              <NewsAlertsSection initialAlerts={newsAlerts} variant="dashboard" />
            </div>
          )}

          {/* ── 01 Relationship view ── */}
          <div className="mb-10">
            <div className="mb-4">
              <SectionHeader number="01" title="Relationship dashboard" />
            </div>
            <HomeRelationshipDashboard summary={relationshipDashboard} pipelineStages={pipelineStages} />
          </div>

          {/* ── 02 Intelligence queue ── */}
          <div className="mb-10">
            <div className="mb-4">
              <SectionHeader number="02" title="Intelligence queue" meta={signalMeta} />
            </div>

            {cases.length === 0 && recent.length === 0 ? (
              <div className="px-5 py-8 text-center" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>
                  No signals right now. Check back later.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cases.map((c) => (
                  <ClickableSignalCard
                    key={c.Id}
                    href={c.Account ? `/accounts/${c.Account.Id}` : "#"}
                    variant="dark"
                    category="High-priority case"
                    timestamp={relativeTime(c.CreatedDate)}
                    headline={c.Subject ?? "(no subject)"}
                    body={[c.Account?.Name, c.Status].filter(Boolean).join(" · ")}
                    accent
                    sfRecordId={c.Id}
                    instanceUrl={session.instanceUrl}
                  />
                ))}
                {recent.map((a) => (
                  <ClickableSignalCard
                    key={a.Id}
                    href={`/accounts/${a.Id}`}
                    variant="light"
                    category="Account update"
                    timestamp={relativeTime(a.LastModifiedDate)}
                    headline={a.Name}
                    body={a.Industry ?? "Account"}
                    meta={`Modified ${relativeTime(a.LastModifiedDate)}`}
                    sfRecordId={a.Id}
                    instanceUrl={session.instanceUrl}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── 03 Today's agenda ── */}
          <div>
            <div className="mb-4">
              <SectionHeader number="03" title="Today's agenda" />
            </div>
            <TodaysAgenda items={agendaItems} />
          </div>

        </div>
      </div>

      {/* ── AI chat panel ── */}
      <ChatPanel initialMcpMode={effectiveMcpMode} hasMcpToken={!!session.mcpAccessToken} />
    </div>
  );
}
