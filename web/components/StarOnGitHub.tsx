import { getStarCount, formatStars } from "../lib/github/stars";
import { GitHubMark, StarMark } from "./icons";

/**
 * "Star on GitHub" pill. A SERVER component: the star count is fetched on the
 * server (cached an hour) so no GitHub call — and no token — ever reaches the
 * browser. If the fetch fails the count is simply omitted and the button stays.
 *
 * `compact` drops the words on small screens so the landing hero keeps its
 * breathing room; the label returns from `sm` up.
 */
const REPO_URL = "https://github.com/bhabishnu/gitcric";

export async function StarOnGitHub({ compact = false }: { compact?: boolean }) {
  const stars = await getStarCount();

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={stars === null ? "Star GitCric on GitHub" : `Star GitCric on GitHub — ${stars} stars`}
      className="gc-ghstar pressable"
    >
      <GitHubMark className="h-[17px] w-[17px] shrink-0" />
      <span className={compact ? "hidden sm:inline" : ""}>Star on GitHub</span>
      {stars !== null && (
        <span className="gc-ghstar-count tabular">
          <StarMark className="gc-ghstar-star h-[13px] w-[13px]" />
          {formatStars(stars)}
        </span>
      )}
    </a>
  );
}
