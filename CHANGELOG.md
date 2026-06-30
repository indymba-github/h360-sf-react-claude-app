# Changelog

All notable project changes are documented here.

## Unreleased

- No unreleased changes yet.

## v2.3.0 - 2026-06-30

### Added

- Added a deterministic Relationship Snapshot to account detail pages with relationship, growth, service, and coverage signals for FINS customer conversations.
- Added focused preview helpers and tests for relationship snapshots, cases, contacts, opportunities, shared date formatting, financial account card theming, and Trust Layer financial-account context.
- Added v2.3.0 design and implementation notes for the FINS relationship workspace.

### Changed

- Refined account detail sections so pipeline, contacts, financial accounts, and cases read as a more cohesive relationship workspace.
- Updated Financial Account value semantics to separate asset balances, debt exposure, and credit exposure instead of treating all values as a generic balance.
- Updated Trust Layer route diagnostics to identify hybrid MCP plus Salesforce REST context when REST financial-account context supplements MCP context.
- Bumped dashboard package metadata to `2.3.0`.

### Fixed

- Fixed Relationship Snapshot copy that showed `Value unknown` when financial accounts existed but value fields were unavailable.
- Fixed Trust Layer account answers missing financial-account context when Hosted MCP returned account context without Financial Accounts.
- Fixed Salesforce date-only values shifting by using shared date formatting across account and financial account views.

## v2.2.3 - 2026-06-30

### Added

- Added a release checklist documenting the safe order for preflight checks, version updates, verification, commits, pushes, tag creation, and GitHub readback.
- Added Playwright smoke tests for the authenticated settings page, hosted response path controls, Trust Layer chat route diagnostics, and brand extraction apply/save-preset flow.

### Changed

- Updated Trust Layer chat route diagnostics to show the context source explicitly in the assistant route footer.
- Bumped dashboard package metadata to `2.2.3`.

## v2.2.2 - 2026-06-30

Release commit: `29cf8822f1c50c230fc61eaf2ad1b3fdbd665ca1`

### Added

- Added `npm run release:preflight` for the dashboard app.
- Added a release preflight script that checks GitHub `main`, local and remote release tags, package metadata, branch state, worktree cleanliness, and release diffs before publishing.
- Added tests covering clean release checks, existing remote tags, package metadata mismatch, staged-change handling, and Git status parsing.

### Changed

- Bumped dashboard package metadata to `2.2.2`.

## v2.2.1 - 2026-06-29

Release commit: `d0194c6846d0351dd2b100797e84f45c4b09497d`

### Added

- Added connection diagnostics support for dashboard settings.
- Added credential source and MCP authentication helper tests.
- Added Trust Layer MCP planning coverage for local curated tools, hosted SOQL tools, hosted scoped SOQL tool names, SOQL argument shape, and SOQL escaping.

### Changed

- Updated Trust Layer MCP context collection to use MCP tool schemas when planning hosted Salesforce SOQL calls.
- Updated hosted Trust Layer SOQL calls to use the hosted tool's expected argument shape.
- Cleaned up credential-source wording so legacy environment variable usage is reported as a selected source, not as a fallback failure.
- Improved response path labeling and route diagnostics for default MCP, Trust Layer, and Agentforce direct responses.
- Bumped dashboard package metadata to `2.2.1`.

### Fixed

- Fixed hosted Trust Layer context collection returning `MALFORMED_QUERY` when hosted SOQL tools expected `q` instead of the local MCP `query` argument.
- Fixed hosted MCP token refresh handling for Trust Layer context collection.

## v2.2.0 - 2026-06-26

Release commit: `1df78883b6353d3fc8e3839e8030a1e68e2554f1`

### Added

- Added extracted brand theme saving as presets.
- Added separated settings panels for brand-from-website, brand preview, preset library, and preset editing.
- Added route labeling and response path helpers for Local, Hosted, Agentforce direct, and Trust Layer flows.
- Added tests for brand extraction, brand settings persistence, branding resolution, preset editing, preset library behavior, and response path labeling.

### Changed

- Refactored the settings screen into smaller focused components.
- Improved branded app identity handling so extracted brand settings can apply app name, logo, and colors.
- Updated preset branding behavior so stored preset logos can override the main settings logo when a preset is active.

### Fixed

- Fixed brand extraction/apply behavior that previously left default Cumulus Bank settings in place after saving.
- Fixed preset logo resolution so an active preset logo is not overwritten by the main settings logo.
- Updated ignore rules to avoid tracking generated or local runtime files.
