/**
 * SpotLock-Camera Pure Verification Engine (v2 format)
 * Clean separation from DOM interactions.
 */

/**
 * Main entry point to verify a SpotLock JPEG ArrayBuffer.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{status: 'verified'|'invalid'|'unsupported', reason: string, timestampMs?: number, version?: number}>}
 */
export async function verifySpotLockJpeg(arrayBuffer) {
  try {
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 4) {
      return { status: 'invalid', reason: 'ファイルデータが無効または空です。' };
    }

    const bytes = new Uint8Array(arrayBuffer);

    // 1. Verify JPEG SOI Marker
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      return { status: 'invalid', reason: 'JPEG形式のファイルではありません (SOIマーカー欠落)。' };
    }

    // 2. Parse APP15 segments strictly
    const parseResult = parseSpotLockApp15(bytes);
    if (!parseResult.success) {
      return { status: 'invalid', reason: parseResult.reason };
    }

    const { segStart, segEnd, version, timestampMs, publicKeyBytes, signatureBytes } = parseResult;

    // 3. Reconstruct Original JPEG (remove APP15 segment)
    const originalJpeg = reconstructOriginalJpeg(bytes, segStart, segEnd);

    // 4. Build Signed Data (UTF-8 timestamp string + original JPEG bytes)
    const signedData = buildSignedData(timestampMs, originalJpeg);

    // 5. Import Public Key using Web Crypto API
    let cryptoKey;
    try {
      const subtle = getSubtleCrypto();
      cryptoKey = await subtle.importKey(
        'spki',
        publicKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
    } catch (err) {
      return { status: 'invalid', reason: '画像内の公開鍵 (X.509 SPKI) のインポートに失敗しました。' };
    }

    // 6. Verify Signature using Web Crypto API
    try {
      const subtle = getSubtleCrypto();
      const isValid = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        signatureBytes,
        signedData
      );

      if (isValid) {
        return {
          status: 'verified',
          reason: '画像内の公開鍵を使用した結果、画像データ、記録時刻、公開鍵、署名の組み合わせが暗号学的に整合しています。',
          timestampMs: timestampMs,
          version: version
        };
      } else {
        return {
          status: 'invalid',
          reason: '署名の暗号学的検証に失敗しました。画像データ、記録時刻、公開鍵、または署名が改変されている可能性があります。',
          timestampMs: timestampMs,
          version: version
        };
      }
    } catch (err) {
      return { status: 'invalid', reason: '署名検証処理中に例外が発生しました。' };
    }

  } catch (e) {
    return { status: 'invalid', reason: `解析中にエラーが発生しました: ${e.message}` };
  }
}

/**
 * Helper to get subtle crypto implementation in Browser or Node environment.
 */
function getSubtleCrypto() {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  if (typeof require === 'function') {
    const nodeCrypto = require('node:crypto');
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
      return nodeCrypto.webcrypto.subtle;
    }
  }
  throw new Error('Web Crypto API (subtle) is not supported in this environment.');
}

/**
 * Strictly parse JPEG segments from SOI to locate SpotLock APP15 segment.
 */
export function parseSpotLockApp15(bytes) {
  let offset = 2;
  let foundSegments = [];

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    // End of Image
    if (marker === 0xD9) { // EOI
      break;
    }
    if (marker === 0x00 || marker === 0xFF) {
      offset++;
      continue;
    }

    // Standalone Markers without length field
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2;
      continue;
    }

    // Check if we have minimum length bytes
    if (offset + 4 > bytes.length) {
      // Truncated segment header at EOF
      return { success: false, reason: 'JPEGセグメントヘッダーが途中で切断されています (切り詰めエラー)。' };
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2) {
      return { success: false, reason: 'セグメント長が不正です。' };
    }

    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > bytes.length) {
      return { success: false, reason: 'セグメント長がファイル末尾を超えています (切り詰めエラー)。' };
    }

    if (marker === 0xEF) { // APP15
      const payloadStart = offset + 4;
      const payloadLength = segmentLength - 2;

      if (payloadLength >= 8) {
        const magicStr = String.fromCharCode(...bytes.slice(payloadStart, payloadStart + 8));
        if (magicStr === 'SPOTLOCK') {
          foundSegments.push({
            segStart: offset,
            segEnd: segmentEnd,
            payloadStart: payloadStart,
            payloadLength: payloadLength
          });
        }
      }
    }

    // If marker is Start Of Scan (SOS), entropy data follows.
    if (marker === 0xDA) {
      break;
    }

    offset = segmentEnd;
  }

  if (foundSegments.length === 0) {
    return { success: false, reason: 'SpotLock APP15 メタデータ (0xFFEF) が見つかりません。' };
  }

  if (foundSegments.length > 1) {
    return { success: false, reason: '複数の SpotLock APP15 セグメントが検出されました (構造曖昧性エラー)。' };
  }

  const target = foundSegments[0];
  const payload = bytes.slice(target.payloadStart, target.segEnd);

  // Payload Minimum Length Validation
  if (payload.length < 84) {
    return { success: false, reason: 'SpotLock APP15 ペイロードサイズが不十分です。' };
  }

  const version = payload[8];
  if (version !== 0x02) {
    return { success: false, reason: `未対応の SpotLock バージョンです (0x${version.toString(16)})。` };
  }

  // Parse Big Endian 8-byte Timestamp Long
  let timestampMs = 0n;
  for (let i = 9; i < 17; i++) {
    timestampMs = (timestampMs << 8n) | BigInt(payload[i]);
  }
  const timestampMsNum = Number(timestampMs);

  // Parse Public Key Length
  const pubKeyLen = (payload[17] << 8) | payload[18];
  if (pubKeyLen <= 0) {
    return { success: false, reason: '公開鍵の長さが不正です。' };
  }

  const expectedTotalPayloadLength = 8 + 1 + 8 + 2 + pubKeyLen + 64; // 83 + pubKeyLen
  if (payload.length !== expectedTotalPayloadLength) {
    return { success: false, reason: 'SpotLock APP15 セグメント長と内部構成の計算長が一致しません。' };
  }

  const publicKeyBytes = payload.slice(19, 19 + pubKeyLen);
  const signatureBytes = payload.slice(19 + pubKeyLen, 19 + pubKeyLen + 64);

  if (signatureBytes.length !== 64) {
    return { success: false, reason: '署名データ長が 64 バイトではありません。' };
  }

  return {
    success: true,
    segStart: target.segStart,
    segEnd: target.segEnd,
    version: version,
    timestampMs: timestampMsNum,
    publicKeyBytes: publicKeyBytes,
    signatureBytes: signatureBytes
  };
}

/**
 * Reconstruct original JPEG bytes by excluding SpotLock APP15 segment.
 */
export function reconstructOriginalJpeg(bytes, segStart, segEnd) {
  const before = bytes.slice(0, segStart);
  const after = bytes.slice(segEnd);
  const result = new Uint8Array(before.length + after.length);
  result.set(before, 0);
  result.set(after, before.length);
  return result;
}

/**
 * Build signed data: UTF-8 timestamp.toString() + original JPEG bytes.
 */
export function buildSignedData(timestampMs, originalJpegBytes) {
  const timestampStr = timestampMs.toString();
  const encoder = new TextEncoder();
  const timestampBytes = encoder.encode(timestampStr);

  const signedData = new Uint8Array(timestampBytes.length + originalJpegBytes.length);
  signedData.set(timestampBytes, 0);
  signedData.set(originalJpegBytes, timestampBytes.length);
  return signedData;
}

export default {
  verifySpotLockJpeg,
  parseSpotLockApp15,
  reconstructOriginalJpeg,
  buildSignedData
};
