#!/bin/sh
export TDSK_EXISTING_VARS=$(printenv | sed '/_=/d' | awk -F= '{print $1}' | sed 's/^/\$/g' | paste -sd,)

if [ $NO_JS_TEMPLATE ]; then
  echo "Skipping JS template replace"
else
  echo "Running JS template replace..."
  cp $TDSK_JS_DIR/*.js /tmp
  for file in /tmp/*.js; do
    sed -i 's/"%%/"$/g' $file
    sed -i 's/%%//g' $file
    cat $file | envsubst $TDSK_EXISTING_VARS | tee $TDSK_JS_DIR/$(basename $file) >/dev/null
  done
  rm -rf /tmp/*.js
fi


# Generate the nginx config passing in the port the root folder path
envsubst '${TDSK_AD_PORT} ${TDSK_AD_ROOT_DIR}' < /etc/nginx/http.d/default.conf.template > /etc/nginx/http.d/default.conf

if [ $NGINX_LOG_STDIO ]; then
  ln -sf /dev/stdout /var/log/nginx/access.log
  ln -sf /dev/stderr /var/log/nginx/error.log
fi

# Run the passed in command
exec "$@"
