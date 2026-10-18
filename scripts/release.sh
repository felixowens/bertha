#!/usr/bin/env bash
# Tags a release and pushes the tag, which starts .github/workflows/release.yml.
#
#   scripts/release.sh 0.2.0
#
# Bump first with scripts/version.sh set 0.2.0, commit, push to main and let CI pass.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

version="${1:?Give the version, e.g. 0.2.0}"
tag="v${version#v}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "The working tree has changes. Commit or stash them, then release." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null || git ls-remote --exit-code --tags origin "$tag" >/dev/null; then
  echo "$tag already exists. Releases are never moved; bump to the next version." >&2
  exit 1
fi

scripts/release-gate.sh "$tag" HEAD
git tag -a "$tag" -m "bertha $tag"
git push origin "$tag"
echo "Pushed $tag. Follow the build with: gh run watch \$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
