#!/bin/bash

# 1. Get the local Wi-Fi IP address (macOS specific)
IP_ADDRESS=$(ipconfig getifaddr en0)
PORT=3000

if [ -z "$IP_ADDRESS" ]; then
  echo "Error: Could not determine IP address. Ensure you are connected to Wi-Fi."
  exit 1
fi

# 2. Set necessary Environment Variables
# HOST: Binds to all interfaces so other computers can connect
export HOST=0.0.0.0
export PORT=$PORT

# VK_ALLOWED_ORIGINS: Required to bypass CORS/Origin checks from external devices
export VK_ALLOWED_ORIGINS="http://$IP_ADDRESS:$PORT"

echo "---------------------------------------------------"
echo "Starting Vibe Kanban..."
echo "Local Access:     http://localhost:$PORT"
echo "Network Access:   http://$IP_ADDRESS:$PORT"
echo "---------------------------------------------------"

# 3. Start the server
# Defaults to 'npx vibe-kanban' if no arguments are provided
if [ $# -eq 0 ]; then
  pnpm dlx vibe-kanban
else
  # Allows running custom commands like: ./expose_vibe.sh npm run dev
  exec "$@"
fi
