# Decisions for the next Singularity Watch edition

These are proposals for review. The figures below come from the November 25, 2026, 14:30 UTC checkpoint and its separately issued pace outlook. Effort estimates are for one engineer and include tests. Time spent collecting new observations or waiting for independent verification is additional.

## A. Let measurements move the reference year in either direction

The current 2062 reference comes from a particular constraint. The midpoint of the two published AGI survey anchors (2042 and 2050) is 2046. Adding the survey-implied 16 years for wider technological acceleration gives 2062. The singularity calculation takes the latest of that date, the next research cycle after RSI, and an outside forecast of widespread progress. Today the first of these sets the date. The 16 years come from interpolating two conditional survey answers. They have no standing as a measured law.

The original `proxyFloor` and the pace outlook's validated task waypoint can push a survey date later. Faster results can undo that delay. Going earlier than the underlying anchor requires another mechanism. A dated, qualifying direct forecast or observation already takes precedence, and a verified first successor can change the RSI path. Moving one input only moves the singularity year if it changes the constraint that finishes last.

**Options.** Keep the outside estimates as fixed starting points and show measurement surprises alongside them. Alternatively, combine the outside estimates with a bounded, two-way adjustment. A third route would fit a probability distribution for milestone arrival. With no verified arrivals to train on, its apparent precision would depend heavily on judgment.

**Recommendation.** Trial the two-way adjustment alongside the issued reference. Freeze a baseline forecast of a measurable target, such as the 80%-success task horizon. On each eligible independent release, compare the observed log task length with the prediction made *before* that release. Using a positive conversion factor specified in advance, shorten the relevant gate's remaining time for a positive surprise and lengthen it for a negative one. Specify and publish the weight, cap, uncertainty and minimum validation record before using it. Report which values were chosen by editors. A missing observation supplies no update. Re-reading the same release four times supplies one update. Keep the link from task performance to AGI distinct from the link from lab progress to wider technological change. A faster task result on its own has no power to establish that wider change.

Backtest the proxy against later observations using only data available at each simulated issue date, compare against persistence and the existing model, and test upward, downward, missing and revised readings. Proxy accuracy can be tested now. Its conversion into years to a milestone remains a scenario assumption. Show both references, the binding constraint, the difference attributable to each input, sensitivity to the conversion factor, and the stalled path. Promote the trial only after publishing the results and selecting a prospective effective date.

**Files, versions and effort.** Introduce a separately named outlook module and versioned source/parameter manifest under `site/`. Wire selection through `site/observatory-model.js`, `scripts/issued-outlooks.mjs` and `scripts/replay-assessment.mjs`. Update `site/observatory-calculations.js`, `site/observatory-methodology.md` and `test/observatory-pace-model.test.mjs`. A replacement reference warrants outlook **3.0.0**, up from pace outlook 2.0.0. Leave all seven currently hashed files byte-identical and issue a distinct manifest with the new implementation's hashes and its base checkpoint hash. Replay old records with their recorded implementation, keep the original 1.0.0 outlook and its 2.0.0 supplement available, and label any retrospective trial as a backtest. The milestone assessment and monthly indicator versions can retain their existing numbers. **8–12 engineering days**, plus prospective evaluation.

## B. Choose what a clock can tell readers

The clock targets July 1 at 00:00 UTC in the selected reference year. This edition's year, 2062, also happens to lie halfway between the finite 2029 and 2095 scenarios. The clock code uses the reference year directly. Those scenario endpoints have no assigned probability and one scenario has no arrival date.

| Choice | What readers gain | Trade-off |
| --- | --- | --- |
| Keep the seconds clock | A recognizable signature, especially with the year, range, target convention and edition time beside it. | Seconds imply a precision the underlying assumptions cannot deliver. |
| Drop the clock | A year and scenario band are easy to compare across milestones. | Readers lose a quick indication of when anything on the page will actually change. |
| Count down to a scheduled event | Readers can return for the next check or the opening of a defined verification window. Milestone bands still show long-term possibilities. | A scheduled check can run late or produce no change. An open verification window can close without a qualifying observation. |

**Recommendation.** Make the reference year and its finite range the hero. Place a quieter “Next scheduled check” timer beside the timestamp of the last successful edition. Show the February 1–7, 2027 verification window beside the **monthly indicator forecasts** it covers. Count down to opening, then show “Verification window open,” followed by the recorded outcome or “Awaiting result.” Derive later windows from the published forecast records. Show the time zone, allow a stale edition to identify itself, and keep second-by-second updates out of screen reader live announcements.

**Files, versions and effort.** `site/observatory-clock.js`, `site/checkpoint-schedule.js`, `site/observatory-ui.js`, `site/index.html`, `site/dashboard.html`, `site/observatory.css`, `scripts/build-pages.mjs` and `test/observatory-clock.test.mjs`. Use the existing checkpoint and verification fields. All seven model hashes and all scientific version numbers stay fixed. **2–3 days**, including check boundaries, stale editions and daylight-saving transitions.

## C. Show progress toward evaluating each criterion

The edition contains 425 observations. Its formal coverage is 0 of 3 criteria assessed for AGI, 0 of 2 for RSI, 0 of 4 for ASI and 0 of 3 for the singularity. Every displayed criterion is unknown and each total score is indeterminate. Those 425 records include inputs for rankings, trend estimates and context. Treating their count as milestone evidence would reward frequent reporting and could combine incompatible systems.

**Options.** Keep the existing statuses and expose the evidence-review queue. Add a separately tracked evidence stage for each criterion. Or award fractional points for suggestive results, which would require defensible weights and a decision on whether unrelated findings can add up to verification.

**Recommendation.** Show an evidence stage beside the formal result. “Candidate reported” requires an identifiable system, test and original source. “Direct test documented” requires a result mapped to the specific criterion, including scope and limitations. “Independent review in progress” identifies the reviewer and the question being checked. Once reviewed, the current formal rules determine met, unmet or conflicting. A failed independent test is informative. A conflicting review should be visible with both sources. An untested condition stays open. With no linked record, say so. Give readers a date and a source at each stage, identify withdrawn or superseded evidence, and retain the history. For example, report “1 of 3 criteria has a documented test” with a separate count for independent assessments. The existing percentage can still mean exactly what its denominator says.

**Files, versions and effort.** Extend candidate metadata in `scripts/candidate-observations.mjs`, use a separate versioned review-stage record, and display it in `site/observatory-evidence.js` and `site/observatory-ui.js`. Document the stages in `site/observatory-methodology.md` and test against `test/observatory-model.test.mjs`. Start the new sidecar schema at **1.0.0** keyed to the source checkpoint and criterion. Missing historical fields mean “stage not recorded.” With this approach all seven model hashes, the **2.0.0** scoring methodology and the forecast versions stay fixed. Choosing partial credit instead would require a successor to the hashed `site/observatory-criteria.js`, scoring methodology **3.0.0**, and explicit breaks in score comparisons. **4–6 days** plus reviewer time.

## D. Show where AI reaches people's lives

**Options.** Lead with controlled workplace studies already cited in the pace material, build a regional statistical panel, or combine one documented workplace result with a few clearly scoped population indicators. Studies can identify effects in a particular setting. Population statistics show reach and context, but hiring cycles, inflation and survey redesigns can all change the figures.

**Recommendation.** Pair a workplace result with the following small panel. Start in a region with consistent definitions, print that region in the headline, and add other regions as comparable series become available. These are prospective primary sources for editorial review.

| Reader question | Source and reading |
| --- | --- |
| Where is employment changing? | U.S. Bureau of Labor Statistics, Current Employment Statistics. Show payroll jobs by industry and the comparison period. An industry trend alone cannot identify AI's contribution. |
| What is happening to pay? | Use the same agency's average hourly earnings for the same period. For a purchasing-power comparison, deflate with a named Consumer Price Index series and distinguish a change in worker mix from an individual raise. |
| Are prices changing? | Use the Bureau of Labor Statistics Consumer Price Index for a named category and geography. Keep household prices and published model API prices in separate units. Either can move while the other holds steady. |
| Who has adopted AI? | U.S. Census Bureau Business Trends and Outlook Survey for U.S. businesses. Eurostat's enterprise ICT usage survey is a candidate for a separately labeled European view. Print the question, denominator, survey period and any break in wording or firm-size coverage. |

Each card should state the date, unit, region, comparison and what the data can establish. For a workplace study give the intervention, people studied and measured outcome. Lead the capability strip with the eligible METR fit. In this edition the human-expert duration of tasks completed at 50% success doubled in about **111 days** on the selected suite. Display the fit window and held-out performance alongside it. The 80%-success series lacks a supported doubling-time fit in this edition. A tooltip and a visible definition should explain **task horizon** as the time a human expert needs for tasks an AI completes at the named success rate. **ECI** here means **Epoch Capabilities Index**, Epoch AI's combined benchmark scale. ECI points compare tested models. Neither measure directly gives a worker's productivity or likelihood of losing a job.

**Files, versions and effort.** Build the panel in `site/observatory-acceleration.js` and `site/observatory-acceleration.css`, reuse explanations from `site/glossary.js`, and select the brief and full views in `site/observatory-ui.js`. For future series, add dated, editor-reviewed local records through `src/global-evidence.mjs` and the build in `scripts/build-pages.mjs`. Serve snapshots from the site and retain source vintage and revisions. The recommendation is descriptive, so all seven hashes and the scientific version numbers stay fixed. Adding economic weights to a forecast would be a separate model decision under A. **2–3 days** for the existing measures and **4–6 additional days** for a first regional panel, plus source review.

## E. Use one public name

**Options.** The domain *arewethereyet.now* is memorable but gives a new reader little clue about the subject. *Singularity Observatory* describes the analytical role and already appears in the page titles. *Singularity Watch* names the subject and matches the masthead and existing social site name.

**Recommendation.** Use **Singularity Watch** as the publication name, with **At a glance** and **Full dashboard** as the two view labels. Put the publication name in both page titles, search and share descriptions where appropriate, the structured site name, and the share image. Retain the current domain, paths and hourglass. Existing inbound links will keep working. Old share previews may persist until the receiving service refreshes its cache.

**Files, versions and effort.** `site/index.html`, `site/dashboard.html`, `site/404.html`, `scripts/build-pages.mjs`, `README.md`, `site/observatory-methodology.md`, `design/share-card.svg` and its rendered `site/assets/singularity-watch-card.png`. Use the next normal asset stamp. All seven model hashes and all scientific version numbers stay fixed. Preserve the title printed on each previously issued record. **1–2 days**, including search and link-preview checks.

## F. Three editorial choices

### Language selection

**Options.** Keep the alphabetical menu of 249 targets including English, shorten it to an editorial shortlist, or make all 249 searchable. A shortlist saves scrolling but takes access away from people who already have a working translation. Alphabetic order alone is difficult to scan across scripts.

**Recommendation.** Retain every native-language name, script and regional variant. Offer local search by native name, translated label where available, or language code, and expose the browser's preferred language as a shortcut only. Keep keyboard navigation, screen reader labels and the translation-provider notice. Translation remains a reader's choice. **Files and cost:** `site/language-menu.js`, `site/language-menu.css`, `site/translation-languages.js` for labels if needed. All seven model hashes and all scientific versions stay fixed. **2–3 days**, including right-to-left, keyboard and mobile tests.

### Provider outages and electricity demand

**Options.** Keep displaying every reading, stop collecting these feeds for future editions, or continue collecting while publishing only a relevant, attributable event in the brief. A provider's status report covers its own service. Great Britain's grid demand covers a whole electricity system. Neither alone establishes a global AI slowdown.

**Recommendation.** Keep routine readings in the dashboard's source detail. Bring a disruption onto the front page only when dated evidence identifies the affected capacity, duration and a measured AI consequence. Show geographical coverage and the uncertainty in attributing the effect. Mark recovery when evidence warrants. Hiding routine rows reduces noise. Retaining them preserves the material needed to assess a genuine interruption. **Files and cost:** presentation in `site/observatory-evidence.js` and `site/observatory-ui.js`. If collection is later retired, change `src/provider-incidents.mjs`, `src/global-evidence.mjs` and `src/signals.mjs` prospectively, with a source-coverage end date. The display choice leaves all seven model hashes and scientific versions fixed. Giving outages a date-shifting weight would require a new version under A. **1–2 days** for presentation, plus editorial review of exception cases.

### Length of At a glance

**Options.** Retain the complete sequence, move selection of charts behind expandable summaries, or publish a short front page with direct links into the full dashboard. The audit's estimate of ten phone screens depends on device height, language and which panels are open. Page length alone gives little guidance about which figures people miss.

**Recommendation.** Keep the year, range, clock treatment chosen under B and edition time together. Follow with four compact milestone rows showing the reference year, independent evidence coverage, and what any published points mean. Give one measured change with its period and denominator, one comparison of leading open- and closed-weight models, and one sentence on what moved the reference or held it steady. Put the important numbers on the page. Link each to its corresponding chart, calculations, or full rankings. Keep definitions available by tap, focus and hover. Test at 393px with large text and a longer translated label: can readers find the date, explain the score, and reach its source without reading the dashboard first?

**Files, versions and effort.** `site/index.html`, `site/observatory-ui.js`, `site/observatory.css`, `site/observatory-charts.js`, and existing anchors in `site/dashboard.html`. Reuse the published values and glossary. All seven model hashes and scientific versions stay fixed. **2–4 days**, including mobile and assistive-technology checks.
