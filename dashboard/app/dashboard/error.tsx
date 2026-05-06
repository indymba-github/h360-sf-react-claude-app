"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  const isSessionExpired =
    error.message === "SF_SESSION_EXPIRED" ||
    error.message.includes("401") ||
    error.message.includes("session");

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        {isSessionExpired ? (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Session expired</h2>
            <p className="text-sm text-gray-500 mb-5">
              Your Salesforce session has expired. Re-connect to continue.
            </p>
            <a
              href="/api/auth/login"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Re-connect to Salesforce
            </a>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-5">{error.message}</p>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
