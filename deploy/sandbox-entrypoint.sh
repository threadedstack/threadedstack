#!/bin/bash
set -e

# 1. Set SSH password from environment
if [ -n "$TDSK_SSH_PASSWORD" ]; then
  echo "sandbox:$TDSK_SSH_PASSWORD" | chpasswd
fi

# 1b. Decode base64 credential files (e.g. Google Vertex service account JSON)
for var in $(env | grep '^TDSK_CRED_FILE_' | cut -d= -f1); do
  target_var="${var#TDSK_CRED_FILE_}"
  target_path="${!target_var}"
  if [ -n "$target_path" ] && [ -n "${!var}" ]; then
    mkdir -p "$(dirname "$target_path")" 2>/dev/null || true
    if echo "${!var}" | base64 -d > "$target_path" 2>/dev/null; then
      chmod 600 "$target_path" 2>/dev/null || echo "[sandbox-entrypoint] WARNING: chmod failed for ${target_path}" >&2
    else
      echo "[sandbox-entrypoint] ERROR: Failed to base64-decode credentials for ${target_var}" >&2
    fi
    unset "$var"
  fi
done

# 2. Start SSH server (background daemon)
/usr/sbin/sshd -p 2222 -e

# 3. Clone git repos (indexed multi-repo format: TDSK_GIT_COUNT, TDSK_GIT_{i}_REPO, etc.)
GIT_COUNT="${TDSK_GIT_COUNT:-0}"
if [ "$GIT_COUNT" -gt 0 ] 2>/dev/null; then
  i=0
  while [ "$i" -lt "$GIT_COUNT" ]; do
    REPO_VAR="TDSK_GIT_${i}_REPO"
    BRANCH_VAR="TDSK_GIT_${i}_BRANCH"
    TOKEN_VAR="TDSK_GIT_${i}_TOKEN"
    REPO="${!REPO_VAR}"
    BRANCH="${!BRANCH_VAR:-main}"
    TOKEN="${!TOKEN_VAR}"

    if [ -n "$REPO" ]; then
      REPO_DIR="/workspace/$(basename "$REPO" .git)"
      if [ "$GIT_COUNT" -eq 1 ]; then
        REPO_DIR="/workspace"
      fi

      GIT_OPTS=""
      if [ -n "$TOKEN" ]; then
        GIT_OPTS="-c http.extraHeader='Authorization: Bearer $TOKEN'"
      fi

      echo "[sandbox-entrypoint] Cloning $REPO (branch: $BRANCH) into $REPO_DIR..."
      if [ -n "$TOKEN" ]; then
        if ! su -s /bin/bash sandbox -c "exec git -c http.extraHeader=\"Authorization: Bearer \$0\" clone --branch \"\$1\" \"\$2\" \"\$3\"" "$TOKEN" "$BRANCH" "$REPO" "$REPO_DIR" 2>&1; then
          echo "[sandbox-entrypoint] WARNING: git clone failed for $REPO"
        fi
      else
        if ! su -s /bin/bash sandbox -c 'exec git clone --branch "$0" "$1" "$2"' "$BRANCH" "$REPO" "$REPO_DIR" 2>&1; then
          echo "[sandbox-entrypoint] WARNING: git clone failed for $REPO"
        fi
      fi
    fi

    i=$((i + 1))
  done
fi

# 4. Execute the container command (AI tool or sleep infinity)
exec "$@"
