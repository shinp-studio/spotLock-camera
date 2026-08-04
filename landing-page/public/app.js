/**
 * SpotLock-Camera Verification Demo Engine
 * Connects file drop UI with pure verifier.js
 */

import { verifySpotLockJpeg } from './verifier.js';

document.addEventListener('DOMContentLoaded', () => {
  initVerifierDemo();
});

function initVerifierDemo() {
  const fileInput = document.getElementById('file-input');
  const uploadArea = document.getElementById('upload-area');

  if (!uploadArea || !fileInput) return;

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  });
}

/**
 * Process uploaded JPEG file using Web Crypto API verifier
 */
async function processFile(file) {
  const banner = document.getElementById('result-banner');
  const details = document.getElementById('result-details');
  const card = document.getElementById('result-card');

  if (!banner || !details || !card) return;

  card.style.display = 'block';
  banner.className = 'status-banner loading';
  banner.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
  banner.style.color = '#2563eb';
  banner.style.border = '1px solid rgba(59, 130, 246, 0.4)';
  banner.style.padding = '12px 16px';
  banner.style.borderRadius = '6px';
  banner.style.fontWeight = '600';
  banner.innerHTML = `⏳ 解析・暗号検証中: ${escapeHtml(file.name)} (${formatBytes(file.size)})`;

  details.innerHTML = '';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await verifySpotLockJpeg(arrayBuffer);

    if (result.status === 'verified') {
      banner.className = 'status-banner valid';
      banner.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
      banner.style.color = '#15803d';
      banner.style.border = '1px solid rgba(34, 197, 94, 0.4)';
      banner.innerHTML = `✅ 署名検証成功 (VERIFIED): ${escapeHtml(file.name)}`;

      const dateStr = result.timestampMs ? new Date(result.timestampMs).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '不明';

      details.innerHTML = `
        <div style="margin-top: 14px; padding: 16px; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
          <h4 style="font-size: 0.95rem; font-weight: 600; color: #15803d; margin: 0 0 8px 0;">
            検証結果: 暗号学的整合性を確認 (VERIFIED)
          </h4>
          <p style="font-size: 0.875rem; color: var(--text-main); line-height: 1.6; margin: 0 0 14px 0;">
            ${escapeHtml(result.reason)}
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 14px;">
            <tr>
              <td style="padding: 6px 0; color: var(--text-muted); width: 140px;">ファイル名:</td>
              <td style="padding: 6px 0; font-family: monospace;">${escapeHtml(file.name)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: var(--text-muted);">記録時刻 (UNIX):</td>
              <td style="padding: 6px 0; font-family: monospace;">${result.timestampMs} (${dateStr})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: var(--text-muted);">仕様バージョン:</td>
              <td style="padding: 6px 0; font-family: monospace;">v${result.version} (APP15 0xFFEF)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: var(--text-muted);">検証アルゴリズム:</td>
              <td style="padding: 6px 0; font-family: monospace;">ECDSA P-256 (SHA-256) via Web Crypto API</td>
            </tr>
          </table>

          <div style="padding-top: 12px; border-top: 1px dashed var(--border-light);">
            <h5 style="font-size: 0.825rem; font-weight: 600; color: var(--text-muted); margin: 0 0 6px 0;">
              構造上の留意事項（本検証で証明・保証しない内容）
            </h5>
            <ul style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; padding-left: 18px; margin: 0;">
              <li>正規SpotLockアプリまたは信頼された特定の端末で撮影されたこと</li>
              <li>現実の正確な撮影時刻（端末のローカル設定時刻を暗号署名しています）</li>
              <li>撮影場所および位置情報</li>
              <li>写真に写っている内容・被写体が現実の事実であること</li>
            </ul>
          </div>
        </div>
      `;
    } else {
      banner.className = 'status-banner invalid';
      banner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      banner.style.color = '#b91c1c';
      banner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      banner.innerHTML = `❌ 署名検証不一致 / 検証不可 (INVALID): ${escapeHtml(file.name)}`;

      details.innerHTML = `
        <div style="margin-top: 14px; padding: 16px; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
          <h4 style="font-size: 0.95rem; font-weight: 600; color: #b91c1c; margin: 0 0 8px 0;">
            判定: 署名不一致または構造エラー (INVALID)
          </h4>
          <p style="font-size: 0.875rem; color: var(--text-main); line-height: 1.6; margin: 0 0 12px 0;">
            ${escapeHtml(result.reason)}
          </p>
          <div style="padding-top: 10px; border-top: 1px dashed var(--border-light); font-size: 0.8rem; color: var(--text-muted); line-height: 1.5;">
            ※ 画像の編集、トリミング、色調変更、タイムスタンプや署名データの書き換え、または非対応の画像ファイルである場合にこの判定となります。
          </div>
        </div>
      `;
    }
  } catch (err) {
    banner.className = 'status-banner invalid';
    banner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    banner.style.color = '#b91c1c';
    banner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    banner.innerHTML = `❌ エラー: 検証処理を実行できませんでした`;

    details.innerHTML = `
      <div style="margin-top: 14px; padding: 14px; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
        <p style="font-size: 0.875rem; color: #b91c1c; margin: 0;">
          エラー詳細: ${escapeHtml(err.message)}
        </p>
      </div>
    `;
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
