#!/usr/bin/env bash
set -euo pipefail

mkdir -p .factory/tmp

if [ -f "./gradlew" ]; then
  chmod +x ./gradlew
fi
