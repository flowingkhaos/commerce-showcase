#!/usr/bin/env bash
# Deploy the showcase CMS to Google Cloud Run (scale to zero, free tier), from your machine:
#   bash deploy/cloudrun.sh <gcp-project-id> [--seed]
# Needs: `gcloud auth login` done, and ~/.config/kos/showcase-cms.prod.env (mode 600)
# holding DATABASE_URL (the Neon string), PAYLOAD_SECRET and the visitor door's Turnstile keys
# (TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY). Idempotent: the first run also creates the
# registry, the media bucket, the three secrets and their permissions.
# --seed loads the sample domains and pages once (it overwrites those sample rows if re-run).
# Admin login + API key: ~/.config/kos/showcase-cms.prod-admin.env (written by the seed, never printed).
set -euo pipefail

PROJECT=${1:?usage: cloudrun.sh <gcp-project-id> [--seed]}
SEED=${2:-}
REGION=us-east5 # Columbus, next to the Neon database in AWS us-east-2 (Ohio)
SERVICE=showcase-cms
APP=$(cd "$(dirname "$0")/.." && pwd)
ENVFILE="$HOME/.config/kos/showcase-cms.prod.env"
ADMINFILE="$HOME/.config/kos/showcase-cms.prod-admin.env"
REPO="$REGION-docker.pkg.dev/$PROJECT/showcase"
BUCKET="$PROJECT-media"

# Read one value without sourcing the file (the Neon string contains '&').
val() { grep -m1 "^$1=" "$ENVFILE" | cut -d= -f2-; }
for key in DATABASE_URL PAYLOAD_SECRET TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY; do
  [ -n "$(val $key)" ] || { echo "$key must be in $ENVFILE"; exit 1; }
done

gcloud config set project "$PROJECT" --quiet >/dev/null
NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNTIME_SA="$NUMBER-compute@developer.gserviceaccount.com"
URL="https://$SERVICE-$NUMBER.$REGION.run.app"

echo "== one-time setup (skips what exists)"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  storage.googleapis.com cloudbuild.googleapis.com --quiet
# Cloud Build runs as the default compute account; new projects grant it no roles by default.
for role in roles/artifactregistry.writer roles/logging.logWriter roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$RUNTIME_SA" --role="$role" --condition=None --quiet >/dev/null
done
gcloud artifacts repositories describe showcase --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create showcase --repository-format=docker --location="$REGION" --quiet
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 \
  || gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention --quiet
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$RUNTIME_SA" --role=roles/storage.objectAdmin --quiet >/dev/null
# Optional: GITHUB_DISPATCH_TOKEN lets a publish start the storefront's deploy workflow.
PAIRS="cms-database-url:DATABASE_URL cms-payload-secret:PAYLOAD_SECRET cms-turnstile-secret:TURNSTILE_SECRET_KEY"
RUN_SECRETS=DATABASE_URL=cms-database-url:latest,PAYLOAD_SECRET=cms-payload-secret:latest,TURNSTILE_SECRET_KEY=cms-turnstile-secret:latest
if [ -n "$(val GITHUB_DISPATCH_TOKEN)" ]; then
  PAIRS="$PAIRS cms-github-dispatch:GITHUB_DISPATCH_TOKEN"
  RUN_SECRETS="$RUN_SECRETS,GITHUB_DISPATCH_TOKEN=cms-github-dispatch:latest"
fi
for pair in $PAIRS; do
  name=${pair%%:*} key=${pair#*:}
  gcloud secrets describe "$name" >/dev/null 2>&1 \
    || val "$key" | tr -d '\n' | gcloud secrets create "$name" --replication-policy=automatic --data-file=- --quiet
  gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$RUNTIME_SA" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
done

echo "== migrate (from here, straight to Neon)"
cd "$APP"
export DATABASE_URL PAYLOAD_SECRET
DATABASE_URL=$(val DATABASE_URL) PAYLOAD_SECRET=$(val PAYLOAD_SECRET)
bun run payload migrate
if [ "$SEED" = --seed ]; then SHOWCASE_CMS_CREDS="$ADMINFILE" bun run seed; fi
unset DATABASE_URL PAYLOAD_SECRET

echo "== build the image in Cloud Build (uploads the source, ~1 MB; .gitignore keeps .env out)"
TAG="$REPO/cms:$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . || echo -dirty)"
gcloud builds submit --tag="$TAG" --region="$REGION" --machine-type=e2-highcpu-8 --quiet .

echo "== deploy"
# Public access is a one-time manual step, kept out of this script: an organization with
# domain-restricted sharing refuses `allUsers`, so the service skips the invoker check instead:
#   gcloud run services update showcase-cms --region=us-east5 --no-invoker-iam-check
# The setting persists across deploys. The admin, drafts and writes still need a login or key.
# One instance at most: the rate limiter's counters live in memory, and the worst-case bill
# stays one instance's worth. Request-based billing (CPU only while answering), zero when idle.
gcloud run deploy "$SERVICE" --image="$TAG" --region="$REGION" --port=3000 \
  --min-instances=0 --max-instances=1 --concurrency=80 \
  --cpu=1 --memory=512Mi --timeout=60 --cpu-boost \
  --set-secrets="$RUN_SECRETS" \
  --set-env-vars="SERVER_URL=$URL,GCS_BUCKET=$BUCKET,TURNSTILE_SITE_KEY=$(val TURNSTILE_SITE_KEY)" --quiet

echo "== smoke $URL (PAYLOAD_SECRET lets it sign live preview links)"
PAYLOAD_SECRET=$(val PAYLOAD_SECRET) SHOWCASE_CMS_CREDS="$ADMINFILE" node scripts/smoke.mjs "$URL"
