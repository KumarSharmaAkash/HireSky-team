#!/usr/bin/env bash
# Builds a fully self-contained local Whisper runtime (standalone Python +
# torch + openai-whisper + the "small" model weights) for bundling inside
# the packaged macOS app via electron-builder's `extraResources`.
#
# Run this ONCE per release (or whenever Python/torch/whisper versions
# change) on an Apple Silicon Mac — NOT on every build. The output is a
# multi-GB directory checked into `vendor/whisper-runtime/` (gitignored),
# which `npm run build:mac` then bundles into the .app.
#
# End users never run this script and never need Python installed — this
# is developer/CI-only build infrastructure.
set -euo pipefail

PYTHON_VERSION="3.13.0"
PBS_RELEASE_TAG="20241016"  # python-build-standalone release tag to pull from
PBS_ASSET="cpython-${PYTHON_VERSION}+${PBS_RELEASE_TAG}-aarch64-apple-darwin-install_only.tar.gz"
PBS_URL="https://github.com/indygreg/python-build-standalone/releases/download/${PBS_RELEASE_TAG}/${PBS_ASSET}"

TORCH_VERSION="2.14.0"
WHISPER_PACKAGE="openai-whisper"
WHISPER_MODEL="small"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/vendor/whisper-runtime/darwin-arm64"
SCRATCH_DIR="$(mktemp -d)"
trap 'rm -rf "${SCRATCH_DIR}"' EXIT

echo "== HireSky: building self-contained Whisper runtime (darwin-arm64) =="
echo "Output: ${OUT_DIR}"

if [ "$(uname -m)" != "arm64" ]; then
  echo "ERROR: this script must run on Apple Silicon (arm64) — got $(uname -m)." >&2
  exit 1
fi

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

echo "-- Downloading standalone Python ${PYTHON_VERSION} --"
curl -fL --progress-bar "${PBS_URL}" -o "${SCRATCH_DIR}/python.tar.gz"
tar -xzf "${SCRATCH_DIR}/python.tar.gz" -C "${SCRATCH_DIR}"
# python-build-standalone's install_only tarball extracts to a top-level
# "python/" directory containing bin/, lib/, include/, etc.
cp -R "${SCRATCH_DIR}/python/." "${OUT_DIR}/"

PYTHON_BIN="${OUT_DIR}/bin/python3"
if [ ! -x "${PYTHON_BIN}" ]; then
  echo "ERROR: expected python binary not found at ${PYTHON_BIN}" >&2
  exit 1
fi

echo "-- Installing pip, torch==${TORCH_VERSION}, ${WHISPER_PACKAGE} into the bundled interpreter --"
"${PYTHON_BIN}" -m pip install --upgrade pip --quiet
"${PYTHON_BIN}" -m pip install --quiet \
  "torch==${TORCH_VERSION}" \
  "${WHISPER_PACKAGE}"

echo "-- Pruning test/cache directories to reduce size --"
find "${OUT_DIR}" -type d \( -name "test" -o -name "tests" -o -name "__pycache__" \) -prune -exec rm -rf {} + 2>/dev/null || true

echo "-- Pre-fetching the '${WHISPER_MODEL}' model weights (bundled into the DMG, not downloaded by end users) --"
MODEL_DIR="${ROOT_DIR}/vendor/whisper-runtime/models"
mkdir -p "${MODEL_DIR}"
"${PYTHON_BIN}" -c "
import whisper
whisper.load_model('${WHISPER_MODEL}', download_root='${MODEL_DIR}')
print('Model downloaded to ${MODEL_DIR}')
"

echo "-- Verifying the bundled runtime actually works --"
"${PYTHON_BIN}" -c "import torch, whisper; print('torch', torch.__version__, '| whisper OK')"

SIZE=$(du -sh "${ROOT_DIR}/vendor/whisper-runtime" | cut -f1)
echo ""
echo "== Done. vendor/whisper-runtime is now ${SIZE} =="
echo "== Listing Mach-O binaries/libraries for the signing pipeline: =="
find "${OUT_DIR}" -type f \( -perm +111 -o -name "*.dylib" -o -name "*.so" \) | tee "${ROOT_DIR}/vendor/whisper-runtime/binaries-to-sign.txt" | wc -l
echo "(full list written to vendor/whisper-runtime/binaries-to-sign.txt)"
echo ""
echo "Next: run 'npm run build:mac' to bundle this into the .app via extraResources."
