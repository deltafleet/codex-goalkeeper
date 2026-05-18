#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const USAGE = `Usage:
  node scripts/goalkeeper-turn-start.mjs [--session <goal-session-id>] [--workspace <path>] [--events <n>] [--context] [--json]

Reads the active Goalkeeper checkpoint at the start of an agent turn.
This script reads only .goalkeeper state.
`;

function parseArgs(argv) {
  const options = {
    sessionId: null,
    workspace: ".",
    events: 0,
    context: false,
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
    } else if (arg === "--events") {
      options.events = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === "--context") {
      options.context = true;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.workspace || !Number.isInteger(options.events) || options.events < 0) {
    throw new Error("Missing or invalid required argument.");
  }

  if (options.sessionId && !isValidSessionId(options.sessionId)) {
    throw new Error("Session id must be a single path segment.");
  }

  return options;
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

function readRecentEvents(eventsPath, limit) {
  if (limit <= 0 || !fs.existsSync(eventsPath)) return [];
  const lines = fs
    .readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  return lines.slice(-limit);
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
  const checkpointPath = path.join(sessionDir, "checkpoint.md");
  const contextPackPath = path.join(sessionDir, "context-pack.md");
  const eventsPath = path.join(sessionDir, "events.jsonl");

  if (!fs.existsSync(checkpointPath)) {
    console.error(`Missing checkpoint: ${checkpointPath}`);
    process.exit(1);
  }

  const checkpoint = fs.readFileSync(checkpointPath, "utf8");
  const contextPack = options.context && fs.existsSync(contextPackPath) ? fs.readFileSync(contextPackPath, "utf8") : null;
  const recentEvents = readRecentEvents(eventsPath, options.events);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          sessionId: resolvedSession.sessionId,
          workspace,
          activeSessionPath: resolvedSession.activeSessionPath,
          checkpointPath,
          contextPackPath: fs.existsSync(contextPackPath) ? contextPackPath : null,
          eventsPath,
          checkpoint,
          contextPack,
          recentEvents,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`# Goalkeeper Turn Start`);
  console.log("");
  console.log(`Session: ${resolvedSession.sessionId}`);
  console.log(`Workspace: ${workspace}`);
  if (resolvedSession.activeSessionPath) {
    console.log(`Active session pointer: ${resolvedSession.activeSessionPath}`);
  }
  console.log(`Checkpoint: ${checkpointPath}`);
  if (fs.existsSync(contextPackPath)) {
    console.log(`Context pack: ${contextPackPath}${options.context ? "" : " (use --context when checkpoint is too thin)"}`);
  }
  console.log("");
  console.log(checkpoint.trimEnd());

  if (contextPack) {
    console.log("");
    console.log(contextPack.trimEnd());
  }

  if (recentEvents.length > 0) {
    console.log("");
    console.log(`## Recent Events`);
    for (const line of recentEvents) {
      console.log(line);
    }
  }
}

main();
