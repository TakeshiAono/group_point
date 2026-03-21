# Group Point

グループ内でポイントを発行・管理できるWebアプリケーションです。

## 技術スタック

- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma** + **PostgreSQL**
- **NextAuth.js** (認証)
- **nodemailer** (メール送信)

## ローカル開発のセットアップ

### 1. 依存パッケージのインストール

```bash
nvm use 20.19.5
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` の `AUTH_SECRET` を生成して設定してください：

```bash
openssl rand -base64 32
```

### 3. DBとMailpitを起動

```bash
docker compose up -d
```

| サービス | URL |
|---|---|
| PostgreSQL | `localhost:5433` |
| Mailpit（メール確認UI） | http://localhost:8025 |

### 4. マイグレーション実行

```bash
npm run db:migrate
```

### 5. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

---

## メール送信の動作確認

ローカル環境では **Mailpit** を使ってメール送信をキャプチャして確認します。実際のメールは送信されません。

### 確認手順

1. `docker compose up -d` でMailpitを起動
2. アプリでグループを作成し、別ユーザーへの招待を送る
3. **http://localhost:8025** をブラウザで開く
4. 受信した招待メールが確認できます

### 本番環境（SendGrid）への切り替え

`.env` の以下の項目を変更するだけで切り替えられます：

```bash
# ローカル（Mailpit）
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="noreply@group-point.local"

# 本番（SendGrid）
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="<SendGrid APIキー>"
MAIL_FROM="noreply@yourdomain.com"
```

---

## よく使うコマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run lint         # ESLint 実行
npm run db:migrate   # マイグレーション実行
npm run db:generate  # Prismaクライアント再生成
npm run db:studio    # Prisma Studio（GUI）起動
```
