import { installGlossary } from './glossary.js';

const briefingTerms = [
  ['singularity|AI singularity|technological singularity', 'The singularity', 'The Watch uses this term for a sustained cycle in which AI helps build its successor and research progress speeds up across several generations.'],
  ['superhuman AI researcher|superhuman AI researchers', 'Superhuman AI researcher', 'For this forecast, an AI would automate all coding on an AI research project and choose experiments as well as its best human researchers.'],
  ['evidence score|evidence index|evidence points', 'Evidence score', 'A point is credit for a result that meets one of the Watch’s published rules. Each of the eight indicators has its own point allowance. Together they can earn up to 100 points.'],
  ['compute|training compute|computing power', 'Compute', 'The computing work used to train or run AI. The Watch tracks how much calculation went into training a leading model.'],
  ['play-money market|play-money forecast|prediction market', 'Prediction market', 'People trade on whether a future event will happen. The play-money market tracked here uses virtual money, and its price records participants’ expectations.'],
  ['50/50 date|50/50 dates|median forecast|median forecasts|median date|median dates', 'A forecaster’s median date', 'The forecaster thinks the event is equally likely to happen before or after this date. Each forecaster can choose a different date.'],
];

export function installBriefingGlossary(root) {
  installGlossary(root, {
    additionalEntries: briefingTerms,
    inlineButtons: true,
    // Keep links, checklist toggles, and the publication’s name single-purpose.
    skipSelector: 'h1, a, button, summary, label, .front-term-hint',
  });
}
