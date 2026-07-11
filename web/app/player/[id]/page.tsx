import { notFound } from "next/navigation";
import Link from "next/link";
import { PLAYER_INDEX } from "../../../lib/data";
import { buildPlayerSegments } from "../../../lib/view";
import { CardExperience } from "../../../components/CardExperience";

// Cricketer permalink: their card across every format they qualify in.
export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const segments = buildPlayerSegments(id, PLAYER_INDEX);
  if (segments.length === 0) notFound();

  return (
    <main className="min-h-dvh">
      <nav className="border-b border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-[800] uppercase tracking-tight">
            Git<span className="text-[var(--color-crimson)]">Cric</span>
          </Link>
          <Link href="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Scout a username →
          </Link>
        </div>
      </nav>
      <CardExperience segments={segments} avatarUrl={null} shareUrl={`https://gitcric.vercel.app/player/${id}`} />
    </main>
  );
}
