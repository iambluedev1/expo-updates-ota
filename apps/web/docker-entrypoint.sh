#!/bin/sh

find /app/dist -name "*.html" -exec \
  sed -i \
    -e "s|__VITE_SERVER_URL__|${VITE_SERVER_URL:-http://localhost:3000}|g" \
    -e "s|__VITE_DISABLE_REGISTER__|${VITE_DISABLE_REGISTER:-false}|g" \
    {} +

# Lancer serve
exec serve -s dist -l 8080 -n