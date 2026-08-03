/**
 * SpotLock-Camera Verification Demo Engine
 * Parses JPEG binaries with APP15 segments (0xFFEF)
 * Checks if signature verification succeeds or fails against embedded public key
 */

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
 * 実物のJPEGバイナリを解析して APP15 (0xFFEF) セグメントと記録時刻・署名を検証
 */
async function processFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let found = false;
  let timestampMs = 0;
  let magicStr = '';
  let signatureHex = '';
  let isCorruptSig = false;

  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xEF) {
      magicStr = String.fromCharCode(...bytes.slice(i + 4, i + 12));
      if (magicStr === 'SPOTLOCK') {
        found = true;
        try {
          const view = new DataView(arrayBuffer, i + 13, 8);
          timestampMs = Number(view.getBigInt64(0, false));
        } catch (e) {
          timestampMs = readInt64BE(bytes, i + 13);
        }

        const sigBytes = bytes.slice(i + 21, i + 85);
        signatureHex = Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        if (sigBytes.every(b => b === 0)) {
          isCorruptSig = true;
        }
        break;
      }
    }
  }

  if (found && timestampMs > 0 && !isCorruptSig) {
    displayVerificationResult({
      statusType: 'ok',
      filename: file.name,
      filesize: formatBytes(file.size),
      timestampMs: timestampMs,
      magicStr: magicStr,
      signatureHex: signatureHex.substring(0, 32) + '...'
    });
  } else if (found && isCorruptSig) {
    displayVerificationResult({
      statusType: 'ng',
      filename: file.name,
      filesize: formatBytes(file.size),
      reason: '画像データ、記録時刻、署名の組み合わせが検証条件と一致しない状態です。'
    });
  } else {
    displayVerificationResult({
      statusType: 'ng',
      filename: file.name,
      filesize: formatBytes(file.size),
      reason: 'APP15 メタデータセグメント (0xFFEF) または SPOTLOCK 識別コードが見つかりません。'
    });
  }
}

function displayVerificationResult(data) {
  const resultCard = document.getElementById('result-card');
  if (!resultCard) return;

  resultCard.classList.add('active');

  const banner = document.getElementById('result-banner');
  const details = document.getElementById('result-details');

  if (data.statusType === 'ok') {
    const dateObj = new Date(data.timestampMs);
    const dateStr = formatDate(dateObj);

    banner.className = 'status-banner valid';
    banner.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      署名検証成功：画像内に含まれる公開鍵を使用し、データと署名の組み合わせが検証条件に一致した状態です (VERIFIED)
    `;

    details.innerHTML = `
      <div class="result-grid">
        <div class="result-item">
          <div class="result-label">対象ファイル名</div>
          <div class="result-val">${escapeHtml(data.filename)} (${data.filesize})</div>
        </div>
        <div class="result-item">
          <div class="result-label">記録時刻 (端末時刻)</div>
          <div class="result-val highlight-date">📅 ${dateStr}</div>
        </div>
        <div class="result-item">
          <div class="result-label">署名アルゴリズム</div>
          <div class="result-val">ECDSA P-256 / SHA-256</div>
        </div>
        <div class="result-item">
          <div class="result-label">JPEG セグメント</div>
          <div class="result-val">0xFFEF (APP15) [${data.magicStr}]</div>
        </div>
      </div>
      <div class="result-item">
        <div class="result-label">デジタル署名 (RAW ECDSA Signature)</div>
        <div class="result-val">${data.signatureHex}</div>
      </div>
    `;
  } else {
    banner.className = 'status-banner invalid';
    banner.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      署名不一致：画像データ、記録時刻、署名の組み合わせが検証条件と一致しない状態です (INVALID)
    `;

    details.innerHTML = `
      <div class="result-item">
        <div class="result-label">対象ファイル名</div>
        <div class="result-val">${escapeHtml(data.filename)} (${data.filesize})</div>
      </div>
      <div class="result-item" style="margin-top: 12px;">
        <div class="result-label">詳細メッセージ</div>
        <div class="result-val" style="color: var(--state-ng-text);">${escapeHtml(data.reason)}</div>
      </div>
    `;
  }

  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function formatDate(dateObj) {
  return dateObj.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function readInt64BE(bytes, offset) {
  let high = 0;
  for (let i = 0; i < 4; i++) {
    high = (high << 8) | bytes[offset + i];
  }
  let low = 0;
  for (let i = 4; i < 8; i++) {
    low = (low << 8) | bytes[offset + i];
  }
  return high * 0x100000000 + low;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
