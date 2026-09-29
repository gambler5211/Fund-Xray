#!/usr/bin/env bash
# One-time setup so GitHub Actions can deploy the API to Cloud Run without any stored keys.
#
# Run in Google Cloud Shell (it's already signed in):
#   bash scripts/setup-github-deploy.sh
#
# It creates:
#   - a service account "github-deployer" that may push images and deploy Cloud Run, nothing else
#   - a Workload Identity pool + provider that trusts GitHub, limited to this repo's main branch
# Then it prints the two values to add as GitHub repository variables. Safe to run twice.
set -euo pipefail

PROJECT="${PROJECT:-fund-xray}"
GITHUB_REPO="${GITHUB_REPO:-gambler5211/Fund-Xray}"   # owner/name, exactly as on GitHub
REGION="asia-south1"
REPO="fund-xray"
SA_NAME="github-deployer"
POOL="github"
PROVIDER="fund-xray-repo"

gcloud config set project "$PROJECT" >/dev/null
NUMBER="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')"
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
RUNTIME_SA="${NUMBER}-compute@developer.gserviceaccount.com"   # the account Cloud Run runs as

echo "Turning on the services GitHub sign-in needs..."
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com \
  run.googleapis.com artifactregistry.googleapis.com

echo "Creating the deploy account..."
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA_NAME" --display-name "GitHub Actions: deploy API"

echo "Granting only what a deploy needs..."
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" \
  --role roles/run.admin --condition None >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$REPO" --location "$REGION" \
  --member "serviceAccount:$SA" --role roles/artifactregistry.writer >/dev/null
# Deploying a service means acting as the account it runs as
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser >/dev/null

echo "Creating the GitHub trust (Workload Identity Federation)..."
gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers describe "$PROVIDER" --location global \
  --workload-identity-pool "$POOL" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location global --workload-identity-pool "$POOL" \
    --display-name "Fund-Xray repo" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$GITHUB_REPO' && assertion.ref == 'refs/heads/main'"

# Only workflows from this repo may use the deploy account
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null

PROVIDER_NAME="projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"

cat <<MSG

Done. Add these two at GitHub → $GITHUB_REPO → Settings → Secrets and variables → Actions
→ Variables tab → New repository variable:

  GCP_WIF_PROVIDER = $PROVIDER_NAME
  GCP_DEPLOY_SA    = $SA

Neither is a secret. Then run the workflow once from Actions → Deploy API → Run workflow.
MSG
