# Singularity Watch

[At a glance](https://arewethereyet.now/) presents the current evidence for four AI milestones. The [full dashboard](https://arewethereyet.now/dashboard.html) publishes the criteria, system-specific observations, benchmark history, forecasts, three-dimensional field, human oversight studies and checkpoint archive. Both views use the same published assessment. The [scientific methodology](site/observatory-methodology.md) gives the rules, assumptions and thresholds.

## Reading an assessment

AGI requires reliable human-level breadth and transfer. ASI requires broad superiority to leading experts and therefore includes the AGI requirements. RSI requires a documented chain in which a system helps improve a successor that can itself repeat the process. A singularity requires independent evidence of sustained AI-driven acceleration and a change in the wider pace of technological progress. Several milestones can be first observed in one edition.

Each necessary criterion is counted once. One named system or lineage must supply the evidence. A directly tested negative, an unanswered question and conflicting studies have different states. A numeric score is available only after all required criteria have independent assessments. It equals the rounded percentage of those criteria met. Counts for available assessments, confirmed criteria and total criteria accompany the result. Inputs, forecasts, launch announcements and prediction-market prices cannot establish milestone achievement. Raw measurements remain useful when the milestone itself is indeterminate.

Each milestone now has an arrival outlook with a central calendar year, approximate time remaining, alternative scenarios and a description of demonstrated progress. The central case depends on published expert forecasts, measured capabilities and explicit assumptions that connect those inputs to the watch’s definitions. The scenarios include prolonged delays and nonarrival within the horizon. Each forecast identifies what could change it. The optional singularity clock uses the stated precision of the available forecast.

A separate calculation tests whether independent, comparable measurements directly support a date for every necessary condition of a single system. It compares persistence, linear and log-linear trends over a five-year horizon and validates against held-out observations. An absence of qualifying measurements leaves this direct estimate open. The long-range outlook remains available under its stated assumptions.

The front page also gives a testable short-term outlook. For example, the watch can predict the highest published benchmark score for a model released during the next calendar month. Each issued prediction has a target month, a unit, a verification date and a source. Open-weight and closed-weight models have separate comparisons. The dashboard preserves the original predictions alongside subsequent outcomes so readers can inspect the error.

## Evidence and field

The evidence register distinguishes the measured system, organization, source, classification, uncertainty, test date, publication date, source reference date and retrieval time. A missing exact date stays undisclosed. Historical benchmark charts use model release dates. Read each series in its original unit. Studies of particular tests, labs, infrastructure or behavior carry limits on extrapolation.

Live sources include METR task evaluations, Epoch AI benchmark and computing data, publisher feeds, operator incident reports and Great Britain’s National Energy System Operator. Versioned readings also include ARC Prize, the UK AI Security Institute, IEA, TSMC, DeepSeek, Google DeepMind, Meta, Waymo and published algorithmic-efficiency research. Software consumes numerical feeds; dated reports and criterion reviews require editorial maintenance. Geographic, language and sector coverage varies. The register records which topics have evidence. An outage alone cannot establish its cause, AI involvement, or a slowdown in global research.

The WebGL field uses conceptual, fixed milestone anchors and evidence stages on three axes. X represents breadth and generalization, Y capability relative to people, and Z autonomous research and self-improvement. A system requires independent evidence on all three axes for a measured current position. Without it the white sphere occupies a separate unplaced shelf. Paths distinguish logical requirements, measured support, possible routes, unsupported inferences and incompatible claims. A keyboard-accessible selector and evidence panel also work when graphics are unavailable. Archived editions support comparison and replay.

## Publication and history

Official recalibrations are scheduled every calendar day at **midnight, 9:30 a.m. and 4 p.m. America/New_York**. Local civil time follows daylight saving time. The morning and afternoon times reference NYSE hours even on weekends and holidays. Discovery runs between checkpoints can stage source material. Only the official workflow can replace an existing edition. A push, ordinary manual build or duplicate execution republishes the same validated state. The first installation records a separately labeled commissioning baseline at the time it actually collected evidence.

**Launch test** is the first official reading following commissioning. The owner requested an immediate collection for that edition. Its timestamp is the actual collection time, and its record links back to the commissioning baseline. Its monthly predictions have the same verification rules as later editions. A separately timestamped [first milestone outlook](https://arewethereyet.now/data/first-arrival-outlook.json) uses the frozen launch measurements and newly reviewed forecasting literature. Opening the original checkpoint reproduces the edition as readers first saw it. Subsequent official readings follow the daily schedule and archive their own four-milestone outlooks.

An edition records its scheduled instant, actual validation and evidence cutoff, observations, rules, model versions, forecasts, external events, coordinates, paths, original inputs, source revision and predecessor hash. The workflow stores content-addressed records on the append-only-by-workflow assessment-archive Git branch before publishing with GitHub Pages. It rejects checksum or chain inconsistencies and non-fast-forward writes. Repository administrators retain standard GitHub administrative powers. Recovery can publish a previously stored record. Missed checkpoints stay absent from the archive. Until another run succeeds, the front page identifies the last validated edition and its age relative to the schedule.

- [Published assessment and archive index](https://arewethereyet.now/data/observatory.json)
- [Source payload](https://arewethereyet.now/data/signals.json)
- [DIVERGE-compatible companion feed](https://arewethereyet.now/data/companion.json)
- [Frozen legacy edition](https://arewethereyet.now/data/legacy-v1.json)

The companion retains its previous schema and labels the former weighted index as legacy. Its `assessment` section links to the exact published edition and carries the milestone assessments, forecasts, dated indicator predictions and recorded outcomes. Scheduled editions include `assessment.arrivalOutlook`. The separately issued first outlook is exposed as `supplementalOutlook` while its underlying edition is current. The legacy edition preserves the last published readings, reconstructed scale and external researcher forecast with the previous code revision. Earlier v1 daily reconstructions do not constitute archived v2 checkpoints.

## Build and reproduce

Use Node.js 24. No dependency installation is required.

```sh
npm test
npm run build
npm run dev
```

The build generates static files in `dist-pages/`. Development serves current UI files with the frozen data from that build. If there is no built assessment, the development server creates one. Local builds retain their baseline in the ignored `.observatory-archive/` directory. Set `OBSERVATORY_ARCHIVE_DIR` to a new empty local directory for a separate commissioning test.

To reproduce an archived assessment, retrieve its source record through the dashboard and check out the code revision in `sourceRevision`. For a record with a predecessor, download that raw JSON as well. The replay verifies its hash and recalculates the assessment and field from the recorded inputs without network access.

```sh
npm run replay -- checkpoint.json previous.json
```

To reproduce the first outlook, pass its downloaded JSON followed by the original Launch test JSON. For a commissioning record, omit the predecessor argument. The [review ledger](src/observatory-ledger.json) is versioned with the methodology. New findings and calibrated series receive explicit evidence references and retain their review dates. Historic editions keep the data and decisions originally published.
