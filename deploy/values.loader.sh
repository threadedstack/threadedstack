#!/usr/bin/env bash

#./values.loader.sh local -- printenv NODE_ENV

# --- Print usage information ---
usage() {
  echo "Usage: $0 [env1 env2 ...] -- <command> [args...]" >&2
  exit 1
}

# --- Verify that we have enough arguments ---
if [ "$1" == "help" ]; then
  usage
fi

# --- Separate environment arguments from the command ---
env_args=()
env_vars=()
cmd_args=()
yaml_files=()

while [[ "$#" -gt 0 ]]; do
  if [[ "$1" == "--" ]]; then
    shift
    break
  fi
  env_args+=("$1")
  shift
done

cmd_args=("$@")


get_yaml_file(){
  yaml="values.$1.yaml"
  yml="values.$1.yml"

  if [[ -z "${1}" ]]; then
    yaml="values.yaml"
    yml="values.yml"
  fi

  if [[ -f "$yaml" ]]; then
    yaml_files+=("$yaml")

  elif [[ -f "$yml" ]]; then
    yaml_files+=("$yml")

  else
    # If the file doesn't exist, we ignore it.
    echo "Note: $yaml not found, skipping." >&2
  fi
}


get_yaml_file
for env in "${env_args[@]}"; do
  get_yaml_file $env
done


for file in "${yaml_files[@]}"; do
  if [[ -f "$file" ]]; then
    while IFS='=' read -r key value; do
      # Optionally trim whitespace from key and value
      key=$(echo "$key" | xargs)
      value=$(echo "$value" | xargs)
      export "$key=$value"

    done < <(awk '
      BEGIN { in_env=0 }
      # When we see "env:" set flag and skip the line.
      /^env:/ { in_env=1; next }
      /^\s*#/ { next; } # Ignore commented lines
      # A non-indented line (or blank) means we are no longer in the env block.
      /^[^[:space:]]/ { in_env=0 }
      # While in the env block, process lines that look like "  KEY: value"
      in_env && /^[[:space:]]+[A-Za-z0-9_]+\s*:/ {
        sub(/^[ \t]+/, "", $0)
        split($0, parts, ":")
        key = parts[1]
        sub("^[^:]+:[ \t]*", "", $0)
        value = $0
        print key"="value
      }
    ' "$file")
  fi
done


exec "${cmd_args[@]}"