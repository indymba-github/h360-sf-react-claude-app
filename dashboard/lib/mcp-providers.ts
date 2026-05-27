export type McpProvider = 'hosted' | 'local' | 'agentforce';

export const PROVIDER_LABELS: Record<McpProvider, string> = {
  hosted: 'Hosted',
  local: 'Local',
  agentforce: 'Agentforce',
};

export const DEFAULT_PROVIDER: McpProvider = 'hosted';
