"""
Downloads the faster-whisper large-v2 model to models/large-v2/
Run once before starting the server.

  Mac/Linux:  python scripts/download_model.py
  Windows:    python scriptsdownload_model.py
"""

import os
import sys

ROOT       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR  = os.path.join(ROOT, "models", "large-v2")

print(f"\nDownloading faster-whisper large-v2 → {MODEL_DIR}\n")

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("ERROR: huggingface_hub not installed.")
    print("Run:  pip install huggingface_hub")
    sys.exit(1)

os.makedirs(MODEL_DIR, exist_ok=True)

snapshot_download(
    repo_id="Systran/faster-whisper-large-v2",
    local_dir=MODEL_DIR,
)

print(f"\nDone — model saved to: {MODEL_DIR}\n")
