"""
Run this to verify everything is installed and the project structure is ready.
Works on Mac and Windows.

  Mac/Linux:  python important/check_setup.py
  Windows:    python important\check_setup.py
"""

import sys
import os
import platform
import importlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─────────────────────────────────────────────
REQUIRED_PYTHON = (3, 8)

REQUIRED_PACKAGES = [
    ("flask",          "flask"),
    ("faster_whisper", "faster-whisper"),
    ("werkzeug",       "werkzeug"),
    ("huggingface_hub","huggingface_hub"),
]

REQUIRED_STRUCTURE = [
    "app.py",
    "templates/index.html",
    "static/script.js",
    "static/style.css",
    "static/corrections.json",
]

REQUIRED_FOLDERS = [
    "models/large-v2",
    "static/audio",
]

REQUIRED_BINARIES = ["ffmpeg", "ffprobe"]
# ─────────────────────────────────────────────

OK   = "\033[92m  OK \033[0m"
FAIL = "\033[91m FAIL\033[0m"
WARN = "\033[93m WARN\033[0m"

def check(label, passed, hint=""):
    icon = OK if passed else FAIL
    print(f"  [{icon}]  {label}")
    if not passed and hint:
        print(f"          → {hint}")
    return passed

def check_warn(label, passed, hint=""):
    icon = OK if passed else WARN
    print(f"  [{icon}]  {label}")
    if not passed and hint:
        print(f"          → {hint}")

# ── Python version ────────────────────────────
print(f"\n{'─'*50}")
print(f"  Platform : {platform.system()} {platform.release()}")
print(f"  Python   : {sys.version.split()[0]}")
print(f"{'─'*50}\n")

errors = 0

print("[ Python version ]")
ok = sys.version_info >= REQUIRED_PYTHON
if not check(f"Python >= {REQUIRED_PYTHON[0]}.{REQUIRED_PYTHON[1]}", ok,
             f"Found {sys.version_info.major}.{sys.version_info.minor} — upgrade Python"):
    errors += 1

# ── Packages ──────────────────────────────────
print("\n[ Python packages ]")
for mod, pkg in REQUIRED_PACKAGES:
    try:
        importlib.import_module(mod)
        check(pkg, True)
    except ImportError:
        check(pkg, False, f"pip install {pkg}")
        errors += 1

# ── File structure ────────────────────────────
print("\n[ Project files ]")
for rel in REQUIRED_STRUCTURE:
    path = os.path.join(ROOT, rel.replace("/", os.sep))
    if not check(rel, os.path.isfile(path), f"Missing: {path}"):
        errors += 1

# ── Required folders ──────────────────────────
print("\n[ Folders ]")
for rel in REQUIRED_FOLDERS:
    path = os.path.join(ROOT, rel.replace("/", os.sep))
    exists = os.path.isdir(path)
    if rel == "models/large-v2":
        # check model files are present
        if exists:
            files = os.listdir(path)
            has_model = any(f.endswith((".bin", ".pt")) for f in files)
            if not check(f"{rel}  (model files)", has_model,
                         "Model not downloaded — run: python important/download_model.py"):
                errors += 1
        else:
            check(rel, False, "Folder missing — run: python important/download_model.py")
            errors += 1
    else:
        if not check(rel, exists, f"Create it: mkdir {path}"):
            os.makedirs(path, exist_ok=True)
            print(f"          → Created automatically.")

# ── External binaries ─────────────────────────
print("\n[ External tools ]")
import shutil
for binary in REQUIRED_BINARIES:
    path = shutil.which(binary)
    if not check(binary, path is not None,
                 "Mac: brew install ffmpeg  |  Windows: https://ffmpeg.org/download.html"):
        errors += 1

# ── Port availability ─────────────────────────
print("\n[ Network ]")
import socket
port = 5001
try:
    s = socket.socket()
    s.settimeout(0.5)
    result = s.connect_ex(("127.0.0.1", port))
    s.close()
    in_use = (result == 0)
    check_warn(f"Port {port}", not in_use,
               f"Port {port} is in use — the server may already be running, or another app is using it.")
except Exception:
    pass

# ── Summary ───────────────────────────────────
print(f"\n{'─'*50}")
if errors == 0:
    print("  \033[92mAll checks passed — ready to run!\033[0m")
    print(f"\n  Start server:  python app.py")
else:
    print(f"  \033[91m{errors} issue(s) found — fix them then re-run this script.\033[0m")
print(f"{'─'*50}\n")

sys.exit(0 if errors == 0 else 1)
