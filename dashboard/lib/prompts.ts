export interface SuggestedPrompt {
  label: string;
  prompt: string;
}

export const DASHBOARD_PROMPTS: SuggestedPrompt[] = [
  { label: "Pipeline summary", prompt: "Summarize my open pipeline by stage." },
  { label: "At-risk deals", prompt: "Which of my open deals are most at risk of slipping this quarter?" },
  { label: "Recent wins", prompt: "What deals have I closed won in the last 30 days?" },
  { label: "Top accounts", prompt: "Who are my top 5 accounts by annual revenue?" },
  { label: "Open cases", prompt: "How many open cases do I have and what are the priorities?" },
];

export const ACCOUNTS_PROMPTS: SuggestedPrompt[] = [
  { label: "Find accounts", prompt: "Find accounts in the financial services industry with revenue over $10M." },
  { label: "Recent changes", prompt: "Which accounts have been modified most recently?" },
  { label: "Missing data", prompt: "Which of my accounts are missing industry or revenue data?" },
];

export function accountDetailPrompts(accountName: string): SuggestedPrompt[] {
  return [
    { label: "Account summary", prompt: `Give me a briefing on ${accountName}.` },
    { label: "Open opportunities", prompt: `What are the open opportunities for ${accountName}?` },
    { label: "Recent activity", prompt: `What's the recent activity on ${accountName}?` },
    { label: "Key contacts", prompt: `Who are the key contacts at ${accountName}?` },
    { label: "Open cases", prompt: `Are there any open cases for ${accountName}?` },
  ];
}
