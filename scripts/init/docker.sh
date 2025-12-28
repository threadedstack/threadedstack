#!/bin/bash

tdsk_remove_local_docker(){
  rm -rf ~/Library/Group\ Containers/group.com.docker
  rm -rf ~/Library/Containers/com.docker.docker
  rm -rf ~/.docker
  rm -rf ~/Library/Application\ Support/com.docker.docker
  rm -rf ~/Library/Application\ Support/Docker\ Desktop
  rm -rf /usr/local/bin/docker
}

# Download the docker.dmg from the docker site
tdsk_mac_download_install_docker(){
  if [[ ! -f "$TDSK_DOCKER_DMG_PATH" ]]; then
    tdsk_info "Downloading docker.dmg ($TDSK_DOCKER_DMG_PATH) ..."
    # Ensure the temp directory exists before downloading docker
    mkdir -p $TDSK_TMP_DIR
    curl -# -L -o $TDSK_DOCKER_DMG_PATH $TDSK_DOCKER_DL_MAC_URL
  fi
}

# Mound the docker volume, and get it's name
tdsk_mac_mount_docker_volume(){
  if [[ ! -f "$TDSK_DOCKER_DMG_PATH" ]]; then
    tdsk_error "Error downloading docker-desktop.\n\t Please download and install manually from $TDSK_DOCKER_DL_MAC_URL"
    exit 1
  fi

  tdsk_message "Mounting docker.dmg ..."
  TDSK_DOCKER_VOL=`hdiutil mount $TDSK_DOCKER_DMG_PATH | tail -n1 | perl -nle '/(\/Volumes\/[^ ]+)/; print $1'`
  
  if [[ -z "$TDSK_DOCKER_VOL" ]]; then
    tdsk_error "Could not find the docker volume name!"
    exit 1
  else
    tdsk_message "Docker.dmg mounted ($TDSK_DOCKER_VOL)"
  fi
}

# Copy the contents of the docker volume app into the /Applications directory
tdsk_mac_copy_docker_app(){
  tdsk_message "Installing docker ..."
  local TDSK_DOCKER_PATH="$TDSK_DOCKER_VOL/$TDSK_DOCKER_APP"
  local TDSK_DOCKER_APP_PATH="$TDSK_APPLICATIONS/$TDSK_DOCKER_APP"

  yes | cp -ir $TDSK_DOCKER_PATH $TDSK_DOCKER_APP_PATH

  if [[ -d "$TDSK_DOCKER_APP_PATH" ]]; then
    tdsk_message "Starting docker desktop ..."
    open -a "$TDSK_DOCKER_APP_PATH"
  else
    tdsk_error "Could not find the docker app in the volume $TDSK_DOCKER_VOL!"
  fi
}

# Remove the mounted docker volume and downloded docker.dmg file
tdsk_mac_unmount_docker_volume(){
  tdsk_message "Cleaning up temp files ..."
  hdiutil unmount $TDSK_DOCKER_VOL -quiet
  rm $TDSK_DOCKER_DMG_PATH
}

# Checks if docker-for-desktop app is already installed
tdsk_check_docker_app(){

  # Check if docker already exists, and return if it does
  if [[ -x "$(command -v docker -v 2>/dev/null)" ]]; then
    tdsk_message "Docker already installed, skipping"
    return
  fi

  local TDSK_DOCKER_APP_PATH="$TDSK_APPLICATIONS/$TDSK_DOCKER_APP"
  if [[ -d "$TDSK_DOCKER_APP_PATH" ]]; then
    tdsk_info "Starting docker desktop ..."
    open -a "$TDSK_DOCKER_APP_PATH"
    return
  fi

  # Get the os to know which url to use
  local TDSK_OS_TYPE=$(uname)
  if [[ "$TDSK_OS_TYPE" == "Darwin" ]]; then
    # Download the docker dmg and install the docker desktop app
    tdsk_mac_download_install_docker
    tdsk_mac_mount_docker_volume
    tdsk_mac_copy_docker_app

    # Clean up after installing
    tdsk_mac_unmount_docker_volume

    # Set a flag so we know docker-desktop was downloaded
    export DOCKER_DOWNLOADED=1
  else
    tdsk_error "Downloading docker-desktop is only supported on a Mac OS.\n\t Please download docker manually"
    exit 1
  fi
}
