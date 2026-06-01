#!/usr/bin/env sh
set -u

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/../../.." && pwd)

if [ -f "$script_dir/env.sh" ]; then
  # shellcheck disable=SC1091
  . "$script_dir/env.sh"
fi

exec node "$repo_root/tools/case-recorder/src/onboard.mjs" --repo-root "$repo_root" "$@"
