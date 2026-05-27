import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode } from "@/lib/mcp-config";
import { sfQuery, getAccount, getNewsAlerts, type SFOpportunity, type SFContact, type SFCase } from "@/lib/salesforce";
import { formatCurrency, formatCount } from "@/lib/format";
import ChatPanel from "@/components/ChatPanel";
import PageHeading from "@/components/PageHeading";
import SectionHeader from "@/components/SectionHeader";
import dynamic from "next/dynamic";

const AccountBriefingPanel = dynamic(() => import("@/components/AccountBriefingPanel"), { ssr: false });
const NewsAlertsSection    = dynamic(() => import("@/components/NewsAlertsSection"),    { ssr: false });
const SalesforceLink       = dynamic(() => import("@/components/SalesforceLink"),       { ssr: false });

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function stagePillStyle(stage: string): React.CSSProperties {
  const s = stage.toLowerCase();
  if (s.includes("closed won")) return { background: "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))", color: "var(--color-success)", border: "0.5px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))" };
  if (s.includes("closed")) return { background: "var(--color-paper)", color: "var(--color-ink-soft)", border: "0.5px solid var(--color-border)" };
  return { background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))", color: "var(--color-accent-text)", border: "0.5px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))" };
}

function casePriorityStyle(priority: string | null): React.CSSProperties {
  if (priority === "High") return { background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))", color: "var(--color-danger)", border: "0.5px solid color-mix(in srgb, var(--color-danger) 20%, var(--color-border))" };
  if (priority === "Medium") return { background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))", color: "var(--color-warning)", border: "0.5px solid color-mix(in srgb, var(--color-warning) 20%, var(--color-border))" };
  return { background: "var(--color-paper)", color: "var(--color-ink-soft)", border: "0.5px solid var(--color-border)" };
}

function lastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function headlineWithoutLastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join(" ") + " ";
}

function EmptySection({ message }: { message: string }) {
  return (
    <div
      className="px-5 py-8 text-center"
      style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}
    >
      <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>{message}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) redirect("/");

  const effectiveMcpMode = getEffectiveMcpMode(session.mcpMode);
  const { id } = await params;
  const safeId = id.replace(/['"\\]/g, "");

  const [accountRes, oppsRes, contactsRes, casesRes, newsRes] = await Promise.allSettled([
    getAccount(session.instanceUrl, session.accessToken, safeId),
    sfQuery<SFOpportunity>(
      session.instanceUrl, session.accessToken,
      `SELECT Id, Name, StageName, Amount, CloseDate, Probability FROM Opportunity WHERE AccountId = '${safeId}' ORDER BY CloseDate DESC NULLS LAST`
    ),
    sfQuery<SFContact>(
      session.instanceUrl, session.accessToken,
      `SELECT Id, Name, Title, Email, Phone FROM Contact WHERE AccountId = '${safeId}'`
    ),
    sfQuery<SFCase>(
      session.instanceUrl, session.accessToken,
      `SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate FROM Case WHERE AccountId = '${safeId}' ORDER BY CreatedDate DESC LIMIT 5`
    ),
    getNewsAlerts(session.instanceUrl, session.accessToken, safeId),
  ]);

  const acct = accountRes.status === "fulfilled" ? accountRes.value : null;
  if (!acct) notFound();

  const opps       = oppsRes.status === "fulfilled" ? oppsRes.value : [];
  const contacts   = contactsRes.status === "fulfilled" ? contactsRes.value : [];
  const cases      = casesRes.status === "fulfilled" ? casesRes.value : [];
  const newsAlerts = newsRes.status === "fulfilled" ? newsRes.value : [];

  const openOpps   = opps.filter((o) => !o.StageName.toLowerCase().startsWith("closed"));
  const openCases  = cases.filter((c) => c.Status !== "Closed");
  const closedCases = cases.filter((c) => c.Status === "Closed");
  const openOppsTotal = openOpps.reduce((s, o) => s + (o.Amount ?? 0), 0);

  // Headline: split last word for italic
  const acctLastWord = lastWord(acct.Name);
  const acctHeadlineStart = headlineWithoutLastWord(acct.Name);
  const singleWord = !acctHeadlineStart.trim();

  // Category label parts
  const since = acct.CreatedDate ? new Date(acct.CreatedDate).getFullYear() : null;
  const catParts = [acct.Industry, acct.Type, since ? `Since ${since}` : null].filter(Boolean);
  const categoryLabel = catParts.length > 0 ? catParts.join(" · ") : undefined;

  // Hero stats — omit nulls
  const heroStats: { label: string; value: string }[] = [];
  if (acct.AnnualRevenue != null) heroStats.push({ label: "Revenue", value: formatCurrency(acct.AnnualRevenue) });
  if (acct.NumberOfEmployees != null) heroStats.push({ label: "Employees", value: formatCount(acct.NumberOfEmployees) });
  if (acct.BillingState || acct.BillingCity) heroStats.push({ label: "Region", value: [acct.BillingCity, acct.BillingState].filter(Boolean).join(", ") });
  if (openOpps.length > 0) heroStats.push({ label: "Open opps", value: formatCount(openOpps.length) });


  return (
    <div className="flex h-full">
      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto min-w-0" style={{ background: "var(--color-paper)" }}>
        <div className="px-8 pt-8 pb-12">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 mb-6" style={{ fontFamily: "var(--font-body)", fontSize: "11px" }}>
            <a href="/accounts" style={{ color: "var(--color-accent-text)" }}>Accounts</a>
            <span style={{ color: "var(--color-ink-soft)" }}>·</span>
            <span style={{ color: "var(--color-ink-muted)" }} className="truncate max-w-xs">{acct.Name}</span>
          </nav>

          {/* Page heading */}
          <div className="mb-3">
            <PageHeading
              categoryLabel={categoryLabel}
              headline={singleWord ? acct.Name : `${acctHeadlineStart}${acctLastWord}.`}
              italicWord={singleWord ? undefined : `${acctLastWord}.`}
            />
          </div>

          <div className="mb-6">
            <SalesforceLink instanceUrl={session.instanceUrl} recordId={acct.Id} variant="text" />
          </div>

          {/* Hero stats row */}
          {heroStats.length > 0 && (
            <div
              className="flex gap-8 mb-6 pb-6"
              style={{ borderBottom: "0.5px solid var(--color-border)" }}
            >
              {heroStats.map(({ label, value }) => (
                <div key={label}>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--color-ink-soft)",
                      marginBottom: "2px",
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--color-ink)",
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Briefing chips */}
          <AccountBriefingPanel accountId={acct.Id} accountName={acct.Name} />

          {/* News Alerts (account-scoped) */}
          {newsAlerts.length > 0 && (
            <div className="mb-8">
              <div className="mb-4">
                <SectionHeader number="00" title="News" meta={`${newsAlerts.length} alert${newsAlerts.length !== 1 ? "s" : ""}`} />
              </div>
              <NewsAlertsSection initialAlerts={newsAlerts} variant="account" />
            </div>
          )}

          {/* 01 Pipeline */}
          <div className="mb-8">
            <div className="mb-4">
              <SectionHeader
                number="01"
                title="Pipeline"
                meta={openOpps.length > 0 ? `${formatCurrency(openOppsTotal)} across ${openOpps.length} opportunit${openOpps.length !== 1 ? "ies" : "y"}` : undefined}
              />
            </div>
            {opps.length === 0 ? (
              <EmptySection message="No open opportunities." />
            ) : (
              <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
                {opps.map((o, i) => (
                  <div
                    key={o.Id}
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: i < opps.length - 1 ? "0.5px solid var(--color-border)" : "none" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="text-xs px-2 py-0.5 shrink-0"
                        style={{ fontFamily: "var(--font-body)", fontSize: "9px", ...stagePillStyle(o.StageName) }}
                      >
                        {o.StageName}
                      </span>
                      <div className="min-w-0">
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }} className="truncate">
                          {o.Name}
                        </p>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
                          Close {formatDate(o.CloseDate)}{o.Probability != null ? ` · ${o.Probability}%` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" style={{ flexShrink: 0, marginLeft: "16px" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
                        {formatCurrency(o.Amount)}
                      </span>
                      <SalesforceLink instanceUrl={session.instanceUrl} recordId={o.Id} variant="icon" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 02 Contacts */}
          <div className="mb-8">
            <div className="mb-4">
              <SectionHeader
                number="02"
                title="Contacts"
                meta={contacts.length > 0 ? `${contacts.length} on file` : undefined}
              />
            </div>
            {contacts.length === 0 ? (
              <EmptySection message="No contacts on this account — add one from Salesforce." />
            ) : (
              <div
                className="grid grid-cols-1 gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
              >
                {contacts.map((c) => (
                  <div
                    key={c.Id}
                    style={{
                      background: "var(--color-surface)",
                      border: "0.5px solid var(--color-border)",
                      padding: "11px 13px",
                      position: "relative",
                    }}
                  >
                    <div style={{ position: "absolute", top: "10px", right: "10px" }}>
                      <SalesforceLink instanceUrl={session.instanceUrl} recordId={c.Id} variant="icon" />
                    </div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)", marginBottom: "2px" }}>
                      {c.Name}
                    </p>
                    {(c.Title) && (
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)", marginBottom: "6px" }}>
                        {c.Title}
                      </p>
                    )}
                    {c.Email && (
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
                        {c.Email}
                      </p>
                    )}
                    {c.Phone && (
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
                        {c.Phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 03 Cases */}
          <div className="mb-8">
            <div className="mb-4">
              <SectionHeader
                number="03"
                title="Cases"
                meta={cases.length > 0 ? `${openCases.length} open · ${closedCases.length} closed` : undefined}
              />
            </div>
            {cases.length === 0 ? (
              <EmptySection message="No cases on file." />
            ) : (
              <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
                {cases.slice(0, 3).map((c, i) => (
                  <div
                    key={c.Id}
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: i < Math.min(cases.length, 3) - 1 ? "0.5px solid var(--color-border)" : "none" }}
                  >
                    <div>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
                        #{c.CaseNumber} {c.Subject ?? "(no subject)"}
                      </p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
                        {formatDate(c.CreatedDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {c.Priority && (
                        <span
                          style={{ fontFamily: "var(--font-body)", fontSize: "9px", padding: "2px 6px", ...casePriorityStyle(c.Priority) }}
                        >
                          {c.Priority}
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "9px",
                          padding: "2px 6px",
                          background: c.Status === "Closed" ? "var(--color-paper)" : "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                          color: c.Status === "Closed" ? "var(--color-ink-soft)" : "var(--color-accent-text)",
                          border: "0.5px solid var(--color-border)",
                        }}
                      >
                        {c.Status}
                      </span>
                      <SalesforceLink instanceUrl={session.instanceUrl} recordId={c.Id} variant="icon" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── AI chat panel ── */}
      <ChatPanel
        accountContext={{
          accountId: acct.Id,
          accountName: acct.Name,
          industry: acct.Industry,
          annualRevenue: acct.AnnualRevenue,
          type: acct.Type,
        }}
        initialMcpMode={effectiveMcpMode}
        hasMcpToken={!!session.mcpAccessToken}
      />
    </div>
  );
}
