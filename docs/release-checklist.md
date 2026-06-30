# Release Checklist

Use this checklist before committing, tagging, or pushing a release.

## Ground Rules

- Do not move existing tags.
- Do not force push release branches or tags.
- Do not create, push, or delete tags without explicit confirmation.
- Confirm GitHub state before every release commit and before every tag push.
- Keep `CHANGELOG.md` updates near the end of a release batch, after the shipped work is known.

## Pre-Commit

1. Confirm the current GitHub state.
   - Check GitHub `main`.
   - Check existing local and GitHub release tags.
   - Confirm the intended version tag does not already exist.
2. Update dashboard package metadata.
   - `dashboard/package.json`
   - `dashboard/package-lock.json`
3. Run release preflight with staged changes allowed.
   - From `dashboard/`: `npm run release:preflight -- --allow-staged`
4. Run verification.
   - Unit tests
   - TypeScript check
   - Lint
   - Production build
   - Diff whitespace check
5. Report exactly what will be committed and ask for approval.

## Commit

1. Stage only the approved files.
2. Confirm the staged diff.
3. Commit with the approved release message.
4. Confirm the local commit hash and worktree state.

## Push Main

1. Run `npm run release:preflight` from `dashboard/`.
2. Confirm GitHub `main` still matches the expected baseline.
3. Push `main` only after approval.
4. Read GitHub `main` back and confirm it points to the pushed commit.

## Tag

1. Confirm the release tag does not exist locally or on GitHub.
2. Create an annotated tag on the approved commit.
3. Verify the tag resolves to the approved commit.
4. Push only that tag after approval.
5. Read GitHub tags back and confirm the tag resolves to the approved commit.

## Final Check

Confirm and report:

- GitHub `main` commit hash
- Release tag name
- Release tag commit hash
- Local worktree state
- Any intentionally unpushed local work
