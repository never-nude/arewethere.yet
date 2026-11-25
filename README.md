# Singularity Watch

An interactive observatory for public evidence of self-accelerating AI. The [abridged dashboard](https://arewethereyet.now/) summarizes the current score, what contributed, the four milestones and a dated external forecast for AI research automation. The [full dashboard](https://arewethereyet.now/dashboard.html) includes source data, scoring rules, maps, history, and conditional scenarios. DIVERGE uses the hosted companion feed at [never-nude.github.io/singularity](https://never-nude.github.io/singularity/).

## Development

Use Node.js 24. Run `npm run dev` for the local site and live source checks. Run `npm run build` to fetch public data and generate a static GitHub Pages bundle in `dist-pages/`. The build and interface have no package dependencies.

GitHub Actions publishes on pushes to `main` and schedules source checks daily at midnight, 6 a.m., 9:30 a.m., and 4 p.m. Eastern time, including weekends and holidays. The last two checks use the regular NYSE opening and closing times as clock anchors. [NYSE trading hours](https://www.nyse.com/trade/hours-calendars)

Public figures arrive on their publishers’ schedules. If all sources fail during a scheduled run, the previous Pages deployment stays live. A compatible new METR dataset replaces the current benchmark data automatically, and a changed format is flagged for review.

## The evidence index

The weighted score combines benchmark task horizons and breadth, research autonomy and speed, training compute, forecast market sentiment, and tracked frontier releases. Methodology, input values, source dates, and weights are visible in the site. The score is an editorial measure of evidence. Historical model observations are backfilled by release date.

The countdown uses six forecasters’ median months for a superhuman AI researcher. Their milestone requires automating the coding on an AI research project and matching its best researchers’ judgment about experiments. The published range reflects differences between forecasters. Source checks look for revised estimates, and the passage of a forecast month cannot confirm the milestone. [AI Futures Project forecast](https://blog.aifutures.org/p/q35-timelines-update-looks-like-the)

The optional calculator projects a reader-chosen score at a reader-chosen monthly pace. The working definition of the singularity requires independent evidence of an AI-led feedback loop that sustains accelerating capability gains across generations. The site tracks three explicit evidence criteria and records an observed date only when all three have been documented.

## Paths and acceleration watch

The evidence snapshot places the Singularity at the top and evidence for AGI at the base. Each milestone has its own meter for points earned on its evidence checklist. In the 3D map, height shows the degree of self-improvement required. The two floor axes show breadth and performance relative to people. Its arrows show possible sequences and fill in proportion to the evidence for each step. Path scores use published weights and report source coverage separately. The browser checks a public play-money forecast every minute while open. Scheduled builds incorporate published benchmark updates.

The acceleration watch looks for large, corroborating capability and research gains over 7 and 30 days. Open- and closed-weight model leaders share the same Epoch benchmark scale. The long-run timeline uses documented landmarks from 1958 and displays the daily numerical index when a reading is available.
