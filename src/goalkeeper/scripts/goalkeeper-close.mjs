#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const EVENT_TYPES = new Set([
  "goal",
  "user_constraint",
  "decision",
  "attempt",
  "failure",
  "edit",
  "command",
  "verification",
  "risk",
  "handoff",
  "next_action",
  "compact_observed",
  "recovery_violation",
  "close",
]);

const STATUSES = new Set(["open", "done", "failed", "blocked", "superseded", "closed"]);

const USAGE = `Usage:
  node scripts/goalkeeper-close.mjs --outcome <text> [--session <goal-session-id>] [--workspace <path>] [--risk <text> ...] [--evidence <text> ...] [--json]

Closes the active Goalkeeper session after a goal is complete, abandoned, or superseded.
This appends a close event, marks checkpoint.md closed, and removes <workspace>/.goalkeeper/active-session when it points to the closed session.
`;

function parseArgs(argv) {
  const options = {
    sessionId: null,
    workspace: ".",
    outcome: null,
    risks: [],
    evidence: [],
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--session") {
      options.sessionId = argv[i + 1];
      i += 1;
    } else if (arg === "--workspace") {
      options.workspace = argv[i + 1];
      i += 1;
    } else if (arg === "--outcome") {
      options.outcome = argv[i + 1];
      i += 1;
    } else if (arg === "--risk") {
      options.risks.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--evidence") {
      options.evidence.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.workspace || !options.outcome) {
    throw new Error("Missing required argument.");
  }

  options.outcome = normalizeText(options.outcome, "outcome");
  options.risks = options.risks.map((item) => normalizeText(item, "risk"));
  options.evidence = options.evidence.map((item) => normalizeText(item, "evidence"));

  if (options.sessionId && !isValidSessionId(options.sessionId)) {
    throw new Error("Session id must be a single path segment.");
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

function isValidSessionId(sessionId) {
  return typeof sessionId === "string" && sessionId.trim().length > 0 && !sessionId.includes("/") && !sessionId.includes("..");
}

function resolveSessionId(workspace, explicitSessionId) {
  const activeSessionPath = path.join(workspace, ".goalkeeper", "active-session");
  if (explicitSessionId) {
    return { sessionId: explicitSessionId, activeSessionPath, resolvedFromActive: false };
  }

  if (!fs.existsSync(activeSessionPath)) {
    throw new Error(`Missing --session and active session pointer: ${activeSessionPath}`);
  }

  const sessionId = fs.readFileSync(activeSessionPath, "utf8").trim();
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid active session id in ${activeSessionPath}`);
  }

  return { sessionId, activeSessionPath, resolvedFromActive: true };
}

function validateExistingJsonl(eventsPath) {
  if (!fs.existsSync(eventsPath)) return 0;
  const lines = fs.readFileSync(eventsPath, "utf8").split(/\r?\n/);
  let records = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    records += 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`Refusing to append to invalid JSONL at ${eventsPath}:${i + 1}: ${error.message}`);
    }
    validateEventRecord(parsed, eventsPath, i + 1);
  }
  return records;
}

function validateEventRecord(parsed, eventsPath, lineNumber) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid event at ${eventsPath}:${lineNumber}: event must be a JSON object`);
  }
  if (typeof parsed.ts !== "string" || Number.isNaN(Date.parse(parsed.ts))) {
    throw new Error(`Invalid event at ${eventsPath}:${lineNumber}: event ts must be a valid ISO timestamp string`);
  }
  if (typeof parsed.type !== "string" || !EVENT_TYPES.has(parsed.type)) {
    throw new Error(`Invalid event at ${eventsPath}:${lineNumber}: event type is missing or unknown: ${parsed.type}`);
  }
  if (typeof parsed.text !== "string" || parsed.text.trim().length === 0) {
    throw new Error(`Invalid event at ${eventsPath}:${lineNumber}: event text must be a non-empty string`);
  }
  if (parsed.status !== undefined && (typeof parsed.status !== "string" || !STATUSES.has(parsed.status))) {
    throw new Error(`Invalid event at ${eventsPath}:${lineNumber}: event status is unknown: ${parsed.status}`);
  }
}

function bulletList(items, fallback = "None recorded.") {
  const values = items.length > 0 ? items : [fallback];
  return values.map((item) => `- ${item}`).join("\n");
}

function renderClosedCheckpoint(existingCheckpoint, options, closedAt) {
  const withoutOldClosedSection = existingCheckpoint.replace(/\n## Closed\n[\s\S]*?(?=\n## |\s*$)/g, "").trimEnd();
  const withClosedStatus = withoutOldClosedSection.includes("- Current status:")
    ? withoutOldClosedSection.replace(/^- Current status: .*$/m, "- Current status: Closed.")
    : `${withoutOldClosedSection}\n\n## Status\n\n- Current status: Closed.`;

  return `${withClosedStatus}

## Closed

- Outcome: ${options.outcome}
- Closed at: ${closedAt}

## Residual Risks

${bulletList(options.risks)}

## Final Evidence

${bulletList(options.evidence)}
`;
}

function maybeRemoveActiveSession(activeSessionPath, sessionId) {
  if (!fs.existsSync(activeSessionPath)) {
    return { removed: false, reason: "active-session was already missing." };
  }

  const activeSessionId = fs.readFileSync(activeSessionPath, "utf8").trim();
  if (activeSessionId !== sessionId) {
    return {
      removed: false,
      reason: `active-session points to ${activeSessionId || "(empty)"}, not ${sessionId}.`,
    };
  }

  fs.rmSync(activeSessionPath);
  return { removed: true, reason: "active-session pointed to the closed session." };
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

  let resolvedSession;
  try {
    resolvedSession = resolveSessionId(workspace, options.sessionId);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const sessionDir = path.join(workspace, ".goalkeeper", "sessions", resolvedSession.sessionId);
  const checkpointPath = path.join(sessionDir, "checkpoint.md");
  const eventsPath = path.join(sessionDir, "events.jsonl");

  if (!fs.existsSync(sessionDir) || !fs.statSync(sessionDir).isDirectory()) {
    console.error(`Goalkeeper session directory is missing: ${sessionDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(checkpointPath)) {
    console.error(`Checkpoint is missing: ${checkpointPath}`);
    process.exit(1);
  }

  let existingRecords;
  try {
    existingRecords = validateExistingJsonl(eventsPath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const closedAt = new Date().toISOString();
  const event = {
    ts: closedAt,
    type: "close",
    text: options.outcome,
    status: "closed",
  };
  if (options.risks.length > 0) event.reason = `Residual risks: ${options.risks.join("; ")}`;
  if (options.evidence.length > 0) event.evidence = options.evidence.join("; ");

  fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`);

  const existingCheckpoint = fs.readFileSync(checkpointPath, "utf8");
  const checkpoint = renderClosedCheckpoint(existingCheckpoint, options, closedAt);
  fs.writeFileSync(checkpointPath, checkpoint);

  const activeSession = maybeRemoveActiveSession(resolvedSession.activeSessionPath, resolvedSession.sessionId);

  const result = {
    ok: true,
    workspace,
    sessionId: resolvedSession.sessionId,
    sessionDir,
    checkpointPath,
    eventsPath,
    lineNumber: existingRecords + 1,
    activeSessionPath: resolvedSession.activeSessionPath,
    activeSession,
    event,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Goalkeeper close: PASS");
  console.log(`Session: ${resolvedSession.sessionId}`);
  console.log(`Checkpoint: ${checkpointPath}`);
  console.log(`Events: ${eventsPath}`);
  console.log(`Active session removed: ${activeSession.removed ? "yes" : "no"}`);
}

main();
