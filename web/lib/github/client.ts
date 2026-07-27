import type { Signals } from "../scoring/types";

const ENDPOINT = "https://api.github.com/graphql";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "not_found" | "rate_limit" | "auth" | "timeout" | "unknown" = "unknown",
  ) {
    super(message);
  }
}

/**
 * Per-attempt ceiling on a GitHub call. Without one, a hung connection blocks
 * until Vercel's function timeout and the visitor sees a spinner the whole way —
 * the "first hit sometimes just fails" symptom. Fail fast, show the retry state.
 */
const REQUEST_TIMEOUT_MS = 9_000;
/**
 * Ceiling on a WHOLE scout. One scout is a profile call followed by parallel
 * year-batch calls, so per-request timeouts alone can stack (9s + 9s). A shared
 * deadline bounds the lot, which is what keeps us inside the serverless
 * function limit however many batches a long-lived account needs.
 */
const TOTAL_BUDGET_MS = 14_000;

/** Time left on the scout's shared deadline, floored so we never issue a
 *  request with an already-expired signal. */
function budgetFor(deadline?: number): number {
  if (!deadline) return REQUEST_TIMEOUT_MS;
  return Math.max(500, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()));
}

function token(): string {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!t) throw new GitHubError("GITHUB_TOKEN is not set", 500, "auth");
  return t;
}

async function graphql<T>(query: string, variables: Record<string, unknown>, deadline?: number): Promise<T> {
  const timeoutMs = budgetFor(deadline);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `bearer ${token()}`,
        "Content-Type": "application/json",
        "User-Agent": "gitcric",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
      // Cache at the fetch layer; the route adds its own revalidation.
      next: { revalidate: 60 * 60 * 6 },
    });
  } catch (e) {
    // token() throws its own classified error from inside this try — don't
    // relabel it, or a missing token reads as a generic network fault.
    if (e instanceof GitHubError) throw e;
    // AbortSignal.timeout rejects with a TimeoutError DOMException.
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new GitHubError(`GitHub did not respond within ${timeoutMs}ms`, 504, "timeout");
    }
    // Genuine network failure (DNS, reset). Surfaced as unknown -> the retry
    // state, rather than bubbling a raw TypeError out of the route.
    throw new GitHubError(`GitHub request failed: ${(e as Error).message}`, 502, "unknown");
  }

  // 401 is a dead credential (expired/revoked/malformed). 403 is usually the
  // secondary rate limit. Keeping them apart is what makes an expired token
  // diagnosable instead of looking like ordinary throttling.
  if (res.status === 401) {
    throw new GitHubError("GitHub rejected the credential (401)", 401, "auth");
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError(`GitHub rate limit (${res.status})`, res.status, "rate_limit");
  }
  if (!res.ok) throw new GitHubError(`GitHub HTTP ${res.status}`, res.status);

  const json = (await res.json()) as {
    data?: (T & { user?: unknown }) | null;
    errors?: { type?: string; message: string }[];
  };
  // GitHub routinely returns partial `errors` alongside usable `data` (a nulled
  // sub-field, a scope quirk). Tolerate those: if we still got a user object,
  // use it. Only a genuinely absent user is fatal.
  if (json.data?.user) return json.data;
  if (json.errors?.some((e) => e.type === "NOT_FOUND")) {
    throw new GitHubError("no such user", 404, "not_found");
  }
  // GraphQL reports throttling and dead credentials with HTTP 200 + an errors
  // array, so status codes alone would misfile both as "unknown".
  const types = new Set((json.errors ?? []).map((e) => e.type));
  if (types.has("RATE_LIMITED")) {
    throw new GitHubError("GitHub GraphQL rate limit exhausted", 429, "rate_limit");
  }
  if (types.has("UNAUTHORIZED") || types.has("FORBIDDEN") || types.has("INSUFFICIENT_SCOPES")) {
    throw new GitHubError(`GitHub rejected the credential: ${json.errors![0].message}`, 401, "auth");
  }
  if (json.errors?.length) throw new GitHubError(json.errors[0].message, 502, "unknown");
  if (!json.data) throw new GitHubError("empty GitHub response", 502);
  return json.data;
}

const PROFILE_QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl
      location
      createdAt
      followers { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: { field: STARGAZERS, direction: DESC }) {
        totalCount
        nodes {
          stargazerCount
          createdAt
          pushedAt
          primaryLanguage { name }
          languages(first: 6) { nodes { name } }
        }
      }
      mergedPRs: pullRequests(states: MERGED) { totalCount }
      allPRs: pullRequests { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions }
      }
    }
  }
`;

/** One request covering several years via aliased fields (GitFut-style), so a
 *  20-year-old account costs ~5 requests instead of 20 — friendlier to GitHub's
 *  concurrent/secondary rate limits. */
function yearsBatchQuery(windows: { from: string; to: string }[]): string {
  const fields = windows
    .map(
      (w, i) =>
        `y${i}: contributionsCollection(from: "${w.from}", to: "${w.to}") { contributionCalendar { totalContributions } }`,
    )
    .join("\n");
  return `query ($login: String!) { user(login: $login) { ${fields} } }`;
}
const LIFETIME_BATCH = 4;

interface ProfileData {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    location: string | null;
    createdAt: string | null;
    followers?: { totalCount: number } | null;
    repositories?: {
      totalCount: number;
      nodes: {
        stargazerCount: number;
        createdAt: string;
        pushedAt: string | null;
        primaryLanguage: { name: string } | null;
        languages: { nodes: { name: string }[] };
      }[];
    } | null;
    mergedPRs?: { totalCount: number } | null;
    allPRs?: { totalCount: number } | null;
    contributionsCollection?: {
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
      totalIssueContributions: number;
      restrictedContributionsCount: number;
      contributionCalendar: { totalContributions: number };
    } | null;
  } | null;
}

/** now-anchored so results are deterministic within a build/ISR window. */
function yearWindows(createdAt: string, nowISO: string): { from: string; to: string }[] {
  const startYear = new Date(createdAt).getUTCFullYear();
  const endYear = new Date(nowISO).getUTCFullYear();
  const out: { from: string; to: string }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    out.push({ from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` });
  }
  return out;
}

/** Fetch the full GitFut signal set for a login. */
export async function fetchSignals(login: string): Promise<Signals> {
  // One deadline for the whole scout — profile call plus every year batch.
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const { user } = await graphql<ProfileData>(PROFILE_QUERY, { login }, deadline);
  if (!user) throw new GitHubError(`No GitHub user "${login}"`, 404, "not_found");

  const nowISO = new Date().toISOString();
  const repos = user.repositories?.nodes ?? [];
  const repoStars = repos.map((r) => r.stargazerCount ?? 0);
  const totalStars = repoStars.reduce((a, b) => a + b, 0);
  const maxStars = repoStars.length ? Math.max(...repoStars) : 0;
  const accountAge = user.createdAt
    ? Math.max(0, (Date.now() - new Date(user.createdAt).getTime()) / (365.25 * 864e5))
    : 0;

  // languages: unique across owned repos (primary + declared)
  const langSet = new Set<string>();
  const langFreq = new Map<string, number>();
  for (const r of repos) {
    if (r.primaryLanguage?.name) {
      langSet.add(r.primaryLanguage.name);
      langFreq.set(r.primaryLanguage.name, (langFreq.get(r.primaryLanguage.name) ?? 0) + 1);
    }
    for (const l of r.languages.nodes) langSet.add(l.name);
  }
  const rankedLanguages = [...langFreq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

  // active_years: distinct years with repo creation or push activity
  const activeYearSet = new Set<number>();
  for (const r of repos) {
    activeYearSet.add(new Date(r.createdAt).getUTCFullYear());
    if (r.pushedAt) activeYearSet.add(new Date(r.pushedAt).getUTCFullYear());
  }

  // lifetime contributions: sum per-year calendars, batched into few requests
  // and best-effort (a failed batch contributes 0 rather than failing the card).
  const windows = yearWindows(user.createdAt ?? nowISO, nowISO);
  const batches: { from: string; to: string }[][] = [];
  for (let i = 0; i < windows.length; i += LIFETIME_BATCH) batches.push(windows.slice(i, i + LIFETIME_BATCH));
  // few requests (aliased years) run in parallel — fast and well within limits.
  const batchResults = await Promise.all(
    batches.map((batch) =>
      graphql<{ user: Record<string, { contributionCalendar: { totalContributions: number } }> }>(yearsBatchQuery(batch), { login })
        .then((d) => batch.map((_, j) => d.user?.[`y${j}`]?.contributionCalendar?.totalContributions ?? 0))
        .catch(() => batch.map(() => 0)),
    ),
  );
  const years = batchResults.flat();
  const cc = user.contributionsCollection ?? {
    totalCommitContributions: 0,
    totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalIssueContributions: 0,
    restrictedContributionsCount: 0,
    contributionCalendar: { totalContributions: 0 },
  };
  const lifetime = years.reduce((a, b) => a + b, 0) || cc.contributionCalendar.totalContributions;
  const activeCalendarYears = years.filter((n) => n > 0).length;

  const recentCommits = cc.totalCommitContributions + cc.restrictedContributionsCount;
  const recentContributions =
    cc.totalCommitContributions +
    cc.totalPullRequestContributions +
    cc.totalPullRequestReviewContributions +
    cc.totalIssueContributions +
    cc.restrictedContributionsCount;
  const yearlyAvg = lifetime / Math.max(accountAge, 1);
  const recentSpike = recentContributions > 2 * yearlyAvg && recentContributions > 200;

  return {
    login: user.login,
    name: user.name ?? user.login,
    avatarUrl: user.avatarUrl ?? "",
    location: user.location,
    followers: user.followers?.totalCount ?? 0,
    account_age_years: accountAge,
    public_repos: user.repositories?.totalCount ?? repos.length,
    total_stars_owned: totalStars,
    max_repo_stars: maxStars,
    repo_stars: repoStars,
    languages: langSet.size,
    rankedLanguages,
    topLanguage: rankedLanguages[0] ?? null,
    recent_contributions: recentContributions,
    active_days_recent: 0,
    active_years: Math.max(activeYearSet.size, activeCalendarYears),
    total_contributions_lifetime: lifetime,
    prs_to_others: cc.totalPullRequestContributions,
    prs_merged_lifetime: user.mergedPRs?.totalCount ?? 0,
    prs_opened_lifetime: user.allPRs?.totalCount ?? 0,
    reviews: cc.totalPullRequestReviewContributions,
    issues_closed: cc.totalIssueContributions,
    recent_commits: recentCommits,
    recent_spike: recentSpike,
  };
}
