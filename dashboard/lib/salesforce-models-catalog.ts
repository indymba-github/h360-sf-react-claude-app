/**
 * Catalog of Salesforce-managed models supported via the Models API.
 * List sourced from:
 * https://developer.salesforce.com/docs/ai/agentforce/guide/supported-models.html
 *
 * Embedding-only models excluded (won't work for chat).
 * Update this list when new models become available or are deprecated.
 */

export type SfModelProvider = "Anthropic" | "OpenAI" | "Google" | "Amazon" | "NVIDIA";

export type SfModel = {
  /** API name used in the Models API URL */
  apiName: string;
  /** Human-friendly label for the dropdown */
  label: string;
  /** Provider grouping for the dropdown */
  provider: SfModelProvider;
  /** True if the model runs inside Salesforce's trust boundary
   *  (Anthropic + Amazon models on Bedrock). Affects governance story. */
  insideTrustBoundary: boolean;
  /** Notes shown as a tooltip — beta status, deprecation, etc. */
  notes?: string;
  /** Mark Beta releases */
  beta?: boolean;
};

export const SF_MODELS: SfModel[] = [
  // ── Anthropic (Claude) — all on Bedrock, inside Trust Boundary ──────────
  {
    apiName: "sfdc_ai__DefaultBedrockAnthropicClaude46Sonnet",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    insideTrustBoundary: true,
  },
  {
    apiName: "sfdc_ai__DefaultBedrockAnthropicClaude46Opus",
    label: "Claude Opus 4.6",
    provider: "Anthropic",
    insideTrustBoundary: true,
  },
  {
    apiName: "sfdc_ai__DefaultBedrockAnthropicClaude47Opus",
    label: "Claude Opus 4.7",
    provider: "Anthropic",
    insideTrustBoundary: true,
    beta: true,
    notes: "Beta release. Lower rate limits, may not be available in all regions.",
  },
  {
    apiName: "sfdc_ai__DefaultBedrockAnthropicClaude45Sonnet",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    insideTrustBoundary: true,
  },
  {
    apiName: "sfdc_ai__DefaultBedrockAnthropicClaude45Opus",
    label: "Claude Opus 4.5",
    provider: "Anthropic",
    insideTrustBoundary: true,
  },
  {
    apiName: "sfdc_ai__DefaultBedrockAnthropicClaude45Haiku",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    insideTrustBoundary: true,
  },

  // ── OpenAI (geo-aware, outside Salesforce Trust Boundary) ────────────────
  {
    apiName: "sfdc_ai__DefaultGPT52",
    label: "GPT 5.2",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT54",
    label: "GPT 5.4",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT55",
    label: "GPT 5.5",
    provider: "OpenAI",
    insideTrustBoundary: false,
    beta: true,
    notes: "Beta release.",
  },
  {
    apiName: "sfdc_ai__DefaultGPT51",
    label: "GPT 5.1",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT5",
    label: "GPT 5",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT5Mini",
    label: "GPT 5 Mini",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT41",
    label: "GPT 4.1",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT41Mini",
    label: "GPT 4.1 Mini",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT4Omni",
    label: "GPT 4o",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultGPT4OmniMini",
    label: "GPT 4o Mini",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultO3",
    label: "OpenAI o3",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultO4Mini",
    label: "OpenAI o4 Mini",
    provider: "OpenAI",
    insideTrustBoundary: false,
  },

  // ── Google (Vertex AI) ───────────────────────────────────────────────────
  {
    apiName: "sfdc_ai__DefaultVertexAIGemini30Flash",
    label: "Gemini 3 Flash",
    provider: "Google",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultVertexAIGeminiPro31",
    label: "Gemini 3.1 Pro",
    provider: "Google",
    insideTrustBoundary: false,
    beta: true,
    notes: "Beta release.",
  },
  {
    apiName: "sfdc_ai__DefaultVertexAIGemini31FlashLite",
    label: "Gemini 3.1 Flash Lite",
    provider: "Google",
    insideTrustBoundary: false,
    beta: true,
    notes: "Beta release.",
  },
  {
    apiName: "sfdc_ai__DefaultVertexAIGemini25Flash001",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultVertexAIGemini25FlashLite001",
    label: "Gemini 2.5 Flash Lite",
    provider: "Google",
    insideTrustBoundary: false,
  },
  {
    apiName: "sfdc_ai__DefaultVertexAIGeminiPro25",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    insideTrustBoundary: false,
  },

  // ── Amazon (Nova) — on Bedrock, inside Salesforce Trust Boundary ─────────
  {
    apiName: "sfdc_ai__DefaultBedrockAmazonNovaPro",
    label: "Amazon Nova Pro",
    provider: "Amazon",
    insideTrustBoundary: true,
  },
  {
    apiName: "sfdc_ai__DefaultBedrockAmazonNovaLite",
    label: "Amazon Nova Lite",
    provider: "Amazon",
    insideTrustBoundary: true,
  },

  // ── NVIDIA ───────────────────────────────────────────────────────────────
  {
    apiName: "sfdc_ai__DefaultBedrockNvidiaNemotronNano330b",
    label: "NVIDIA Nemotron 3 Nano 30B",
    provider: "NVIDIA",
    insideTrustBoundary: false,
    beta: true,
    notes: "Beta release.",
  },
];

/** Default model when no user selection exists. */
export const SF_MODELS_DEFAULT_API_NAME =
  "sfdc_ai__DefaultBedrockAnthropicClaude46Sonnet";

/** Provider display order in the dropdown. */
export const SF_PROVIDER_ORDER: SfModelProvider[] = [
  "Anthropic", "OpenAI", "Google", "Amazon", "NVIDIA",
];

/** Look up a model by API name, returning undefined if not found. */
export function findModelByApiName(apiName: string): SfModel | undefined {
  return SF_MODELS.find((m) => m.apiName === apiName);
}

/** Group models by provider for the dropdown UI. */
export function groupModelsByProvider(): Map<SfModelProvider, SfModel[]> {
  const grouped = new Map<SfModelProvider, SfModel[]>();
  for (const provider of SF_PROVIDER_ORDER) {
    grouped.set(provider, SF_MODELS.filter((m) => m.provider === provider));
  }
  return grouped;
}
