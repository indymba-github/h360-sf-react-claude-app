#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function parsePorcelainStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      raw: line,
      x: line.slice(0, 1),
      y: line.slice(1, 2),
      path: line.slice(3),
      untracked: line.startsWith("??"),
    }));
}

function summarizePorcelainStatus(entries) {
  return entries.reduce(
    (summary, entry) => {
      summary.total += 1;
      if (entry.untracked) {
        summary.untracked += 1;
        return summary;
      }
      if (entry.x && entry.x !== " ") summary.staged += 1;
      if (entry.y && entry.y !== " ") summary.unstaged += 1;
      return summary;
    },
    { total: 0, staged: 0, unstaged: 0, untracked: 0 },
  );
}

function evaluatePreflight(snapshot, options = {}) {
  const errors = [];
  const warnings = [];
  const statusSummary = summarizePorcelainStatus(snapshot.statusEntries ?? []);
  const expectedBranch = options.branchName ?? "main";

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(snapshot.packageVersion ?? "")) {
    errors.push(`dashboard/package.json version is not a valid release version: ${snapshot.packageVersion || "(missing)"}`);
  }

  if (snapshot.lockfileVersion && snapshot.lockfileVersion !== snapshot.packageVersion) {
    errors.push(
      `dashboard/package-lock.json version (${snapshot.lockfileVersion}) does not match package.json version (${snapshot.packageVersion}).`,
    );
  }

  if (snapshot.lockfilePackageVersion && snapshot.lockfilePackageVersion !== snapshot.packageVersion) {
    errors.push(
      `dashboard/package-lock.json root package version (${snapshot.lockfilePackageVersion}) does not match package.json version (${snapshot.packageVersion}).`,
    );
  }

  if (snapshot.currentBranch !== expectedBranch) {
    errors.push(`Current branch is ${snapshot.currentBranch}; expected ${expectedBranch}.`);
  }

  if (snapshot.localTagExists) {
    errors.push(`Release tag ${snapshot.expectedTag} already exists locally.`);
  }

  if (snapshot.remoteTagExists) {
    errors.push(`Release tag ${snapshot.expectedTag} already exists on GitHub.`);
  }

  if (!snapshot.remoteMain) {
    errors.push(`Could not read ${snapshot.remoteName ?? "origin"}/${expectedBranch} from GitHub.`);
  } else if (!snapshot.remoteMainKnownLocally) {
    errors.push(
      `${snapshot.remoteName ?? "origin"}/${expectedBranch} (${snapshot.remoteMain}) is not present locally. Fetch before release.`,
    );
  } else if (!snapshot.remoteMainIsAncestor) {
    errors.push(`Local HEAD does not contain GitHub ${expectedBranch}; pull/rebase before release.`);
  }

  if (snapshot.localHead && snapshot.remoteMain && snapshot.localHead === snapshot.remoteMain) {
    warnings.push(`Local HEAD matches GitHub ${expectedBranch}; there is no release commit ahead of GitHub yet.`);
  }

  if (statusSummary.total > 0) {
    const stagedOnly = statusSummary.staged > 0 && statusSummary.unstaged === 0 && statusSummary.untracked === 0;
    if (options.allowStaged && stagedOnly) {
      warnings.push("Worktree has staged changes; staged changes are allowed for this pre-commit check.");
    } else {
      errors.push(
        `Worktree is not clean (${statusSummary.staged} staged, ${statusSummary.unstaged} unstaged, ${statusSummary.untracked} untracked).`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    statusSummary,
  };
}

function collectSnapshot(options = {}) {
  const packageRoot = options.packageRoot ?? path.resolve(__dirname, "..");
  const repoRoot = git(["rev-parse", "--show-toplevel"], { cwd: packageRoot }).stdout.trim();
  const remoteName = options.remoteName ?? "origin";
  const branchName = options.branchName ?? "main";
  const packageJson = readJson(path.join(packageRoot, "package.json"));
  const lockfile = readOptionalJson(path.join(packageRoot, "package-lock.json"));
  const expectedTag = `v${packageJson.version}`;
  const remoteMain = parseLsRemoteSha(
    git(["ls-remote", "--exit-code", remoteName, `refs/heads/${branchName}`], { cwd: repoRoot }).stdout,
  );

  return {
    repoRoot,
    packageRoot,
    remoteName,
    branchName,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    lockfileVersion: lockfile?.version,
    lockfilePackageVersion: lockfile?.packages?.[""]?.version,
    expectedTag,
    currentBranch: git(["branch", "--show-current"], { cwd: repoRoot }).stdout.trim(),
    localHead: git(["rev-parse", "HEAD"], { cwd: repoRoot }).stdout.trim(),
    remoteMain,
    remoteMainKnownLocally: remoteMain ? gitOk(["cat-file", "-e", `${remoteMain}^{commit}`], repoRoot) : false,
    remoteMainIsAncestor: remoteMain ? gitOk(["merge-base", "--is-ancestor", remoteMain, "HEAD"], repoRoot) : false,
    localTagExists: gitOk(["show-ref", "--verify", "--quiet", `refs/tags/${expectedTag}`], repoRoot),
    remoteTagExists: gitOk(["ls-remote", "--exit-code", "--tags", remoteName, `refs/tags/${expectedTag}`], repoRoot),
    statusEntries: parsePorcelainStatus(git(["status", "--porcelain"], { cwd: repoRoot }).stdout),
    stagedDiffStat: git(["diff", "--cached", "--stat"], { cwd: repoRoot }).stdout.trim(),
    unstagedDiffStat: git(["diff", "--stat"], { cwd: repoRoot }).stdout.trim(),
    githubMainDiffStat: remoteMain && gitOk(["cat-file", "-e", `${remoteMain}^{commit}`], repoRoot)
      ? git(["diff", "--stat", remoteMain, "HEAD"], { cwd: repoRoot }).stdout.trim()
      : "",
    remoteUrl: git(["remote", "get-url", remoteName], { cwd: repoRoot }).stdout.trim(),
  };
}

function formatReport(snapshot, result) {
  const lines = [
    "Release preflight",
    "",
    `Repository: ${snapshot.repoRoot}`,
    `Remote: ${snapshot.remoteName} (${snapshot.remoteUrl ?? "unknown"})`,
    `Branch: ${snapshot.currentBranch}`,
    `Package: ${snapshot.packageName}@${snapshot.packageVersion}`,
    `Expected tag: ${snapshot.expectedTag}`,
    `Local HEAD: ${snapshot.localHead}`,
    `GitHub ${snapshot.branchName}: ${snapshot.remoteMain}`,
    `Local tag exists: ${snapshot.localTagExists ? "yes" : "no"}`,
    `GitHub tag exists: ${snapshot.remoteTagExists ? "yes" : "no"}`,
    `Worktree: ${formatStatusSummary(result.statusSummary)}`,
  ];

  if (snapshot.githubMainDiffStat) {
    lines.push("", "Diff from GitHub main:", indent(snapshot.githubMainDiffStat));
  }
  if (snapshot.stagedDiffStat) {
    lines.push("", "Staged diff:", indent(snapshot.stagedDiffStat));
  }
  if (snapshot.unstagedDiffStat) {
    lines.push("", "Unstaged diff:", indent(snapshot.unstagedDiffStat));
  }
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }
  if (result.errors.length > 0) {
    lines.push("", "Errors:", ...result.errors.map((error) => `- ${error}`));
  }

  lines.push("", `Result: ${result.ok ? "PASS" : "FAIL"}`);
  return lines.join("\n");
}

function parseArgs(argv) {
  const options = { remoteName: "origin", branchName: "main", allowStaged: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--allow-staged") {
      options.allowStaged = true;
    } else if (arg === "--remote") {
      options.remoteName = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === "--branch") {
      options.branchName = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log([
    "Usage: npm run release:preflight -- [options]",
    "",
    "Options:",
    "  --allow-staged       Allow staged-only changes for a pre-commit check.",
    "  --remote <name>      Git remote to check. Default: origin.",
    "  --branch <name>      GitHub branch to compare against. Default: main.",
    "  --help               Show this help.",
  ].join("\n"));
}

function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) {
      printHelp();
      return 0;
    }
    const snapshot = collectSnapshot(options);
    const result = evaluatePreflight(snapshot, options);
    console.log(formatReport(snapshot, result));
    return result.ok ? 0 : 1;
  } catch (err) {
    console.error(`Release preflight failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

function git(args, { cwd }) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function gitOk(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8" }).status === 0;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readOptionalJson(filePath) {
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function parseLsRemoteSha(output) {
  const line = output.split(/\r?\n/).find(Boolean);
  return line ? line.split(/\s+/)[0] : "";
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function formatStatusSummary(summary) {
  if (!summary || summary.total === 0) return "clean";
  return `${summary.staged} staged, ${summary.unstaged} unstaged, ${summary.untracked} untracked`;
}

function indent(text) {
  return text.split(/\r?\n/).map((line) => `  ${line}`).join("\n");
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  collectSnapshot,
  evaluatePreflight,
  formatReport,
  parseArgs,
  parsePorcelainStatus,
  summarizePorcelainStatus,
};
