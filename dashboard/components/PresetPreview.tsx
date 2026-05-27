"use client";

import type { DemoPack } from "@/lib/demoPacks";
import { inkDeepFromInk } from "@/lib/brandColors";

interface PresetPreviewProps {
  preset: DemoPack;
  size?: "mini" | "large";
}

export default function PresetPreview({ preset, size = "mini" }: PresetPreviewProps) {
  const { palette, typography, appName, logoDataUrl } = preset;
  const isMini = size === "mini";
  const scale = isMini ? 1 : 2.2;

  const root: React.CSSProperties = {
    width: isMini ? 120 : 264,
    height: isMini ? 76 : 167,
    background: palette.paper,
    border: `0.5px solid ${palette.accent}33`,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    fontFamily: `'${typography.body}', system-ui, sans-serif`,
  };

  const headerBar: React.CSSProperties = {
    background: inkDeepFromInk(palette.ink),
    height: isMini ? 10 : 22,
    display: "flex",
    alignItems: "center",
    paddingLeft: 4 * scale,
    gap: 3 * scale,
  };

  const logoBox: React.CSSProperties = {
    width: 6 * scale,
    height: 6 * scale,
    background: "transparent",
    borderRadius: 1,
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const appNameStyle: React.CSSProperties = {
    fontSize: 4 * scale,
    color: palette.paper,
    fontWeight: 500,
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: isMini ? 56 : 130,
  };

  const body: React.CSSProperties = {
    display: "flex",
    gap: 3 * scale,
    padding: `${3 * scale}px ${4 * scale}px`,
    height: isMini ? 66 : 145,
  };

  const sidebar: React.CSSProperties = {
    width: isMini ? 20 : 44,
    display: "flex",
    flexDirection: "column",
    gap: 2 * scale,
  };

  const navItem = (active: boolean): React.CSSProperties => ({
    height: 3 * scale,
    borderRadius: 1,
    background: active ? `${palette.accent}33` : `${palette.ink}11`,
  });

  const main: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 3 * scale,
  };

  const headline: React.CSSProperties = {
    fontFamily: `'${typography.display}', Georgia, serif`,
    fontSize: 5.5 * scale,
    color: palette.ink,
    lineHeight: 1.1,
    fontWeight: 500,
  };

  const subline: React.CSSProperties = {
    fontSize: 3 * scale,
    color: `${palette.ink}88`,
    lineHeight: 1.3,
  };

  const kpiRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 2 * scale,
  };

  const kpiCard = (i: number): React.CSSProperties => ({
    background: i === 0 ? `${palette.accent}18` : `${palette.ink}08`,
    borderTop: i === 0 ? `1.5px solid ${palette.accent}` : `1.5px solid ${palette.ink}22`,
    padding: `${1.5 * scale}px ${2 * scale}px`,
  });

  const kpiVal: React.CSSProperties = {
    fontSize: 4.5 * scale,
    fontWeight: 600,
    color: palette.ink,
    fontFamily: `'${typography.display}', Georgia, serif`,
  };

  const kpiLabel: React.CSSProperties = {
    fontSize: 2.5 * scale,
    color: `${palette.ink}66`,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  const barRow: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 1.5 * scale,
  };

  const barTrack: React.CSSProperties = {
    height: 2 * scale,
    background: `${palette.ink}0F`,
    borderRadius: 1,
    overflow: "hidden",
  };

  const barFills = [0.72, 0.48, 0.88];

  return (
    <div style={root}>
      {/* Header bar */}
      <div style={headerBar}>
        <div style={logoBox}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" style={{ width: "70%", height: "70%", opacity: 0.5 }}>
              <path d="M3 16.5a6 6 0 0 1 7-5.88A7 7 0 1 1 17 19H5a2 2 0 0 1-2-2.5Z" fill="white" />
            </svg>
          )}
        </div>
        <span style={appNameStyle}>{appName}</span>
      </div>

      {/* Body */}
      <div style={body}>
        {/* Sidebar nav */}
        <div style={sidebar}>
          {[true, false, false, false, false].map((active, i) => (
            <div key={i} style={navItem(active)} />
          ))}
        </div>

        {/* Main content */}
        <div style={main}>
          <div>
            <div style={headline}>Good morning.</div>
            <div style={subline}>Pipeline overview</div>
          </div>

          {/* KPI row */}
          <div style={kpiRow}>
            {["$4.2M", "12", "3"].map((val, i) => (
              <div key={i} style={kpiCard(i)}>
                <div style={kpiVal}>{val}</div>
                <div style={kpiLabel}>{["Open", "Deals", "Won"][i]}</div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div style={barRow}>
            {barFills.map((fill, i) => (
              <div key={i} style={barTrack}>
                <div style={{ height: "100%", width: `${fill * 100}%`, background: palette.accent, borderRadius: 1 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
