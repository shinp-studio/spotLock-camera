import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { verifySpotLockJpeg, parseSpotLockApp15 } from '../public/verifier.js';

/**
 * Helper to ensure a clean independent ArrayBuffer is passed
 */
function toArrayBuffer(buf) {
  const u8 = new Uint8Array(buf);
  const copy = new Uint8Array(u8.length);
  copy.set(u8);
  return copy.buffer;
}

/**
 * Helper to generate an ECDSA P-256 keypair and create a valid SpotLock v2 Signed JPEG
 */
async function generateValidSpotLockJpeg(timestampMs = 1719736800000) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256'
  });

  const spkiPubKey = publicKey.export({ type: 'spki', format: 'der' });

  // Dummy Original JPEG: SOI (FF D8) + APP0 + DQT + SOS + scan data + EOI (FF D9)
  const originalJpeg = new Uint8Array([
    0xFF, 0xD8,
    0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xFF, 0xDB, 0x00, 0x09, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0xFF, 0xDA, 0x00, 0x08, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    0xFF, 0xD9
  ]);

  // Build signed data: timestampStr + originalJpeg
  const timestampStr = timestampMs.toString();
  const timestampBytes = Buffer.from(timestampStr, 'utf-8');
  const signedData = Buffer.concat([timestampBytes, Buffer.from(originalJpeg)]);

  // Sign using Node.js crypto
  const signer = crypto.createSign('SHA256');
  signer.update(signedData);
  const derSignature = signer.sign(privateKey);
  const rawSignature = derToRaw64(derSignature);

  // Build APP15 Payload
  const magic = Buffer.from('SPOTLOCK', 'ascii');
  const version = Buffer.from([0x02]);
  
  const timestampBuf = Buffer.alloc(8);
  timestampBuf.writeBigInt64BE(BigInt(timestampMs), 0);

  const pubKeyLenBuf = Buffer.alloc(2);
  pubKeyLenBuf.writeUInt16BE(spkiPubKey.length, 0);

  const payload = Buffer.concat([
    magic,
    version,
    timestampBuf,
    pubKeyLenBuf,
    spkiPubKey,
    rawSignature
  ]);

  const segmentLength = payload.length + 2;
  const app15Header = Buffer.alloc(4);
  app15Header[0] = 0xFF;
  app15Header[1] = 0xEF;
  app15Header.writeUInt16BE(segmentLength, 2);

  // Insertion index: right after SOI (offset 2)
  const signedJpeg = Buffer.concat([
    originalJpeg.subarray(0, 2),
    app15Header,
    payload,
    originalJpeg.subarray(2)
  ]);

  return {
    signedJpeg: new Uint8Array(signedJpeg),
    spkiPubKey,
    rawSignature,
    app15Offset: 2,
    app15Length: segmentLength + 2,
    pubKeyLen: spkiPubKey.length
  };
}

/**
 * Convert DER Signature to 64-byte RAW (R|S)
 */
function derToRaw64(der) {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Invalid DER');
  let totalLen = der[offset++];
  if (totalLen & 0x80) offset += (totalLen & 0x7F);

  if (der[offset++] !== 0x02) throw new Error('Invalid DER R marker');
  let rLen = der[offset++];
  let rBytes = der.subarray(offset, offset + rLen);
  offset += rLen;

  if (der[offset++] !== 0x02) throw new Error('Invalid DER S marker');
  let sLen = der[offset++];
  let sBytes = der.subarray(offset, offset + sLen);

  const raw = Buffer.alloc(64);
  const rStart = rLen > 32 ? rLen - 32 : 0;
  const rLength = Math.min(rLen, 32);
  rBytes.copy(raw, 32 - rLength, rStart, rStart + rLength);

  const sStart = sLen > 32 ? sLen - 32 : 0;
  const sLength = Math.min(sLen, 32);
  sBytes.copy(raw, 64 - sLength, sStart, sStart + sLength);

  return raw;
}

test('1. VERIFIED: Node generated valid signed JPEG', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const res = await verifySpotLockJpeg(toArrayBuffer(signedJpeg));
  assert.equal(res.status, 'verified');
  assert.equal(res.version, 2);
  assert.equal(res.timestampMs, 1719736800000);
});

test('2. CROSS-IMPLEMENTATION: Android SpotLockImageSigner generated JPEG fixture -> VERIFIED', async () => {
  const fixturePath = path.join(process.cwd(), 'test', 'fixtures', 'android_v2_signed_sample.jpg');
  assert.ok(fs.existsSync(fixturePath), 'Android test fixture file must exist');

  const androidJpegBuffer = fs.readFileSync(fixturePath);
  const res = await verifySpotLockJpeg(toArrayBuffer(androidJpegBuffer));

  assert.equal(res.status, 'verified', `Android fixture verification failed: ${res.reason}`);
  assert.equal(res.version, 2);
  assert.equal(res.timestampMs, 1719736800000);
});

test('3. SAMPLES CHECK: sample_ok.jpg -> VERIFIED & sample_ng.jpg -> INVALID', async () => {
  const sampleOkPath = path.join(process.cwd(), 'public', 'samples', 'sample_ok.jpg');
  const sampleNgPath = path.join(process.cwd(), 'public', 'samples', 'sample_ng.jpg');

  assert.ok(fs.existsSync(sampleOkPath), 'sample_ok.jpg must exist');
  assert.ok(fs.existsSync(sampleNgPath), 'sample_ng.jpg must exist');

  const okBuf = fs.readFileSync(sampleOkPath);
  const ngBuf = fs.readFileSync(sampleNgPath);

  const resOk = await verifySpotLockJpeg(toArrayBuffer(okBuf));
  assert.equal(resOk.status, 'verified', `sample_ok.jpg failed: ${resOk.reason}`);
  assert.equal(resOk.version, 2);

  const resNg = await verifySpotLockJpeg(toArrayBuffer(ngBuf));
  assert.equal(resNg.status, 'invalid', 'sample_ng.jpg should be INVALID');
});

test('4. INVALID: Modify 1 byte in image data after APP15', async () => {
  const { signedJpeg, app15Length } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);
  const targetIdx = 2 + app15Length + 5;
  modified[targetIdx] ^= 0xFF; // Flip bits

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /暗号学的検証に失敗しました/);
});

test('5. INVALID: Modify 1 byte near end of JPEG file', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);
  modified[modified.length - 5] ^= 0x55;

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /暗号学的検証に失敗しました/);
});

test('6. INVALID: Modify 1 byte in timestamp within APP15', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);
  // Timestamp starts at offset 2 (SOI) + 4 (APP15 header) + 8 (Magic) + 1 (Version) = 15
  modified[15] ^= 0x01;

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
});

test('7. INVALID: Modify 1 byte in public key within APP15', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);
  // PubKey starts at offset 2 + 4 + 8 + 1 + 8 + 2 = 25
  modified[30] ^= 0x01;

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
});

test('8. INVALID: Modify EXACTLY 1 byte inside 64-byte signature region within APP15', async () => {
  const { signedJpeg, app15Offset, pubKeyLen } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);

  // APP15 header: 4B (FF EF + 2B len)
  // Payload offsets: Magic(8) + Version(1) + Timestamp(8) + PubKeyLen(2) + PubKey(pubKeyLen) = 27 + pubKeyLen
  // Signature start offset in JPEG bytes: app15Offset + 4 + 27 + pubKeyLen
  const sigStartOffset = app15Offset + 4 + 8 + 1 + 8 + 2 + pubKeyLen;
  const sigTargetByte = sigStartOffset + 10; // Modify 11th byte of 64-byte signature

  modified[sigTargetByte] ^= 0xFF; // Flip bits in signature byte

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /暗号学的検証に失敗しました/);
});

test('9. INVALID: Remove APP15 segment completely', async () => {
  const { signedJpeg, app15Length } = await generateValidSpotLockJpeg();
  const withoutApp15 = Buffer.concat([
    Buffer.from(signedJpeg.subarray(0, 2)),
    Buffer.from(signedJpeg.subarray(2 + app15Length))
  ]);

  const res = await verifySpotLockJpeg(toArrayBuffer(withoutApp15));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /見つかりません/);
});

test('10. INVALID: Truncate APP15 segment midway', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const truncated = signedJpeg.subarray(0, 30);

  const res = await verifySpotLockJpeg(toArrayBuffer(truncated));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /切り詰め|見つかりません/);
});

test('11. INVALID: Invalid public key length in APP15 header', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);
  modified[23] = 0x00;
  modified[24] = 0x05;

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /計算長が一致しません/);
});

test('12. INVALID: Invalid APP15 segment length', async () => {
  const { signedJpeg } = await generateValidSpotLockJpeg();
  const modified = new Uint8Array(signedJpeg);
  modified[4] = 0xFF;
  modified[5] = 0xFF;

  const res = await verifySpotLockJpeg(toArrayBuffer(modified));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /切り詰めエラー/);
});

test('13. INVALID: Multiple SpotLock APP15 segments inserted', async () => {
  const { signedJpeg, app15Length } = await generateValidSpotLockJpeg();
  const app15Chunk = signedJpeg.subarray(2, 2 + app15Length);
  const multipleApp15 = Buffer.concat([
    Buffer.from(signedJpeg.subarray(0, 2 + app15Length)),
    Buffer.from(app15Chunk),
    Buffer.from(signedJpeg.subarray(2 + app15Length))
  ]);

  const res = await verifySpotLockJpeg(toArrayBuffer(multipleApp15));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /複数の SpotLock APP15/);
});

test('14. INVALID: Normal unsigned JPEG', async () => {
  const plainJpeg = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
  ]);
  const res = await verifySpotLockJpeg(toArrayBuffer(plainJpeg));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /見つかりません/);
});

test('15. INVALID: Non-JPEG file', async () => {
  const textFile = Buffer.from('Hello World Not A JPEG');
  const res = await verifySpotLockJpeg(toArrayBuffer(textFile));
  assert.equal(res.status, 'invalid');
  assert.match(res.reason, /JPEG形式のファイルではありません/);
});
