#!/bin/sh
# Installs or upgrades bertha on a Linux server with systemd. Run as root.
#
#   ./install.sh                  the latest GitHub release
#   ./install.sh v0.2.0           a given release
#   ./install.sh ./bertha         a binary you built or copied over
#
# The first run creates the bertha user, /etc/bertha/env and the service. Later runs
# swap the binary and restart; the database is migrated when bertha starts. The old
# binary is kept as bertha.previous, and restored if the new one doesn't come up.

set -eu

REPO=felixowens/bertha
LIB=/usr/local/lib/bertha
ETC=/etc/bertha
HERE=$(cd "$(dirname "$0")" && pwd)

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root (sudo $0 $*)"
command -v systemctl >/dev/null || die "this needs systemd"

case "$(uname -m)" in
  x86_64 | amd64) target=x86_64-unknown-linux-musl ;;
  aarch64 | arm64) target=aarch64-unknown-linux-musl ;;
  *) die "no release build for $(uname -m); build it yourself and pass the path" ;;
esac

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# 1. Get the binary.
if [ -n "${1:-}" ] && [ -f "$1" ]; then
  cp "$1" "$work/bertha"
else
  tag=${1:-}
  if [ -n "$tag" ]; then base="https://github.com/$REPO/releases/download/$tag"
  else base="https://github.com/$REPO/releases/latest/download"; fi
  say "Downloading bertha ${tag:-(latest)} for $target"
  for f in "bertha-$target.tar.gz" "bertha-$target.tar.gz.sha256"; do
    curl -fsSL -o "$work/$f" "$base/$f" || die "couldn't download $f from $base. Check the version exists."
  done
  (cd "$work" && sha256sum -c "bertha-$target.tar.gz.sha256") || die "the download doesn't match its checksum"
  tar -xzf "$work/bertha-$target.tar.gz" -C "$work"
fi
chmod 0755 "$work/bertha"
"$work/bertha" --version >/dev/null || die "that binary doesn't run on this machine"
say "Installing $("$work/bertha" --version)"

# 2. First run: user, settings, admin wrapper, service.
if ! id bertha >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/bertha --no-create-home --shell /usr/sbin/nologin bertha
fi
install -d -m 0755 "$LIB"
install -d -m 0750 -g bertha "$ETC"
if [ ! -f "$ETC/env" ]; then
  install -m 0640 -g bertha "$HERE/env.example" "$ETC/env"
  fresh=1
fi
# `bertha <command>` as root runs the CLI as the service user with the same settings.
cat > /usr/local/bin/bertha <<'WRAP'
#!/bin/sh
# Runs bertha's CLI as the bertha user, with the service's settings.
set -eu
exec setpriv --reuid=bertha --regid=bertha --init-groups -- sh -c '
  set -a; . /etc/bertha/env; set +a
  export DATABASE_PATH=/var/lib/bertha/bertha.db
  cd /var/lib/bertha && exec /usr/local/lib/bertha/bertha "$@"' bertha "$@"
WRAP
chmod 0755 /usr/local/bin/bertha
install -m 0644 "$HERE/bertha.service" /etc/systemd/system/bertha.service
install -d -m 0750 -o bertha -g bertha /var/lib/bertha
systemctl daemon-reload

if [ "${fresh:-}" = 1 ]; then
  install -m 0755 "$work/bertha" "$LIB/bertha"
  systemctl enable bertha >/dev/null
  say "Installed. Next:"
  echo "  1. Edit $ETC/env (BERTHA_URL and SMTP at least)."
  echo "  2. Add deploy/Caddyfile to /etc/caddy/Caddyfile and reload Caddy."
  echo "  3. sudo bertha owner create you@example.com --name 'Your name'"
  echo "  4. sudo systemctl start bertha, then sign in at your BERTHA_URL."
  exit 0
fi

# 3. Upgrade: swap, restart, and roll back if it doesn't come up healthy.
[ -f "$LIB/bertha" ] && cp -p "$LIB/bertha" "$LIB/bertha.previous"
# Back up before migrations run. One copy, replaced each upgrade.
if [ -f /var/lib/bertha/bertha.db ] && systemctl is-active --quiet bertha; then
  say "Backing up the database"
  /usr/local/bin/bertha backup /var/lib/bertha/before-upgrade.db
fi
install -m 0755 "$work/bertha" "$LIB/bertha.new"
mv -f "$LIB/bertha.new" "$LIB/bertha"
systemctl restart bertha

bind=$(sed -n 's/^BERTHA_BIND=//p' "$ETC/env" | tr -d '"' | tail -n 1)
bind=${bind:-127.0.0.1:3000}
for _ in $(seq 1 30); do
  if curl -fsS "http://$bind/healthz" >/dev/null 2>&1; then
    say "bertha is up: $("$LIB/bertha" --version)"
    exit 0
  fi
  sleep 1
done

echo "The new bertha didn't answer /healthz in 30s. Its log:" >&2
journalctl -u bertha -n 30 --no-pager >&2 || true
if [ -f "$LIB/bertha.previous" ]; then
  say "Putting the previous binary back"
  mv -f "$LIB/bertha.previous" "$LIB/bertha"
  systemctl restart bertha
  echo "If the new version migrated the database, restore /var/lib/bertha/before-upgrade.db too." >&2
fi
exit 1
