import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session.accessToken) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    state_mismatch: "Authentication failed — please try again.",
    token_exchange: "Could not exchange token with Salesforce — check your Connected App settings.",
    user_info: "Authenticated, but could not retrieve your user info.",
    missing_code: "Salesforce did not return an authorization code.",
  };

  const errorMessage = error ? (errorMessages[error] ?? `OAuth error: ${error}`) : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-xs flex flex-col items-center gap-7">

        {/* Logo mark */}
        <div
          className="flex items-center justify-center w-11 h-11 shrink-0"
          style={{
            borderRadius: 3,
            border: "1px solid var(--color-accent)",
            background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
          }}
        >
          <svg
            className="w-5 h-5"
            style={{ color: "var(--color-accent)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
          </svg>
        </div>

        {/* Headline */}
        <div className="text-center">
          <h1
            className="text-[26px] font-medium leading-[1.15]"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}
          >
            Welcome to{" "}
            <em style={{ color: "var(--color-accent-text)", fontStyle: "italic" }}>
              SF Dashboard.
            </em>
          </h1>
          <p
            className="mt-2 text-[12px]"
            style={{ color: "var(--color-ink-muted)", fontFamily: "var(--font-body)" }}
          >
            Sign in with Salesforce to load your book.
          </p>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div
            className="w-full px-4 py-3 text-[11px]"
            style={{
              background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
              border: "0.5px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border))",
              color: "var(--color-danger)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* CTA button */}
        <a
          href="/api/auth/login"
          className="flex items-center justify-center gap-2 w-full px-5 py-2.5 text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-surface)",
            fontFamily: "var(--font-body)",
          }}
        >
          Connect to Salesforce
        </a>

        <p
          className="text-[10px] text-center"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Uses OAuth 2.0 — your credentials are never stored here
        </p>
      </div>
    </div>
  );
}
