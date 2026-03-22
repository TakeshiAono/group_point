#!/bin/bash
# アプリコードデプロイ（コード更新時に実行）
set -e

# .env から読み込む
if [ -f "$(dirname "$0")/../.env" ]; then
  export $(grep -E '^(AWS_REGION|AWS_PROFILE|AWS_ENV)' "$(dirname "$0")/../.env" | xargs)
fi

echo "EC2 インスタンスIDを取得中..."
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=group-point-${AWS_ENV:-dev}" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text \
  --region "${AWS_REGION:-ap-northeast-1}" \
  --profile "${AWS_PROFILE}")

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "エラー: 実行中のEC2インスタンスが見つかりません" >&2
  exit 1
fi

echo "デプロイ先: $INSTANCE_ID"

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "set -e",
    "cd /home/ec2-user/app",
    "git pull origin master",
    "npm install --omit=dev",
    "npm run db:migrate",
    "npm run build",
    "pm2 restart group-point || pm2 start npm --name group-point -- start",
    "pm2 save"
  ]' \
  --query "Command.CommandId" \
  --output text \
  --region "${AWS_REGION:-ap-northeast-1}" \
  --profile "${AWS_PROFILE}")

echo "コマンド実行中... (ID: $COMMAND_ID)"

# 完了まで待機
aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "${AWS_REGION:-ap-northeast-1}" \
  --profile "${AWS_PROFILE}"

# 結果を表示
STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query "Status" \
  --output text \
  --region "${AWS_REGION:-ap-northeast-1}" \
  --profile "${AWS_PROFILE}")

if [ "$STATUS" = "Success" ]; then
  echo "コードデプロイ完了！"
else
  echo "コードデプロイ失敗 (Status: $STATUS)" >&2
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "StandardErrorContent" \
    --output text \
    --region "${AWS_REGION:-ap-northeast-1}" \
    --profile "${AWS_PROFILE}"
  exit 1
fi
