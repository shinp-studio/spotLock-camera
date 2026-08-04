# SpotLock-Camera

地下駅や地下施設など、通信が不安定な環境でも撮影と署名処理を実行できる Android カメラアプリと、JPEG 内の署名データを検証する Web LP / 実物検証ツールです。

🌐 **公式 LP & Web 実物検証ツール**: [https://spotlock.shinp-studio.com/](https://spotlock.shinp-studio.com/)

---

## 1. 製品体験フロー

1. **Android アプリをインストール**: LP または Releases から APK をダウンロードしてスマホにインストール。
2. **SpotLock-Camera で撮影**: ネットワーク通信を行わず、端末内で撮影・タイムスタンプ描画・電子署名・APP15 埋め込みを実行。
3. **LP 上の検証機能へ JPEG をドロップ**: ブラウザの [実物検証ツール](https://spotlock.shinp-studio.com/#verifier) へ撮影した JPEG ファイルをドラッグ＆ドロップ。
4. **改ざんの有無を確認**: 署名後に画像データや記録時刻が変更されていないか（`VERIFIED` / `INVALID`）を確認。

---

## 2. プロジェクト概要

SpotLock-Camera は、安定したネットワーク接続を確保しにくい現場での撮影を想定して開発されたカメラ＆検証システムです。
撮影時にインターネット接続を必要とせず、端末のシステム時刻（UNIX時間ミリ秒）と撮影された JPEG 画像データに対して電子署名を付与・埋め込みます。

専用の Web 実物検証ツールを使用することで、画像内に格納された公開鍵を用いて、画像データ、記録時刻、署名の組み合わせが一致するかを確認できます。

---

## 3. リポジトリ構成

```text
app/
  Androidカメラアプリ (Kotlin, CameraX, Compose)
  撮影、タイムスタンプ描画、電子署名、APP15埋め込み、保存

landing-page/
  製品LP
  APKダウンロード導線
  ブラウザ上の署名検証機能 (Web Crypto API)
  Cloudflare Workersへのデプロイ設定 (Wrangler)
```

---

## 4. 主な機能

- **通信が不安定な環境での撮影・署名**: 外部タイムサーバー（NTP）や認証サーバーへのリアルタイム接続を行わずに、端末内で撮影と署名処理を完結します。
- **電子署名の付与**: 署名処理時に端末のシステム時刻（UNIX時間ミリ秒）と JPEG 画像データに対し、ECDSA P-256（SHA256withECDSA）によるデジタル署名を生成します。
- **APP15 セグメントへのメタデータ格納**: JPEG 規格の `0xFFEF` (APP15) セグメント内に、識別コード、記録時刻、端末公開鍵、電子署名を直接埋め込みます。標準の画像ビューアでそのまま閲覧可能です。
- **Web ブラウザでの署名検証**: Web Crypto API を利用し、JPEG ファイルをドラッグ＆ドロップするだけで署名の整合性を検証できます。

---

## 5. 検証ツールが確認する内容

Web 実物検証ツールが直接確認・表示する事項は以下の通りです：

- **署名の整合性**: 画像内に含まれる公開鍵（または旧 v1 形式用の固定公開鍵）を使用し、画像データ、記録時刻、署名の組み合わせが検証条件に一致しているか（`VERIFIED` / `INVALID`）。
- **署名不一致が検知されるケース**:
  - 署名を更新せずに行われた画像データの修正や色調変更
  - 署名を更新せずに行われた記録時刻文字列の書き換え
  - JPEG バイナリまたは署名データの破損

---

## 6. 検証・確認できない内容（セキュリティ上の制約）

本システムの構造上、以下の事項は確認・保証できません：

- **現実の正確な時刻との一致**: 署名処理時に端末のシステム時刻を取得するため、記録時刻が現実の正確な時間と一致していることや、署名処理前の端末時刻変更を確認するものではありません。
- **位置・撮影事実の証明**: 撮影された場所、ユーザーが特定の場所にいたこと、写真に写っている内容が現実の事実であることを証明するものではありません。
- **正規アプリ・正規端末の確認**: 検証ツールが公開鍵の信頼性を別途確認しない構成では、正規アプリまたは信頼された端末で署名されたかを判別するものではありません。
- **変更者・変更箇所の特定**: データの変更があった場合に、具体的にどの部分が変更されたか、誰が変更したか、意図的な書き換えか偶発的な破損かを判別するものではありません。
- **書き換えの物理的防止**: 電子署名はデータの書き換え動作そのものを物理的に防止する機能ではありません。

---

## 7. Androidアプリの処理フロー

1. **画像キャプチャ**: `CameraX` から撮影画像データ（`ImageProxy` バイト列）を取得し、リソースを解放。
2. **時刻取得**: 署名処理の段階で `System.currentTimeMillis()` を呼び出し、端末のシステム時刻を UNIX エポックからの経過ミリ秒値として取得。
3. **画像加工**: タイムスタンプオーバーレイを描画加工。
4. **署名生成**: 取得した時刻文字列（UTF-8 バイト列）と加工済み JPEG バイナリを連結し、Android Keystore の秘密鍵で `SHA256withECDSA` 署名を生成（DER形式から 64 バイト RAW 形式 `R|S` へ変換）。
5. **APP15 メタデータ挿入**: SOI (`0xFFD8`) 直後に `0xFFEF` APP15 セグメント（識別コード `"SPOTLOCK"`、バージョン `0x02`、時刻、公開鍵、署名）を組み込み。
6. **保存**: 処理された JPEG バイト列をストレージへ保存。

---

## 8. 鍵生成と鍵管理

Android アプリ側での鍵管理仕様およびライフサイクルは以下の通りです：

- **鍵生成クラス**: `KeystoreKeyProvider.kt`
- **保管場所**: `AndroidKeyStore`
- **エイリアス名**: `"spotlock_signing_key"`
- **生成方式**: `KeyPairGenerator` を用いて、アプリがインストールされた各端末内で ECDSA P-256（secp256r1）鍵ペアを動的に生成。
- **保護レベル**: 秘密鍵は `AndroidKeyStore` 内に保持され、アプリ外へのエクスポートはできません。
- **鍵のライフサイクル**:
  - 鍵ペアはアプリの初回利用時に自動生成され、アプリの通常利用やバージョンアップデート後も同一の鍵が使用されます。
  - アプリデータの消去や再インストール時には新しい鍵ペアが生成されます。

---

## 9. APP15 v2 データ形式

| オフセット | 長さ (Bytes) | フィールド | 説明 |
| :--- | :--- | :--- | :--- |
| `+0` | `2` | マーカー | `0xFFEF` (JPEG APP15 Marker) |
| `+2` | `2` | セグメント長 | APP15マーカーを除いたセグメントデータ長 |
| `+4` | `8` | 識別コード | ASCII 文字列 `"SPOTLOCK"` (`0x53504F544C4F434B`) |
| `+12` | `1` | バージョン | `0x02` (現行 v2 形式) |
| `+13` | `8` | 記録時刻 | UNIX時間ミリ秒 (Long, Big Endian) |
| `+21` | `2` | 公開鍵長 | 公開鍵バイナリの長さ |
| `+23` | 変動 (`pubKeyLen`) | 公開鍵 | X.509 SPKI 形式の ECDSA P-256 公開鍵バイナリ |
| `+23 + pubKeyLen` | `64` | デジタル署名 | RAW 64 バイト署名 (`R` 32B + `S` 32B) |

---

## 10. テスト・ビルド方法

### Android アプリ

```bash
# 単位テスト実行 (Windows環境: gradlew.bat test)
./gradlew test

# Debug APK ビルド (Windows環境: gradlew.bat assembleDebug)
./gradlew assembleDebug
```

### Web LP & 検証ツール

```bash
cd landing-page
npm install
npx wrangler dev
```

---

## 11. 主要なコード構成

```text
spotLock-camera/
├── app/src/main/java/com/shinpstudio/spotlockcamera/
│   ├── MainActivity.kt
│   ├── ui/
│   │   ├── camera/
│   │   │   ├── CameraScreen.kt
│   │   │   ├── CameraUiState.kt
│   │   │   ├── CameraViewModel.kt
│   │   │   └── CameraViewModelFactory.kt
│   │   └── theme/
│   ├── domain/
│   │   ├── reporter/ErrorReporter.kt
│   │   └── usecase/CaptureAndSignUseCase.kt
│   ├── core/
│   │   ├── crypto/
│   │   │   ├── PrivateKeyProvider.kt
│   │   │   ├── KeystoreKeyProvider.kt
│   │   │   └── SpotLockImageSigner.kt
│   │   ├── image/
│   │   │   └── TimestampOverlayProcessor.kt
│   │   ├── storage/
│   │   │   └── MediaStoreImageStorage.kt
│   │   └── utils/RetryUtils.kt
│   └── infrastructure/
│       └── reporter/LogErrorReporter.kt
└── landing-page/
    ├── public/
    │   ├── index.html
    │   └── app.js
    └── src/index.ts
```

---

&copy; Shinp Studio
