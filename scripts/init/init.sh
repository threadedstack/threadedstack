#! /usr/bin/env bash

#
# Checks and installs all needed software for running the tdsk application
# Location of tdsk repo can be overwritten by setting the $TDSK_ROOT_DIR env
#

# Exit when any command fails
set -e
trap 'printf "\nFinished with exit code $?\n\n"' EXIT

# Loads the environment needed to setup the host machine
tdsk_load_env(){

  # Ensure the tdsk root directory env is set
  if [[ -z "$TDSK_ROOT_DIR" ]]; then
    printf "\033[0;31m[TDSK]\033[0m - ENV \"TDSK_ROOT_DIR\" must point to the tdsk root directory\n"
    exit 1
  fi

  # Ensure the temp install directory exists
  export TDSK_TMP_DIR=$TDSK_ROOT_DIR/.tmp

  # Build the path to the scripts directory
  export TDSK_INIT_DIR="$TDSK_ROOT_DIR/scripts/init"

  # Load the envs from the .env file
  set -o allexport
  . $TDSK_INIT_DIR/.env >/dev/null 2>&1
  set +o allexport

  # Add the helper files
  . $TDSK_INIT_DIR/brew.sh
  . $TDSK_INIT_DIR/docker.sh
  . $TDSK_INIT_DIR/devspace.sh
  . $TDSK_INIT_DIR/node.sh
  . $TDSK_INIT_DIR/tdsk.sh
  . $TDSK_INIT_DIR/setup.sh
  . $TDSK_INIT_DIR/stdio.sh

}

# Setups of the host machine for development of the tdsk repo
tdsk_setup(){

  # Make sure we are in the tdsk root directory
  cd $TDSK_ROOT_DIR

  # Determin the setup type
  local SETUP_TYPE=$1

  if [[ "$SETUP_TYPE" ]]; then
    tdsk_message "Setup type is $SETUP_TYPE"
  else
    tdsk_message "Setup type is all"
  fi

  # Setup install brew and deps
  if [[ -z "$SETUP_TYPE" || "$SETUP_TYPE" == "brew" ]]; then
    tdsk_message "Checking brew installation ..."
    # Ensure brew exisists and is up to date
    tdsk_brew_check
    # Install all deps needed for the GB applications
    tdsk_install_brew_deps
  fi

  # # Setup and install docker desktop
  if [[ -z "$SETUP_TYPE" || "$SETUP_TYPE" == "docker" ]]; then
    tdsk_message "Checking docker configuration ..."
    tdsk_check_docker_app
  fi

  # Setup and install nvm plus node
  if [[ -z "$SETUP_TYPE" || "$SETUP_TYPE" == "node" ]]; then
    tdsk_message "Checking nvm, node configuration ..."
    tdsk_setup_nvm_node
    # Setup .npmrc with git token
    tdsk_message "Checking .npmrc file configuration ..."
    tdsk_setup_npmrc
  fi

  # Install and configure the tdsk git dependecies
  if [[ -z "$SETUP_TYPE" || "$SETUP_TYPE" == "repo" ]]; then
    tdsk_message "Checking tdsk repo setup ..."
    # Install node_modules for the tdsk repo
    tdsk_install_repo_deps
  fi

  # Install and configure devspace
  if [[ -z "$SETUP_TYPE" || "$SETUP_TYPE" == "devspace" ]]; then
    tdsk_message "Checking devspace setup ..."
    # Ensures devspace is installed
    tdsk_check_devspace_and_dependencies
    # Setup devspace for the host machine
    tdsk_setup_devspace
  fi

  # Run setup tasks to configure the environment
  if [[ -z "$SETUP_TYPE" || "$SETUP_TYPE" == "setup" ]]; then
    tdsk_message "Running setup tasks ..."
    # Runs setup tasks from the tasks folder
    tdsk_run_setup_tasks
  fi

  echo ""
  tdsk_message_green "[TDSK] -------------------------------- [TDSK]"
  echo "              Threaded Stack setup complete!"
  tdsk_message_green "[TDSK] -------------------------------- [TDSK]"
  echo ""

}

# Load the envs and helper scripts
tdsk_load_env "$@"

# Run setup of tdsk repo
tdsk_setup "$@"

# # Cleanup after the script is done
unset TDSK_TMP_DIR
unset TDSK_INIT_DIR
unset TDSK_GIT_TOKEN
