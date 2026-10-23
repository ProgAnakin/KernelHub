import { z } from "zod";

const MAX_RESPONSE_BYTES = 1024 * 1024;
export const GITHUB_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const GITHUB_FRESH_MS = 15 * 60 * 1000;
const usernamePattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const repositoryPattern = /^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d_.-]{1,100}$/i;
const timestamp = z.iso.datetime();
const boundedCount = z.number().int().min(0).max(100000);

export type GitHubStatus = "idle" | "loading" | "live" | "stale" | "error";
export type GitHubEventType =
  "push" | "pull-request" | "release" | "deployment" | "other";
export interface GitHubEvent {
  id: string;
  type: GitHubEventType;
  title: string;
  repository: string;
  url: string;
  at: string;
  commits: number | null;
  /** IDs are available only when the provider supplied a complete commit list. */
  commitIds: string[] | null;
  merged: boolean;
}
export interface GitHubSnapshot {
  source: "github";
  username: string;
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
    url: string;
  };
  syncedAt: string;
  /** Provider hint when the response header is exposed by CORS. */
  pollIntervalSeconds?: number;
  events: GitHubEvent[];
  statisticsToday: {
    day: string;
    pushes: number;
    commits: number | null;
    mergedPRs: number;
    releases: number;
    deployments: number | null;
  };
  /** Public event counts, not the GitHub contributions graph or a coding streak. */
  contributions: { day: string; count: number }[];
  coverage: {
    visibility: "public";
    received: number;
    maxEvents: 100;
    capped: boolean;
    oldestEventAt: string | null;
  };
}
export type GitHubErrorCode =
  | "invalid-username"
  | "not-found"
  | "rate-limit"
  | "network"
  | "timeout"
  | "invalid-response"
  | "too-large";
export class GitHubError extends Error {
  readonly code: GitHubErrorCode;
  readonly retryAt: string | null;
  constructor(
    code: GitHubErrorCode,
    message: string,
    retryAt: string | null = null,
  ) {
    super(message);
    this.name = "GitHubError";
    this.code = code;
    this.retryAt = retryAt;
  }
}

export function normalizeGithubUsername(value: string): string | null {
  const name = value.trim().replace(/^@/, "");
  return usernamePattern.test(name) ? name : null;
}
function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function readable(value: unknown, fallback: string): string {
  const text = typeof value === "string" && value.trim() ? value : fallback;
  return (
    text
      .split(/[\r\n]/, 1)[0]
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 160) || "Atividade pública"
  );
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function count(value: unknown): number | null {
  const parsed = boundedCount.safeParse(value);
  return parsed.success ? parsed.data : null;
}
const rawEventSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(80),
  created_at: timestamp,
  repo: z.object({ name: z.string().regex(repositoryPattern) }),
  payload: z.unknown().optional(),
});
const rawProfileSchema = z.object({
  login: z.string().regex(usernamePattern),
  name: z.string().max(200).nullable().optional(),
  avatar_url: z.string().max(500).optional(),
});
function normalizeEvent(raw: z.infer<typeof rawEventSchema>): GitHubEvent {
  const payload = object(raw.payload);
  const repository = raw.repo.name;
  const root = `https://github.com/${repository}`;
  const base: GitHubEvent = {
    id: raw.id,
    type: "other",
    title: "Atividade pública",
    repository,
    url: root,
    at: raw.created_at,
    commits: null,
    commitIds: null,
    merged: false,
  };
  if (raw.type === "PushEvent") {
    const commits =
      Array.isArray(payload.commits) && payload.commits.length <= 1000
        ? payload.commits.map(object)
        : null;
    const ids = commits?.map((commit) =>
      typeof commit.sha === "string" && /^[a-f\d]{7,64}$/i.test(commit.sha)
        ? commit.sha
        : null,
    );
    const known = count(payload.size) ?? (commits ? commits.length : null);
    const complete =
      ids &&
      ids.every((id): id is string => id !== null) &&
      known === ids.length;
    const branch =
      typeof payload.ref === "string"
        ? payload.ref.replace(/^refs\/heads\//, "")
        : "repositório";
    const head =
      typeof payload.head === "string" && /^[a-f\d]{7,64}$/i.test(payload.head)
        ? payload.head
        : null;
    return {
      ...base,
      type: "push",
      title: readable(commits?.[0]?.message, `Push em ${branch}`),
      url: head ? `${root}/commit/${head}` : `${root}/commits`,
      commits: known,
      commitIds: complete ? [...new Set(ids)] : null,
    };
  }
  if (raw.type === "PullRequestEvent") {
    const pr = object(payload.pull_request);
    const number = count(payload.number) ?? count(pr.number);
    const merged = payload.action === "closed" && pr.merged === true;
    const verb = merged
      ? "PR integrado"
      : payload.action === "opened"
        ? "PR aberto"
        : payload.action === "closed"
          ? "PR fechado"
          : "PR atualizado";
    return {
      ...base,
      type: "pull-request",
      title: `${verb}${number ? ` #${number}` : ""} · ${readable(pr.title, repository)}`,
      url: number ? `${root}/pull/${number}` : `${root}/pulls`,
      merged,
    };
  }
  if (raw.type === "ReleaseEvent" && payload.action === "published") {
    const release = object(payload.release);
    if (release.draft !== true)
      return {
        ...base,
        type: "release",
        title: `Release · ${readable(release.name, readable(release.tag_name, repository))}`,
        url: `${root}/releases`,
      };
  }
  // A push or a release is not proof of deployment. Only a successful status
  // event, when actually supplied, can be displayed as an observed deployment.
  if (
    raw.type === "DeploymentStatusEvent" &&
    object(payload.deployment_status).state === "success"
  )
    return {
      ...base,
      type: "deployment",
      title: `Deploy confirmado · ${readable(object(payload.deployment).environment, repository)}`,
      url: `${root}/deployments`,
    };
  const titles: Record<string, string> = {
    CreateEvent: "Criou uma referência",
    DeleteEvent: "Removeu uma referência",
    ForkEvent: "Criou um fork",
    IssuesEvent: "Atualizou uma issue",
    IssueCommentEvent: "Comentou em uma issue",
    PullRequestReviewEvent: "Revisou um pull request",
    WatchEvent: "Favoritou um repositório",
    ReleaseEvent: "Atualizou uma release",
    DeploymentEvent: "Deployment iniciado",
  };
  return {
    ...base,
    title: Object.hasOwn(titles, raw.type)
      ? titles[raw.type]
      : "Atividade pública",
  };
}

export function summarizeGithubEvents(
  events: GitHubEvent[],
  now = new Date(),
): Pick<GitHubSnapshot, "statisticsToday" | "contributions"> {
  const day = localDate(now);
  const today = events.filter((event) => localDate(new Date(event.at)) === day);
  const pushes = today.filter((event) => event.type === "push");
  const commitIds = pushes.every((event) => event.commitIds !== null)
    ? new Set(pushes.flatMap((event) => event.commitIds ?? []))
    : null;
  const deployments = today.filter((event) => event.type === "deployment");
  return {
    statisticsToday: {
      day,
      pushes: pushes.length,
      commits: commitIds ? commitIds.size : null,
      mergedPRs: today.filter(
        (event) => event.type === "pull-request" && event.merged,
      ).length,
      releases: today.filter((event) => event.type === "release").length,
      deployments: deployments.length ? deployments.length : null,
    },
    contributions: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (6 - index),
        12,
      );
      const key = localDate(date);
      return {
        day: key,
        count: events.filter((event) => localDate(new Date(event.at)) === key)
          .length,
      };
    }),
  };
}

export function normalizeGithubResponse(
  username: string,
  profile: unknown,
  activity: unknown,
  now = new Date(),
): GitHubSnapshot {
  const name = normalizeGithubUsername(username);
  const parsedProfile = rawProfileSchema.safeParse(profile);
  const parsedEvents = z.array(rawEventSchema).max(100).safeParse(activity);
  if (
    !name ||
    !parsedProfile.success ||
    !parsedEvents.success ||
    parsedProfile.data.login.toLowerCase() !== name.toLowerCase()
  )
    throw new GitHubError(
      "invalid-response",
      "O GitHub retornou dados inesperados. A última sincronização foi preservada.",
    );
  const events = [
    ...new Map(
      parsedEvents.data.map((event) => [event.id, normalizeEvent(event)]),
    ).values(),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const avatar = parsedProfile.data.avatar_url;
  let avatarUrl: string | null = null;
  if (avatar) {
    try {
      const url = new URL(avatar);
      if (
        url.protocol === "https:" &&
        url.hostname === "avatars.githubusercontent.com" &&
        !url.username &&
        !url.password
      )
        avatarUrl = url.href;
    } catch {
      /* Avatar is optional. */
    }
  }
  return {
    source: "github",
    username: parsedProfile.data.login,
    profile: {
      login: parsedProfile.data.login,
      name: parsedProfile.data.name?.trim() || null,
      avatarUrl,
      url: `https://github.com/${parsedProfile.data.login}`,
    },
    syncedAt: now.toISOString(),
    pollIntervalSeconds: 600,
    events,
    ...summarizeGithubEvents(events, now),
    coverage: {
      visibility: "public",
      received: parsedEvents.data.length,
      maxEvents: 100,
      capped: parsedEvents.data.length === 100,
      oldestEventAt: events.at(-1)?.at ?? null,
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 404)
    throw new GitHubError(
      "not-found",
      "Perfil não encontrado. Confira o nome de usuário do GitHub.",
    );
  if (response.status === 403 || response.status === 429) {
    const clock = Date.now();
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    const retry = response.headers.get("retry-after");
    const delay =
      retry && /^\d+$/.test(retry)
        ? clock + Number(retry) * 1000
        : retry
          ? Date.parse(retry)
          : NaN;
    const candidates = [reset, delay].filter(
      (value) =>
        Number.isFinite(value) &&
        value > clock &&
        value <= clock + 7 * 86400000,
    );
    const retryAt = candidates.length
      ? new Date(Math.max(...candidates)).toISOString()
      : null;
    throw new GitHubError(
      "rate-limit",
      "O GitHub limitou as consultas. A última sincronização continua disponível; tente novamente mais tarde.",
      retryAt,
    );
  }
  if (!response.ok)
    throw new GitHubError(
      "network",
      "O GitHub está indisponível agora. Seus dados anteriores foram mantidos.",
    );
  if (!response.headers.get("content-type")?.includes("json"))
    throw new GitHubError(
      "invalid-response",
      "Não foi possível validar a resposta do GitHub.",
    );
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    void response.body?.cancel();
    throw new GitHubError(
      "too-large",
      "A resposta do GitHub excedeu o limite seguro de leitura.",
    );
  }
  let text = "";
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        void reader.cancel();
        throw new GitHubError(
          "too-large",
          "A resposta do GitHub excedeu o limite seguro de leitura.",
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } else text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
    throw new GitHubError(
      "too-large",
      "A resposta do GitHub excedeu o limite seguro de leitura.",
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new GitHubError(
      "invalid-response",
      "Não foi possível validar a resposta do GitHub.",
    );
  }
}

export async function fetchGithubSnapshot(
  username: string,
  options: {
    fetcher?: typeof fetch;
    now?: Date;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<GitHubSnapshot> {
  const name = normalizeGithubUsername(username);
  if (!name)
    throw new GitHubError(
      "invalid-username",
      "Use um nome de usuário GitHub válido, com até 39 caracteres.",
    );
  if (options.signal?.aborted)
    throw new GitHubError("network", "Sincronização cancelada.");
  const controller = new AbortController();
  const fetcher = options.fetcher ?? fetch;
  let rejectCancellation: (reason: unknown) => void = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    rejectCancellation = reject;
  });
  const abort = () => {
    controller.abort();
    rejectCancellation(new GitHubError("network", "Sincronização cancelada."));
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    controller.abort();
    rejectCancellation(
      new GitHubError(
        "timeout",
        "O GitHub demorou a responder. A última sincronização foi preservada.",
      ),
    );
  }, options.timeoutMs ?? 8000);
  let pollIntervalSeconds = 600;
  const request = async (path: string) => {
    const response = await fetcher(
      `https://api.github.com/users/${encodeURIComponent(name)}${path}`,
      {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (path) {
      // This header may be hidden by CORS. Ten minutes remains the minimum
      // cadence; anonymous public requests share the provider's IP budget.
      const hint = Number(response.headers.get("x-poll-interval"));
      if (Number.isFinite(hint) && hint >= 1 && hint <= 86400)
        pollIntervalSeconds = Math.max(600, Math.ceil(hint));
    }
    return readJson(response);
  };
  try {
    const [profile, activity] = await Promise.race([
      Promise.all([request(""), request("/events?per_page=100")]),
      cancellation,
    ]);
    return {
      ...normalizeGithubResponse(
        name,
        profile,
        activity,
        options.now ?? new Date(),
      ),
      pollIntervalSeconds,
    };
  } catch (error) {
    controller.abort();
    if (error instanceof GitHubError) throw error;
    throw new GitHubError(
      "network",
      "Sem conexão com o GitHub. A última sincronização foi preservada.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

const safeGithubUrl = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "github.com" &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
const safeAvatarUrl = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "avatars.githubusercontent.com" &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
const cachedEventSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["push", "pull-request", "release", "deployment", "other"]),
  title: z.string().max(350),
  repository: z.string().regex(repositoryPattern),
  url: safeGithubUrl,
  at: timestamp,
  commits: boundedCount.nullable(),
  commitIds: z
    .array(z.string().regex(/^[a-f\d]{7,64}$/i))
    .max(1000)
    .nullable(),
  merged: z.boolean(),
});
const cachedSnapshotSchema = z.object({
  source: z.literal("github"),
  username: z.string().regex(usernamePattern),
  profile: z.object({
    login: z.string().regex(usernamePattern),
    name: z.string().max(200).nullable(),
    avatarUrl: safeAvatarUrl.nullable(),
    url: safeGithubUrl,
  }),
  syncedAt: timestamp,
  pollIntervalSeconds: z.number().int().min(60).max(86400).default(600),
  events: z.array(cachedEventSchema).max(100),
  coverage: z.object({
    visibility: z.literal("public"),
    received: z.number().int().min(0).max(100),
    maxEvents: z.literal(100),
    capped: z.boolean(),
    oldestEventAt: timestamp.nullable(),
  }),
});

export function parseGithubCache(
  value: unknown,
  now = new Date(),
): { username: string; snapshot: GitHubSnapshot | null } | null {
  const record = object(value);
  const username =
    typeof record.username === "string"
      ? normalizeGithubUsername(record.username)
      : null;
  if (!username) return null;
  if (record.snapshot === null || record.snapshot === undefined)
    return { username, snapshot: null };
  const parsed = cachedSnapshotSchema.safeParse(record.snapshot);
  if (
    !parsed.success ||
    parsed.data.username.toLowerCase() !== username.toLowerCase() ||
    parsed.data.profile.login.toLowerCase() !== username.toLowerCase()
  )
    return { username, snapshot: null };
  const age = now.getTime() - new Date(parsed.data.syncedAt).getTime();
  if (age < -5 * 60000 || age > GITHUB_CACHE_MAX_AGE_MS)
    return { username, snapshot: null };
  const events = parsed.data.events;
  if (new Set(events.map((event) => event.id)).size !== events.length)
    return { username, snapshot: null };
  return {
    username,
    snapshot: { ...parsed.data, ...summarizeGithubEvents(events, now) },
  };
}
