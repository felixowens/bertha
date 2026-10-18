#!/usr/bin/env bash
# Whether TAG may be released from REV. Run by scripts/release.sh, the pre-push hook
# and the release workflow, so a release can't skip it from any direction.
#
#   scripts/release-gate.sh v0.2.0 [REV]
#
# 1. The tag matches the version in every place scripts/version.sh knows.
# 2. REV is on origin/main.
# 3. If CI already ran on REV (by hand, gh workflow run ci.yml), it passed. CI doesn't
#    run on pushes, so no run is fine: the release workflow runs the whole suite on the
#    tag before it builds anything. Skipped with --no-ci or when gh isn't installed.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ci=1
args=()
for a in "$@"; do
  if [[ "$a" == --no-ci ]]; then ci=0; else args+=("$a"); fi
done
tag="${args[0]:?Give the tag, e.g. v0.2.0}"
rev="${args[1]:-HEAD}"
sha="$(git rev-parse "$rev^{commit}")"
short="${sha:0:7}"

scripts/version.sh check "$tag" "$sha"

git fetch -q origin main
if ! git merge-base --is-ancestor "$sha" origin/main; then
  echo "$short isn't on origin/main. Push it to main, then tag." >&2
  exit 1
fi

if (( ci )); then
  if ! command -v gh >/dev/null; then
    echo "gh isn't installed, so CI on $short wasn't checked. The release workflow runs it anyway." >&2
  else
    run="$(gh run list --workflow ci.yml --commit "$sha" --limit 1 \
      --json status,conclusion,url -q '.[0] | "\(.status) \(.conclusion) \(.url)"')"
    read -r status conclusion url <<<"${run:-none none none}"
    if [[ "$status" == none ]]; then
      echo "CI hasn't run on $short; the release workflow will run it first." >&2
    elif [[ "$status" != completed ]]; then
      echo "CI is still running on $short: $url" >&2
      echo "Wait for it (gh run watch), then try again." >&2
      exit 1
    elif [[ "$conclusion" != success ]]; then
      echo "CI on $short ended in $conclusion: $url" >&2
      echo "Fix it on main, then tag the fixed commit." >&2
      exit 1
    fi
  fi
fi

echo "$tag can be released from $short."
