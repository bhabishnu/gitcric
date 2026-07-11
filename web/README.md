# GitCric — web app

Enter a GitHub username → get a FUT-style cricket card scored from your GitHub
activity → toggle a five-segment switch (YOU · TEST · ODI · T20I · IPL) to meet
the real cricketer of your equal in each format.

## How it works

- **Scoring** (`lib/scoring`) is a re-axing of [GitFut](https://github.com/Younesfdj/gitfut)'s
  engine to cricket's six axes (BAT/POW/BWL/ECO/FLD/IMP): raw → within-profile
  z-score → tension pairs → spike → role-weighted OVR (cap 85) → legacy gate. The
  dials in `lib/scoring/constants.ts` are tuned so user OVRs land on the SAME
  compressed scale as the cricketer DB (empty <50 · casual 55–70 · solid 70–83 ·
  strong OSS 84–90 · torvalds 93–97 · 99 unreachable).
- **Data** (`lib/data.ts`) reads two committed JSON files in `gen/`, built from
  the pipeline's `gitcric.db` by `scripts/export-data.ts`. Nothing native ships
  to the runtime — the app is self-contained and deploys to the edge/serverless.
- **Matcher** (`lib/match/matcher.ts`) picks the nearest **recognizable** twin
  (multi-format international, `gformats ≥ 2`) per format within ±3 OVR,
  deterministic per username.

## Develop

```bash
npm install
echo "GITHUB_TOKEN=ghp_xxx" > .env.local   # classic PAT, no scopes needed (public read)
npm run export-data                        # regenerate gen/*.json from ../data/gitcric.db
npm run dev
```

Scripts: `npm run export-data` (DB → JSON), `npm run calibrate [login…]` (scoring
trail), `npm run match-check [login…]` (twin validation), `npm run typecheck`.

## Deploy (Vercel)

Set the project **root directory** to `web/`, add `GITHUB_TOKEN` as an env var.
`gen/*.json` is committed, so the build needs no database. Each username card is
ISR-cached 6h; the GitHub GraphQL fetch is cached at the fetch layer.
