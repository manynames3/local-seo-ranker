# AWS Deployment

This repository includes an AWS deployment path for Local SEO Ranker using GitHub Actions OIDC.

## Infrastructure

The production stack in `infra/aws/app.yml` creates:

- S3 private static-site bucket.
- CloudFront distribution with S3 origin and `/api/*` API origin.
- API Gateway HTTP API.
- Lambda API backend.
- DynamoDB single-table product store.
- IAM execution role for Lambda.
- SSM SecureString lookup for the Scrappa provider key.

The Lambda backend in `aws/lambda/handler.mjs` supports the same core product APIs:

- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/geocode`
- `/api/scans`
- `/api/history`
- `/api/admin/overview`

## One-Time AWS Bootstrap

Deploy `infra/aws/github-oidc-bootstrap.yml` from an AWS admin session. This creates a GitHub OIDC provider and a deploy role.

Recommended for this repo only:

```bash
aws cloudformation deploy \
  --stack-name local-seo-ranker-github-oidc \
  --template-file infra/aws/github-oidc-bootstrap.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=local-seo-ranker \
    GitHubOrg=manynames3 \
    GitHubRepoPattern=local-seo-ranker \
    GitHubBranch=main
```

If you really want the same AWS role to deploy all repos in `manynames3`, set `GitHubRepoPattern=*`. That is more convenient but less isolated.

Copy the `RoleArn` output into the GitHub repository variable `AWS_ROLE_ARN`.

## GitHub Variables

Set these repository variables:

- `AWS_ROLE_ARN`
- `AWS_REGION`, for example `us-east-1`
- `ADMIN_EMAILS`, comma-separated admin emails
- `DEFAULT_MONTHLY_CREDITS`, default `2500`
- `MAX_LIVE_GRID_POINTS`, default `81`
- `ENABLE_LIVE_SCANS`, `true` or `false`

## GitHub Secrets

Set these repository secrets:

- `APP_ACCESS_CODE`
- `SCRAPPA_API_KEY`

The workflow stores `SCRAPPA_API_KEY` in SSM as `/local-seo-ranker/scrappa-api-key` and the Lambda reads it server-side.

## Deploy

After the variables and secrets are set, push to `main` or run **Deploy to AWS** from GitHub Actions.

The workflow will:

1. Assume the AWS deploy role using GitHub OIDC.
2. Validate JavaScript and tests.
3. Store the provider secret in SSM.
4. Deploy the CloudFormation stack.
5. Package and update the Lambda code.
6. Sync static files to S3.
7. Invalidate CloudFront.

## Notes

- AWS deployment is separate from the existing Cloudflare deployment.
- No AWS long-lived access keys should be stored in GitHub.
- The app can run on either Cloudflare or AWS, but each platform has its own persistence layer.
