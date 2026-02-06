#!/bin/bash


set -e
trap 'printf "\nFinished with exit code $?\n\n"' EXIT


# Download the key from the database
tdsk_download(){

  # Ensure this ENVs are set in your environment
  url=$TDSK_DB_URL
  name=$TDSK_DB_NAME
  user=$TDSK_DB_USER
  pass=$TDSK_DB_PASS
  # Default params are for neon db
  params=${TDSK_DB_PARAMS:-"sslmode=require&channel_binding=require"}

  # Fully built URL
  db_url="postgresql://$user:$pass@$url/$name?$params"

  psql $db_url -A -t -c "SELECT value FROM caddy_certmagic_objects WHERE name='root.crt'" | cut -c 3- | xxd -r -p > root.crt
  psql $db_url -A -t -c "SELECT value FROM caddy_certmagic_objects WHERE name='root.key'" | cut -c 3- | xxd -r -p > root.key
}


# Confirm the cert it valid
tdsk_validate(){
  openssl x509 -in root.crt -text -noout
}

# Add to local keychain
tdsk_store(){
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./root.crt
}


tdsk_download "$@"
tdsk_validate "$@"
tdsk_store "$@"