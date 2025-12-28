#!/bin/bash

NO_COL='\033[0m'
WHITE_COL='\033[1;37m'
GREEN_COL='\033[0;32m'
RED_COL='\033[0;31m'
CYAN_COL='\033[0;36m'
PURPLE_COL='\033[0;35m'

# Prints an error message to the terminal in the color white
tdsk_message(){
  printf "${PURPLE_COL}[TDSK]${NO_COL} - $@\n"
}

# Prints a message to the terminal in all green
tdsk_message_green(){
  printf "${GREEN_COL}$@${NO_COL}\n"
}

# Prints an error message to the terminal in the color white
tdsk_info(){
  printf "${CYAN_COL}[TDSK]${NO_COL} - $@\n"
}

# Prints an success message to the terminal in the color green
tdsk_success(){
  printf "${GREEN_COL}[TDSK]${NO_COL} - $@\n"
}

# Prints an error message to the terminal in the color red
tdsk_error(){
  printf "\n${RED_COL}[TDSK] - $@${NO_COL}\n\n"
}

# Asks a question in the terminal
tdsk_question(){
  read -p "" INPUT;
  local ANSWER="${INPUT}"

  echo "$ANSWER"
}
