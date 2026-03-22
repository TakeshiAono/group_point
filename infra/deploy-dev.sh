#!/bin/bash
# CloudFormation リソースデプロイ（インフラ変更時のみ実行）
set -e

# .env から読み込む
if [ -f "$(dirname "$0")/../.env" ]; then
  export $(grep -E '^(AWS_REGION|AWS_PROFILE|AWS_ENV|NEXTAUTH_URL)' "$(dirname "$0")/../.env" | xargs)
fi

STACK_NAME="group-point-${AWS_ENV:-dev}"
REGION="${AWS_REGION:-ap-northeast-1}"

# 失敗状態のスタックがあれば削除
STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --profile "${AWS_PROFILE}" \
  --query "Stacks[0].StackStatus" \
  --output text 2>/dev/null || echo "NONE")

# IN_PROGRESS 状態の場合は完了を待機
if [[ "$STATUS" == *"IN_PROGRESS"* ]]; then
  echo "スタックが処理中です。完了を待機中..."
  aws cloudformation wait stack-rollback-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "${AWS_PROFILE}" 2>/dev/null || true
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "${AWS_PROFILE}" \
    --query "Stacks[0].StackStatus" \
    --output text 2>/dev/null || echo "NONE")
  echo "完了: $STATUS"
fi

if [[ "$STATUS" == *"ROLLBACK_COMPLETE"* || "$STATUS" == *"REVIEW_IN_PROGRESS"* || "$STATUS" == *"ROLLBACK_FAILED"* ]]; then
  echo "既存の失敗スタックを削除中..."
  aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "${AWS_PROFILE}"
  aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "${AWS_PROFILE}"
  echo "削除完了"
fi

# スタック作成 or 更新
if [ "$STATUS" == "NONE" ] || [[ "$STATUS" == *"ROLLBACK_COMPLETE"* ]] || [[ "$STATUS" == *"ROLLBACK_FAILED"* ]]; then
  echo "CloudFormation スタックを作成中..."
  aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$(dirname "$0")/main.yml" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --profile "${AWS_PROFILE}"
  aws cloudformation wait stack-create-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "${AWS_PROFILE}"
else
  echo "CloudFormation スタックを更新中..."
  aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$(dirname "$0")/main.yml" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --profile "${AWS_PROFILE}"
  aws cloudformation wait stack-update-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "${AWS_PROFILE}"
fi

echo "インフラデプロイ完了！"
