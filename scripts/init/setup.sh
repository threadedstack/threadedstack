#!/bin/bash

# Ensures script is run from the tdsk root directory
tdsk_ensure_root() {
  # Ensure the tdsk root directory env is set
  if [ -z "$TDSK_ROOT_DIR" ]; then
    if [ -f "./tdskRoot.js" ]; then
      export TDSK_ROOT_DIR=$(pwd)
    else
      printf "\033[0;31m[TDSK]\033[0m - ENV \"TDSK_ROOT_DIR\" must point to the tdsk root directory\n"
      exit 1
    fi
  fi

  # Ensure we are in the tdsk-root dirctory
  cd $TDSK_ROOT_DIR

  if [ ! -f "./tdskRoot.js" ]; then
    printf "\033[0;31m[TDSK]\033[0m - ENV \"TDSK_ROOT_DIR\" must point to the tdsk root directory\n"
    exit 1
  fi
}

tdsk_print_config_message(){
  tdsk_info "Kubernetes is required to execute the setup tasks"
  tdsk_message "  - Please enable kubernetes from the docker-desktop ui"
  tdsk_message "  - Then run \"pnpm make setup\" from the projects root directory"
  echo ""
}

# Runs the setup tasks to ensure kuberentes is configured properly
tdsk_run_setup_tasks() {
  
  # If docker was just installed, we can't run the setup tasks
  # So print a message and return
  if [ "$DOCKER_DOWNLOADED" ]; then
    tdsk_print_config_message
    return
  fi

  tdsk_ensure_root


  # Setup the nginx ingress for the current namespace
  pnpm kube ingress

  # Setup kuberenetes secrets for docker user and password
  pnpm kube auth
}
