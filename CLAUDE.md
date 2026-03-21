# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技術スタック

- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS**

## よく使うコマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # プロダクションビルド
npm run start    # プロダクションサーバー起動
npm run lint     # ESLint 実行
```

```bash
npm run db:migrate   # マイグレーション実行（開発用）
npm run db:generate  # Prismaクライアントを再生成
npm run db:studio    # Prisma Studio（GUI）を起動
npm run db:push      # スキーマをDBに直接反映（マイグレーションなし）
```

## ディレクトリ構成

- `app/` — App Router のルートディレクトリ。`layout.tsx` がルートレイアウト、`page.tsx` がトップページ
- `lib/prisma.ts` — Prismaクライアントのシングルトン（Next.jsのホットリロード対応）
- `prisma/schema.prisma` — データベーススキーマ定義
- `public/` — 静的ファイル
- `next.config.ts` — Next.js 設定

## 開発時の注意

- Node.js v20 以上が必要。nvm を使用している場合は `nvm use 20` を実行すること
- パスエイリアス `@/*` はプロジェクトルートからの絶対パスにマッピングされている

## 開発フロー

ユーザーがissue番号を指定したら、以下の手順で実装する：

1. **masterを最新化**
   ```bash
   git checkout master
   git pull origin master
   ```

2. **issueの内容を確認**
   ```bash
   gh issue view {番号} --repo TakeshiAono/group_point --json title,body,comments
   ```

3. **フィーチャーブランチを作成**
   ```bash
   git checkout -b feature/{issue番号}
   ```

4. **実装してコミット**
   ```bash
   git add {該当ファイル}
   git commit -m "feat: {内容} (#{issue番号})"
   ```

5. **pushしてPRを作成**
   ```bash
   git push -u origin feature/{issue番号}
   gh pr create --repo TakeshiAono/group_point --title "..." --base master --head feature/{issue番号} --body "..."
   ```
   PRの本文には必ず `Closes #{issue番号}` を含める。

6. **PRをマージ**

   マージ前に必ず以下の選択肢をユーザーに提示し、確認を取ること：
   - **merge** — マージコミットを作成（デフォルト）
   - **squash** — コミットを1つにまとめてマージ
   - **rebase** — リベースしてマージ
   - **キャンセル** — マージしない

### 注意事項
- 応答はすべて日本語で行う
- gh コマンドが認証エラーになる場合は `gh auth login` を実行するようユーザーに案内する
- センシティブなファイル（.env, .pem, .key, credentials等）がpushされないよう、push前に必ず確認する
- **masterブランチへの直接コミット・プッシュは絶対に禁止**。必ずフィーチャーブランチを作成してPR経由でマージすること
- issue番号がない場合でも同様。修正・追加・バグ修正すべてフィーチャーブランチ（`feature/xxx`）を切ってからコミットすること
- PRマージ後の追加修正も新たにフィーチャーブランチを作成してPR経由で行うこと
