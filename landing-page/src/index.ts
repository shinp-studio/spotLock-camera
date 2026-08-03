import { Hono } from 'hono';

type Bindings = {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
};

const app = new Hono<{ Bindings: Bindings }>();

// セキュアヘッダーミドルウェア
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// API エンドポイント: ヘルスチェック
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'SpotLock-Camera LP & Verifier Worker',
    timestamp: new Date().toISOString()
  });
});

// API エンドポイント: デモ用検証シミュレータ
app.post('/api/verify-demo', async (c) => {
  try {
    const body = await c.req.json<{ timestamp?: number; hasApp15?: boolean }>();
    const timestamp = body.timestamp || Date.now();
    const formattedDate = new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });

    return c.json({
      verified: true,
      signatureAlgorithm: 'ECDSA P-256 (SHA-256)',
      segmentMarker: '0xFFEF (APP15)',
      magicString: 'SPOTLOCK',
      version: 1,
      capturedAtMs: timestamp,
      capturedAtFormatted: formattedDate,
      integrity: 'INTACT (0 bytes altered)',
      statusMessage: '署名は有効であり、撮影日時の捏造および画像バイナリの改ざんは認められません。'
    });
  } catch (err) {
    return c.json({ verified: false, error: '無効なリクエストデータです' }, 400);
  }
});

// 静的アセットのフォールバック (public ディレクトリ)
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
