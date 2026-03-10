#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/images"
if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp non installé. Installe webp pour générer du .webp (ex: brew install webp)."
  exit 0
fi
for file in *.jpg *.jpeg *.png; do
  [ -e "$file" ] || continue
  out="${file%.*}.webp"
  cwebp -q 78 "$file" -o "$out" >/dev/null
  echo "optimized: $file -> $out"
done
