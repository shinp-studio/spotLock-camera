import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// 1. Generate real ECDSA P-256 KeyPair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256'
});
const spkiPubKey = publicKey.export({ type: 'spki', format: 'der' });

// 2. Create a realistic Sample JPEG image buffer
// SOI (FF D8) + APP0 (JFIF) + DQT + SOF0 + DHT + SOS + scan data + EOI (FF D9)
const sampleJpegBase = Buffer.from([
  0xFF, 0xD8,                                           // SOI
  0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, // APP0
  0xFF, 0xDB, 0x00, 0x43, 0x00,                         // DQT
  0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14,
  0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A,
  0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C,
  0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
  0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00, // SOF0 (16x16 px)
  0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, // DHT
  0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, // SOS
  0x7F, 0xFF, 0x00, 0x55, 0xAA, 0x33, 0xCC, 0x11, 0x88, 0x99, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, // Scan Data
  0xFF, 0xD9                                            // EOI
]);

const timestampMs = 1719736800000;
const timestampStr = timestampMs.toString();
const signedData = Buffer.concat([Buffer.from(timestampStr, 'utf-8'), sampleJpegBase]);

// Sign data
const signer = crypto.createSign('SHA256');
signer.update(signedData);
const derSig = signer.sign(privateKey);

// Convert DER to RAW 64B
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

const rawSig = derToRaw64(derSig);

// Construct APP15 Payload
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
  rawSig
]);

const segmentLength = payload.length + 2;
const app15Header = Buffer.alloc(4);
app15Header[0] = 0xFF;
app15Header[1] = 0xEF;
app15Header.writeUInt16BE(segmentLength, 2);

// Insert APP15 after SOI (offset 2)
const sampleOkJpeg = Buffer.concat([
  sampleJpegBase.subarray(0, 2),
  app15Header,
  payload,
  sampleJpegBase.subarray(2)
]);

// Create sample_ng.jpg by altering 1 byte in the image scan area AFTER the APP15 segment
const sampleNgJpeg = Buffer.from(sampleOkJpeg);
const alterIdx = 2 + app15Header.length + payload.length + 10;
sampleNgJpeg[alterIdx] ^= 0xFF; // Flip byte in scan data

// Write files
const samplesDir = path.join(process.cwd(), 'public', 'samples');
fs.writeFileSync(path.join(samplesDir, 'sample_ok.jpg'), sampleOkJpeg);
fs.writeFileSync(path.join(samplesDir, 'sample_ng.jpg'), sampleNgJpeg);

console.log('sample_ok.jpg and sample_ng.jpg successfully updated with v2 format.');
