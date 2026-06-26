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

export type ContextSource = "mcp" | "rest" | "none";

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

    if (contextSource === "none" && !contextPrefetched) {
      return `${model} answered through the Trust Layer`;
    }

    return `${BASE_MODE_LABELS[baseMode]} gathered context -> ${model} answered through the Trust Layer`;
  }

  return `${BASE_MODE_LABELS[baseMode]} gathered context -> Claude answered`;
}
