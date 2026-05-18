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
]);

const STATUSES = new Set(["open", "done", "failed", "blocked", "superseded"]);

const USAGE = `Usage:
  node scripts/goalkeeper-append-event.mjs --type <event-type> --text <summary> [--session <goal-session-id>] [--workspace <path>] [--goal <text>] [--reason <text>] [--evidence <text>] [--status <status>] [--file <path> ...] [--command <cmd> ...] [--ts <iso>] [--json]

Appends one validated JSONL event to <workspace>/.goalkeeper/sessions/<goal-session-id>/events.jsonl.
This script writes only to the target events.jsonl file.
If --session is omitted, <workspace>/.goalkeeper/active-session is used.
`;

function parseArgs(argv) {
  const options = {
    sessionId: null,
    workspace: ".",
    type: null,
    text: null,
    goal: null,
    reason: null,
    evidence: null,
    status: null,
    files: [],
    commands: [],
    ts: null,
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
    } else if (arg === "--type") {
      options.type = argv[i + 1];
      i += 1;
    } else if (arg === "--text") {
      options.text = argv[i + 1];
      i += 1;
    } else if (arg === "--goal") {
      options.goal = argv[i + 1];
      i += 1;
    } else if (arg === "--reason") {
      options.reason = argv[i + 1];
      i += 1;
    } else if (arg === "--evidence") {
      options.evidence = argv[i + 1];
      i += 1;
    } else if (arg === "--status") {
      options.status = argv[i + 1];
      i += 1;
    } else if (arg === "--file") {
      options.files.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--command") {
      options.commands.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--ts") {
      options.ts = argv[i + 1];
      i += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.workspace || !options.type || !options.text) {
    throw new Error("Missing required argument.");
  }

  if (options.sessionId && !isValidSessionId(options.sessionId)) {
    throw new Error("Session id must be a single path segment.");
  }

  if (!EVENT_TYPES.has(options.type)) {
    throw new Error(`Unknown event type: ${options.type}`);
  }

  if (options.status && !STATUSES.has(options.status)) {
    throw new Error(`Unknown status: ${options.status}`);
  }

  if (options.ts && Number.isNaN(Date.parse(options.ts))) {
    throw new Error(`Invalid timestamp: ${options.ts}`);
  }

  for (const value of [...options.files, ...options.commands]) {
    if (!value) throw new Error("Repeated --file and --command values must not be empty.");
  }

  return options;
}

function validateExistingJsonl(eventsPath) {
  if (!fs.existsSync(eventsPath)) return 0;
  const lines = fs.readFileSync(eventsPath, "utf8").split(/\r?\n/);
  let records = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    records += 1;
    try {
      const parsed = JSON.parse(line);
      validateEventRecord(parsed, eventsPath, i + 1);
    } catch (error) {
      throw new Error(`Refusing to append to invalid JSONL at ${eventsPath}:${i + 1}: ${error.message}`);
    }
  }
  return records;
}

function validateEventRecord(parsed, eventsPath, lineNumber) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("event must be a JSON object");
  }

  if (typeof parsed.ts !== "string" || Number.isNaN(Date.parse(parsed.ts))) {
    throw new Error("event ts must be a valid ISO timestamp string");
  }

  if (typeof parsed.type !== "string" || !EVENT_TYPES.has(parsed.type)) {
    throw new Error(`event type is missing or unknown: ${parsed.type}`);
  }

  if (typeof parsed.text !== "string" || parsed.text.trim().length === 0) {
    throw new Error("event text must be a non-empty string");
  }

  if (parsed.status !== undefined && (typeof parsed.status !== "string" || !STATUSES.has(parsed.status))) {
    throw new Error(`event status is unknown: ${parsed.status}`);
  }

  if (parsed.files !== undefined && (!Array.isArray(parsed.files) || parsed.files.some((item) => typeof item !== "string" || !item))) {
    throw new Error("event files must be an array of non-empty strings");
  }

  if (
    parsed.commands !== undefined &&
    (!Array.isArray(parsed.commands) || parsed.commands.some((item) => typeof item !== "string" || !item))
  ) {
    throw new Error("event commands must be an array of non-empty strings");
  }

  return { eventsPath, lineNumber };
}

function buildEvent(options) {
  const event = {
    ts: options.ts || new Date().toISOString(),
    type: options.type,
    text: options.text,
  };

  if (options.goal) event.goal = options.goal;
  if (options.reason) event.reason = options.reason;
  if (options.evidence) event.evidence = options.evidence;
  if (options.files.length > 0) event.files = options.files;
  if (options.commands.length > 0) event.commands = options.commands;
  if (options.status) event.status = options.status;

  return event;
}

function isValidSessionId(sessionId) {
  return typeof sessionId === "string" && sessionId.trim().length > 0 && !sessionId.includes("/") && !sessionId.includes("..");
}

function resolveSessionId(workspace, explicitSessionId) {
  if (explicitSessionId) {
    return { sessionId: explicitSessionId, activeSessionPath: null };
  }

  const activeSessionPath = path.join(workspace, ".goalkeeper", "active-session");
  if (!fs.existsSync(activeSessionPath)) {
    throw new Error(`Missing --session and active session pointer: ${activeSessionPath}`);
  }

  const sessionId = fs.readFileSync(activeSessionPath, "utf8").trim();
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid active session id in ${activeSessionPath}`);
  }

  return { sessionId, activeSessionPath };
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
  let resolvedSession;
  try {
    resolvedSession = resolveSessionId(workspace, options.sessionId);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const sessionDir = path.join(workspace, ".goalkeeper", "sessions", resolvedSession.sessionId);
  const eventsPath = path.join(sessionDir, "events.jsonl");

  if (!fs.existsSync(sessionDir) || !fs.statSync(sessionDir).isDirectory()) {
    console.error(`Goalkeeper session directory is missing: ${sessionDir}`);
    process.exit(1);
  }

  const existingRecords = validateExistingJsonl(eventsPath);

  const event = buildEvent(options);
  fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`);

  const result = {
    ok: true,
    workspace,
    sessionId: resolvedSession.sessionId,
    activeSessionPath: resolvedSession.activeSessionPath,
    eventsPath,
    lineNumber: existingRecords + 1,
    event,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Goalkeeper append-event: PASS");
  console.log(`Events: ${eventsPath}`);
  console.log(`Line: ${result.lineNumber}`);
  console.log(`Type: ${event.type}`);
  console.log(`Text: ${event.text}`);
}

main();
