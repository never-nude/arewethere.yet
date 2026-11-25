#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${OBSERVATORY_ARCHIVE_DIR:?}" "${GH_TOKEN:?}"
gh auth setup-git --hostname github.com
git init --quiet --initial-branch=assessment-archive "$OBSERVATORY_ARCHIVE_DIR"
cd "$OBSERVATORY_ARCHIVE_DIR"
git remote add origin "https://github.com/${GITHUB_REPOSITORY}.git"
published=$(mktemp)
trap 'rm -f "$published"' EXIT
code=$(curl --silent --show-error --retry 2 --max-time 20 --output "$published" --write-out '%{http_code}' https://arewethereyet.now/data/observatory.json)
case "$code" in
  200)
    digest=$(jq -re '.currentRecord.sha256' "$published")
    if [[ ! "$digest" =~ ^[a-f0-9]{64}$ ]]; then exit 1; fi
    echo "PUBLISHED_HEAD_SHA256=$digest" >> "${GITHUB_ENV:?}"
    ;;
  404) ;;
  *) echo "Could not verify the published ledger head (HTTP $code)." >&2; exit 1 ;;
esac

if git ls-remote --exit-code --heads origin refs/heads/assessment-archive > /dev/null; then
  git fetch --no-tags --depth=1 origin refs/heads/assessment-archive
  git switch -C assessment-archive FETCH_HEAD
else
  status=$?
  if [[ "$status" != 2 ]]; then exit "$status"; fi
  if [[ "$code" != 404 ]]; then
    echo "Cannot initialize an archive over a published v2 ledger." >&2
    exit 1
  fi
  revision=$(gh api -X GET "repos/$GITHUB_REPOSITORY/actions/workflows/pages.yml/runs" -f status=success -f branch=main -f per_page=1 --jq '.workflow_runs[0].head_sha')
  if [[ ! "$revision" =~ ^[a-f0-9]{40}$ ]]; then exit 1; fi
  echo "LEGACY_SOURCE_REVISION=$revision" >> "${GITHUB_ENV:?}"
fi
git config user.name "Singularity Watch archive"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
