export type BaseMode = "local" | "hosted" | "agentforce";

export type ResponsePath = "default" | "agentforce-direct" | "trust-layer";

export const RESPONSE_PATHS: ResponsePath[] = ["default", "agentforce-direct", "trust-layer"];

export const RESPONSE_PATH_LABELS: Record<ResponsePath, string> = {
  default: "MCP answer",
  "agentforce-direct": "Agentforce direct",
  "trust-layer": "Trust Layer",
};

const BASE_MODE_LABELS: Record<BaseMode, string> = {
  local: "Local MCP",
  hosted: "Hosted MCP",
  agentforce: "Agentforce",
};

export function getSelectableResponsePaths(baseMode: BaseMode): ResponsePath[] {
  return baseMode === "agentforce" ? ["default"] : RESPONSE_PATHS;
}

export function normalizeResponsePath(baseMode: BaseMode, path: ResponsePath): ResponsePath {
  return getSelectableResponsePaths(baseMode).includes(path) ? path : "default";
}

export function getDefaultResponseDescription(baseMode: BaseMode): string {
  if (baseMode === "agentforce") return "Next response: Agentforce direct";
  return `Next response: ${BASE_MODE_LABELS[baseMode]} -> Claude`;
}

export function getNextResponseDescription(baseMode: BaseMode, path: ResponsePath): string {
  const normalized = normalizeResponsePath(baseMode, path);

  if (normalized === "agentforce-direct") return "Next response: Agentforce direct";
  if (normalized === "trust-layer") {
    return `Next response: ${BASE_MODE_LABELS[baseMode]} context -> Salesforce Models API / Trust Layer`;
  }

  return getDefaultResponseDescription(baseMode);
}

export function getResponsePathDetail(baseMode: BaseMode, path: ResponsePath): string {
  const normalized = normalizeResponsePath(baseMode, path);

  if (normalized === "agentforce-direct") {
    return "Skips MCP and Claude for this response.";
  }

  if (normalized === "trust-layer") {
    return `${BASE_MODE_LABELS[baseMode]} gathers context, then Salesforce Models API answers through the Trust Layer.`;
  }

  if (baseMode === "agentforce") {
    return "Salesforce Agentforce handles the response.";
  }

  return `${BASE_MODE_LABELS[baseMode]} provides Salesforce context to Claude.`;
}

export type ContextSource = "mcp" | "rest" | "mcp+rest" | "none";

export interface RouteReceiptOptions {
  baseMode: BaseMode;
  path: ResponsePath;
  modelLabel?: string;
  contextSource?: ContextSource;
  contextPrefetched?: boolean;
}

export function getRouteReceiptText({
  baseMode,
  path,
  modelLabel,
  contextSource,
  contextPrefetched,
}: RouteReceiptOptions): string {
  const normalized = normalizeResponsePath(baseMode, path);

  if (normalized === "agentforce-direct" || baseMode === "agentforce") {
    return "Agentforce answered directly";
  }

  if (normalized === "trust-layer") {
    const model = modelLabel ?? "Salesforce Models API";

    if (contextSource === "rest") {
      return `Salesforce REST prefetch gathered context -> ${model} answered through the Trust Layer`;
    }

    if (contextSource === "mcp+rest") {
      return `${BASE_MODE_LABELS[baseMode]} + Salesforce REST gathered context -> ${model} answered through the Trust Layer`;
    }

    if (contextSource === "none" && !contextPrefetched) {
      return `${model} answered through the Trust Layer`;
    }

    return `${BASE_MODE_LABELS[baseMode]} gathered context -> ${model} answered through the Trust Layer`;
  }

  return `${BASE_MODE_LABELS[baseMode]} gathered context -> Claude answered`;
}

export interface RouteDiagnosticsOptions extends RouteReceiptOptions {
  toolCount?: number;
  durationMs?: number;
}

export interface RouteDiagnostics {
  baseMode: BaseMode;
  path: ResponsePath;
  dataLayer: string;
  sourceLabel?: string;
  answerLayer: string;
  trustLayer: boolean;
  toolCount: number;
  durationLabel?: string;
}

export interface RouteDiagnosticsRow {
  label: string;
  value: string;
}

function formatDuration(ms?: number): string | undefined {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDataLayerLabel(baseMode: BaseMode, path: ResponsePath, contextSource?: ContextSource): string {
  const normalized = normalizeResponsePath(baseMode, path);

  if (normalized === "agentforce-direct" || baseMode === "agentforce") return "None";

  if (normalized === "trust-layer") {
    if (contextSource === "rest") return "Salesforce REST";
    if (contextSource === "mcp+rest") return `${BASE_MODE_LABELS[baseMode]} + Salesforce REST`;
    if (contextSource === "none") return "None";
  }

  return BASE_MODE_LABELS[baseMode];
}

function getSourceLabel(baseMode: BaseMode, path: ResponsePath, contextSource?: ContextSource): string | undefined {
  const normalized = normalizeResponsePath(baseMode, path);
  if (normalized !== "trust-layer") return undefined;
  if (contextSource === "mcp") return "MCP";
  if (contextSource === "rest") return "Salesforce REST";
  if (contextSource === "mcp+rest") return "MCP + Salesforce REST";
  if (contextSource === "none") return "None";
  return BASE_MODE_LABELS[baseMode];
}

function getAnswerLayerLabel(baseMode: BaseMode, path: ResponsePath, modelLabel?: string): string {
  const normalized = normalizeResponsePath(baseMode, path);

  if (normalized === "agentforce-direct" || baseMode === "agentforce") return "Agentforce";
  if (normalized === "trust-layer") return modelLabel ?? "Salesforce Models API";
  return "Claude";
}

export function buildRouteDiagnostics({
  baseMode,
  path,
  modelLabel,
  contextSource,
  toolCount = 0,
  durationMs,
}: RouteDiagnosticsOptions): RouteDiagnostics {
  const normalized = normalizeResponsePath(baseMode, path);
  return {
    baseMode,
    path: normalized,
    dataLayer: getDataLayerLabel(baseMode, normalized, contextSource),
    ...(getSourceLabel(baseMode, normalized, contextSource) ? { sourceLabel: getSourceLabel(baseMode, normalized, contextSource) } : {}),
    answerLayer: getAnswerLayerLabel(baseMode, normalized, modelLabel),
    trustLayer: normalized === "trust-layer" || normalized === "agentforce-direct" || baseMode === "agentforce",
    toolCount,
    ...(formatDuration(durationMs) ? { durationLabel: formatDuration(durationMs) } : {}),
  };
}

export function getRouteDiagnosticsRows(diagnostics: RouteDiagnostics): RouteDiagnosticsRow[] {
  return [
    { label: "Data", value: diagnostics.dataLayer },
    ...(diagnostics.sourceLabel ? [{ label: "Source", value: diagnostics.sourceLabel }] : []),
    { label: "Answer", value: diagnostics.answerLayer },
    { label: "Trust", value: diagnostics.trustLayer ? "Yes" : "No" },
    { label: "Tools", value: String(diagnostics.toolCount) },
    ...(diagnostics.durationLabel ? [{ label: "Time", value: diagnostics.durationLabel }] : []),
  ];
}
