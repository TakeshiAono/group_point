#!/bin/bash
set -e

# .env から読み込む
if [ -f "$(dirname "$0")/../.env" ]; then
  export $(grep -E '^(AWS_REGION|AWS_PROFILE|AWS_ENV|NEXTAUTH_URL)' "$(dirname "$0")/../.env" | xargs)
fi

AWS_CONFIG_FILE=~/.aws/config \
aws cloudformation deploy \
  --template-file "$(dirname "$0")/main.yml" \
  --stack-name "group-point-${AWS_ENV:-dev}" \
  --parameter-overrides Env="${AWS_ENV:-dev}" AllowedOrigin="${NEXTAUTH_URL:-http://localhost:3000}" \
  --region "${AWS_REGION:-ap-northeast-1}" \
  --profile "${AWS_PROFILE}"
