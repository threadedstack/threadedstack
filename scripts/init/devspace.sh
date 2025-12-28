#!/bin/bash

# Checks and installs devspace and dependencies
tdsk_check_devspace_and_dependencies(){
  # Check and install kubectl
  tdsk_brew_check_install "kubectl" "kubectl version --client"

  # Check and install helm
  tdsk_brew_check_install "helm" "helm version"

  # Check and install devspace
  DS_VERSION=${TDSK_DEVSPACE_VERSION:-6.3.14}
  tdsk_global_check_install "devspace@$DS_VERSION" "devspace -v"
  # Doing a check for the version will force the correct executabe to download
  devspace -v
}

# Sets up devspace for running the application in a kubernetes cluster
tdsk_setup_devspace(){
  devspace use namespace $TDSK_KUBE_NAMESPACE --kube-context $TDSK_KUBE_CONTEXT
}
