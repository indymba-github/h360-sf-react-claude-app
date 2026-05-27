import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    local: {
      configured: process.env.LOCAL_MCP_ENABLED !== "false",
      description: "Custom MCP server running on stdio",
      hint: "Start the MCP server in salesforce-mcp-server/ to enable",
    },
    hosted: {
      configured: !!process.env.SF_MCP_SERVER_URL,
      description: "Salesforce-hosted MCP server",
      hint: "Set SF_MCP_SERVER_URL in .env.local",
    },
    agentforce: {
      configured: !!(
        process.env.SF_AGENT_CLIENT_ID &&
        process.env.SF_AGENT_CLIENT_SECRET
      ),
      description: "Salesforce Agentforce endpoint",
      hint: "Set SF_AGENT_CLIENT_ID and SF_AGENT_CLIENT_SECRET in .env.local. Configure agents in Settings.",
    },
  });
}
