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
export const SESSION_ACTIONS = ["list_workspaces", "list_sessions", "dispatch", "create", "send", "read", "fork", "rename"];

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

/** Keep only the attribution fields a reader needs from a durable source. */
function messageSource(source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return undefined;
  const compact = {};
  for (const key of ["kind", "form", "senderSessionId", "name"]) {
    if (typeof source[key] === "string" && source[key].length > 0) compact[key] = source[key];
  }
  return Object.keys(compact).length === 0 ? undefined : compact;
}

/** Extract one user/assistant text message from a durable event, if it has text. */
function messageFromEvent(event) {
  if (event?.type !== "user/message" && event?.type !== "assistant/message") return null;
  const data = event.data ?? {};
  const message = data.message ?? data;
  const content = Array.isArray(message.content) ? message.content : Array.isArray(data.content) ? data.content : [];
  const text = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (text.length === 0) return null;
  const role = typeof message.role === "string" ? message.role : typeof data.role === "string" ? data.role : event.type === "assistant/message" ? "assistant" : "user";
  const source = messageSource(message.source ?? data.source);
  return {
    seq: event.seq,
    role,
    ...(source === undefined ? {} : { source }),
    text,
  };
}

/**
 * Read the target Session's current model surface through the Host query
 * service. This bypasses the workspace-scoped `session_event_search` guard on
 * purpose: `session_message` already addresses sessions across workspaces, and
 * an AI-to-AI exchange is unreadable if the reply cannot be inspected.
 */
async function readSessionMessages(query, sessionId, limit, signal) {
  const read = typeof query.readSurface === "function"
    ? await query.readSurface(sessionId)
    : await query.readSession(sessionId);
  const events = Array.isArray(read?.events) ? read.events : [];
  const messages = [];
  for (const event of events) {
    const message = messageFromEvent(event);
    if (message !== null) messages.push(message);
  }
  let title;
  if (typeof query.readTitle === "function") {
    try {
      title = await query.readTitle(sessionId, signal);
    } catch {
      /* the title is optional; the session id remains the stable target */
    }
  }
  return {
    sessionId,
    ...(typeof title === "string" && title.trim().length > 0 ? { title: title.trim() } : {}),
    messages: messages.slice(-limit),
  };
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
  // Without a session title the label is already the id; printing it twice as
  // `Agent <id> (<id>)` is noise. Keep the title plus id only when they differ.
  const identity = senderLabel === senderSessionId ? senderLabel : `${senderLabel} (${senderSessionId})`;
  return Object.freeze({
    id: randomUUID(),
    role: "user",
    content: Object.freeze([
      Object.freeze({ type: "text", text: `Agent ${identity} 发来一条消息：` }),
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
/**
 * Leave a durable "sent" record in the sender's own transcript.
 *
 * DSH has no outgoing-message primitive: a cross-session send is a tool call,
 * so the sender only sees the tool result. Appending a user-role record at the
 * end of the sending turn gives the sender a visible bubble without feeding the
 * record back into the turn that performed the send. The record is marked so
 * the next turn does not mistake it for a fresh instruction.
 */
function scheduleSentEcho(agent, targetId, text) {
  const session = agent?.session;
  if (session === undefined || typeof session.append !== "function") return;
  if (typeof agent.ctx?.on !== "function") return;
  let appended = false;
  let off;
  const append = () => {
    if (appended) return;
    appended = true;
    try {
      session.append("user/message", {
        id: randomUUID(),
        role: "user",
        content: [{ type: "text", text: `【跨会话发送记录】已发送给会话 ${targetId}：\n${text}` }],
        source: { kind: "user", rpcId: randomUUID() },
      });
    } catch {
      /* the sender transcript is best-effort; delivery already succeeded */
    }
    if (typeof off === "function") off();
  };
  off = agent.ctx.on("session/event", (eventSession, event) => {
    if (event?.type !== "turn/end") return;
    if ((eventSession?.id ?? eventSession?.header?.id) !== agent.id) return;
    append();
  });
}

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
      "Work with other Harness sessions. `dispatch` creates a session in a target workspace and sends it a complete task prompt in one step; use it to hand work to another project after you have finished the research here. `send` steers or continues an existing session immediately, even while it is running a turn or a goal, and the target bubble shows the sender session. `read` returns the target session's recent user/assistant messages, including messages from other workspaces. `fork` branches a conversation, `rename` titles one, and the two `list_*` actions discover targets. Sessions you touch appear in the sidebar like any other, and the target runs on its own.",
    parameters: {
      action: {
        type: "string",
        required: true,
        enum: SESSION_ACTIONS,
        description:
          "`list_workspaces` lists registered projects. `list_sessions` lists top-level sessions (use `include_subagents` for subagents), optionally filtered to one workspace. `dispatch` creates a session and sends the prompt. `create` only creates. `send` adds a prompt to an existing session. `read` returns recent user/assistant messages from an existing session across workspaces. `fork` branches a session at an optional event boundary. `rename` retitles a session.",
      },
      workspace: {
        type: "string",
        description:
          "Target workspace: its id, its absolute path, or part of its title. For `dispatch` and `create`, an absolute path that is not yet registered is created as a new workspace.",
      },
      session_id: {
        type: "string",
        description: "Target session id for `send`, `read`, `fork` and `rename`.",
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
      limit: {
        type: "integer",
        description:
          "For `read`: number of most recent user/assistant messages to return, 1–100 (default 20).",
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
        case "read": {
          requireSessionId(args);
          const query = getService("sessionQuery");
          if (query === undefined) {
            throw new Error(
              "session_message needs the Host session query service, which this deployment does not mount",
            );
          }
          const limit = args.limit ?? 20;
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw new Error("read needs `limit` to be an integer between 1 and 100");
          }
          const candidates = sessionIdCandidates(args.session_id);
          let lastError;
          for (let index = 0; index < candidates.length; index += 1) {
            try {
              return JSON.stringify(await readSessionMessages(query, candidates[index], limit, exec.signal), null, 2);
            } catch (error) {
              lastError = error;
              if (index === candidates.length - 1 || !isSessionNotFound(error)) break;
            }
          }
          throw new Error(`could not read session ${args.session_id}: ${describeFailure(lastError)}`);
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
              scheduleSentEcho(exec.agent, targetId, text);
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
