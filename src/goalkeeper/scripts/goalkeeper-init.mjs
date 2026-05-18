#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const USAGE = `Usage:
  node scripts/goalkeeper-init.mjs --session <goal-session-id> --goal <text> [--workspace <path>] [--constraint <text> ...] [--no-activate] [--force] [--json]

Creates a project-local Goalkeeper session with checkpoint.md, context-pack.md, and events.jsonl.
This script writes only under <workspace>/.goalkeeper/sessions/<goal-session-id>/.
`;

function parseArgs(argv) {
  const options = {
    sessionId: null,
    goal: null,
    workspace: ".",
    constraints: [],
    activate: true,
    force: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--session") {
      options.sessionId = argv[i + 1];
      i += 1;
    } else if (arg === "--goal") {
      options.goal = argv[i + 1];
      i += 1;
    } else if (arg === "--workspace") {
      options.workspace = argv[i + 1];
      i += 1;
    } else if (arg === "--constraint") {
      options.constraints.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--no-activate") {
      options.activate = false;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sessionId || !options.goal || !options.workspace) {
    throw new Error("Missing required argument.");
  }

  if (options.sessionId.includes("/") || options.sessionId.includes("..")) {
    throw new Error("Session id must be a single path segment.");
  }

  if (options.constraints.some((constraint) => !constraint)) {
    throw new Error("Constraint text must not be empty.");
  }

  return options;
}

function eventLine(record) {
  return `${JSON.stringify(record)}\n`;
}

function renderCheckpoint({ sessionId, goal, constraints, createdAt }) {
  const constraintLines =
    constraints.length > 0
      ? constraints.map((constraint) => `- ${constraint}`).join("\n")
      : "- None recorded yet.";

  return `# Checkpoint: ${sessionId}

## Active Goal

${goal}

## Current Throughline

Initial Goalkeeper session created. Replace this section with the actual working direction after the first meaningful decision or investigation result.

## Constraints

${constraintLines}

## Evidence

- Initialized at ${createdAt}.
- Runtime state is project-local under \`.goalkeeper/sessions/${sessionId}/\`.

## Open Risks

- This is a seed checkpoint. It is not yet proof that recovery works for the project.
- Add failed attempts, verification results, and exact next actions as the session develops.

## Next Action

Run Goalkeeper doctor for this workspace, then continue the goal and update this checkpoint after the first meaningful state change.
`;
}

function renderContextPack({ sessionId, goal, constraints, createdAt }) {
  const constraintLines =
    constraints.length > 0
      ? constraints.map((constraint) => `- ${constraint}`).join("\n")
      : "- None recorded yet.";

  return `# Context Pack: ${sessionId}

## Purpose

This file preserves medium-density context that is too detailed for checkpoint.md but too important to rely on compacted conversation memory.

Read this file when checkpoint.md is too thin, when resuming after a long gap, or before changing direction on a long-running goal.

## Active Goal

${goal}

## Durable Constraints

${constraintLines}

## Working Model

- Not recorded yet.

## Decision Chain

- Not recorded yet.

## Rejected Alternatives

- Not recorded yet.

## Open Threads

- Not recorded yet.

## Evidence Index

- Initialized at ${createdAt}.
- Atomic events live in \`.goalkeeper/sessions/${sessionId}/events.jsonl\`.

## Maintenance Notes

- Keep checkpoint.md short enough to read every turn.
- Use this file for the larger explanation that helps reconstruct pre-compaction reasoning.
- Do not paste raw transcripts or long command output here.
`;
}

function buildEvents({ goal, constraints, createdAt }) {
  const events = [
    {
      ts: createdAt,
      type: "goal",
      text: goal,
      status: "open",
    },
  ];

  for (const constraint of constraints) {
    events.push({
      ts: createdAt,
      type: "user_constraint",
      text: constraint,
    });
  }

  events.push({
    ts: createdAt,
    type: "next_action",
    text: "Run Goalkeeper doctor, then update checkpoint.md after the first meaningful state change.",
    status: "open",
  });

  return events.map(eventLine).join("");
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
  const goalkeeperDir = path.join(workspace, ".goalkeeper");
  const sessionDir = path.join(workspace, ".goalkeeper", "sessions", options.sessionId);
  const checkpointPath = path.join(sessionDir, "checkpoint.md");
  const contextPackPath = path.join(sessionDir, "context-pack.md");
  const eventsPath = path.join(sessionDir, "events.jsonl");
  const activeSessionPath = path.join(goalkeeperDir, "active-session");

  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    console.error(`Workspace does not exist or is not a directory: ${workspace}`);
    process.exit(1);
  }

  if (!options.force && (fs.existsSync(checkpointPath) || fs.existsSync(contextPackPath) || fs.existsSync(eventsPath))) {
    console.error(`Goalkeeper session already exists: ${sessionDir}`);
    console.error("Use --force only if you intentionally want to overwrite checkpoint.md, context-pack.md, and events.jsonl.");
    process.exit(1);
  }

  const createdAt = new Date().toISOString();
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(
    checkpointPath,
    renderCheckpoint({
      sessionId: options.sessionId,
      goal: options.goal,
      constraints: options.constraints,
      createdAt,
    }),
  );
  fs.writeFileSync(
    contextPackPath,
    renderContextPack({
      sessionId: options.sessionId,
      goal: options.goal,
      constraints: options.constraints,
      createdAt,
    }),
  );
  fs.writeFileSync(
    eventsPath,
    buildEvents({
      goal: options.goal,
      constraints: options.constraints,
      createdAt,
    }),
  );
  if (options.activate) {
    fs.writeFileSync(activeSessionPath, `${options.sessionId}\n`);
  }

  const result = {
    ok: true,
    workspace,
    sessionId: options.sessionId,
    sessionDir,
    checkpointPath,
    contextPackPath,
    eventsPath,
    activeSessionPath: options.activate ? activeSessionPath : null,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Goalkeeper init: PASS");
  console.log(`Workspace: ${workspace}`);
  console.log(`Session: ${options.sessionId}`);
  console.log(`Checkpoint: ${checkpointPath}`);
  console.log(`Context pack: ${contextPackPath}`);
  console.log(`Events: ${eventsPath}`);
  if (options.activate) {
    console.log(`Active session: ${activeSessionPath}`);
  }
}

main();
