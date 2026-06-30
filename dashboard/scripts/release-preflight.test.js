const assert = require("node:assert/strict");
const test = require("node:test");

const {
  evaluatePreflight,
  parsePorcelainStatus,
  summarizePorcelainStatus,
} = require("./release-preflight");

const baseSnapshot = {
  packageName: "sf-ai-dashboard",
  packageVersion: "2.2.2",
  lockfileVersion: "2.2.2",
  lockfilePackageVersion: "2.2.2",
  expectedTag: "v2.2.2",
  currentBranch: "main",
  localHead: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  remoteMain: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  remoteMainKnownLocally: true,
  remoteMainIsAncestor: true,
  localTagExists: false,
  remoteTagExists: false,
  statusEntries: [],
};

test("evaluatePreflight passes for a clean unreleased version ahead of GitHub main", () => {
  const result = evaluatePreflight(baseSnapshot);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("evaluatePreflight fails when the release tag already exists on GitHub", () => {
  const result = evaluatePreflight({
    ...baseSnapshot,
    remoteTagExists: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /already exists on GitHub/);
});

test("evaluatePreflight fails when dashboard package metadata is out of sync", () => {
  const result = evaluatePreflight({
    ...baseSnapshot,
    lockfileVersion: "0.1.0",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /package-lock\.json version/);
});

test("evaluatePreflight blocks staged changes by default but can allow staged pre-commit checks", () => {
  const statusEntries = parsePorcelainStatus("M  dashboard/package.json\nA  dashboard/scripts/release-preflight.js\n");

  const strictResult = evaluatePreflight({
    ...baseSnapshot,
    statusEntries,
  });
  assert.equal(strictResult.ok, false);
  assert.match(strictResult.errors.join("\n"), /Worktree is not clean/);

  const allowStagedResult = evaluatePreflight({
    ...baseSnapshot,
    statusEntries,
  }, { allowStaged: true });
  assert.equal(allowStagedResult.ok, true);
  assert.match(allowStagedResult.warnings.join("\n"), /staged changes are allowed/);
});

test("summarizePorcelainStatus distinguishes staged, unstaged, and untracked files", () => {
  const entries = parsePorcelainStatus([
    "M  dashboard/package.json",
    " M dashboard/package-lock.json",
    "?? dashboard/scripts/release-preflight.js",
  ].join("\n"));

  assert.deepEqual(summarizePorcelainStatus(entries), {
    total: 3,
    staged: 1,
    unstaged: 1,
    untracked: 1,
  });
});
