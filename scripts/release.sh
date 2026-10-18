#!/usr/bin/env bash
# Tags a release and pushes the tag, which starts .github/workflows/release.yml.
#
#   scripts/release.sh 0.2.0           tag HEAD as v0.2.0
#   scripts/release.sh 0.2.0 --retry   v0.2.0's release run failed and nothing was
#                                      published: move the tag to HEAD and run again
#
# Bump first with scripts/version.sh set 0.2.0, commit and push to main. The release
# workflow runs CI on the tag before building; if it fails, nothing is published, and
# this script can tag the fixed commit with the same version (see --retry).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

version="${1:?Give the version, e.g. 0.2.0}"
tag="v${version#v}"
retry=0
[[ "${2:-}" == --retry ]] && retry=1

if [[ -n "$(git status --porcelain)" ]]; then
  echo "The working tree has changes. Commit or stash them, then release." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null || git ls-remote --exit-code --tags origin "$tag" >/dev/null; then
  if (( !retry )); then
    echo "$tag already exists. If its release run failed, use --retry; otherwise bump to the next version." >&2
    exit 1
  fi
  if gh release view "$tag" >/dev/null 2>&1; then
    echo "$tag was published, so it can't move. Bump to the next version." >&2
    exit 1
  fi
fi

scripts/release-gate.sh "$tag" HEAD
if (( retry )); then
  git tag -d "$tag" >/dev/null 2>&1 || true
  git push -q origin ":refs/tags/$tag" 2>/dev/null || true
fi
git tag -a "$tag" -m "bertha $tag"
git push origin "$tag"
echo "Pushed $tag. Follow the build with: gh run watch \$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
