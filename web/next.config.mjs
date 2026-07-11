/** @type {import('next').NextConfig} */
const nextConfig = {
  // The generated JSON data lives in web/gen and is imported directly; nothing
  // native ships to the runtime. better-sqlite3 is only used by build scripts.
  serverExternalPackages: ["better-sqlite3"],
  // web/ is fully self-contained — pin the trace root so stray parent lockfiles
  // don't confuse file tracing (and so Vercel can use web/ as the project root).
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
