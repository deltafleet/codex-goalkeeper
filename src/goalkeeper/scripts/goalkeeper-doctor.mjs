#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const CHECKPOINT_TARGET_BYTES = 8_000;
const CHECKPOINT_MAX_BYTES = 16_000;
const CONTEXT_PACK_TARGET_BYTES = 30_000;
const CONTEXT_PACK_MAX_BYTES = 60_000;

const USAGE = `Usage:
  node scripts/goalkeeper-doctor.mjs --session <goal-session-id> [--workspace <path>] [--strict] [--json]

Checks whether a target workspace has enough Goalkeeper state and guardrails for long-running agent goal work.
This script is read-only.
`;

function parseArgs(argv) {
  const options = {
    sessionId: null,
    workspace: ".",
    strict: false,
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
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sessionId || !options.workspace) {
    throw new Error("Missing required argument.");
  }

  if (options.sessionId.includes("/") || options.sessionId.includes("..")) {
    throw new Error("Session id must be a single path segment.");
  }

  return options;
}

function check(status, name, message, details = {}) {
  return { status, name, message, ...(Object.keys(details).length > 0 ? { details } : {}) };
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function validateJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const invalid = [];
  const schemaErrors = [];
  let records = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    records += 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      invalid.push({ line: index + 1, message: error.message });
      if (invalid.length >= 5) break;
      continue;
    }

    const lineNumber = index + 1;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      schemaErrors.push({ line: lineNumber, message: "Event must be a JSON object." });
      continue;
    }

    if (typeof parsed.ts !== "string" || Number.isNaN(Date.parse(parsed.ts))) {
      schemaErrors.push({ line: lineNumber, message: "Event ts must be a valid ISO timestamp string." });
    }

    if (typeof parsed.type !== "string" || !EVENT_TYPES.has(parsed.type)) {
      schemaErrors.push({ line: lineNumber, message: `Event type is missing or unknown: ${parsed.type}` });
    }

    if (typeof parsed.text !== "string" || parsed.text.trim().length === 0) {
      schemaErrors.push({ line: lineNumber, message: "Event text must be a non-empty string." });
    }

    if (parsed.status !== undefined && (typeof parsed.status !== "string" || !STATUSES.has(parsed.status))) {
      schemaErrors.push({ line: lineNumber, message: `Event status is unknown: ${parsed.status}` });
    }

    if (parsed.files !== undefined && (!Array.isArray(parsed.files) || parsed.files.some((item) => typeof item !== "string" || !item))) {
      schemaErrors.push({ line: lineNumber, message: "Event files must be an array of non-empty strings." });
    }

    if (
      parsed.commands !== undefined &&
      (!Array.isArray(parsed.commands) || parsed.commands.some((item) => typeof item !== "string" || !item))
    ) {
      schemaErrors.push({ line: lineNumber, message: "Event commands must be an array of non-empty strings." });
    }
  }

  return { records, invalid, schemaErrors };
}

function validateActiveSessionPointer(filePath, expectedSessionId) {
  const sessionId = fs.readFileSync(filePath, "utf8").trim();
  if (!sessionId) {
    return { status: "fail", message: "active-session is empty.", sessionId };
  }
  if (sessionId.includes("/") || sessionId.includes("..")) {
    return { status: "fail", message: "active-session must contain a single session id path segment.", sessionId };
  }
  if (sessionId !== expectedSessionId) {
    return { status: "fail", message: `active-session points to ${sessionId}, not ${expectedSessionId}.`, sessionId };
  }
  return { status: "pass", message: "active-session points to the target session.", sessionId };
}

function listSessionDirs(sessionsRoot) {
  try {
    return fs
      .readdirSync(sessionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function guardrailStatus(workspace, strict) {
  const candidates = [
    { name: "AGENTS.md", path: path.join(workspace, "AGENTS.md") },
    { name: "CLAUDE.md", path: path.join(workspace, "CLAUDE.md") },
  ];
  const existing = candidates.filter((candidate) => fileExists(candidate.path));

  if (existing.length === 0) {
    return check(strict ? "fail" : "warn", "project_guardrail", "AGENTS.md or CLAUDE.md is missing.", {
      paths: candidates.map((candidate) => candidate.path),
    });
  }

  const inspected = existing.map((candidate) => {
    const text = fs.readFileSync(candidate.path, "utf8");
    return {
      ...candidate,
      hasGoalkeeperPath: text.includes(".goalkeeper/sessions"),
      hasCheckpoint: text.includes("checkpoint"),
      hasFirstActionLanguage: /start|before|first|resume|compaction|compact/i.test(text),
    };
  });
  const passing = inspected.find((candidate) => candidate.hasGoalkeeperPath && candidate.hasCheckpoint && candidate.hasFirstActionLanguage);

  if (passing) {
    return check("pass", "project_guardrail", `${passing.name} contains a Goalkeeper checkpoint-first guardrail.`, {
      path: passing.path,
    });
  }

  return check(
    strict ? "fail" : "warn",
    "project_guardrail",
    "AGENTS.md or CLAUDE.md exists but does not clearly contain the Goalkeeper checkpoint-first guardrail.",
    { paths: inspected.map((candidate) => candidate.path) },
  );
}

function runTurnStart(workspace, sessionId) {
  const scriptPath = fileURLToPath(new URL("./goalkeeper-turn-start.mjs", import.meta.url));
  if (!fileExists(scriptPath)) {
    return check("fail", "turn_start_helper", "goalkeeper-turn-start.mjs is missing next to doctor.", {
      path: scriptPath,
    });
  }

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--workspace", workspace, "--session", sessionId, "--json"],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    return check("fail", "turn_start_helper", "goalkeeper-turn-start.mjs could not read the checkpoint.", {
      status: result.status,
      stderr: result.stderr.trim(),
    });
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return check("pass", "turn_start_helper", "goalkeeper-turn-start.mjs can read the active checkpoint.", {
      checkpointPath: parsed.checkpointPath,
      checkpointBytes: parsed.checkpoint.length,
    });
  } catch (error) {
    return check("fail", "turn_start_helper", "goalkeeper-turn-start.mjs returned invalid JSON.", {
      message: error.message,
    });
  }
}

function inspectWorkspace(options) {
  const workspace = path.resolve(options.workspace);
  const activeSessionPath = path.join(workspace, ".goalkeeper", "active-session");
  const sessionsRoot = path.join(workspace, ".goalkeeper", "sessions");
  const sessionDir = path.join(workspace, ".goalkeeper", "sessions", options.sessionId);
  const checkpointPath = path.join(sessionDir, "checkpoint.md");
  const contextPackPath = path.join(sessionDir, "context-pack.md");
  const eventsPath = path.join(sessionDir, "events.jsonl");
  const checks = [];

  checks.push(
    isDirectory(workspace)
      ? check("pass", "workspace", "Workspace exists.", { path: workspace })
      : check("fail", "workspace", "Workspace does not exist or is not a directory.", { path: workspace }),
  );

  checks.push(
    isDirectory(sessionDir)
      ? check("pass", "session_dir", "Goalkeeper session directory exists.", { path: sessionDir })
      : check("fail", "session_dir", "Goalkeeper session directory is missing.", { path: sessionDir }),
  );

  if (fileExists(checkpointPath)) {
    const checkpoint = fs.readFileSync(checkpointPath, "utf8");
    const checkpointBytes = Buffer.byteLength(checkpoint);
    checks.push(
      checkpoint.trim().length > 0
        ? check("pass", "checkpoint", "Checkpoint exists and is non-empty.", {
            path: checkpointPath,
            bytes: checkpointBytes,
          })
        : check("fail", "checkpoint", "Checkpoint exists but is empty.", { path: checkpointPath }),
    );

    if (checkpointBytes <= CHECKPOINT_TARGET_BYTES) {
      checks.push(
        check("pass", "checkpoint_size", "Checkpoint is within the routine-read size target.", {
          bytes: checkpointBytes,
          targetBytes: CHECKPOINT_TARGET_BYTES,
          maxBytes: CHECKPOINT_MAX_BYTES,
        }),
      );
    } else if (checkpointBytes <= CHECKPOINT_MAX_BYTES) {
      checks.push(
        check("warn", "checkpoint_size", "Checkpoint is above the target size; compact stale details soon.", {
          bytes: checkpointBytes,
          targetBytes: CHECKPOINT_TARGET_BYTES,
          maxBytes: CHECKPOINT_MAX_BYTES,
        }),
      );
    } else {
      checks.push(
        check("fail", "checkpoint_size", "Checkpoint is too large for reliable routine recovery.", {
          bytes: checkpointBytes,
          targetBytes: CHECKPOINT_TARGET_BYTES,
          maxBytes: CHECKPOINT_MAX_BYTES,
        }),
      );
    }

    const expectedSections = ["goal", "constraint", "evidence", "next"];
    const lower = checkpoint.toLowerCase();
    const missingSections = expectedSections.filter((section) => !lower.includes(section));
    if (missingSections.length === 0) {
      checks.push(check("pass", "checkpoint_shape", "Checkpoint appears to contain goal, constraints, evidence, and next action."));
    } else {
      checks.push(
        check("warn", "checkpoint_shape", "Checkpoint is readable but may be too thin for reliable recovery.", {
          missingHints: missingSections,
        }),
      );
    }
  } else {
    checks.push(check("fail", "checkpoint", "Checkpoint is missing.", { path: checkpointPath }));
  }

  if (fileExists(eventsPath)) {
    const jsonl = validateJsonl(eventsPath);
    if (jsonl.invalid.length > 0) {
      checks.push(
        check("fail", "events_jsonl", "events.jsonl contains invalid JSON.", {
          path: eventsPath,
          invalid: jsonl.invalid,
        }),
      );
    } else if (jsonl.schemaErrors.length > 0) {
      checks.push(
        check("fail", "events_jsonl", "events.jsonl contains schema-invalid events.", {
          path: eventsPath,
          records: jsonl.records,
          schemaErrors: jsonl.schemaErrors.slice(0, 5),
        }),
      );
    } else {
      checks.push(
        check("pass", "events_jsonl", "events.jsonl exists and passes schema validation.", {
          path: eventsPath,
          records: jsonl.records,
        }),
      );
    }
  } else {
    checks.push(check("fail", "events_jsonl", "events.jsonl is missing.", { path: eventsPath }));
  }

  if (fileExists(contextPackPath)) {
    const contextPack = fs.readFileSync(contextPackPath, "utf8");
    const contextPackBytes = Buffer.byteLength(contextPack);
    if (contextPackBytes <= CONTEXT_PACK_TARGET_BYTES) {
      checks.push(
        check("pass", "context_pack", "context-pack.md exists and is within the medium-context target.", {
          path: contextPackPath,
          bytes: contextPackBytes,
          targetBytes: CONTEXT_PACK_TARGET_BYTES,
          maxBytes: CONTEXT_PACK_MAX_BYTES,
        }),
      );
    } else if (contextPackBytes <= CONTEXT_PACK_MAX_BYTES) {
      checks.push(
        check("warn", "context_pack", "context-pack.md is large; compact stale detail when possible.", {
          path: contextPackPath,
          bytes: contextPackBytes,
          targetBytes: CONTEXT_PACK_TARGET_BYTES,
          maxBytes: CONTEXT_PACK_MAX_BYTES,
        }),
      );
    } else {
      checks.push(
        check("fail", "context_pack", "context-pack.md is too large to use as a practical recovery aid.", {
          path: contextPackPath,
          bytes: contextPackBytes,
          targetBytes: CONTEXT_PACK_TARGET_BYTES,
          maxBytes: CONTEXT_PACK_MAX_BYTES,
        }),
      );
    }
  }

  if (fileExists(activeSessionPath)) {
    const activeSession = validateActiveSessionPointer(activeSessionPath, options.sessionId);
    checks.push(
      check(activeSession.status, "active_session", activeSession.message, {
        path: activeSessionPath,
        sessionId: activeSession.sessionId,
      }),
    );
  } else {
    const sessionDirs = listSessionDirs(sessionsRoot);
    if (sessionDirs.length > 1) {
      checks.push(
        check(
          options.strict ? "fail" : "warn",
          "active_session",
          "active-session is missing while multiple Goalkeeper sessions exist.",
          {
            path: activeSessionPath,
            sessions: sessionDirs,
          },
        ),
      );
    }
  }

  checks.push(guardrailStatus(workspace, options.strict));

  if (fileExists(checkpointPath)) {
    checks.push(runTurnStart(workspace, options.sessionId));
  }

  const failed = checks.filter((item) => item.status === "fail").length;
  const warned = checks.filter((item) => item.status === "warn").length;

  return {
    ok: failed === 0,
    strict: options.strict,
    workspace,
    sessionId: options.sessionId,
    sessionDir,
    activeSessionPath: fileExists(activeSessionPath) ? activeSessionPath : null,
    checkpointPath,
    eventsPath,
    checks,
    summary: {
      passed: checks.filter((item) => item.status === "pass").length,
      warned,
      failed,
    },
  };
}

function printText(result) {
  console.log(`Goalkeeper doctor: ${result.ok ? "PASS" : "FAIL"}`);
  console.log(`Workspace: ${result.workspace}`);
  console.log(`Session: ${result.sessionId}`);
  console.log(`Strict: ${result.strict ? "yes" : "no"}`);
  console.log("");

  for (const item of result.checks) {
    console.log(`- ${item.status.toUpperCase()} ${item.name}: ${item.message}`);
    if (item.details?.path) console.log(`  path: ${item.details.path}`);
    if (item.details?.paths) console.log(`  paths: ${item.details.paths.join(", ")}`);
    if (item.details?.sessionId) console.log(`  session id: ${item.details.sessionId}`);
    if (item.details?.bytes !== undefined) console.log(`  bytes: ${item.details.bytes}`);
    if (item.details?.records !== undefined) console.log(`  records: ${item.details.records}`);
    if (item.details?.sessions) console.log(`  sessions: ${item.details.sessions.join(", ")}`);
    if (item.details?.checkpointBytes !== undefined) console.log(`  checkpoint bytes: ${item.details.checkpointBytes}`);
    if (item.details?.missingHints) console.log(`  missing hints: ${item.details.missingHints.join(", ")}`);
    if (item.details?.errors) {
      for (const error of item.details.errors) {
        console.log(`  error: ${error}`);
      }
    }
    if (item.details?.schemaErrors) {
      for (const error of item.details.schemaErrors) {
        console.log(`  schema error line ${error.line}: ${error.message}`);
      }
    }
    if (item.details?.stderr) console.log(`  stderr: ${item.details.stderr.slice(0, 300)}`);
  }
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

  const result = inspectWorkspace(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }

  process.exit(result.ok ? 0 : 1);
}

main();
