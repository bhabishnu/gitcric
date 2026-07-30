/**
 * Inline monochrome brand marks. No icon dependency, no network request, and
 * `currentColor` throughout so each one inherits the graphite/crimson hover
 * conventions rather than carrying brand colour of its own.
 *
 * Paths are the official simple-icons glyphs on a 24x24 viewBox.
 * Safe to import from client components: this file is pure JSX with no server
 * imports, so it adds nothing but the markup to the bundle.
 */

type IconProps = { className?: string };

export function GitHubMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function XMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

export function LinkedInMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function RedditMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.974-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015a.484.484 0 0 0-.585.332l-1.65 5.19c-2.767.07-5.271.829-7.117 2.043a2.647 2.647 0 0 0-1.84-.746C1.192 9.134 0 10.32 0 11.779c0 .977.535 1.828 1.324 2.290-.036.23-.055.462-.055.696 0 3.545 4.107 6.428 9.155 6.428 5.049 0 9.156-2.883 9.156-6.428 0-.232-.019-.463-.055-.691.789-.462 1.324-1.313 1.324-2.291zM6.152 13.878c0-.926.752-1.679 1.678-1.679.926 0 1.678.753 1.678 1.679 0 .926-.752 1.679-1.678 1.679-.926 0-1.678-.753-1.678-1.679zm9.462 4.464c-.966.965-2.755 1.04-3.281 1.04-.526 0-2.316-.075-3.281-1.04a.36.36 0 0 1 .509-.51c.609.609 1.911.826 2.772.826.861 0 2.164-.217 2.773-.826a.36.36 0 0 1 .508.51zm-.111-2.785c-.926 0-1.678-.753-1.678-1.679 0-.926.752-1.679 1.678-1.679.926 0 1.679.753 1.679 1.679 0 .926-.753 1.679-1.679 1.679z" />
    </svg>
  );
}

/** Filled star, used beside the GitHub star count. */
export function StarMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M12 1.75l3.093 6.61 6.907.9-5.06 4.9 1.28 7.09L12 17.77l-6.22 3.48 1.28-7.09-5.06-4.9 6.907-.9z" />
    </svg>
  );
}

/** Download — a UI glyph (not a brand mark): a stroked arrow dropping into a tray. */
export function DownloadMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className={className}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4.5 17v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
