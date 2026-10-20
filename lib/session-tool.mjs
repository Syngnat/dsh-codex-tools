/**
 * `session_message` — start, steer and continue other Harness sessions.
 *
 * This is the cross-session capability: one session can hand a fully written
 * task to a brand-new session in another project, follow up on an existing one,
 * or fork its own conversation. It talks to the Host's own services
 * (`sessionController`, `workspaceRegistry`) rather than to storage, so the
 * target session appears in the sidebar exactly like one the user started.
 *
 * @module dsh-codex-tools/session-tool
 */

import { randomUUID } from "node:crypto";

/** Actions the tool exposes. */
export const SESSION_ACTIONS = ["list_workspaces", "list_sessions", "dispatch", "create", "send", "fork", "rename"];

/**
 * Build one prompt request.
 *
 * The Host records `requestId` on the accepted message and uses it for prompt
 * de-duplication and attachment binding, so every prompt carries a fresh one.
 * @param sessionId - Target session.
 * @param text - Prompt body.
 * @param mode - Optional delivery mode.
 * @returns A request for `sessionController.prompt`.
 */
function promptRequest(sessionId, text, mode) {
  return {
    sessionId,
    requestId: randomUUID(),
    content: [{ type: "text", text }],
    ...(mode === undefined ? {} : { mode }),
  };
}

/**
 * Turn a Host service failure into a message that names the actual cause.
 * @param error - Error raised by the Host.
 * @returns A diagnostic string.
 */
function describeFailure(error) {
  const parts = [String(error?.message ?? error)];
  const info = error?.info ?? error?.data;
  if (info !== undefined) {
    try {
      parts.push(JSON.stringify(info));
    } catch {
      parts.push(String(info));
    }
  }
  if (typeof error?.code === "string") parts.push(`code=${error.code}`);
  return parts.join(" ");
}

/** Resolve a workspace reference to a registry entity. */
function resolveWorkspace(registry, reference) {
  const entries = registry.list();
  const byId = entries.find((entry) => entry.id === reference);
  if (byId !== undefined) return byId;
  const byPath = entries.find((entry) => entry.path === reference);
  if (byPath !== undefined) return byPath;
  const needle = reference.toLowerCase();
  const byTitle = entries.find((entry) => (entry.title ?? "").toLowerCase().includes(needle));
  if (byTitle !== undefined) return byTitle;
  const byPathTail = entries.find((entry) => entry.path.toLowerCase().endsWith(`/${needle}`));
  return byPathTail;
}

/** Describe one workspace for model consumption. */
function describeWorkspace(entry) {
  return {
    id: entry.id,
    path: entry.path,
    ...(entry.title === undefined ? {} : { title: entry.title }),
    sessionCount: entry.sessionIds.length,
  };
}

/** Normalize one session summary into a compact row. */
function describeSession(item) {
  const row = { sessionId: item.sessionId ?? item.id };
  for (const key of ["title", "cwd", "updatedAt", "createdAt", "archived", "agentPreset"]) {
    if (item[key] !== undefined) row[key] = item[key];
  }
  return row;
}

/**
 * Build the `session_message` tool definition.
 * @param options - Wiring supplied by the plugin.
 * @param options.defineTool - The harness `defineTool` helper.
 * @param options.getService - `ctx.get` bound to the plugin context.
 * @returns A registry-ready tool definition.
 */
export function createSessionTool({ defineTool, getService }) {
  return defineTool({
    name: "session_message",
    description:
      "Work with other Harness sessions. `dispatch` creates a session in a target workspace and sends it a complete task prompt in one step; use it to hand work to another project after you have finished the research here. `send` steers or continues an existing session, `fork` branches a conversation, `rename` titles one, and the two `list_*` actions discover targets. Sessions you touch appear in the sidebar like any other, and the target runs on its own.",
    parameters: {
      action: {
        type: "string",
        required: true,
        enum: SESSION_ACTIONS,
        description:
          "`list_workspaces` lists registered projects. `list_sessions` lists sessions, optionally filtered to one workspace. `dispatch` creates a session and sends the prompt. `create` only creates. `send` adds a prompt to an existing session. `fork` branches a session at an optional event boundary. `rename` retitles a session.",
      },
      workspace: {
        type: "string",
        description:
          "Target workspace: its id, its absolute path, or part of its title. For `dispatch` and `create`, an absolute path that is not yet registered is created as a new workspace.",
      },
      session_id: {
        type: "string",
        description: "Target session id for `send`, `fork` and `rename`.",
      },
      message: {
        type: "string",
        description:
          "Prompt text for `dispatch` and `send`. Write it as a self-contained brief: the target session cannot see this conversation, so include the goal, the evidence you gathered, the files involved and what finished work looks like.",
      },
      title: {
        type: "string",
        description: "Optional session title for `dispatch`, `create` or `rename`.",
      },
      at_seq: {
        type: "number",
        description:
          "For `fork`, the inclusive event sequence to cut at. Omit to branch from the latest completed turn.",
      },
      mode: {
        type: "string",
        enum: ["queue", "steer"],
        description:
          "For `send`: `queue` (default) delivers the prompt as the next turn; `steer` interrupts the running turn with it.",
      },
    },
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      const sessions = getService("sessionController");
      if (sessions === undefined) {
        throw new Error(
          "session_message needs the Host session controller service, which this deployment does not mount",
        );
      }
      const registry = getService("workspaceRegistry");
      switch (args.action) {
        case "list_workspaces": {
          if (registry === undefined) throw new Error("session_message needs the Host workspace registry service");
          const rows = registry.list().map(describeWorkspace);
          return rows.length === 0 ? "No workspaces are registered yet." : JSON.stringify(rows, null, 2);
        }
        case "list_sessions": {
          const listed = await sessions.list({}, exec.signal);
          const items = Array.isArray(listed?.items) ? listed.items.map(describeSession) : [];
          let rows = items;
          if (args.workspace !== undefined) {
            if (registry === undefined) throw new Error("session_message needs the Host workspace registry service");
            const target = resolveWorkspace(registry, args.workspace);
            if (target === undefined) throw new Error(workspaceNotFound(args.workspace, registry));
            const ids = new Set(target.sessionIds);
            rows = items.filter((item) => ids.has(item.sessionId));
          }
          if (rows.length === 0) return "No matching sessions.";
          return JSON.stringify(rows, null, 2);
        }
        case "dispatch": {
          if (registry === undefined) throw new Error("session_message needs the Host workspace registry service");
          if (args.message === undefined || args.message.trim().length === 0) {
            throw new Error("dispatch needs a non-empty `message` describing the task for the target session");
          }
          const location = await resolveTargetLocation(registry, args.workspace);
          const created = await sessions.create(
            location.workspaceId === undefined ? { cwd: location.cwd } : { workspaceId: location.workspaceId },
          );
          const sessionId = created.sessionId;
          const notes = [];
          try {
            await sessions.prompt(promptRequest(sessionId, args.message), exec.signal);
          } catch (error) {
            throw new Error(
              `session ${sessionId} was created in ${location.description}, but the prompt was not accepted: ${describeFailure(error)}`,
            );
          }
          // Title after the prompt: renaming first resumes the Agent and leaves it
          // busy, which makes the Host reject the immediate prompt.
          if (args.title !== undefined && args.title.trim().length > 0) {
            try {
              await sessions.rename({ sessionId, title: args.title.trim() });
              notes.push(`titled "${args.title.trim()}"`);
            } catch (error) {
              notes.push(`title not applied (${describeFailure(error)})`);
            }
          }
          return [
            `Started session ${sessionId} in ${location.description}.`,
            `The prompt was accepted and the session is running on its own.`,
            ...notes,
            `Open it from the sidebar, or call session_message with action "send" and this session id to steer it.`,
          ].join("\n");
        }
        case "create": {
          if (registry === undefined) throw new Error("session_message needs the Host workspace registry service");
          const location = await resolveTargetLocation(registry, args.workspace);
          const created = await sessions.create(
            location.workspaceId === undefined ? { cwd: location.cwd } : { workspaceId: location.workspaceId },
          );
          if (args.title !== undefined && args.title.trim().length > 0) {
            try {
              await sessions.rename({ sessionId: created.sessionId, title: args.title.trim() });
            } catch {
              /* the session exists either way */
            }
          }
          return `Created session ${created.sessionId} in ${location.description}. Send it work with action "send".`;
        }
        case "send": {
          requireSessionId(args);
          try {
            await sessions.prompt(promptRequest(args.session_id, requireMessage(args), args.mode), exec.signal);
          } catch (error) {
            throw new Error(`session ${args.session_id} did not accept the prompt: ${describeFailure(error)}`);
          }
          return `Delivered the prompt to session ${args.session_id}.`;
        }
        case "fork": {
          requireSessionId(args);
          const request = { sessionId: args.session_id };
          if (args.at_seq !== undefined) request.atSeq = args.at_seq;
          const forked = await sessions.fork(request);
          const sessionId = forked?.sessionId ?? forked?.id ?? JSON.stringify(forked);
          const notes = [`Forked session ${args.session_id} into ${sessionId}.`];
          if (args.message !== undefined && args.message.trim().length > 0) {
            try {
              await sessions.prompt(promptRequest(sessionId, args.message), exec.signal);
              notes.push("The prompt was accepted by the fork.");
            } catch (error) {
              notes.push(`The prompt was not accepted: ${describeFailure(error)}`);
            }
          }
          if (args.title !== undefined && args.title.trim().length > 0) {
            try {
              await sessions.rename({ sessionId, title: args.title.trim() });
              notes.push(`titled "${args.title.trim()}"`);
            } catch {
              /* the fork exists either way */
            }
          }
          return notes.join(" ");
        }
        case "rename": {
          requireSessionId(args);
          if (args.title === undefined || args.title.trim().length === 0) {
            throw new Error("rename needs a non-empty `title`");
          }
          await sessions.rename({ sessionId: args.session_id, title: args.title.trim() });
          return `Renamed session ${args.session_id} to "${args.title.trim()}".`;
        }
        default:
          throw new Error(`unsupported session_message action "${String(args.action)}"`);
      }
    },
  });
}

/** Assert a session id was supplied. */
function requireSessionId(args) {
  if (args.session_id === undefined || args.session_id.length === 0) {
    throw new Error(`session_message action "${args.action}" needs a \`session_id\``);
  }
}

/** Assert prompt text was supplied. */
function requireMessage(args) {
  if (args.message === undefined || args.message.trim().length === 0) {
    throw new Error(`session_message action "${args.action}" needs a non-empty \`message\``);
  }
  return args.message;
}

/** Build a diagnostic listing the workspaces that do exist. */
function workspaceNotFound(reference, registry) {
  const known = registry
    .list()
    .map((entry) => `${entry.id} (${entry.path}${entry.title === undefined ? "" : `, ${entry.title}`})`)
    .join("; ");
  return `no workspace matches "${reference}". Registered workspaces: ${known.length === 0 ? "none" : known}`;
}

/**
 * Resolve where a new session should live, creating the workspace row when an
 * unregistered absolute path is named.
 * @param registry - Host workspace registry.
 * @param reference - Workspace id, path or title; omitted for the caller's default.
 * @returns Location descriptor with either a workspace id or a bare cwd.
 */
async function resolveTargetLocation(registry, reference) {
  if (reference === undefined || reference.length === 0) return { cwd: undefined, description: "the default directory" };
  const existing = resolveWorkspace(registry, reference);
  if (existing !== undefined) {
    return { workspaceId: existing.id, description: `workspace ${existing.id} at ${existing.path}` };
  }
  if (reference.startsWith("/")) {
    const created = await registry.create(reference);
    return { workspaceId: created.id, description: `new workspace ${created.id} at ${created.path}` };
  }
  throw new Error(workspaceNotFound(reference, registry));
}
