#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_MAX_BYTES = 8_000;
const HARD_MAX_BYTES = 16_000;

const USAGE = `Usage:
  node scripts/goalkeeper-update-checkpoint.mjs --goal <text> --next <text> [--session <goal-session-id>] [--workspace <path>] [--done <text>] [--status <text>] [--throughline <text>] [--why <text>] [--constraint <text> ...] [--forbidden <text> ...] [--decision <text> ...] [--attempt <text> ...] [--file <path> ...] [--verified <text> ...] [--unverified <text> ...] [--risk <text> ...] [--evidence <text> ...] [--max-bytes <n>] [--dry-run] [--json]

Replaces checkpoint.md with a bounded, canonical recovery checkpoint.
Append the corresponding event first with goalkeeper-append-event.mjs; this script writes only checkpoint.md.
If --session is omitted, <workspace>/.goalkeeper/active-session is used.
`;

function parseArgs(argv) {
  const options = {
    sessionId: null,
    workspace: ".",
    title: null,
    goal: null,
    doneCriteria: null,
    status: null,
    throughline: null,
    why: null,
    constraints: [],
    forbidden: [],
    decisions: [],
    attempts: [],
    files: [],
    verified: [],
    unverified: [],
    risks: [],
    evidence: [],
    next: null,
    maxBytes: DEFAULT_MAX_BYTES,
    dryRun: false,
    json: false,
  };

  const repeated = new Map([
    ["--constraint", "constraints"],
    ["--forbidden", "forbidden"],
    ["--decision", "decisions"],
    ["--attempt", "attempts"],
    ["--file", "files"],
    ["--verified", "verified"],
    ["--unverified", "unverified"],
    ["--risk", "risks"],
    ["--evidence", "evidence"],
  ]);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--session") {
      options.sessionId = argv[i + 1];
      i += 1;
    } else if (arg === "--workspace") {
      options.workspace = argv[i + 1];
      i += 1;
    } else if (arg === "--title") {
      options.title = argv[i + 1];
      i += 1;
    } else if (arg === "--goal") {
      options.goal = argv[i + 1];
      i += 1;
    } else if (arg === "--done") {
      options.doneCriteria = argv[i + 1];
      i += 1;
    } else if (arg === "--status") {
      options.status = argv[i + 1];
      i += 1;
    } else if (arg === "--throughline") {
      options.throughline = argv[i + 1];
      i += 1;
    } else if (arg === "--why") {
      options.why = argv[i + 1];
      i += 1;
    } else if (arg === "--next") {
      options.next = argv[i + 1];
      i += 1;
    } else if (arg === "--max-bytes") {
      options.maxBytes = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (repeated.has(arg)) {
      options[repeated.get(arg)].push(argv[i + 1]);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.workspace || !options.goal || !options.next) {
    throw new Error("Missing required argument.");
  }

  if (!Number.isInteger(options.maxBytes) || options.maxBytes < 1 || options.maxBytes > HARD_MAX_BYTES) {
    throw new Error(`--max-bytes must be an integer between 1 and ${HARD_MAX_BYTES}.`);
  }

  const stringFields = [
    "sessionId",
    "title",
    "goal",
    "doneCriteria",
    "status",
    "throughline",
    "why",
    "next",
  ];

  for (const field of stringFields) {
    if (options[field] !== null && options[field] !== undefined) {
      options[field] = normalizeText(options[field], field);
    }
  }

  for (const key of repeated.values()) {
    const normalize = key === "files" ? normalizePathText : normalizeText;
    options[key] = options[key].map((value) => normalize(value, key));
    if (options[key].some((value) => !value)) {
      throw new Error(`Values for ${key} must not be empty.`);
    }
  }

  return options;
}

function normalizeText(value, field) {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error(`${field} must not be empty.`);
  }
  return normalized;
}

function normalizePathText(value, field) {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} must not be empty.`);
  }
  if (/[\r\n]/.test(normalized)) {
    throw new Error(`${field} must not contain newlines.`);
  }
  return normalized;
}

function isSingleSegmentSessionId(value) {
  return typeof value === "string" && value.trim() && !value.includes("/") && !value.includes("..");
}

function readActiveSession(workspace) {
  const activeSessionPath = path.join(workspace, ".goalkeeper", "active-session");
  if (!fs.existsSync(activeSessionPath)) {
    throw new Error(`--session was omitted and active-session is missing: ${activeSessionPath}`);
  }
  const sessionId = fs.readFileSync(activeSessionPath, "utf8").trim();
  if (!isSingleSegmentSessionId(sessionId)) {
    throw new Error(`active-session must contain a single session id path segment: ${activeSessionPath}`);
  }
  return { sessionId, activeSessionPath };
}

function bulletList(items, fallback = "None recorded.") {
  if (items.length === 0) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function renderCheckpoint(options, context) {
  const title = options.title || context.sessionId;
  const contextPack = fs.existsSync(context.contextPackPath)
    ? `.goalkeeper/sessions/${context.sessionId}/context-pack.md`
    : "None recorded.";

  return `# Checkpoint: ${title}

## Active Goal

- Objective: ${options.goal}
- Done criteria: ${options.doneCriteria || "Not explicitly recorded."}
- Current status: ${options.status || "Open."}

## Throughline

- Current direction: ${options.throughline || "Continue from the active goal and latest verified state."}
- Why this direction: ${options.why || "Preserve direction across compaction with project-local state."}

## Constraints

- Non-negotiable:
${indentBullets(options.constraints, "None recorded.")}
- Forbidden approaches:
${indentBullets(options.forbidden, "None recorded.")}

## Decisions

${bulletList(options.decisions)}

## Attempts And Failures

${bulletList(options.attempts)}

## Important Files

${bulletList(options.files)}

## Evidence

${bulletList(options.evidence)}

## Context Pack

- ${contextPack}

## Verification

- Verified:
${indentBullets(options.verified, "None recorded.")}
- Not yet verified:
${indentBullets(options.unverified, "None recorded.")}

## Open Risks

${bulletList(options.risks)}

## Next Action

- ${options.next}

## Last Updated

- ${context.updatedAt}
`;
}

function indentBullets(items, fallback) {
  return bulletList(items, fallback)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(2);
  }

  const workspace = path.resolve(options.workspace);
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    console.error(`Workspace does not exist or is not a directory: ${workspace}`);
    process.exit(1);
  }

  let activeSessionPath = null;
  if (!options.sessionId) {
    try {
      const active = readActiveSession(workspace);
      options.sessionId = active.sessionId;
      activeSessionPath = active.activeSessionPath;
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }

  if (!isSingleSegmentSessionId(options.sessionId)) {
    console.error("Session id must be a single path segment.");
    process.exit(2);
  }

  const sessionDir = path.join(workspace, ".goalkeeper", "sessions", options.sessionId);
  const checkpointPath = path.join(sessionDir, "checkpoint.md");
  const contextPackPath = path.join(sessionDir, "context-pack.md");

  if (!fs.existsSync(sessionDir) || !fs.statSync(sessionDir).isDirectory()) {
    console.error(`Goalkeeper session directory is missing: ${sessionDir}`);
    process.exit(1);
  }

  const updatedAt = new Date().toISOString();
  const checkpoint = renderCheckpoint(options, {
    sessionId: options.sessionId,
    contextPackPath,
    updatedAt,
  });
  const bytes = Buffer.byteLength(checkpoint);

  if (bytes > options.maxBytes) {
    console.error(`Rendered checkpoint is ${bytes} bytes, over --max-bytes ${options.maxBytes}.`);
    console.error("Shorten fields or raise --max-bytes up to the 16000 hard limit only when recovery cost is acceptable.");
    process.exit(1);
  }

  if (!options.dryRun) {
    fs.writeFileSync(checkpointPath, checkpoint);
  }

  const result = {
    ok: true,
    dryRun: options.dryRun,
    workspace,
    sessionId: options.sessionId,
    sessionDir,
    checkpointPath,
    activeSessionPath,
    bytes,
    maxBytes: options.maxBytes,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Goalkeeper update-checkpoint: PASS");
  console.log(`Workspace: ${workspace}`);
  console.log(`Session: ${options.sessionId}`);
  console.log(`Checkpoint: ${checkpointPath}`);
  console.log(`Bytes: ${bytes}/${options.maxBytes}`);
  if (options.dryRun) console.log("Dry run: yes");
}

main();
