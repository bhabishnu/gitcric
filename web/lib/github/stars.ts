/**
 * Star count for the repo, fetched SERVER-SIDE only.
 *
 * The browser never talks to the GitHub API here and never sees GITHUB_TOKEN:
 * the only caller is <StarOnGitHub/>, a server component, so this never enters a
 * client bundle. (No `import "server-only"` guard because that package is not a
 * dependency here — keep this module out of client components by hand.)
 * The token is optional — an unauthenticated call works too, just on a smaller
 * rate budget — so a missing token degrades to "no count" rather than breaking
 * the page.
 *
 * Anything other than a clean 200 returns null, and the caller hides the count
 * while keeping the button. A star count is decoration; it must never be able to
 * take the landing page down.
 */
const REPO = "bhabishnu/gitcric";
export const STARS_REVALIDATE_SECONDS = 3600;

export async function getStarCount(): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "gitcric",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Cache for an hour: the count is ambient, and this keeps the landing page
      // off GitHub's rate limit no matter how much traffic it takes.
      next: { revalidate: STARS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { stargazers_count?: unknown };
    return typeof json.stargazers_count === "number" ? json.stargazers_count : null;
  } catch {
    return null;
  }
}

/** 1200 -> "1.2k". Keeps the pill from growing as the repo does. */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}
