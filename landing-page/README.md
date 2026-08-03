# SpotLock-Camera Landing Page (by Shinp Studio)

**Shinp Studio** が開発する SpotLock-Camera（GPS不使用・暗号署名による完全性証明カメラ）の製品 LP および実物検証ツールです。

## 🌟 特徴

- **Stripe & Supabase スタイルのクリーンデザイン**: エンタープライズや現場業務に適した信頼感のあるライトモードデザイン。
- **実物の動作シーン画像**: 自前作成した高精度のスマホ撮影画面およびWeb検証成功・改ざん検知画面。
- **実物JPEGバイナリ検証デモ**: ブラウザ内 Web Crypto API により、ドロップされた実物JPEGファイルの APP15 メタデータを直接解読・判定。
- **Cloudflare Workers 完全対応**: Wrangler と Workers Static Assets を利用した超高速配信。

---

## 🚀 ローカル起動方法

```bash
cd landing-page
npm install
npx wrangler dev
```

ブラウザで `http://localhost:8787` を開きます。

---

## ☁️ Cloudflare Workers へのデプロイ方法

```bash
cd landing-page
npx wrangler deploy
```

---

&copy; Shinp Studio
