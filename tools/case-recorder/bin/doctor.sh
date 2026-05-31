#!/usr/bin/env sh
set -u

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/../../.." && pwd)
while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo-root)
      repo_root=$2
      shift 2
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

status=0

pass() {
  echo "[OK] $1: $2"
}

fail() {
  echo "[FAIL] $1: $2"
  status=1
}

is_windows_backed_path() {
  case "$1" in
    /mnt/[a-z]/*|/mnt/[A-Z]/*) return 0 ;;
    [a-zA-Z]:/*|[a-zA-Z]:\\*) return 0 ;;
    *) return 1 ;;
  esac
}

major_from_semver() {
  echo "$1" | sed -n 's/^v\{0,1\}\([0-9][0-9]*\).*/\1/p' | head -n 1
}

major_from_java() {
  version=$(echo "$1" | sed -n 's/.*version "\([^"]*\)".*/\1/p' | head -n 1)
  case "$version" in
    1.*) echo "$version" | cut -d. -f2 ;;
    *) echo "$version" | cut -d. -f1 ;;
  esac
}

check_tool() {
  label=$1
  command_name=$2
  minimum_major=$3
  version_args=$4
  parser=$5

  resolved=$(command -v "$command_name" 2>/dev/null || true)
  if [ -z "$resolved" ]; then
    fail "$label" "$command_name was not found on PATH"
    return
  fi

  if is_windows_backed_path "$resolved"; then
    fail "$label" "$command_name resolved to $resolved; install/use the WSL $command_name executable instead"
    return
  fi

  # shellcheck disable=SC2086
  version_text=$("$command_name" $version_args 2>&1)
  command_status=$?
  if [ "$command_status" -ne 0 ]; then
    fail "$label" "$command_name is present at $resolved but version check failed: $version_text"
    return
  fi

  version_summary=$(printf "%s" "$version_text" | sed -n '1p')

  case "$parser" in
    semver) major=$(major_from_semver "$version_text") ;;
    java) major=$(major_from_java "$version_text") ;;
    *) major="" ;;
  esac

  if [ -z "$major" ]; then
    fail "$label" "could not parse version from $version_text"
    return
  fi

  if [ "$minimum_major" -gt 0 ] && [ "$major" -lt "$minimum_major" ]; then
    fail "$label" "$command_name $major is too old; require $minimum_major+ at $resolved"
    return
  fi

  pass "$label" "$command_name $version_summary at $resolved"
}

echo "Case recorder preflight:"
check_tool "Node.js" "node" 20 "--version" "semver"
check_tool "npm" "npm" 0 "--version" "semver"
check_tool "Java" "java" 21 "-version" "java"

gradlew_path="$repo_root/gradlew"
if [ ! -f "$gradlew_path" ]; then
  fail "Gradle wrapper" "missing $gradlew_path"
elif [ ! -x "$gradlew_path" ]; then
  fail "Gradle wrapper" "$gradlew_path is not executable"
else
  pass "Gradle wrapper" "$gradlew_path is present and executable"
fi

exit "$status"
