# インフラ構成 & デプロイ手順

## 構成概要

- **CloudFormation** (`main.yml`): S3 + EC2 + セキュリティグループ
- **EC2**: Amazon Linux 2023, Node.js 20, PostgreSQL 15, PM2
- **接続方法**: AWS Systems Manager (SSM) Session Manager（キーペア不要）

---

## 1. デプロイスクリプト

| スクリプト | 用途 | 実行タイミング |
|---|---|---|
| `deploy-dev.sh` | CloudFormation（インフラ） | EC2追加・セキュリティグループ変更など |
| `deploy-app-dev.sh` | コードデプロイ（SSM経由） | コード更新のたびに |

```bash
# インフラ変更時
bash infra/deploy-dev.sh

# コード更新時（普段はこっちだけ）
bash infra/deploy-app-dev.sh
```

> `deploy-app-dev.sh` は SSM Session Manager 経由でEC2に入らずリモート実行します

---

## 2. CloudFormation スタックを手動でデプロイする場合

```bash
aws cloudformation deploy \
  --template-file infra/main.yml \
  --stack-name group-point-dev \
  --parameter-overrides Env=dev \
  --capabilities CAPABILITY_IAM \
  --profile group-point-dev
```

> `--capabilities CAPABILITY_IAM` は IAM ロール作成に必要

---

## 3. SSM Session Manager でEC2に接続する

### 前提条件
- AWS CLI v2 がインストール済み
- Session Manager plugin がインストール済み（[インストール手順](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)）

### コンソールから接続する場合
1. AWSコンソール → EC2 → インスタンス一覧
2. `group-point-dev` インスタンスを選択
3. 「接続」ボタン → **「Session Manager」タブ** → 「接続」

### AWS CLI から接続する場合
```bash
# インスタンスIDを確認
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=group-point-dev" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text \
  --profile group-point-dev

# Session Manager で接続
aws ssm start-session \
  --target i-xxxxxxxxxxxxxxxxx \
  --profile group-point-dev
```

---

## 4. 初回デプロイ（EC2にコードを配置する）

EC2に接続後、以下を実行：

```bash
# ec2-user に切り替え
sudo su - ec2-user

# GitHubからクローン（HTTPSの場合）
git clone https://github.com/TakeshiAono/group_point.git /home/ec2-user/app

cd /home/ec2-user/app

# .env を作成（内容は手動で編集）
cp .env.example .env
nano .env
# DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL 等を設定

# 依存関係インストール & ビルド
npm install
npm run db:migrate
npm run build

# PM2 で起動
pm2 start npm --name "group-point" -- start
pm2 save
```

---

## 5. 2回目以降のデプロイ（コード更新）

```bash
# ローカルから実行（EC2にログイン不要）
bash infra/deploy-app-dev.sh
```

---

## 6. .env の設定項目

| 変数 | 説明 | 例 |
|------|------|-----|
| `DATABASE_URL` | PostgreSQL接続URL | `postgresql://grouppoint:changeme@localhost:5432/group_point` |
| `AUTH_SECRET` | NextAuth署名キー | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | アプリのURL | `http://<EC2のパブリックIP>:3000` |
| `AWS_REGION` | S3のリージョン | `ap-northeast-1` |
| `AWS_S3_BUCKET` | S3バケット名 | CloudFormation Outputsで確認 |

> `AWS_PROFILE` は EC2上では不要（IAMロールで自動認証されます）

---

## 7. ステータス確認コマンド

```bash
# アプリの状態確認
pm2 status
pm2 logs group-point

# PostgreSQL の状態確認
systemctl status postgresql

# ポート確認
ss -tlnp | grep 3000
```
