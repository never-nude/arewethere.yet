#!/usr/bin/env bash
set -euo pipefail

cd "${OBSERVATORY_ARCHIVE_DIR:?}"
git add --all
if git diff --cached --quiet; then exit 0; fi
if [[ -n "$(git diff --cached --diff-filter=MDRCTUXB --name-only)" ]]; then
  echo "Published archive records are append-only." >&2
  exit 1
fi
git commit -m "Archive validated assessment from workflow ${GITHUB_RUN_ID:?}"
# A concurrent advance causes a non-fast-forward rejection; the job never forces an update.
git push origin HEAD:refs/heads/assessment-archive
