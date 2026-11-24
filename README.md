# Singularity Watch

An interactive observatory for public evidence of self-accelerating AI. The site publishes at [never-nude.github.io/singularity](https://never-nude.github.io/singularity/).

## Development

Use Node.js 24. Run `npm run dev` for the local site and live source checks. Run `npm run build` to fetch public data and generate a static GitHub Pages bundle in `dist-pages/`. The build and interface have no package dependencies.

GitHub Actions publishes on pushes to `main` and checks sources hourly. Public figures arrive on their publishers’ schedules. If all sources fail during a scheduled run, the previous Pages deployment stays live. A compatible new METR dataset replaces the current benchmark data automatically, and a changed format is flagged for review.

## The evidence index

The weighted score combines benchmark task horizons and breadth, research autonomy and speed, training compute, forecast market sentiment, and tracked frontier releases. Methodology, input values, source dates, and weights are visible in the site. The score is an editorial measure of evidence. Historical model observations are backfilled by release date.

A scenario date marks a hypothetical crossing of the 75-point watch line. The working definition of the singularity requires independent evidence of an AI-led feedback loop that sustains accelerating capability gains across generations. The site tracks three explicit evidence criteria and records an observed date only when all three have been documented.
