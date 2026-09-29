#!/usr/bin/env bash
# Deploy the API to Google Cloud Run in Mumbai.
#
# Run from the repo root, in Google Cloud Shell or anywhere gcloud is signed in:
#   bash scripts/deploy-api.sh setup     # first time only: turns on services and permissions
#   bash scripts/deploy-api.sh           # every deploy after that
#
# WEB_ORIGIN is the web app's address(es), comma-separated; it defaults to production + localhost.
# SUPABASE_URL lets the API check sign-in tokens against Supabase's public keys.
# Secrets (Supabase secret key, Kite secret, encryption key) are added once in the Cloud Run
# console under Edit → Variables & Secrets; --update-env-vars below leaves them alone.
set -euo pipefail

PROJECT="${PROJECT:-fund-xray}"
REGION="asia-south1"          # Mumbai
SERVICE="fund-xray-api"
REPO="fund-xray"
WEB_ORIGIN="${WEB_ORIGIN:-https://fund-xray-theta.vercel.app,http://localhost:3000}"
SUPABASE_URL="${SUPABASE_URL:-https://dgjbladcfysjncciukhg.supabase.co}"
# Optional: SUPABASE_PUBLISHABLE_KEY=sb_publishable_... bash scripts/deploy-api.sh (left alone if unset)
EXTRA_ENV=""
[[ -n "${SUPABASE_PUBLISHABLE_KEY:-}" ]] && EXTRA_ENV="@SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY"

gcloud config set project "$PROJECT" >/dev/null

if [[ "${1:-}" == "setup" ]]; then
  echo "Turning on Cloud Run, Artifact Registry and Cloud Build..."
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

  echo "Creating the image store in $REGION..."
  gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 ||
    gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" \
      --description "Fund X-Ray images"

  # Keep only the 5 newest images so storage stays inside the free allowance
  gcloud artifacts repositories set-cleanup-policies "$REPO" --location "$REGION" --no-dry-run \
    --policy <(printf '[{"name":"keep-5","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":5}}]') || true

  echo "Letting Cloud Build push images..."
  NUMBER="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')"
  BUILDER="${NUMBER}-compute@developer.gserviceaccount.com"
  for ROLE in roles/artifactregistry.writer roles/logging.logWriter roles/storage.objectViewer; do
    gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$BUILDER" \
      --role "$ROLE" --condition None >/dev/null
  done
  echo "Setup done."
fi

TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/api:$TAG"

echo "Building $IMAGE ..."
gcloud builds submit --config api/cloudbuild.yaml --substitutions "_IMAGE=$IMAGE" .

echo "Deploying $SERVICE ..."
# --update-env-vars keeps secrets added later; ^@^ lets WEB_ORIGIN contain commas.
# max-instances 2 caps the bill; min-instances 0 means it sleeps (free) when idle.
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 2 \
  --cpu 1 --memory 512Mi --concurrency 40 --timeout 60 \
  --update-env-vars "^@^WEB_ORIGIN=$WEB_ORIGIN@SUPABASE_URL=$SUPABASE_URL$EXTRA_ENV"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
echo
echo "API is live: $URL/health"
echo "Put this in Vercel as NEXT_PUBLIC_API_URL: $URL"
