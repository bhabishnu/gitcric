import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { fetchSignals, GitHubError } from "../../lib/github/client";
import { buildUserCard } from "../../lib/scoring/engine";
import { pickTwins } from "../../lib/match/matcher";
import { PLAYER_INDEX } from "../../lib/data";
import { buildSegments } from "../../lib/view";
import { CardExperience } from "../../components/CardExperience";
import Link from "next/link";

// NOTE: currently INERT. This route calls headers() (for shareUrl), which opts
// it into fully dynamic rendering, so the ISR page cache never engages —
// responses carry `cache-control: no-store` and x-vercel-cache: MISS. What
// actually spares GitHub is the fetch-level Data Cache in lib/github/client.ts
// (same 6h window), which is why warm hits still return in ~0.4s. Left in place
// deliberately: if headers() ever goes, page-level ISR should resume at 6h.
export const revalidate = 21600;

async function load(usernameRaw: string) {
  const username = usernameRaw.replace(/^@/, "").trim();
  const signals = await fetchSignals(username);
  const you = buildUserCard(signals);
  // Seed on the CANONICAL login (GitHub logins are case-insensitive) so the same
  // person always gets the same twins regardless of typed case.
  const twins = pickTwins(you.ovr, you.login, PLAYER_INDEX);
  const segments = buildSegments(you, twins);
  return { you, segments };
}

/**
 * One unmistakable line per failed scout. The auth case gets the loudest
 * treatment on purpose: the deployed token is a classic PAT with an expiry, and
 * when it lapses every scout starts failing at once with a message the visitor
 * reads as "GitHub is busy". This is the only place that says otherwise.
 */
function logScoutFailure(username: string, e: unknown) {
  const tag = "[gitcric] SCOUT FAILED";
  if (!(e instanceof GitHubError)) {
    console.error(`${tag} kind=unhandled login=${username}`, e);
    return;
  }
  if (e.kind === "auth") {
    console.error(
      `${tag} kind=auth login=${username} status=${e.status} — GITHUB_TOKEN IS INVALID, EXPIRED OR REVOKED. ` +
        `This is NOT rate limiting. Rotate the token: Vercel → gitcric → Settings → Environment Variables → ` +
        `GITHUB_TOKEN (classic PAT, scope read:user), then redeploy. Detail: ${e.message}`,
    );
    return;
  }
  if (e.kind === "rate_limit") {
    console.error(
      `${tag} kind=rate_limit login=${username} status=${e.status} — GitHub throttled us; the token is fine. ` +
        `Detail: ${e.message}`,
    );
    return;
  }
  if (e.kind === "timeout") {
    console.error(
      `${tag} kind=timeout login=${username} — GitHub did not answer inside the scout budget. Detail: ${e.message}`,
    );
    return;
  }
  console.error(`${tag} kind=${e.kind} login=${username} status=${e.status} — ${e.message}`);
}

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(username);
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "not_found") notFound();
    // Next sanitises server errors before error.tsx sees them, so the cause has
    // to be written down HERE or it is lost. Worth being loud: an expired token
    // and ordinary throttling look identical from the browser.
    logScoutFailure(username, e);
    throw e; // rate_limit / auth / timeout / unknown → error.tsx
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gitcric.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/${encodeURIComponent(username.replace(/^@/, ""))}`;

  return (
    <main className="min-h-dvh">
      <nav className="border-b border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-[800] uppercase tracking-tight"
          >
            Git<span className="text-[var(--color-crimson)]">Cric</span>
          </Link>
          <Link href="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Scout another →
          </Link>
        </div>
      </nav>
      <CardExperience
        segments={data.segments}
        avatarUrl={data.you.avatarUrl}
        shareUrl={shareUrl}
      />
    </main>
  );
}
