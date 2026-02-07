#!/bin/sh
set +e  # Continue on errors

COLOR_BLUE="\033[0;94m"
COLOR_GREEN="\033[0;92m"
COLOR_RESET="\033[0m"

tdsk_proxy() {
  cd /tdsk/repos/proxy
  pnpm start 2>&1 &
}

tdsk_backend(){
  cd /tdsk/repos/backend
  pnpm start 2>&1 &
}

# If a sub-repo is defined only run that one repo
# Check if the process to run is defined, then run it
if [ "$TDSK_SUB_REPO" ]; then

  # Handle repo specific tasks as needed
  if [ "$TDSK_SUB_REPO" == "proxy" ]; then
    tdsk_proxy

  elif [ "$TDSK_SUB_REPO" == "backend" ]; then
    tdsk_backend


  else
    cd /tdsk/repos/$TDSK_SUB_REPO
    pnpm start >> /proc/1/fd/1 &
  fi

  # Tail /dev/null to keep the container running
  tail -f /dev/null && exit 0;

else
  # Set terminal prompt
  export PS1="\[${COLOR_BLUE}\]devspace\[${COLOR_RESET}\] ./\W \[${COLOR_BLUE}\]\\$\[${COLOR_RESET}\] "
  if [ -z "$BASH" ]; then export PS1="$ "; fi

  # Include project's bin/ folder in PATH
  export PATH="./bin:$PATH"

  # Open a new shell
  sh --norc
fi
