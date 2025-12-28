#!/bin/bash

# Checks and installs a pnpm global package if needed via pnpm global add <package>
tdsk_global_check_install(){
  local CMD_CHECK="${@:2}"

  # Check and install the azure cli
  if [[ -x "$(command -v $CMD_CHECK 2>/dev/null)" ]]; then
    tdsk_message "The $1 package is already installed, skipping"
    return
  else
    tdsk_info "Installing $1 ..."
    pnpm global add $1
    tdsk_success "$1 installation complete"
    return
  fi
}

# Uses npm to install node_modeuls for the wb server repo
tdsk_install_repo_deps(){
  if [[ -x "$(command -v pnpm -v 2>/dev/null)" ]]; then
    tdsk_set_node_version
    tdsk_global_check_install "depcheck" "depcheck --version"

    # Check the root directory for node_modules 
    cd $TDSK_ROOT_DIR
    if [[ ! -d "$TDSK_ROOT_DIR/node_modules" ]]; then
      tdsk_message "Running \"pnpm setup\" for tdsk repo ..."
      pnpm install
    else
      tdsk_message "Repo \"tdsk/node_modules\" already installed, skipping"
    fi

  else
    tdsk_error "PNPM is not installed correctly.\n\t Please ensure \"pnpm\" is installed before running this command"
    printf "\t See the Yarn website for more information:\n\t ${CYAN_COL}https://pnpm.io/${NO_COL}\n"
    exit 1
  fi
}
