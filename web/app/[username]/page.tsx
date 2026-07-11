import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { fetchSignals, GitHubError } from "../../lib/github/client";
import { buildUserCard } from "../../lib/scoring/engine";
import { pickTwins } from "../../lib/match/matcher";
import { PLAYER_INDEX } from "../../lib/data";
import { buildSegments } from "../../lib/view";
import { CardExperience } from "../../components/CardExperience";
import Link from "next/link";

// Revalidate each username's card every 6h (ISR) — respects GitHub rate limits.
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

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(username);
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "not_found") notFound();
    throw e; // rate_limit / auth / unknown → error.tsx
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
