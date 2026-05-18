#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const SKILL_ROOT = path.join(REPO_ROOT, "src", "goalkeeper");
const TMP_ROOT = path.join(REPO_ROOT, ".goalkeeper", "tmp", "checkpoint-update");
const WORKSPACE = path.join(TMP_ROOT, "workspace");
const SESSION_ID = "checkpoint-update-poc";

function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    ...options,
  });
  return {
    ...result,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function script(name) {
  return path.join(SKILL_ROOT, "scripts", name);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function setupWorkspace() {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.writeFileSync(
    path.join(WORKSPACE, "AGENTS.md"),
    [
      "# Goalkeeper Guardrail",
      "",
      "At the start of each new assistant turn, before source work, read .goalkeeper/sessions/<goal-session-id>/checkpoint.md.",
      "This checkpoint-first rule applies after compaction, compact, start, resume, and before normal project work.",
      "",
    ].join("\n"),
  );
}

function main() {
  setupWorkspace();

  const init = run([
    script("goalkeeper-init.mjs"),
    "--workspace",
    WORKSPACE,
    "--session",
    SESSION_ID,
    "--goal",
    "Validate canonical checkpoint updates.",
    "--constraint",
    "Keep checkpoints short.",
    "--json",
  ]);
  assert(init.status === 0, `init failed:\n${init.stderr}\n${init.stdout}`);

  const append = run([
    script("goalkeeper-append-event.mjs"),
    "--workspace",
    WORKSPACE,
    "--type",
    "decision",
    "--text",
    "Use the update helper to rewrite checkpoint.md canonically.",
    "--json",
  ]);
  assert(append.status === 0, `append failed:\n${append.stderr}\n${append.stdout}`);
  const parsedAppend = JSON.parse(append.stdout);
  assert(parsedAppend.sessionId === SESSION_ID, "append helper should recover the session id from active-session");
  assert(parsedAppend.lineNumber === 4, "append helper should report the appended JSONL line number");

  const contextPackPath = path.join(WORKSPACE, ".goalkeeper", "sessions", SESSION_ID, "context-pack.md");
  assert(fs.existsSync(contextPackPath), "init should create context-pack.md");

  const turnStartWithContext = run([
    script("goalkeeper-turn-start.mjs"),
    "--workspace",
    WORKSPACE,
    "--context",
    "--json",
  ]);
  assert(turnStartWithContext.status === 0, `turn-start --context failed:\n${turnStartWithContext.stderr}\n${turnStartWithContext.stdout}`);
  const parsedTurnStart = JSON.parse(turnStartWithContext.stdout);
  assert(parsedTurnStart.contextPackPath === contextPackPath, "turn-start should report context-pack.md path");
  assert(parsedTurnStart.contextPack.includes("Context Pack"), "turn-start --context should include context pack content");

  const noActiveWorkspace = path.join(TMP_ROOT, "no-active-workspace");
  fs.mkdirSync(path.join(noActiveWorkspace, ".goalkeeper", "sessions", SESSION_ID), { recursive: true });
  fs.writeFileSync(path.join(noActiveWorkspace, ".goalkeeper", "sessions", SESSION_ID, "events.jsonl"), "");
  const appendWithoutActive = run([
    script("goalkeeper-append-event.mjs"),
    "--workspace",
    noActiveWorkspace,
    "--type",
    "decision",
    "--text",
    "This should fail because no active-session pointer exists.",
    "--json",
  ]);
  assert(appendWithoutActive.status === 1, "append without --session should fail when active-session is missing");

  const schemaInvalidWorkspace = path.join(TMP_ROOT, "schema-invalid-workspace");
  const schemaInvalidSessionDir = path.join(schemaInvalidWorkspace, ".goalkeeper", "sessions", SESSION_ID);
  fs.mkdirSync(schemaInvalidSessionDir, { recursive: true });
  fs.writeFileSync(path.join(schemaInvalidWorkspace, ".goalkeeper", "active-session"), `${SESSION_ID}\n`);
  fs.writeFileSync(
    path.join(schemaInvalidSessionDir, "events.jsonl"),
    `${JSON.stringify({ ts: "2026-05-18T00:00:00Z", type: "unknown", text: "bad existing event" })}\n`,
  );
  const appendToSchemaInvalid = run([
    script("goalkeeper-append-event.mjs"),
    "--workspace",
    schemaInvalidWorkspace,
    "--type",
    "decision",
    "--text",
    "This should fail because the existing event log is schema-invalid.",
    "--json",
  ]);
  assert(appendToSchemaInvalid.status === 1, "append should refuse an existing schema-invalid event log");

  const claudeGuardrailWorkspace = path.join(TMP_ROOT, "claude-guardrail-workspace");
  fs.mkdirSync(claudeGuardrailWorkspace, { recursive: true });
  fs.writeFileSync(
    path.join(claudeGuardrailWorkspace, "CLAUDE.md"),
    [
      "# Goalkeeper Guardrail",
      "",
      "At the start of each new assistant turn, before source work, read .goalkeeper/sessions/<goal-session-id>/checkpoint.md.",
      "This checkpoint-first rule applies after compaction, compact, start, resume, and before normal project work.",
      "",
    ].join("\n"),
  );
  const claudeInit = run([
    script("goalkeeper-init.mjs"),
    "--workspace",
    claudeGuardrailWorkspace,
    "--session",
    SESSION_ID,
    "--goal",
    "Validate CLAUDE.md guardrail support.",
    "--json",
  ]);
  assert(claudeInit.status === 0, `claude init failed:\n${claudeInit.stderr}\n${claudeInit.stdout}`);
  const claudeDoctor = run([
    script("goalkeeper-doctor.mjs"),
    "--workspace",
    claudeGuardrailWorkspace,
    "--session",
    SESSION_ID,
    "--strict",
    "--json",
  ]);
  assert(claudeDoctor.status === 0, `CLAUDE.md doctor failed:\n${claudeDoctor.stderr}\n${claudeDoctor.stdout}`);
  assert(JSON.parse(claudeDoctor.stdout).ok === true, "doctor should accept a CLAUDE.md-only guardrail");

  const update = run([
    script("goalkeeper-update-checkpoint.mjs"),
    "--workspace",
    WORKSPACE,
    "--goal",
    "Validate canonical checkpoint updates.",
    "--done",
    "Doctor passes after a helper-rendered checkpoint.",
    "--status",
    "Helper under test.",
    "--throughline",
    "Use deterministic CLI rendering instead of manual checkpoint Markdown.",
    "--why",
    "Long sessions need bounded state that can be safely refreshed after compacted turns.",
    "--constraint",
    "Keep checkpoint under the routine-read budget.",
    "--forbidden",
    "Do not paste long command output into checkpoint.md.",
    "--decision",
    "Render a canonical checkpoint from CLI fields.",
    "--attempt",
    "Manual checkpoint edits remain possible but are not the default path.",
    "--file",
    "scripts/goalkeeper-update-checkpoint.mjs",
    "--file",
    "docs/path with spaces.md",
    "--evidence",
    "This test rewrites checkpoint.md in a guarded temporary workspace.",
    "--verified",
    "Update helper exits 0.",
    "--unverified",
    "No real compact boundary is generated by this unit test.",
    "--risk",
    "Overlong input should fail before writing.",
    "--next",
    "Run strict doctor against the updated temporary workspace.",
    "--json",
  ]);
  assert(update.status === 0, `update failed:\n${update.stderr}\n${update.stdout}`);

  const parsedUpdate = JSON.parse(update.stdout);
  assert(parsedUpdate.bytes > 0 && parsedUpdate.bytes <= 8_000, "updated checkpoint should fit the default budget");

  const checkpointPath = path.join(WORKSPACE, ".goalkeeper", "sessions", SESSION_ID, "checkpoint.md");
  const checkpoint = fs.readFileSync(checkpointPath, "utf8");
  assert(checkpoint.includes("## Active Goal"), "checkpoint should include Active Goal section");
  assert(checkpoint.includes("## Context Pack"), "checkpoint should include Context Pack section");
  assert(checkpoint.includes("## Next Action"), "checkpoint should include Next Action section");
  assert(checkpoint.includes("scripts/goalkeeper-update-checkpoint.mjs"), "checkpoint should include important files");
  assert(checkpoint.includes("docs/path with spaces.md"), "checkpoint should preserve spaces in file paths");

  const beforeOversize = checkpoint;
  const oversize = run([
    script("goalkeeper-update-checkpoint.mjs"),
    "--workspace",
    WORKSPACE,
    "--goal",
    "Validate oversize refusal.",
    "--decision",
    "x".repeat(2_000),
    "--next",
    "This should not be written.",
    "--max-bytes",
    "1000",
    "--json",
  ]);
  assert(oversize.status === 1, "oversize checkpoint update should exit 1");
  assert(fs.readFileSync(checkpointPath, "utf8") === beforeOversize, "oversize failure should not rewrite checkpoint.md");

  const doctor = run([
    script("goalkeeper-doctor.mjs"),
    "--workspace",
    WORKSPACE,
    "--session",
    SESSION_ID,
    "--strict",
    "--json",
  ]);
  assert(doctor.status === 0, `doctor failed:\n${doctor.stderr}\n${doctor.stdout}`);
  const parsedDoctor = JSON.parse(doctor.stdout);
  assert(parsedDoctor.ok === true, "doctor JSON should be ok");

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspace: WORKSPACE,
        sessionId: SESSION_ID,
        checkpointBytes: parsedUpdate.bytes,
        doctor: parsedDoctor.summary,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
