import os
import struct
import time
from PIL import Image

# 出力先ディレクトリ
output_dir = r"d:\dev\spotLock-camera\landing-page\public\samples"
os.makedirs(output_dir, exist_ok=True)

# ベース画像を取得（生成済みのデモ画像をJPEGに変換）
base_img_path = r"d:\dev\spotLock-camera\landing-page\public\images\spotlock_verifier_demo.png"
base_jpeg_path = os.path.join(output_dir, "base_temp.jpg")

im = Image.open(base_img_path)
im.convert("RGB").save(base_jpeg_path, "JPEG", quality=90)

with open(base_jpeg_path, "rb") as f:
    jpeg_bytes = bytearray(f.read())

# SOI (0xFFD8) の位置を確認
assert jpeg_bytes[0] == 0xFF and jpeg_bytes[1] == 0xD8, "Not a valid JPEG"

def build_app15_segment(timestamp_ms: int, is_corrupt_sig: bool = False) -> bytes:
    # 0xFFEF (2B), Length=83 (0x0053) (2B), "SPOTLOCK" (8B), Version=0x01 (1B), Timestamp Int64 (8B), Signature (64B)
    marker = b'\xFF\xEF'
    length = struct.pack('>H', 83)
    magic = b'SPOTLOCK'
    version = b'\x01'
    ts_bytes = struct.pack('>q', timestamp_ms)
    
    # 64-byte ECDSA Signature (R|S)
    if is_corrupt_sig:
        # 改ざんされた偽署名・不一致バイナリ
        sig = b'\x00' * 64
    else:
        # 有効な構造のダミー署名バイト列
        sig = bytes([ (i * 7 + 13) % 256 for i in range(64) ])
        
    return marker + length + magic + version + ts_bytes + sig

now_ms = int(time.time() * 1000)
# 90日前のタイムスタンプ (約100日前)
expired_ms = now_ms - (100 * 24 * 60 * 60 * 1000)

# 1. OK サンプル (実物バイナリAPP15入り)
app15_ok = build_app15_segment(now_ms, is_corrupt_sig=False)
jpeg_ok = jpeg_bytes[:2] + app15_ok + jpeg_bytes[2:]
with open(os.path.join(output_dir, "sample_ok.jpg"), "wb") as f:
    f.write(jpeg_ok)

# 2. NG サンプル (見た目は同じだが署名・ピクセル不一致)
app15_ng = build_app15_segment(now_ms, is_corrupt_sig=True)
jpeg_ng = jpeg_bytes[:2] + app15_ng + jpeg_bytes[2:]
# ピクセル領域を少し書き換え (改ざんバイナリ)
jpeg_ng[len(jpeg_ng)-50] ^= 0xFF
with open(os.path.join(output_dir, "sample_ng.jpg"), "wb") as f:
    f.write(jpeg_ng)

# 3. EXPIRED サンプル (見た目は同じだが90日超前の古いタイムスタンプ)
app15_expired = build_app15_segment(expired_ms, is_corrupt_sig=False)
jpeg_expired = jpeg_bytes[:2] + app15_expired + jpeg_bytes[2:]
with open(os.path.join(output_dir, "sample_expired.jpg"), "wb") as f:
    f.write(jpeg_expired)

# 一時ファイル削除
os.remove(base_jpeg_path)

print("Sample JPEGs successfully generated in samples/ directory!")
