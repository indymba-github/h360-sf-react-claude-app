"use client";

import { buildSalesforceRecordUrl } from "@/lib/salesforce";

function CloudIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M13.2 8.4a5.6 5.6 0 0 1 10.5 2.0 4.0 4.0 0 0 1 .3 7.96H8.8a4.8 4.8 0 0 1-.4-9.58 5.6 5.6 0 0 1 4.8-.38Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface SalesforceLinkProps {
  instanceUrl: string | undefined;
  recordId: string;
  label?: string;
  variant?: "text" | "icon" | "badge";
}

export default function SalesforceLink({
  instanceUrl,
  recordId,
  label = "View in Salesforce",
  variant = "text",
}: SalesforceLinkProps) {
  if (!instanceUrl || !recordId) return null;

  const href = buildSalesforceRecordUrl(instanceUrl, recordId);
  const shared = { href, target: "_blank", rel: "noopener noreferrer" } as const;

  if (variant === "icon") {
    return (
      <a
        {...shared}
        title="View in Salesforce"
        aria-label="View in Salesforce"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          color: "var(--color-accent-soft)",
          opacity: 0.6,
          transition: "opacity 120ms",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
      >
        <CloudIcon size={14} />
      </a>
    );
  }

  if (variant === "badge") {
    return (
      <a
        {...shared}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 7px",
          fontFamily: "var(--font-body)",
          fontSize: "10px",
          letterSpacing: "0.04em",
          color: "var(--color-accent-text)",
          border: "0.5px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))",
          textDecoration: "none",
          transition: "opacity 120ms",
          lineHeight: 1.4,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <CloudIcon size={11} />
        <span>Salesforce</span>
      </a>
    );
  }

  // text variant
  return (
    <a
      {...shared}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontFamily: "var(--font-body)",
        fontSize: "12px",
        color: "var(--color-accent-text)",
        textDecoration: "none",
        transition: "text-decoration 120ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
    >
      <CloudIcon size={13} />
      <span>{label}</span>
    </a>
  );
}
