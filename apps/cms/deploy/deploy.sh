#!/usr/bin/env bash
# Deploy the showcase CMS to its Oracle VM, from this workstation:
#   bash deploy/deploy.sh <public-ip>
# First run: opens ports 80/443, installs Docker, writes the server's secrets
# (/opt/showcase-cms/.env, never leaves the VM except the admin lines below), adds a nightly
# database dump, migrates and seeds. Every run: copy the code, rebuild, restart, smoke.
# The admin login + API key land in ~/.config/kos/showcase-cms.prod.env (mode 600, never printed).
set -euo pipefail

IP=${1:?usage: deploy.sh <public-ip>}
HOST="${IP//./-}.sslip.io"
KEY="$HOME/.ssh/showcase-cms"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$IP")
APP=$(cd "$(dirname "$0")/.." && pwd)
COMPOSE='sudo docker compose -p showcase-cms --env-file .env -f app/deploy/compose.yml'
CREDS="$HOME/.config/kos/showcase-cms.prod.env"

echo "== host setup ($HOST)"
"${SSH[@]}" CMS_HOST="$HOST" bash -s <<'REMOTE'
set -euo pipefail
if ! command -v docker >/dev/null; then
  sudo apt-get update -qq
  # Oracle's Ubuntu image rejects all inbound traffic but SSH. Open the web ports and save
  # the rule set before Docker adds its own chains, so the saved set stays ours.
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent rsync
  sudo iptables -C INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT
  sudo netfilter-persistent save
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2
fi
sudo mkdir -p /opt/showcase-cms/backups && sudo chown -R ubuntu: /opt/showcase-cms
cd /opt/showcase-cms
if [ ! -f .env ]; then
  umask 077
  r() { openssl rand -hex "$1"; }
  printf 'CMS_HOST=%s\nDB_PASSWORD=%s\nPAYLOAD_SECRET=%s\nSHOWCASE_CMS_ADMIN_EMAIL=admin@showcase.local\nSHOWCASE_CMS_ADMIN_PASSWORD=%s\nSHOWCASE_CMS_API_KEY=%s\n' \
    "$CMS_HOST" "$(r 24)" "$(r 32)" "$(r 18)" "$(cat /proc/sys/kernel/random/uuid)" > .env
fi
# Nightly database dump at 04:15 UTC, one file per weekday, so 7 are kept.
crontab -l 2>/dev/null | grep -q pg_dump || {
  crontab -l 2>/dev/null || true
  echo '15 4 * * * cd /opt/showcase-cms && sudo docker compose -p showcase-cms --env-file .env -f app/deploy/compose.yml exec -T db pg_dump -U showcase showcase | gzip > backups/$(date +\%a).sql.gz'
} | crontab -
REMOTE

echo "== copy code"
rsync -az --delete -e "ssh -i $KEY" \
  --exclude node_modules --exclude .next --exclude .env --exclude media --exclude '*.tsbuildinfo' \
  "$APP/" "ubuntu@$IP:/opt/showcase-cms/app/"

echo "== build and start (the first build takes several minutes)"
"${SSH[@]}" "cd /opt/showcase-cms && $COMPOSE up -d --build --remove-orphans"

echo "== migrate, then seed once"
"${SSH[@]}" "cd /opt/showcase-cms && $COMPOSE exec -T cms node_modules/.bin/payload migrate \
  && { [ -f .seeded ] || { $COMPOSE exec -T cms node_modules/.bin/payload run scripts/seed.ts && touch .seeded; }; }"

(umask 077 && { echo "CMS_URL=https://$HOST"; "${SSH[@]}" "grep -E '^SHOWCASE_CMS_' /opt/showcase-cms/.env"; } > "$CREDS")

echo "== wait for HTTPS (Caddy fetches the certificate on first use)"
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "https://$HOST/api/domains" && break
  sleep 3
done
SHOWCASE_CMS_CREDS="$CREDS" node "$APP/scripts/smoke.mjs" "https://$HOST"
