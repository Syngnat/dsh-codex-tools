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

/** A plain UUID without the canonical `session-` prefix. */
const BARE_SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Try the canonical `session-` form first, then the bare UUID.
 *
 * Host lists contain both shapes: top-level sessions are normally
 * `session-<uuid>`, while subagent sessions keep a bare UUID. A caller that
 * copies a bare top-level UUID would otherwise fail with `session/not-found`
 * on the first send, so both shapes are tried in that order. The fallback is
 * only used for a not-found result, never for ownership or busy errors.
 */
function sessionIdCandidates(value) {
  const id = typeof value === "string" ? value.trim() : value;
  if (typeof id !== "string" || id.length === 0) return [id];
  if (id.startsWith("session-")) {
    const bare = id.slice("session-".length);
    return BARE_SESSION_UUID.test(bare) ? [id, bare] : [id];
  }
  return BARE_SESSION_UUID.test(id) ? [`session-${id}`, id] : [id];
}

/** Whether a Host failure means the addressed Session id does not exist. */
function isSessionNotFound(error) {
  if (error?.code === "session/not-found") return true;
  const message = String(error?.message ?? "");
  return /session\b[\s\S]*not found/i.test(message);
}

/**
 * Build one durable Agent-to-Agent message.
 *
 * `agent-message` + `form: "relay"` is the Host's cross-Agent attribution:
 * the client renders it as "来自会话 <senderSessionId>" and the recipient's
 * model sees the sender line before the prompt. The public
 * `sessionController.prompt` always rewrites the source to `kind: "user"`, so
 * steering a live Agent directly is the only path that preserves the sender.
 *
 * @param senderLabel - Human-readable sender label (title when known).
 * @param senderSessionId - Authoring session id.
 * @param text - Prompt body.
 * @returns A frozen user-role message accepted by `agent.steer`.
 */
function agentMessage(senderLabel, senderSessionId, text) {
  return Object.freeze({
    id: randomUUID(),
    role: "user",
    content: Object.freeze([
      Object.freeze({ type: "text", text: `Agent ${senderLabel} (${senderSessionId}) sent a message: ` }),
      Object.freeze({ type: "text", text }),
    ]),
    // The client renders this field as the relay label ("来自会话 …"); keep
    // the actual id in the content line for the recipient model.
    source: Object.freeze({ kind: "agent-message", form: "relay", senderSessionId: senderLabel }),
  });
}

/** Resolve the sender's session title, falling back to its id. */
async function senderLabel(sessions, senderId, signal) {
  if (typeof sessions.list !== "function") return senderId;
  try {
    const listed = await sessions.list({}, signal);
    const items = Array.isArray(listed?.items) ? listed.items : [];
    const row = items.find((item) => (item.sessionId ?? item.id) === senderId);
    const title = typeof row?.title === "string" ? row.title.trim() : "";
    return title.length > 0 ? title : senderId;
  } catch {
    return senderId;
  }
}

/** Read the authoring session id from the tool execution context. */
function senderSessionId(exec) {
  const agent = exec?.agent;
  const id = agent?.id ?? agent?.session?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * Deliver one Agent message to a live ordinary session.
 *
 * The public prompt path is intentionally bypassed only for a live ordinary
 * Agent: it preserves the sender source and can steer a target that is already
 * running a turn or a goal. Subagents keep the Host's ownership-checked prompt
 * path, and older Hosts without `resolveAgent`/`steer` fall back to `prompt`.
 *
 * @param sessions - Host session controller.
 * @param targetSessionId - Recipient session.
 * @param text - Prompt body.
 * @param senderId - Authoring session id.
 * @param label - Sender title or id for the relay label.
 * @param mode - `steer` by default; `queue` uses the target's next-turn inbox.
 * @returns true when the Agent path delivered the message.
 */
async function deliverAgentMessage(sessions, targetSessionId, text, senderId, label, mode) {
  if (typeof sessions.resolveAgent !== "function") return false;
  const resolved = await sessions.resolveAgent(targetSessionId);
  if (resolved?.error !== undefined) throw resolved.error;
  const target = resolved?.agent ?? resolved;
  if (typeof target?.steer !== "function") return false;
  // Keep the public ownership guard for subagents; only ordinary sessions are
  // steered directly. An ordinary target with no source agent still uses the
  // prompt path so no message is silently dropped.
  if (target.session?.header?.origin === "subagent") return false;
  const message = agentMessage(label, senderId, text);
  if (mode === "queue" && typeof target.followup === "function") target.followup(message);
  else target.steer(message);
  return true;
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
  for (const key of ["title", "cwd", "updatedAt", "createdAt", "archived", "agentPreset", "parentSessionId", "origin"]) {
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
      "Work with other Harness sessions. `dispatch` creates a session in a target workspace and sends it a complete task prompt in one step; use it to hand work to another project after you have finished the research here. `send` steers or continues an existing session immediately, even while it is running a turn or a goal, and the target bubble shows the sender session. `fork` branches a conversation, `rename` titles one, and the two `list_*` actions discover targets. Sessions you touch appear in the sidebar like any other, and the target runs on its own.",
    parameters: {
      action: {
        type: "string",
        required: true,
        enum: SESSION_ACTIONS,
        description:
          "`list_workspaces` lists registered projects. `list_sessions` lists top-level sessions (use `include_subagents` for subagents), optionally filtered to one workspace. `dispatch` creates a session and sends the prompt. `create` only creates. `send` adds a prompt to an existing session. `fork` branches a session at an optional event boundary. `rename` retitles a session.",
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
      include_subagents: {
        type: "boolean",
        description:
          "For `list_sessions`: include subagent sessions (bare UUID rows). Omitted or false lists top-level sessions only, which are the normal cross-session targets.",
      },
      mode: {
        type: "string",
        enum: ["queue", "steer"],
        description:
          "For `send`: `steer` (default) delivers an attributed agent message immediately, interrupting a running turn or goal; `queue` explicitly waits for the next turn.",
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
          // Subagent rows are internal and usually carry a bare UUID. Listing
          // them by default made a caller pick one and send to the wrong target,
          // so only top-level sessions are offered unless explicitly requested.
          let rows = args.include_subagents === true
            ? items
            : items.filter((item) => item.origin !== "subagent" && item.parentSessionId === undefined);
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
          const text = requireMessage(args);
          const mode = args.mode ?? "steer";
          const sender = senderSessionId(exec);
          exec.signal?.throwIfAborted?.();
          const label = sender === undefined ? undefined : await senderLabel(sessions, sender, exec.signal);
          const candidates = sessionIdCandidates(args.session_id);
          let lastError;
          for (let index = 0; index < candidates.length; index += 1) {
            const targetId = candidates[index];
            try {
              let delivered = false;
              if (sender !== undefined) delivered = await deliverAgentMessage(sessions, targetId, text, sender, label, mode);
              // Older Hosts, or a target the Host will not let us steer directly,
              // fall back to the public prompt path. It still defaults to steer.
              if (!delivered) await sessions.prompt(promptRequest(targetId, text, mode), exec.signal);
              return delivered
                ? `Delivered the agent message to session ${targetId}${mode === "steer" ? " immediately" : ""}.`
                : `Delivered the prompt to session ${targetId}.`;
            } catch (error) {
              lastError = error;
              if (index === candidates.length - 1 || !isSessionNotFound(error)) break;
            }
          }
          throw new Error(`session ${args.session_id} did not accept the prompt: ${describeFailure(lastError)}`);
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
