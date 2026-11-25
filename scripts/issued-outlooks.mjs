import firstOutlook from '../site/data/first-arrival-outlook.json' with { type: 'json' };
import firstPaceOutlook from '../site/data/first-pace-outlook.json' with { type: 'json' };
export {firstOutlook, firstPaceOutlook};

// A separately issued bulletin can supersede the live outlook between two official checks.
export function previouslyIssuedOutlook(assessment, sha256, includePace = true) {
  if (includePace && sha256 && sha256 === firstPaceOutlook.basedOnSha256) return firstPaceOutlook.outlook;
  return assessment?.arrivalOutlook ?? (sha256 === firstOutlook.basedOnSha256 ? firstOutlook.outlook : null);
}
