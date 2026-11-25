#!/usr/bin/env bash
set -euo pipefail
dir="${OBSERVATORY_CANDIDATE_DIR:?}"
mkdir -p "$dir"
# Only successful runs of the dedicated collection workflow on this repository's main branch qualify.
# Fetch at most the retained seven days after a service interruption.
since=$(node --input-type=module - <<'JS'
import {readArchive} from './scripts/checkpoint-archive.mjs';
const records = await readArchive(process.env.OBSERVATORY_ARCHIVE_DIR);
console.log(records.at(-1)?.checkpointAt ?? new Date(Date.now() - 7*86400000).toISOString());
JS
)
if ! gh run list --workflow collect.yml --repo "$GITHUB_REPOSITORY" --branch main --status success --limit 90 --json databaseId,createdAt > "$dir/runs.json"; then
  echo 'Discovery history unavailable. Fresh checkpoint sources checked separately.' > "$dir/status.txt"
  exit 0
fi
echo 'Intervening discovery runs checked.' > "$dir/status.txt"
while read -r run; do
  [[ "$run" =~ ^[0-9]+$ ]] || continue
  if ! gh run download "$run" --repo "$GITHUB_REPOSITORY" --name candidate-evidence --dir "$dir/$run"; then
    rm -f "$dir/$run/candidate.json"
    rmdir "$dir/$run" 2>/dev/null || true
    echo 'Some pending discovery captures were unavailable. Fresh checkpoint sources checked separately.' > "$dir/status.txt"
  fi
done < <(jq --arg since "$since" -r '.[] | select(.createdAt >= $since) | .databaseId' "$dir/runs.json")
