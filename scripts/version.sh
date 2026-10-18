#!/usr/bin/env bash
# The release version lives in five places. This keeps them in step.
#
#   scripts/version.sh            print each place's version
#   scripts/version.sh check TAG [REV]
#                                 fail unless TAG (v1.2.3) matches every place at REV
#                                 (default HEAD); used by the pre-push hook and release CI
#   scripts/version.sh set 1.2.3  write 1.2.3 everywhere
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# path|perl regex whose $1 is the version
PLACES=(
  'server/Cargo.toml|(?ms)^\[workspace\.package\]\s*\nversion = "([^"]+)"'
  'server/Cargo.lock|(?ms)^name = "bertha-server"\s*\nversion = "([^"]+)"'
  'sdk/package.json|(?m)^  "version": "([^"]+)"'
  'sdk/package-lock.json|\A\{\s*"name": "[^"]+",\s*"version": "([^"]+)"'
  'sdk/package-lock.json|"packages": \{\s*"": \{\s*"name": "[^"]+",\s*"version": "([^"]+)"'
  'sdk/src/core/version.ts|(?m)^export const VERSION = "([^"]+)"'
)

read_at() { # rev path regex
  git show "$1:$2" 2>/dev/null | RE="$3" perl -0777 -ne 'print $1 if /$ENV{RE}/' 
}

case "${1:-show}" in
  show)
    for p in "${PLACES[@]}"; do printf '%-28s %s\n' "${p%%|*}" "$(read_at HEAD "${p%%|*}" "${p#*|}")"; done
    ;;
  check)
    tag="${2:?Give the tag, e.g. v0.2.0}"
    rev="${3:-HEAD}"
    want="${tag#v}"
    if ! [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
      echo "Tag $tag isn't a version. Use v1.2.3 (or v1.2.3-rc.1)." >&2
      exit 1
    fi
    bad=0
    for p in "${PLACES[@]}"; do
      got="$(read_at "$rev" "${p%%|*}" "${p#*|}")"
      if [[ "$got" != "$want" ]]; then
        echo "${p%%|*} says ${got:-nothing}, the tag says $want." >&2
        bad=1
      fi
    done
    if (( bad )); then
      echo "Run scripts/version.sh set $want, commit, then tag again." >&2
      exit 1
    fi
    ;;
  set)
    want="${2:?Give the version, e.g. 0.2.0}"
    want="${want#v}"
    [[ "$want" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "$want isn't a version, e.g. 0.2.0" >&2; exit 1; }
    for p in "${PLACES[@]}"; do
      file="${p%%|*}"
      re="${p#*|}"
      # Replace only the captured version inside the match.
      RE="$re" WANT="$want" perl -0777 -pi -e 's/$ENV{RE}/substr($&, 0, $-[1] - $-[0]) . $ENV{WANT} . substr($&, $+[1] - $-[0])/e' "$file"
    done
    # The other workspace crates share the version; cargo refreshes their lock entries.
    (cd server && cargo metadata -q --format-version 1 >/dev/null)
    git --no-pager diff --stat
    ;;
  *)
    echo "Use: scripts/version.sh [show | check TAG [REV] | set X.Y.Z]" >&2
    exit 1
    ;;
esac
