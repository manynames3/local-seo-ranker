# ADR 0006: Add AWS Deployment Target With GitHub OIDC

## Status

Accepted

## Context

The product already runs on Cloudflare, but deploying through AWS is useful for accounts that prefer AWS-native hosting, IAM governance, CloudFront delivery, and DynamoDB persistence. The deployment should not require long-lived AWS keys in GitHub.

## Decision

Add an AWS deployment path using S3 for static assets, CloudFront for delivery and API routing, API Gateway for `/api/*`, Lambda for server-side product APIs, DynamoDB for product state, SSM Parameter Store for the provider key, and GitHub Actions OIDC for deployment.

## Consequences

- The app has a credible AWS-native production path without sharing AWS access keys.
- The AWS backend mirrors the Cloudflare API contract, but it uses DynamoDB instead of D1.
- Cloudflare and AWS deployments maintain separate persistence layers.
- Initial AWS setup still requires an AWS admin to create the GitHub OIDC role.
