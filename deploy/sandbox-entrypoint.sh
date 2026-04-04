#!/bin/bash
set -e

# 1. Set SSH password from environment
if [ -n "$TDSK_SSH_PASSWORD" ]; then
  echo "sandbox:$TDSK_SSH_PASSWORD" | chpasswd
fi

# 2. Start SSH server (background daemon)
/usr/sbin/sshd -p 2222 -e

# 3. Configure git auth token if provided (placeholder replaced by egress proxy)
if [ -n "$TDSK_GIT_TOKEN" ]; then
  git config --system http.extraHeader "Authorization: Bearer $TDSK_GIT_TOKEN"
fi

# 4. Clone git repo if configured (goes through egress proxy for placeholder replacement)
if [ -n "$TDSK_GIT_REPO" ]; then
  BRANCH="${TDSK_GIT_BRANCH:-main}"
  echo "[sandbox-entrypoint] Cloning $TDSK_GIT_REPO (branch: $BRANCH) into /workspace..."
  if ! su -s /bin/bash sandbox -c 'exec git clone --branch "$0" "$1" /workspace' "$BRANCH" "$TDSK_GIT_REPO" 2>&1; then
    echo "[sandbox-entrypoint] WARNING: git clone failed. /workspace may be empty."
  fi
fi

# 5. Execute the container command (AI tool or sleep infinity)
exec "$@"
