"use client";

import { useState } from "react";
import SignalCard from "./SignalCard";
import SalesforceLink from "./SalesforceLink";

interface Props {
  href: string;
  variant: "dark" | "light";
  category: string;
  timestamp: string;
  headline: string;
  body?: string;
  meta?: string;
  accent?: boolean;
  sfRecordId?: string;
  instanceUrl?: string;
}

export default function ClickableSignalCard({ href, sfRecordId, instanceUrl, ...cardProps }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => { window.location.href = href; }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") window.location.href = href; }}
      style={{
        display: "block",
        textDecoration: "none",
        position: "relative",
        cursor: "pointer",
        outline: hovered ? "0.5px solid var(--color-accent-soft)" : "0.5px solid transparent",
        transition: "outline-color 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SignalCard {...cardProps} />
      {sfRecordId && instanceUrl && (
        <div
          style={{
            position: "absolute",
            top: "28px",
            right: "10px",
          }}
        >
          <SalesforceLink instanceUrl={instanceUrl} recordId={sfRecordId} variant="icon" />
        </div>
      )}
    </div>
  );
}
