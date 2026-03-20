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

## ディレクトリ構成

- `app/` — App Router のルートディレクトリ。`layout.tsx` がルートレイアウト、`page.tsx` がトップページ
- `public/` — 静的ファイル
- `next.config.ts` — Next.js 設定

## 開発時の注意

- Node.js v20 以上が必要。nvm を使用している場合は `nvm use 20` を実行すること
- パスエイリアス `@/*` はプロジェクトルートからの絶対パスにマッピングされている
