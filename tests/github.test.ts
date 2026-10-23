import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchGithubSnapshot,
  GitHubError,
  normalizeGithubResponse,
  normalizeGithubUsername,
  parseGithubCache,
  summarizeGithubEvents,
} from "../lib/github.ts";

const now = new Date(2026, 9, 23, 12);
const profile = {
  login: "ProgAnakin",
  name: "Anakin",
  avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
};
const event = (
  id: string,
  type: string,
  payload: unknown = {},
  at = now.toISOString(),
) => ({
  id,
  type,
  payload,
  created_at: at,
  repo: { name: "ProgAnakin/KernelHub" },
});
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const expectCode = (code: string) => (error: unknown) =>
  error instanceof GitHubError && error.code === code;

test("GitHub usernames are normalized without accepting URLs, whitespace or unsafe path segments", () => {
  assert.equal(normalizeGithubUsername(" @ProgAnakin "), "ProgAnakin");
  assert.equal(normalizeGithubUsername("a"), "a");
  assert.equal(normalizeGithubUsername("a".repeat(39)), "a".repeat(39));
  for (const value of [
    "",
    "-name",
    "name-",
    "name--more",
    "a".repeat(40),
    "a/b",
    "../user",
    "https://github.com/user",
    "a b",
    "@a@b",
  ])
    assert.equal(normalizeGithubUsername(value), null, value);
});

test("public push events with reduced payloads remain pushes with unknown commit totals", () => {
  const snapshot = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [event("1", "PushEvent", { ref: "refs/heads/main", head: "a".repeat(40) })],
    now,
  );
  assert.equal(snapshot.statisticsToday.pushes, 1);
  assert.equal(snapshot.statisticsToday.commits, null);
  assert.equal(snapshot.statisticsToday.deployments, null);
  assert.equal(snapshot.events[0].type, "push");
  assert.equal(snapshot.events[0].commits, null);
  assert.equal(
    snapshot.events[0].url,
    `https://github.com/ProgAnakin/KernelHub/commit/${"a".repeat(40)}`,
  );
  assert.equal(snapshot.coverage.visibility, "public");
  assert.equal(snapshot.contributions.at(-1)?.count, 1);
});

test("commit identities deduplicate observed complete lists rather than counting the same commit twice", () => {
  const a = "a".repeat(40),
    b = "b".repeat(40),
    c = "c".repeat(40);
  const snapshot = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [
      event("1", "PushEvent", {
        size: 2,
        commits: [
          { sha: a, message: "Primeiro\nDetalhes" },
          { sha: b, message: "Segundo" },
        ],
      }),
      event("2", "PushEvent", {
        commits: [
          { sha: a, message: "Primeiro" },
          { sha: c, message: "Terceiro" },
        ],
      }),
    ],
    now,
  );
  assert.equal(snapshot.statisticsToday.pushes, 2);
  assert.equal(snapshot.statisticsToday.commits, 3);
  assert.equal(
    snapshot.events.find((item) => item.id === "1")?.title,
    "Primeiro",
  );
  const incomplete = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [
      event("1", "PushEvent", {
        size: 50,
        commits: [{ sha: a, message: "Só um item recebido" }],
      }),
    ],
    now,
  );
  assert.equal(incomplete.events[0].commits, 50);
  assert.equal(incomplete.statisticsToday.commits, null);
});

test("merged PRs, published releases and explicitly successful deployment statuses are distinct", () => {
  const snapshot = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [
      event("1", "PullRequestEvent", {
        action: "closed",
        number: 8,
        pull_request: { merged: true, title: "Fluxo novo" },
      }),
      event("2", "PullRequestEvent", {
        action: "closed",
        number: 9,
        pull_request: { merged: false, title: "Não integrado" },
      }),
      event("3", "PullRequestEvent", {
        action: "opened",
        number: 10,
        pull_request: { merged: true, title: "Não confiar no campo isolado" },
      }),
      event("4", "ReleaseEvent", {
        action: "published",
        release: { name: "v0.4", draft: false },
      }),
      event("5", "ReleaseEvent", {
        action: "created",
        release: { name: "v0.5" },
      }),
      event("6", "DeploymentEvent", {
        deployment: { environment: "production" },
      }),
      event("7", "DeploymentStatusEvent", {
        deployment_status: { state: "success" },
        deployment: { environment: "production" },
      }),
      event("8", "DeploymentStatusEvent", {
        deployment_status: { state: "failure" },
      }),
    ],
    now,
  );
  assert.equal(snapshot.statisticsToday.mergedPRs, 1);
  assert.equal(snapshot.statisticsToday.releases, 1);
  assert.equal(snapshot.statisticsToday.deployments, 1);
  assert.equal(snapshot.events.find((item) => item.id === "6")?.type, "other");
  assert.equal(
    snapshot.events.find((item) => item.id === "7")?.type,
    "deployment",
  );
});

test("event window deduplicates IDs, preserves seven dates and declares capped coverage", () => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const snapshot = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [
      event("1", "PushEvent"),
      event("1", "PushEvent"),
      event("2", "CreateEvent", {}, yesterday.toISOString()),
    ],
    now,
  );
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.coverage.received, 3);
  assert.equal(snapshot.contributions.length, 7);
  assert.equal(snapshot.contributions.at(-2)?.count, 1);
  assert.equal(snapshot.contributions.at(-1)?.count, 1);
  const capped = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    Array.from({ length: 100 }, (_, index) =>
      event(String(index), "CreateEvent"),
    ),
    now,
  );
  assert.equal(capped.coverage.capped, true);
  assert.equal(capped.coverage.maxEvents, 100);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(
    summarizeGithubEvents(snapshot.events, tomorrow).statisticsToday.pushes,
    0,
  );
});

test("untrusted profile links and malformed feed structures never become navigation targets", () => {
  const snapshot = normalizeGithubResponse(
    "ProgAnakin",
    {
      ...profile,
      avatar_url: "javascript:alert(1)",
      html_url: "https://evil.example",
    },
    [],
    now,
  );
  assert.equal(snapshot.profile.avatarUrl, null);
  assert.equal(snapshot.profile.url, "https://github.com/ProgAnakin");
  assert.throws(
    () =>
      normalizeGithubResponse(
        "ProgAnakin",
        { ...profile, login: "Other" },
        [],
        now,
      ),
    expectCode("invalid-response"),
  );
  assert.throws(
    () =>
      normalizeGithubResponse(
        "ProgAnakin",
        profile,
        [event("1", "PushEvent", {}, "invalid")],
        now,
      ),
    expectCode("invalid-response"),
  );
  assert.throws(
    () =>
      normalizeGithubResponse(
        "ProgAnakin",
        profile,
        [{ ...event("1", "PushEvent"), repo: { name: "../../private" } }],
        now,
      ),
    expectCode("invalid-response"),
  );
  const untrusted = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [
      event("long", "PushEvent", { ref: "refs/heads/" + "x".repeat(10000) }),
      event("prototype", "__proto__"),
    ],
    now,
  );
  assert.ok(untrusted.events.every((item) => item.title.length <= 160));
  assert.equal(
    untrusted.events.find((item) => item.id === "prototype")?.title,
    "Atividade pública",
  );
});

test("fetch uses the public API without credentials and validates both responses", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return json(url.includes("/events?") ? [event("1", "PushEvent")] : profile);
  };
  const snapshot = await fetchGithubSnapshot("@ProgAnakin", { fetcher, now });
  assert.equal(snapshot.username, "ProgAnakin");
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every((call) =>
      call.url.startsWith("https://api.github.com/users/ProgAnakin"),
    ),
  );
  assert.ok(
    calls.every(
      (call) =>
        call.init?.credentials === "omit" && call.init.cache === "no-store",
    ),
  );
  assert.ok(
    calls.every(
      (call) => !Object.hasOwn(call.init?.headers ?? {}, "Authorization"),
    ),
  );
});

test("provider polling hints only extend the minimum ten minute cadence", async () => {
  for (const [header, expected] of [
    ["900", 900],
    ["30", 600],
    ["untrusted", 600],
    ["99999999999", 600],
  ] as const) {
    const snapshot = await fetchGithubSnapshot("ProgAnakin", {
      now,
      fetcher: async (input) =>
        String(input).includes("/events?")
          ? json([], 200, { "x-poll-interval": header })
          : json(profile),
    });
    assert.equal(snapshot.pollIntervalSeconds, expected);
  }
});

test("rate-limit retry headers select the latest bounded provider deadline", async () => {
  const clock = Date.now();
  const reset = Math.floor(clock / 1000) + 60;
  await assert.rejects(
    fetchGithubSnapshot("limited", {
      fetcher: async () =>
        json({}, 429, {
          "x-ratelimit-reset": String(reset),
          "retry-after": "120",
        }),
    }),
    (error: unknown) =>
      error instanceof GitHubError &&
      error.retryAt !== null &&
      Date.parse(error.retryAt) >= clock + 120000,
  );
  const future = new Date(clock + 180000).toUTCString();
  await assert.rejects(
    fetchGithubSnapshot("limited", {
      fetcher: async () => json({}, 403, { "retry-after": future }),
    }),
    (error: unknown) =>
      error instanceof GitHubError &&
      error.retryAt === new Date(future).toISOString(),
  );
  await assert.rejects(
    fetchGithubSnapshot("limited", {
      fetcher: async () => json({}, 403, { "retry-after": "99999999999" }),
    }),
    (error: unknown) => error instanceof GitHubError && error.retryAt === null,
  );
});

test("404, rate limits and malformed or excessive responses yield bounded actionable failures", async () => {
  await assert.rejects(
    fetchGithubSnapshot("missing", { fetcher: async () => json({}, 404) }),
    expectCode("not-found"),
  );
  const reset = Math.floor(Date.now() / 1000) + 60;
  await assert.rejects(
    fetchGithubSnapshot("limited", {
      fetcher: async () =>
        json({}, 403, { "x-ratelimit-reset": String(reset) }),
    }),
    (error: unknown) =>
      error instanceof GitHubError &&
      error.code === "rate-limit" &&
      error.retryAt !== null,
  );
  await assert.rejects(
    fetchGithubSnapshot("limited", { fetcher: async () => json({}, 429) }),
    expectCode("rate-limit"),
  );
  await assert.rejects(
    fetchGithubSnapshot("broken", {
      fetcher: async () =>
        new Response("{", { headers: { "content-type": "application/json" } }),
    }),
    expectCode("invalid-response"),
  );
  await assert.rejects(
    fetchGithubSnapshot("broken", {
      fetcher: async () =>
        new Response("<html>Oops</html>", {
          headers: { "content-type": "text/html" },
        }),
    }),
    expectCode("invalid-response"),
  );
  await assert.rejects(
    fetchGithubSnapshot("large", {
      fetcher: async () =>
        new Response("x".repeat(1024 * 1024 + 1), {
          headers: { "content-type": "application/json" },
        }),
    }),
    expectCode("too-large"),
  );
});

test("timeouts and transport failures preserve a caller's previous snapshot instead of creating fake values", async () => {
  await assert.rejects(
    fetchGithubSnapshot("slow", {
      timeoutMs: 5,
      fetcher: () => new Promise(() => {}),
    }),
    expectCode("timeout"),
  );
  await assert.rejects(
    fetchGithubSnapshot("offline", {
      fetcher: async () => {
        throw new TypeError("Offline");
      },
    }),
    expectCode("network"),
  );
  await assert.rejects(
    fetchGithubSnapshot("../invalid", {
      fetcher: async () => {
        throw new Error("Must not call");
      },
    }),
    expectCode("invalid-username"),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchGithubSnapshot("ProgAnakin", {
      signal: controller.signal,
      fetcher: async () => {
        throw new Error("Must not call after cancellation");
      },
    }),
    expectCode("network"),
  );
});

test("cache validation rederives daily metrics, bounds age and rejects corrupt snapshots", () => {
  const snapshot = normalizeGithubResponse(
    "ProgAnakin",
    profile,
    [event("1", "PushEvent")],
    now,
  );
  const cached = {
    username: "ProgAnakin",
    snapshot: {
      ...snapshot,
      statisticsToday: { ...snapshot.statisticsToday, deployments: 9999 },
    },
  };
  assert.equal(
    parseGithubCache(cached, now)?.snapshot?.statisticsToday.deployments,
    null,
  );
  const farFuture = new Date(now);
  farFuture.setDate(farFuture.getDate() + 31);
  assert.equal(parseGithubCache(cached, farFuture)?.snapshot, null);
  assert.equal(
    parseGithubCache(
      {
        username: "ProgAnakin",
        snapshot: {
          ...snapshot,
          profile: { ...snapshot.profile, login: "other" },
        },
      },
      now,
    )?.snapshot,
    null,
  );
  assert.equal(
    parseGithubCache({ username: "../invalid", snapshot }, now),
    null,
  );
  assert.equal(
    parseGithubCache({ username: "ProgAnakin", snapshot: null }, now)?.snapshot,
    null,
  );
});
