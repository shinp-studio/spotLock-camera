# SpotLock-Camera Design System Guidelines (DESIGN.md)

Stripe Docs & Supabase スタイル（Enterprise Clean Refined）に基づくデザイン仕様書です。

## 📐 コアデザイン原則

1. **Enterprise Clean Clarity (エンタープライズの透明感と視認性)**
   - 余計なグラデーションや派手なアニメーションを廃し、すっきりとした情報構造と高いコントラストで信頼感を演出します。
2. **Compact & Rational Spacing (コンパクトで合理的な余白)**
   - 過剰な空白（80px〜100px）を禁止。セクション間は `40px`、コンポーネント内は `16px〜20px` の締まったレイアウトを維持します。
3. **Structured Design Tokens (トークン体系)**
   - カラー、タイポグラフィ、ボーダー、シャドウをすべて変数管理し、洗練された一貫性を提供します。

---

## 🎨 デザイン・トークン

### カラーパレット
```css
--bg-page: #f8fafc;          /* Slate 50 */
--bg-surface: #ffffff;       /* Pure White */
--bg-subtle: #f1f5f9;        /* Slate 100 */

--border-light: #e2e8f0;     /* Slate 200 */
--border-medium: #cbd5e1;    /* Slate 300 */

--text-main: #0f172a;        /* Slate 900 */
--text-body: #334155;        /* Slate 700 */
--text-muted: #64748b;       /* Slate 500 */

--accent-blue: #2563eb;      /* Primary Blue */
--accent-blue-hover: #1d4ed8;
--accent-blue-light: #eff6ff;

--state-ok-text: #059669;    /* Emerald 600 */
--state-ok-bg: #ecfdf5;      /* Emerald 50 */
--state-ok-border: #a7f3d0;  /* Emerald 200 */

--state-ng-text: #dc2626;    /* Red 600 */
--state-ng-bg: #fef2f2;      /* Red 50 */
--state-ng-border: #fecaca;  /* Red 200 */
```

### シャドウ & ボーダー
- `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);`
- `border-radius: 8px;` (コンポーネント/カード)
- `border-radius: 6px;` (ボタン/タグ/インプット)
