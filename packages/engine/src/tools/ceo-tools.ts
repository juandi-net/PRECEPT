import type { ToolDefinition, ToolHandler } from '../ai/invoke.js';
import { stopOrgContainer } from '../infra/container-manager.js';
import { createInitiative, getActiveInitiatives, updateInitiativeRepoUrl, updateInitiativeStatus, softDeleteInitiative } from '../db/initiatives.js';
import { createTasks, getTask, getTasksByInitiative, updateEscalationDiagnosis, softDeleteTask, type CreateTaskParams } from '../db/tasks.js';
import { applyTransition } from '../orchestration/state-machine.js';
import { getRecentEvents, logEvent } from '../db/audit.js';
import { getLatestCornerstone } from '../db/cornerstone.js';
import { resolveCredentials } from '../lib/credentials.js';
import { listCredentials, storeCredential, getCredentialValue } from '../db/credentials.js';
import { db } from '../db/client.js';
import { CORNERSTONE_FIELDS, FIELD_LABELS, type CornerstoneDraft, type TaskPriority } from '@precept/shared';
import { createIssue, addComment } from '../lib/linear.js';
import { searchPlanningHistory } from '../db/planning-history.js';
import { sendAdhocEmail, sendBatchBoardRequestEmail } from '../lib/email.js';
import { createThread, insertEmailMessage } from '../db/email-threads.js';
import { getOrg, getOwnerLastSeen } from '../db/orgs.js';
import { computeOwnerPresence } from '../ai/prompts/ceo-chat.js';
import { createBoardRequest, updateBoardRequestThreadId, getPendingBoardRequests, resolveBoardRequest } from '../db/boardRequests.js';
import { embedText } from '../lib/embeddings.js';
import { matchRoleMemory } from '../db/role-memory.js';

export const CEO_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_initiatives',
      description: 'Search active initiatives by keyword. Returns matching initiatives with their status. Use when the owner asks about specific work — if no results, fall back to list_initiatives.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search keyword' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Get tasks for a specific initiative with their outputs and states. Use after finding an initiative to drill into its work items.',
      parameters: {
        type: 'object',
        properties: { initiative_id: { type: 'string', description: 'Initiative UUID' } },
        required: ['initiative_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_audit',
      description: 'Search recent audit log activity by keyword. Use to find what happened — task completions, failures, dispatches, emails sent.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keyword' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cornerstone',
      description: "Read the organization's Cornerstone — its mission, goals, and strategic constraints. Reference this when discussing strategy or prioritization.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_initiatives',
      description: 'List all active initiatives. Use when you need a full picture of current work without guessing search terms.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'linear',
      description: 'Write to Linear. Create issues or add comments to existing issues.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create_issue', 'comment'], description: 'The Linear operation to perform' },
          title: { type: 'string', description: 'Issue title. Required for create_issue.' },
          description: { type: 'string', description: 'Issue description or comment body (markdown).' },
          priority: { type: 'number', enum: [1, 2, 3, 4], description: '1=Urgent, 2=High, 3=Medium, 4=Low. For create_issue only.' },
          issue_id: { type: 'string', description: 'Linear issue ID. Required for comment.' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_planning_history',
      description: 'Search the organization\'s full planning history — past decisions, CEO reasoning, initiative outcomes, task patterns. Use when you need to recall a past strategy, check if something was tried before, or find context behind a previous decision. Returns results ranked by relevance.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query (e.g., "outreach strategy", "why we paused the website redesign")' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: "Create a task and dispatch it immediately. Use when the owner gives a direct command that implies work — 'build X', 'research Y', 'fix Z'. NOT for sending emails (use send_email) or requesting decisions (use board_requests). If no initiative_id is provided, a new initiative is created.",
      parameters: {
        type: 'object',
        properties: {
          initiative_id: { type: 'string', description: 'Existing initiative UUID (optional — omit to create new)' },
          initiative_name: { type: 'string', description: 'Name for new initiative (required if no initiative_id)' },
          initiative_description: { type: 'string', description: 'Description for new initiative (optional)' },
          role: { type: 'string', enum: ['researcher', 'coder', 'writer', 'analyst', 'ops'], description: 'Worker role' },
          title: { type: 'string', description: 'Concise task label, max 8 words. Shown in ticker and navigation. NOT the full description.' },
          description: { type: 'string', description: 'Task description' },
          acceptance_criteria: { type: 'array', items: { type: 'string' }, description: 'List of acceptance criteria' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Task priority' },
          required_credentials: { type: 'array', items: { type: 'string' }, description: 'Credential key names the worker needs in their environment (e.g. ["cloudflare_api_token"])' },
        },
        required: ['role', 'title', 'description', 'acceptance_criteria', 'priority'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_repo',
      description: 'Create a new GitHub repository in the org. Stores the clone URL on the initiative. Deletion requires a Board Request.',
      parameters: {
        type: 'object',
        properties: {
          initiative_id: { type: 'string', description: 'Initiative UUID to attach the repo to' },
          name: { type: 'string', description: 'Repository name (e.g. "my-service")' },
          description: { type: 'string', description: 'Short repo description (optional)' },
        },
        required: ['initiative_id', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_planning',
      description: 'Trigger an ad-hoc planning cycle. Use when the owner says something that implies strategic replanning — e.g. "pivot to X", "drop everything and focus on Y", "we need to change direction". Do NOT use for simple task requests — use create_task for those.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why this warrants a replanning cycle' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to the owner. Use for delivering results, sharing links, or communicating anything that should land in their inbox — not for decisions that need approval (use board_requests for those). The email is sent immediately via the organization\'s configured email domain.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Email subject line' },
          body_html: { type: 'string', description: 'Email body as HTML. Use <p>, <a>, <ul> tags. Keep it concise.' },
          thread_id: { type: 'string', description: 'Existing email thread UUID to reply in (optional — omit to start a new thread)' },
        },
        required: ['subject', 'body_html'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'board_requests',
      description: 'Manage board requests. Create new requests for owner decisions, list pending requests, or resolve completed ones. Use create when you need authorization or a strategic call from the owner. Use list to review pending decisions. Use resolve when a request is handled or no longer relevant.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'list', 'resolve'], description: 'The board request operation to perform' },
          content: { type: 'string', description: 'The request — what decision or approval is needed. Required for create.' },
          context: { type: 'string', description: 'Background context the owner needs. Required for create.' },
          urgency: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How urgently the decision is needed. Required for create.' },
          fallback: { type: 'string', description: 'What the CEO will do if the owner does not respond. For create only.' },
          id: { type: 'string', description: 'Board request UUID. Required for resolve.' },
          resolution: { type: 'string', description: 'How the request was resolved. Required for resolve.' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'credentials',
      description: `Manage org credentials. Actions: list (show all configured credentials), store (save a new credential), revoke (neutralize a compromised credential).

When storing: service_key must be lowercase_snake_case (e.g. cloudflare_api_token). Extract ONLY the credential string from the owner's message — strip surrounding text, quotes, backticks. Confirm by key name only, never repeat the value. Always dispatch a verification task after storing.

When revoking: overwrites the value with a sentinel so downstream systems detect the revoked state. To restore, store a new value.`,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'store', 'revoke'], description: 'The credential operation to perform' },
          key: { type: 'string', description: 'Credential key name in lowercase_snake_case. Required for store and revoke.' },
          value: { type: 'string', description: 'The credential value. Required for store only.' },
          description: { type: 'string', description: 'Brief capability description for store (e.g. "DNS, Pages, Workers, R2 for example.org").' },
          reason: { type: 'string', description: 'Why this credential is being revoked. Required for revoke only.' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'org_admin',
      description: 'Administrative operations on the organization. Use for housekeeping: deleting stale initiatives or tasks, updating initiative status, checking owner presence. Use delete_initiative when the owner asks to clean up old/stale work. Deleting an initiative also deletes all its tasks. Use update_initiative_status to mark initiatives as completed, paused, or abandoned.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['delete_initiative', 'delete_task', 'update_initiative_status', 'check_owner_presence'],
            description: 'The administrative action to perform',
          },
          id: {
            type: 'string',
            description: 'Initiative or task ID. Required for delete and status update actions.',
          },
          status: {
            type: 'string',
            enum: ['completed', 'paused', 'abandoned'],
            description: 'New status. Required for update_initiative_status only.',
          },
          reason: {
            type: 'string',
            description: 'Why this action is being taken. Required for delete and status update actions. Logged to audit.',
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_escalation',
      description: 'Close out an escalated task after diagnosing and acting on it. Use after you have re-dispatched a replacement task (redispatched), decided the work is no longer needed (cancelled), or handled the issue yourself (resolved_directly). This removes the escalation from The Interface.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the escalated task' },
          resolution: {
            type: 'string',
            enum: ['redispatched', 'cancelled', 'resolved_directly'],
            description: 'How the escalation was resolved',
          },
          note: { type: 'string', description: 'What you did and why — recorded for audit trail' },
        },
        required: ['task_id', 'resolution', 'note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information. Use this to answer factual questions, research companies, find current data — anything you can look up yourself instead of creating a researcher task. Returns top results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results (default 5, max 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_role_memory',
      description: "Search what a specific worker role knows from past tasks. Use this to check if your team already has relevant knowledge before creating a new research task. Returns semantically similar entries from the role's memory.",
      parameters: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['researcher', 'coder', 'writer', 'analyst', 'ops'], description: 'Which role to search' },
          query: { type: 'string', description: 'What to search for (natural language)' },
          limit: { type: 'number', description: 'Max results (default 5, max 10)' },
        },
        required: ['role', 'query'],
      },
    },
  },
];

export function createCeoToolHandler(
  orgId: string,
  onDispatch?: (taskId: string) => void,
  onAdhocPlan?: () => void,
  onResolveAccepted?: (taskId: string) => void,
): ToolHandler {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case 'search_initiatives': {
        const query = (args.query as string).toLowerCase();
        const initiatives = await getActiveInitiatives(orgId);
        const matches = initiatives.filter(i =>
          i.name.toLowerCase().includes(query) ||
          i.description?.toLowerCase().includes(query)
        );
        // If no matches, return all initiatives so CEO can browse
        const results = matches.length > 0 ? matches : initiatives;
        return JSON.stringify({
          exact_matches: matches.length,
          results: results.map(i => ({
            id: i.id,
            name: i.name,
            status: i.status,
            phase: i.phase_current,
          })),
        });
      }

      case 'get_tasks': {
        const initiativeId = args.initiative_id as string;
        const tasks = await getTasksByInitiative(initiativeId);
        return JSON.stringify(tasks.map(t => ({
          id: t.id,
          title: t.spec.title,
          state: t.state,
          role: t.role,
          phase: t.phase,
          output: t.output?.output?.substring(0, 500) ?? null,
        })));
      }

      case 'search_audit': {
        const query = (args.query as string).toLowerCase();
        const limit = (args.limit as number) ?? 20;
        const events = await getRecentEvents(orgId, limit * 2);
        const matches = events.filter(e =>
          e.event_type.toLowerCase().includes(query) ||
          JSON.stringify(e.metadata).toLowerCase().includes(query)
        ).slice(0, limit);
        return JSON.stringify(matches.map(e => ({
          event_type: e.event_type,
          agent: e.agent_id,
          created_at: e.created_at,
          detail: e.metadata,
        })));
      }

      case 'get_cornerstone': {
        const cornerstone = await getLatestCornerstone(orgId);
        if (!cornerstone) return 'No cornerstone found.';
        const sections: string[] = [];
        for (const field of CORNERSTONE_FIELDS) {
          const f = (cornerstone.content as CornerstoneDraft)[field];
          if (!f?.content) continue;
          sections.push(`## ${FIELD_LABELS[field]}\n\n${f.content}`);
        }
        return sections.join('\n\n');
      }

      case 'list_initiatives': {
        const initiatives = await getActiveInitiatives(orgId);
        return JSON.stringify(initiatives.map(i => ({
          id: i.id,
          name: i.name,
          description: i.description,
          status: i.status,
          phase: i.phase_current,
        })));
      }

      case 'search_planning_history': {
        const query = args.query as string;
        const limit = (args.limit as number) ?? 20;
        const results = await searchPlanningHistory(orgId, query, limit);
        return JSON.stringify(results.map(r => ({
          source: r.source,
          type: r.event_type ?? r.decision_type,
          agent: r.agent_id,
          date: r.created_at,
          summary: r.summary,
        })));
      }

      case 'create_task': {
        console.log('[ceo-tools] create_task called with:', JSON.stringify(args));
        try {
          const role = args.role as string;
          let description = args.description as string;

          // Extract and enforce title
          let title = (args.title as string) ?? '';
          if (!title) {
            // Fallback: first 8 words of description
            title = description.split(/\s+/).slice(0, 8).join(' ');
          }
          // Trim to 8 words max
          const words = title.split(/\s+/);
          if (words.length > 8) {
            title = words.slice(0, 8).join(' ') + '...';
          }

          // Defensive: LLMs sometimes pass acceptance_criteria as a JSON string
          let rawCriteria: unknown = args.acceptance_criteria;
          if (typeof rawCriteria === 'string') {
            try { rawCriteria = JSON.parse(rawCriteria); } catch { rawCriteria = [rawCriteria]; }
          }
          const acceptanceCriteria = rawCriteria as string[];
          const priority = args.priority as string;
          const requiredCredentials = (args.required_credentials as string[]) ?? undefined;

          // Resolve or create initiative
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let initiativeId = args.initiative_id as string | undefined;
          if (initiativeId && !UUID_RE.test(initiativeId)) {
            // Model passed a name instead of a UUID — look up by name
            const initiatives = await getActiveInitiatives(orgId);
            const match = initiatives.find(i => i.name.toLowerCase() === initiativeId!.toLowerCase());
            if (match) {
              initiativeId = match.id;
            } else {
              // No match — create a new initiative using the provided value as the name
              const initiative = await createInitiative({ orgId, name: initiativeId, description: description });
              initiativeId = initiative.id;
            }
          } else if (!initiativeId) {
            const name = (args.initiative_name as string) || 'Owner-directed task';
            const desc = (args.initiative_description as string) || description;
            const initiative = await createInitiative({ orgId, name, description: desc });
            initiativeId = initiative.id;
          }

          // Append org GitHub context so workers can run gh commands directly
          const creds = await resolveCredentials(orgId);
          if (creds.githubOrg) {
            description += `\n\nGitHub organization: ${creds.githubOrg}. GITHUB_TOKEN and GH_TOKEN are pre-configured — do not check auth, just run commands.`;
          }

          // Create the task
          const taskParams: CreateTaskParams = {
            orgId,
            initiativeId,
            phase: 1,
            role,
            spec: {
              title,
              description,
              acceptance_criteria: acceptanceCriteria,
              priority: priority as TaskPriority,
              ...(requiredCredentials?.length ? { required_credentials: requiredCredentials } : {}),
            },
            source: 'owner_directed',
          };
          const [task] = await createTasks([taskParams]);

          // Dispatch via engine
          if (onDispatch) {
            onDispatch(task.id);
          }

          return JSON.stringify({
            task_id: task.id,
            initiative_id: initiativeId,
            status: 'created_and_dispatched',
            role,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[ceo-tools] create_task error:', msg);
          throw err;
        }
      }

      case 'github_create_repo': {
        const creds = await resolveCredentials(orgId);
        if (!creds.githubToken || !creds.githubOrg) {
          return JSON.stringify({ error: 'GitHub not configured for this organization' });
        }
        const repoName = args.name as string;
        const description = (args.description as string) ?? '';
        const initiativeId = args.initiative_id as string;

        const res = await fetch(`https://api.github.com/orgs/${encodeURIComponent(creds.githubOrg)}/repos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: repoName,
            description,
            private: true,
            auto_init: true,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          return JSON.stringify({ error: `GitHub API ${res.status}: ${body}` });
        }

        const repo = await res.json() as { clone_url: string; html_url: string; full_name: string };

        // Store the clone URL on the initiative
        await updateInitiativeRepoUrl(initiativeId, repo.clone_url);

        return JSON.stringify({
          repo: repo.full_name,
          clone_url: repo.clone_url,
          html_url: repo.html_url,
          initiative_id: initiativeId,
        });
      }

      case 'trigger_planning': {
        const reason = args.reason as string;
        console.log(`[ceo-tools] trigger_planning: ${reason}`);
        if (onAdhocPlan) {
          onAdhocPlan();
        }
        return JSON.stringify({ status: 'planning_triggered', reason });
      }

      case 'linear': {
        const creds = await resolveCredentials(orgId);
        const linearAction = args.action as string;

        switch (linearAction) {
          case 'create_issue': {
            if (!creds.linearApiKey || !creds.linearTeamId) {
              return JSON.stringify({ error: 'Linear not configured for this organization' });
            }
            const issue = await createIssue(creds.linearApiKey, creds.linearTeamId, {
              title: args.title as string,
              description: args.description as string | undefined,
              priority: args.priority as number | undefined,
            });
            return JSON.stringify(issue);
          }
          case 'comment': {
            if (!creds.linearApiKey) {
              return JSON.stringify({ error: 'Linear not configured' });
            }
            await addComment(creds.linearApiKey, args.issue_id as string, args.description as string);
            return JSON.stringify({ success: true });
          }
          default:
            return JSON.stringify({ error: `Unknown linear action: ${linearAction}` });
        }
      }

      case 'send_email': {
        const creds = await resolveCredentials(orgId);
        if (!creds.resendApiKey) {
          return JSON.stringify({ error: 'Email not configured — no Resend API key for this organization' });
        }
        const ownerEmail = creds.ownerEmail;
        if (!ownerEmail) {
          return JSON.stringify({ error: 'Owner email not configured for this organization' });
        }

        const subject = args.subject as string;
        const bodyHtml = args.body_html as string;
        const threadId = args.thread_id as string | undefined;
        const org = await getOrg(orgId);
        const orgName = org?.name ?? orgId;

        // Create or reuse email thread — thread type is 'adhoc' (NOT 'board_request')
        let resolvedThreadId = threadId;
        if (!resolvedThreadId) {
          const thread = await createThread(orgId, 'adhoc', subject);
          resolvedThreadId = thread.id;
        }

        const sendResult = await sendAdhocEmail({
          to: ownerEmail,
          orgName,
          subject,
          bodyHtml,
          resendApiKey: creds.resendApiKey,
          emailDomain: creds.emailDomain,
        });

        if (!sendResult) {
          return JSON.stringify({ error: 'Email send failed — Resend returned no result' });
        }

        await insertEmailMessage({
          threadId: resolvedThreadId,
          orgId,
          direction: 'outbound',
          senderRole: 'ceo',
          content: bodyHtml,
          resendEmailId: sendResult.emailId,
          resendMessageId: sendResult.messageId,
        });

        return JSON.stringify({
          status: 'sent',
          thread_id: resolvedThreadId,
          email_id: sendResult.emailId,
        });
      }

      case 'board_requests': {
        const brAction = args.action as string;

        switch (brAction) {
          case 'create': {
            const content = args.content as string;
            const context = args.context as string;
            const urgency = args.urgency as string;
            const fallback = (args.fallback as string) ?? '';

            const created = await createBoardRequest(
              orgId,
              null,
              { request: content, context, urgency, fallback },
            );

            // Always email the owner — a board request without notification is pointless
            let notified = false;
            try {
              const [org, creds] = await Promise.all([
                getOrg(orgId),
                resolveCredentials(orgId),
              ]);
              const ownerEmail = creds.ownerEmail;
              if (ownerEmail && creds.resendApiKey) {
                const orgName = org?.name ?? orgId;
                const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
                const thread = await createThread(orgId, 'board_request', `${orgName} — Board Request`);

                const sendResult = await sendBatchBoardRequestEmail({
                  to: ownerEmail,
                  orgName,
                  requests: [{ id: created.id, request: content, context, urgency, fallback }],
                  appUrl,
                  resendApiKey: creds.resendApiKey,
                  emailDomain: creds.emailDomain,
                });

                if (sendResult) {
                  await updateBoardRequestThreadId(created.id, thread.id);
                  await insertEmailMessage({
                    threadId: thread.id,
                    orgId,
                    direction: 'outbound',
                    senderRole: 'ceo',
                    content: `Board Request: ${content}\nContext: ${context}\nUrgency: ${urgency}\nFallback: ${fallback}`,
                    resendEmailId: sendResult.emailId,
                    resendMessageId: sendResult.messageId,
                  });
                  notified = true;
                }
              }
            } catch (err) {
              console.error(`[ceo-tools] board request email failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            return JSON.stringify({
              board_request_id: created.id,
              status: 'created',
              notified,
            });
          }
          case 'list': {
            const requests = await getPendingBoardRequests(orgId);
            return JSON.stringify(requests.map(r => ({
              id: r.id,
              title: r.content,
              urgency: r.urgency,
              status: r.status,
              created_at: r.created_at,
              context_snippet: r.context?.substring(0, 200) ?? null,
            })));
          }
          case 'resolve': {
            const id = args.id as string;
            const resolution = args.resolution as string;
            const found = await resolveBoardRequest(id, resolution);
            if (!found) {
              return JSON.stringify({ error: `Board request ${id} not found or already resolved.` });
            }
            await logEvent(orgId, 'ceo.board_request_resolved', 'CEO-1', {
              board_request_id: id,
              resolution,
              resolved_at: new Date().toISOString(),
            });
            return JSON.stringify({ status: 'resolved', id });
          }
          default:
            return JSON.stringify({ error: `Unknown board_requests action: ${brAction}` });
        }
      }

      case 'credentials': {
        const credAction = args.action as string;

        switch (credAction) {
          case 'list': {
            const credentialsList = await listCredentials(orgId);
            return JSON.stringify({ credentials: credentialsList });
          }
          case 'store': {
            const serviceKey = args.key as string;
            const credentialValue = args.value as string;
            const description = args.description as string | undefined;

            if (!serviceKey || !credentialValue) {
              return JSON.stringify({ error: 'key and value required for store' });
            }

            await storeCredential(orgId, serviceKey, credentialValue, description);

            // Redact credential from the most recent owner chat message (best-effort)
            try {
              const { data: recentMsg } = await db
                .from('ceo_chat_messages')
                .select('id, content')
                .eq('org_id', orgId)
                .eq('role', 'owner')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (recentMsg && recentMsg.content.includes(credentialValue)) {
                await db
                  .from('ceo_chat_messages')
                  .update({ content: recentMsg.content.replaceAll(credentialValue, `[stored as ${serviceKey}]`) })
                  .eq('id', recentMsg.id);
              }
            } catch (err) {
              console.warn(`[ceo-tools] credential redaction failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            return JSON.stringify({
              status: 'stored',
              service_key: serviceKey,
              note: 'Credential stored. Dispatch a verification task before using it for real work.',
            });
          }
          case 'revoke': {
            const key = args.key as string;
            const reason = args.reason as string;

            if (!key || !reason) {
              return JSON.stringify({ error: 'key and reason required for revoke' });
            }

            const timestamp = new Date().toISOString();
            const sentinel = `REVOKED_BY_CEO_${timestamp}`;

            const currentValue = await getCredentialValue(orgId, key);
            if (currentValue === null) {
              return JSON.stringify({ error: `Credential "${key}" does not exist.` });
            }

            if (currentValue.startsWith('REVOKED_BY_CEO_')) {
              return JSON.stringify({ error: `Credential "${key}" is already revoked.` });
            }

            await storeCredential(orgId, key, sentinel);

            await logEvent(orgId, 'ceo.credential_revoked', 'CEO-1', {
              action: 'revoke_credential',
              key,
              reason,
              revoked_at: timestamp,
            });

            await stopOrgContainer(orgId).catch(err =>
              console.warn(`[ceo-tools] container restart after credential revoke failed: ${err instanceof Error ? err.message : String(err)}`)
            );

            return JSON.stringify({
              status: 'revoked',
              key,
              revoked_at: timestamp,
              restore_path: 'Store a new value with credentials({ action: "store", key, value }).',
            });
          }
          default:
            return JSON.stringify({ error: `Unknown credentials action: ${credAction}` });
        }
      }

      case 'org_admin': {
        const action = args.action as string;
        const id = args.id as string | undefined;
        const reason = args.reason as string | undefined;

        switch (action) {
          case 'delete_initiative': {
            if (!id || !reason) return JSON.stringify({ error: 'id and reason required' });
            await softDeleteInitiative(id);
            await logEvent(orgId, 'ceo.initiative_deleted', 'CEO-1', { initiative_id: id, reason });
            return JSON.stringify({ success: true, message: `Initiative ${id} deleted. All associated tasks also deleted.` });
          }
          case 'delete_task': {
            if (!id || !reason) return JSON.stringify({ error: 'id and reason required' });
            await softDeleteTask(id);
            await logEvent(orgId, 'ceo.task_deleted', 'CEO-1', { task_id: id, reason });
            return JSON.stringify({ success: true, message: `Task ${id} deleted.` });
          }
          case 'update_initiative_status': {
            const status = args.status as string | undefined;
            if (!id || !status || !reason) return JSON.stringify({ error: 'id, status, and reason required' });
            await updateInitiativeStatus(id, status);
            await logEvent(orgId, 'ceo.initiative_status_updated', 'CEO-1', { initiative_id: id, status, reason });
            return JSON.stringify({ success: true, message: `Initiative ${id} status set to ${status}.` });
          }
          case 'check_owner_presence': {
            const lastSeen = await getOwnerLastSeen(orgId);
            const presence = computeOwnerPresence(lastSeen);
            return JSON.stringify({ owner_presence: presence, last_seen_at: lastSeen?.toISOString() ?? null });
          }
          default:
            return JSON.stringify({ error: `Unknown org_admin action: ${action}` });
        }
      }

      case 'resolve_escalation': {
        const taskId = args.task_id as string;
        const resolution = args.resolution as 'redispatched' | 'cancelled' | 'resolved_directly';
        const note = args.note as string;

        const task = await getTask(taskId);
        if (!task) {
          return JSON.stringify({ error: `Task ${taskId} not found.` });
        }
        if (task.state !== 'ESCALATED') {
          return JSON.stringify({ error: `Task ${taskId} is not in ESCALATED state (current: ${task.state}).` });
        }

        const targetState = resolution === 'resolved_directly' ? 'ACCEPTED' : 'FAILED';
        await applyTransition(taskId, targetState, 'CEO-1', note);

        // Post-acceptance side effects (workspace cleanup, dependency dispatch, owner follow-up)
        if (targetState === 'ACCEPTED' && onResolveAccepted) {
          Promise.resolve(onResolveAccepted(taskId)).catch(err =>
            console.error(`[ceo-tools] onResolveAccepted failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
        }

        // Patch escalation_diagnosis with resolution sub-object
        const diagnosis = task.escalation_diagnosis ?? { type: 'spec_problem' as const, action: {}, reasoning: '' };
        await updateEscalationDiagnosis(taskId, {
          ...diagnosis,
          resolution: {
            type: resolution,
            note,
            resolved_at: new Date().toISOString(),
          },
        });

        await logEvent(orgId, 'ceo.escalation_resolved', 'CEO-1', {
          task_id: taskId,
          resolution,
          note,
        });

        return JSON.stringify({
          status: 'resolved',
          task_id: taskId,
          from_state: 'ESCALATED',
          to_state: targetState,
        });
      }

      case 'web_search': {
        const query = args.query as string;
        const limit = Math.min((args.limit as number) ?? 5, 10);

        try {
          const encoded = encodeURIComponent(query);
          const url = `https://html.duckduckgo.com/html/?q=${encoded}`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'PRECEPT-CEO/1.0' },
            signal: AbortSignal.timeout(15_000),
          });
          const html = await res.text();

          // Parse results from DuckDuckGo HTML
          const linkRe = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)<\/a>/g;
          const snippetRe = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

          const links: Array<{ href: string; title: string }> = [];
          let m: RegExpExecArray | null;
          while ((m = linkRe.exec(html)) !== null) links.push({ href: m[1], title: m[2] });

          const snippets: string[] = [];
          while ((m = snippetRe.exec(html)) !== null) snippets.push(m[1]);

          const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim();

          const results = links.slice(0, limit).map((link, i) => {
            // Decode DuckDuckGo redirect URL
            let actualUrl = link.href;
            try {
              const parsed = new URL(link.href, 'https://duckduckgo.com');
              actualUrl = parsed.searchParams.get('uddg') ?? link.href;
            } catch { /* use raw href */ }

            return {
              title: stripHtml(link.title),
              url: actualUrl,
              snippet: stripHtml(snippets[i] ?? ''),
            };
          });

          return JSON.stringify({ query, results });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return JSON.stringify({ error: `Web search failed: ${msg}` });
        }
      }

      case 'query_role_memory': {
        const role = args.role as string;
        const query = args.query as string;
        const limit = Math.min((args.limit as number) ?? 5, 10);

        try {
          const embedding = await embedText(query, 'query');
          const matches = await matchRoleMemory(orgId, role, embedding, limit);
          return JSON.stringify({
            role,
            query,
            results: matches.map(m => ({
              content: m.content,
              confidence: m.confidence,
              type: m.entryType,
              similarity: m.similarity,
            })),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return JSON.stringify({ error: `Role memory query failed: ${msg}` });
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  };
}
