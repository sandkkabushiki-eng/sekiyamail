# メール返信文ジェネレーター

お客様からのメールを翻訳し、口調とボリュームを調整した返信文を生成できるサポートツールです。

## 機能

- お客様メールの自動翻訳（日本語以外の言語対応）
- 情報ブロックによる構造化データ入力
- プリセット機能による迅速な情報入力
- 口調と文章量の調整
- 日本語と英語の返信文を同時生成
- 個別コピー機能

## セットアップ

### 環境変数

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL_TRANSLATE=gpt-4o-mini
OPENAI_MODEL_REPLY=gpt-4o-mini
```

### インストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

## Vercelへのデプロイ

1. GitHubリポジトリにプッシュ
2. Vercelダッシュボードでプロジェクトをインポート
3. 環境変数 `OPENAI_API_KEY` を設定
4. デプロイ

## 技術スタック

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- OpenAI API
- Zod
