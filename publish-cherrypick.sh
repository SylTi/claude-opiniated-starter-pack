#!/usr/bin/env bash
# publish-cherrypick.sh
# Usage: ./publish-cherrypick.sh <commit-sha>
#
# Assumes:
# - public remote is named "public" and push is disabled via:
#     git remote set-url --push public DISABLED
# - OSS branch is "public-main"
# - public repo target branch is "main"
#
# Override with env vars:
#   PUBLIC_REMOTE=public PUBLIC_BRANCH=public-main PUBLIC_TARGET_BRANCH=main ./publish-cherrypick.sh <sha>

# If someone sources this in zsh by mistake, fail with a clear message.
if [ -z "${BASH_VERSION:-}" ]; then
  echo "Please run this script with bash: bash $0 <commit-sha>" >&2
  return 2 2>/dev/null || exit 2
fi

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <commit-sha>" >&2
  exit 1
fi

COMMIT="$1"
PUBLIC_REMOTE="${PUBLIC_REMOTE:-public}"
PUBLIC_BRANCH="${PUBLIC_BRANCH:-public-main}"
PUBLIC_TARGET_BRANCH="${PUBLIC_TARGET_BRANCH:-main}"

# Ensure commit exists
git rev-parse --verify "${COMMIT}^{commit}" >/dev/null

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree not clean. Commit or stash first." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ORIG_PUSH_URL="$(git remote get-url --push "$PUBLIC_REMOTE" 2>/dev/null || true)"
FETCH_URL="$(git remote get-url "$PUBLIC_REMOTE")"

cleanup() {
  # Restore push URL (usually DISABLED) and return to original branch
  if [[ -n "${ORIG_PUSH_URL}" ]]; then
    git remote set-url --push "$PUBLIC_REMOTE" "$ORIG_PUSH_URL" >/dev/null 2>&1 || true
  else
    git remote set-url --push "$PUBLIC_REMOTE" DISABLED >/dev/null 2>&1 || true
  fi
  git switch -q "$CURRENT_BRANCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Switch to public branch and sync it with public/main
git switch "$PUBLIC_BRANCH"
git pull --ff-only "$PUBLIC_REMOTE" "$PUBLIC_TARGET_BRANCH"

# Cherry-pick the commit onto public branch
git cherry-pick -x "$COMMIT"

# Temporarily enable push, push to public/main, then disable push again
git remote set-url --push "$PUBLIC_REMOTE" "$FETCH_URL"
git push "$PUBLIC_REMOTE" HEAD:"$PUBLIC_TARGET_BRANCH"
git remote set-url --push "$PUBLIC_REMOTE" DISABLED

echo "Done: cherry-picked ${COMMIT} onto ${PUBLIC_BRANCH} and pushed to ${PUBLIC_REMOTE}/${PUBLIC_TARGET_BRANCH}."
echo "Returned to branch: ${CURRENT_BRANCH}"
