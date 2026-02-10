#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

# Local plugin switching is centralized in plugins.config.ts.
TARGET_FILES=(
  "packages/config/plugins.config.ts"
)

ACTION="${1:-status}"

tracked_files=()
for file in "${TARGET_FILES[@]}"; do
  if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    tracked_files+=("$file")
  fi
done

if [[ ${#tracked_files[@]} -eq 0 ]]; then
  echo "No tracked plugin config files found."
  exit 0
fi

print_status() {
  echo "Plugin config skip-worktree status:"
  git ls-files -v -- "${tracked_files[@]}" | while IFS= read -r line; do
    flag="${line:0:1}"
    path="${line:2}"
    if [[ "$flag" == "S" ]]; then
      printf "  %-42s %s\n" "$path" "SKIP-WORKTREE"
    else
      printf "  %-42s %s\n" "$path" "TRACKED"
    fi
  done
}

case "$ACTION" in
  on|enable)
    git update-index --skip-worktree -- "${tracked_files[@]}"
    echo "Enabled skip-worktree for plugin config files."
    print_status
    echo
    echo "Note: run 'pnpm run plugins:local:off' before rebasing/pulling upstream config changes."
    ;;
  off|disable)
    git update-index --no-skip-worktree -- "${tracked_files[@]}"
    echo "Disabled skip-worktree for plugin config files."
    print_status
    ;;
  status)
    print_status
    ;;
  *)
    echo "Usage: $0 [on|off|status]"
    exit 1
    ;;
esac
