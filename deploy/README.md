# Running bertha on a server

One binary, one SQLite file, behind Caddy. bertha idles at about 15 MB of memory.

| File | What it is |
| --- | --- |
| `install.sh` | Installs or upgrades bertha, and rolls back if the new one won't start. |
| `bertha.service` | The systemd unit, locked down to the network and `/var/lib/bertha`. |
| `env.example` | Every setting, explained. Becomes `/etc/bertha/env`. |
| `Caddyfile` | TLS and compression in front of bertha. |
| `litestream.yml` | Continuous backup to S3-compatible storage. |
| `docker/` | The same release binary in a container, behind an existing Traefik. |

## First install

You need a Linux server with systemd, [Caddy](https://caddyserver.com/docs/install), a
DNS name pointing at it, and `curl`.

```sh
git clone https://github.com/felixowens/bertha && cd bertha/deploy
sudo ./install.sh
sudoedit /etc/bertha/env               # BERTHA_URL and SMTP at least
sudo bertha owner create you@example.com --name "Your name"
sudo systemctl start bertha
```

Add the block in `Caddyfile` to `/etc/caddy/Caddyfile` with your address, then
`sudo systemctl reload caddy`. Open your `BERTHA_URL` and sign in with your email.

Without SMTP, sign-in links are written to the log:
`journalctl -u bertha | grep -A3 "email (SMTP"`.

## With Docker

If the server already runs its sites in Docker behind Traefik, use `docker/` instead of
`install.sh`. The image is the release binary on Alpine, checked against the release's
checksum when it's built, running as an unprivileged user with a read-only root.

```sh
git clone https://github.com/felixowens/bertha && cd bertha/deploy/docker
cp .env.example .env && chmod 600 .env
$EDITOR .env      # BERTHA_VERSION, BERTHA_URL, BERTHA_HOST, the Traefik names, SMTP
docker compose up -d --build
docker compose exec bertha bertha owner create you@example.com --name "Your name"
```

The other commands in this file work the same way inside the container:
`docker compose exec bertha bertha project keys LANT`. Without SMTP, sign-in links are in
`docker compose logs bertha`. The database lives in the `bertha-data` volume.

To upgrade, set the new `BERTHA_VERSION` in `.env`, run `./bertha-backup` for a copy
from before the migrations, then `docker compose up -d --build`.

`BERTHA_TRUSTED_PROXIES` in `.env` tells bertha to believe Traefik's `X-Forwarded-For`
from the Docker network. Without it, an event that asks for the visitor's address gets
Traefik's instead.

**Backups:** `bertha-backup` takes a consistent copy while bertha runs, checks it with
SQLite's integrity check and keeps 30 days of copies in `/var/backups/bertha`. Install it
with its timer (the commands are at the top of `bertha-backup.service`) and point the
host's own backups (borgmatic, restic) at that folder. To restore, stop bertha, write a
copy into the volume as `bertha.db`, and start it again:

```sh
docker compose stop bertha
sudo cat /var/backups/bertha/bertha-<date>.db | docker compose run --rm -T --no-deps \
  --entrypoint sh bertha -c 'cat > /data/bertha.db && rm -f /data/bertha.db-wal /data/bertha.db-shm'
docker compose start bertha
```

## Upgrading

```sh
cd bertha/deploy && git pull
sudo ./install.sh            # latest release; or ./install.sh v0.2.0
```

It backs up the database to `/var/lib/bertha/before-upgrade.db`, swaps the binary,
restarts, and waits for `/healthz`. If the new version doesn't answer within 30
seconds, it puts the old binary back and shows the log. Migrations run when bertha
starts and only ever add to the schema.

To install a binary you built yourself (`npm run build`, then
`cargo build --release` in `server/`), pass its path: `sudo ./install.sh ./bertha`.

## Day to day

```sh
systemctl status bertha
journalctl -u bertha -f                  # JSON logs
sudo bertha project list                 # projects and their short keys
sudo bertha project keys LANT            # a project's ingest and upload keys
sudo bertha backup /tmp/bertha-copy.db   # a consistent copy while it runs
```

`/healthz` answers `ok` when bertha can reach its database. Add an uptime monitor for
`https://<your bertha>/healthz` in bertha itself, and point an outside checker at it too,
because bertha can't tell you it's down.

## Backups

The database is one file, `/var/lib/bertha/bertha.db`, in WAL mode.

**Continuous, with Litestream** (recommended). It copies each change to a bucket within
a second or so, and can restore to any point in the last week.

1. Install [Litestream](https://litestream.io/install/) (it ships a `.deb` with a service).
2. Create a bucket and an access key limited to it (B2, R2 or S3).
3. Copy `litestream.yml` to `/etc/litestream.yml`, and write `/etc/litestream.env`:

   ```sh
   LITESTREAM_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
   LITESTREAM_BUCKET=my-bertha-backups
   LITESTREAM_ACCESS_KEY_ID=...
   LITESTREAM_SECRET_ACCESS_KEY=...
   ```

4. Run it as the bertha user, so it can read the database:

   ```sh
   sudo systemctl edit litestream
   # [Service]
   # User=bertha
   # Group=bertha
   # EnvironmentFile=/etc/litestream.env
   sudo systemctl enable --now litestream
   ```

To restore onto a new server, install bertha but don't start it, then:

```sh
sudo -u bertha sh -c 'set -a; . /etc/litestream.env; litestream restore \
  -config /etc/litestream.yml /var/lib/bertha/bertha.db'
sudo systemctl start bertha
```

**Ad hoc:** `sudo bertha backup <path>` writes a consistent copy using SQLite's online
backup, without stopping bertha. Copying the `.db` file by hand while bertha runs can
miss the latest writes, which sit in the `-wal` file.

## What it needs from the server

- Outbound HTTPS, for uptime checks and webhooks, and your SMTP port.
- Inbound only through Caddy. bertha listens on `127.0.0.1:3000`.
- Memory: about 15 MB idle and under 60 MB while taking a flood of events. The unit caps
  it at 256 MB.
- The disk: about 600 bytes per stored event, indexes and counts included. 90 days of
  5,000 events a day is about 270 MB.
- Ingest is capped at 50 events a second per project, with bursts of 500. Past that,
  the SDK is told to back off and the extra events are counted as rejected. One small
  VPS keeps up with every project at its cap.
