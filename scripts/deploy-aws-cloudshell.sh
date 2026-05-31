#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-local-seo-ranker}"
STACK_NAME="${STACK_NAME:-local-seo-ranker-prod}"
OIDC_STACK_NAME="${OIDC_STACK_NAME:-local-seo-ranker-github-oidc}"
GITHUB_ORG="${GITHUB_ORG:-manynames3}"
GITHUB_REPO_PATTERN="${GITHUB_REPO_PATTERN:-local-seo-ranker}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
AWS_REGION="${AWS_REGION:-$(aws configure get region || true)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ADMIN_EMAILS="${ADMIN_EMAILS:-}"
DEFAULT_MONTHLY_CREDITS="${DEFAULT_MONTHLY_CREDITS:-2500}"
MAX_LIVE_GRID_POINTS="${MAX_LIVE_GRID_POINTS:-81}"
ENABLE_LIVE_SCANS="${ENABLE_LIVE_SCANS:-true}"
SCRAPPA_PARAMETER_NAME="/${PROJECT_NAME}/scrappa-api-key"

if [[ -z "${APP_ACCESS_CODE:-}" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p "App access code: " APP_ACCESS_CODE
    echo
  else
    echo "APP_ACCESS_CODE is required." >&2
    exit 1
  fi
fi

if [[ -z "${SCRAPPA_API_KEY:-}" && -t 0 ]]; then
  read -r -s -p "Scrappa API key (leave blank to skip live scans): " SCRAPPA_API_KEY
  echo
fi

echo "Deploying ${PROJECT_NAME} to ${AWS_REGION}."

EXISTING_OIDC_ARN="$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" \
  --output text 2>/dev/null || true)"

if [[ "${EXISTING_OIDC_ARN}" == "None" || -z "${EXISTING_OIDC_ARN}" ]]; then
  CREATE_OIDC_PROVIDER="true"
  EXISTING_OIDC_ARN=""
  echo "No GitHub Actions OIDC provider found; the bootstrap stack will create one."
else
  CREATE_OIDC_PROVIDER="false"
  echo "Using existing GitHub Actions OIDC provider: ${EXISTING_OIDC_ARN}"
fi

aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${OIDC_STACK_NAME}" \
  --template-file infra/aws/github-oidc-bootstrap.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName="${PROJECT_NAME}" \
    GitHubOrg="${GITHUB_ORG}" \
    GitHubRepoPattern="${GITHUB_REPO_PATTERN}" \
    GitHubBranch="${GITHUB_BRANCH}" \
    CreateGitHubOidcProvider="${CREATE_OIDC_PROVIDER}" \
    ExistingGitHubOidcProviderArn="${EXISTING_OIDC_ARN}"

ROLE_ARN="$(aws cloudformation describe-stacks \
  --region "${AWS_REGION}" \
  --stack-name "${OIDC_STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue | [0]" \
  --output text)"

if [[ -n "${SCRAPPA_API_KEY:-}" ]]; then
  aws ssm put-parameter \
    --region "${AWS_REGION}" \
    --name "${SCRAPPA_PARAMETER_NAME}" \
    --type SecureString \
    --value "${SCRAPPA_API_KEY}" \
    --overwrite
else
  echo "SCRAPPA_API_KEY is not set; live scans will not work until ${SCRAPPA_PARAMETER_NAME} is stored in SSM."
fi

aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${STACK_NAME}" \
  --template-file infra/aws/app.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName="${PROJECT_NAME}" \
    AppAccessCode="${APP_ACCESS_CODE}" \
    AdminEmails="${ADMIN_EMAILS}" \
    DefaultMonthlyCredits="${DEFAULT_MONTHLY_CREDITS}" \
    MaxLiveGridPoints="${MAX_LIVE_GRID_POINTS}" \
    EnableLiveScans="${ENABLE_LIVE_SCANS}" \
    ScrappaParameterName="${SCRAPPA_PARAMETER_NAME}"

OUTPUTS="$(aws cloudformation describe-stacks \
  --region "${AWS_REGION}" \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs" \
  --output json)"

BUCKET="$(printf '%s' "${OUTPUTS}" | jq -r '.[] | select(.OutputKey=="SiteBucketName").OutputValue')"
DISTRIBUTION_ID="$(printf '%s' "${OUTPUTS}" | jq -r '.[] | select(.OutputKey=="DistributionId").OutputValue')"
LAMBDA_NAME="$(printf '%s' "${OUTPUTS}" | jq -r '.[] | select(.OutputKey=="LambdaFunctionName").OutputValue')"
CLOUDFRONT_URL="$(printf '%s' "${OUTPUTS}" | jq -r '.[] | select(.OutputKey=="CloudFrontUrl").OutputValue')"

rm -f lambda.zip
zip -qr lambda.zip aws/lambda functions/_lib/scan-utils.js

aws lambda update-function-code \
  --region "${AWS_REGION}" \
  --function-name "${LAMBDA_NAME}" \
  --zip-file fileb://lambda.zip >/dev/null

aws lambda wait function-updated \
  --region "${AWS_REGION}" \
  --function-name "${LAMBDA_NAME}"

aws s3 sync . "s3://${BUCKET}" \
  --region "${AWS_REGION}" \
  --delete \
  --exclude ".git/*" \
  --exclude ".github/*" \
  --exclude "aws/*" \
  --exclude "docs/*" \
  --exclude "functions/*" \
  --exclude "infra/*" \
  --exclude "node_modules/*" \
  --exclude "scripts/*" \
  --exclude "tests/*" \
  --exclude ".env*" \
  --exclude "lambda.zip" \
  --exclude "package*.json" \
  --exclude "README.md"

aws cloudfront create-invalidation \
  --region "${AWS_REGION}" \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" >/dev/null

cat <<EOF
AWS deploy complete.

CloudFront URL: ${CLOUDFRONT_URL}
GitHub deploy role: ${ROLE_ARN}

Add this repository variable in GitHub if you want push-to-main AWS deploys:
AWS_ROLE_ARN=${ROLE_ARN}
EOF
