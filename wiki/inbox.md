# Wiki Inbox

Items captured during sessions. Review periodically and promote to full wiki pages.

<!-- New items go below this line -->

1. **SOAP login is disabled by default** in newer SF orgs. Don't use username-password auth. Use JWT Bearer flow.
2. **External Client Apps ≠ legacy Connected Apps.** The UI is different. JWT setup lives under "Flow Enablement" → "Enable JWT Bearer Flow," not in the same place as legacy Connected Apps.
3. **The MCP Inspector requires stdio transport.** If the server uses HTTP/streamable transport, the Inspector fails with "Cannot POST /register." Use stdio for local dev.
4. **Security tokens may not be available** in newer orgs. Don't rely on them.
5. **External Client Apps don't appear in Permission Sets** until you set "Admin approved users are pre-authorized" in OAuth Policies.
6. **Verify fields exist in your org** before hardcoding SOQL. `Rating` doesn't exist on Account in all orgs. Use `isAccessible()` checks or test queries in Developer Console first.