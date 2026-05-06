import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // If already authenticated, skip the landing page
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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">SF Dashboard</h1>
            <p className="mt-1 text-sm text-gray-400">
              AI-powered Salesforce CRM explorer
            </p>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Connect button */}
        <a
          href="/api/auth/login"
          className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-600/20"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.53 2.01C9.63 2.01 7.1 3.38 5.5 5.5a7.5 7.5 0 0 0 0 13C7.1 20.62 9.63 22 12.53 22c1.97 0 3.78-.62 5.27-1.67l-1.42-1.42A6.5 6.5 0 1 1 14.5 7.12V5.01A8.48 8.48 0 0 0 12.53 4.8V2.01Zm1.97.56v2.82l2.12-2.12 1.41 1.41L15.12 7.6l2.82.01V5.5l2.12 2.12-1.41 1.41-2.82-2.82V8.5c2.04.9 3.47 2.94 3.47 5.3 0 3.2-2.6 5.8-5.8 5.8a5.8 5.8 0 0 1-5.8-5.8c0-2.36 1.43-4.4 3.47-5.3V5.5l-2.82 2.82-1.41-1.41L10.88 4.8l-2.82-.01v2.82L6.65 6.2 5.24 4.79 8.06 1.97l.01 2.82L8.06 2h6.47l-.03 2.79V2.57Z" />
          </svg>
          Connect to Salesforce
        </a>

        <p className="text-center text-xs text-gray-600">
          Uses OAuth 2.0 — your credentials are never stored here
        </p>
      </div>
    </div>
  );
}
