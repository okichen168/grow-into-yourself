#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running vinext build..."

# macOS does not ship GNU coreutils' `timeout`. A build is still safe to run
# without a wrapper locally; hosted environments may use GNU `timeout` or
# Homebrew's `gtimeout` when available.
if command -v timeout >/dev/null 2>&1; then
  timeout --signal=TERM --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" "${SITES_BUILD_TIMEOUT:-3m}" "${vinext}" build
elif command -v gtimeout >/dev/null 2>&1; then
  gtimeout --signal=TERM --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" "${SITES_BUILD_TIMEOUT:-3m}" "${vinext}" build
else
  "${vinext}" build
fi

"${script_dir}/validate-artifact.sh"
