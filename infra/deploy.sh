#!/bin/bash
# ============================================================
# group-point 手動デプロイスクリプト
# 使い方: bash infra/deploy.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# .env から設定を読み込む
if [ -f "$ROOT_DIR/.env" ]; then
  export $(grep -E '^(AWS_REGION|AWS_PROFILE|AWS_ENV|KEY_PAIR_PATH)' "$ROOT_DIR/.env" | xargs)
fi

AWS_REGION="${AWS_REGION:-ap-northeast-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_ENV="${AWS_ENV:-dev}"
STACK_NAME="group-point-${AWS_ENV}"
KEY_PATH="${KEY_PAIR_PATH:-~/.ssh/group-point-key.pem}"
SSH_USER="ec2-user"

echo "==> CloudFormation スタックをデプロイ中..."
aws cloudformation deploy \
  --template-file "$SCRIPT_DIR/main.yml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides \
    Env="$AWS_ENV" \
    AllowedOrigin="${NEXTAUTH_URL:-http://localhost:3000}" \
    KeyPairName="group-point-key" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo "==> EC2のIPを取得中..."
EC2_IP=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='EC2PublicIP'].OutputValue" \
  --output text \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE")

echo "==> EC2 IP: $EC2_IP"
echo "==> アクセスURL: http://$EC2_IP:3000"

# SSH接続確認（最大2分待機）
echo "==> SSH接続を待機中..."
for i in $(seq 1 24); do
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$KEY_PATH" \
    "$SSH_USER@$EC2_IP" "echo ok" 2>/dev/null && break
  echo "   待機中... ($i/24)"
  sleep 5
done

# .env.production が存在する場合はEC2へアップロード
if [ -f "$ROOT_DIR/.env.production" ]; then
  echo "==> .env.production をEC2へ転送中..."
  scp -o StrictHostKeyChecking=no -i "$KEY_PATH" \
    "$ROOT_DIR/.env.production" \
    "$SSH_USER@$EC2_IP:/home/ec2-user/app/.env"
else
  echo "⚠️  .env.production が見つかりません。EC2上の /home/ec2-user/app/.env を手動で設定してください。"
fi

# コードをrsyncで転送（node_modules・.env・.gitは除外）
echo "==> コードをEC2へ転送中..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.next' \
  -e "ssh -o StrictHostKeyChecking=no -i $KEY_PATH" \
  "$ROOT_DIR/" \
  "$SSH_USER@$EC2_IP:/home/ec2-user/app/"

# EC2上でビルド＆起動
echo "==> EC2上でビルド・起動中..."
ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "$SSH_USER@$EC2_IP" << 'ENDSSH'
set -e
cd /home/ec2-user/app

echo "--- npm install ---"
npm ci --production=false

echo "--- prisma generate ---"
npx prisma generate

echo "--- prisma migrate deploy ---"
npx prisma migrate deploy

echo "--- next build ---"
npm run build

echo "--- PM2 起動/再起動 ---"
pm2 describe group-point > /dev/null 2>&1 \
  && pm2 restart group-point \
  || pm2 start npm --name group-point -- run start -- -p 3000

pm2 save
echo "==> デプロイ完了！"
ENDSSH

echo ""
echo "✅ デプロイ成功！"
echo "   アクセスURL: http://$EC2_IP:3000"
