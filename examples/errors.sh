#!/usr/bin/env bash
# Errors go to stderr with exit code 1. No failure is silent.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

for f in data/with-errors/*; do
  echo "--- rdf read $f"
  rdf read "$f" > /dev/null
  echo "exit code: $?"
done
