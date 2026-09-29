#!/usr/bin/env bash
set -euo pipefail

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
CAPATAZ_AUTH="$TARGET_HOME/capataz/auth"

echo "Instalando cuentas de Josema en el Granjero..."
mkdir -p "$CAPATAZ_AUTH"

TMP_ENC="/tmp/auth.enc"
TMP_TAR="/tmp/auth.tar"

curl -fsSL https://raw.githubusercontent.com/Diegon97/laborapy/master/scripts/auth.enc -o "$TMP_ENC"
openssl enc -d -aes-256-cbc -pbkdf2 -in "$TMP_ENC" -out "$TMP_TAR" -k "tobi123"
tar -xf "$TMP_TAR" -C "$CAPATAZ_AUTH"

rm -f "$TMP_ENC" "$TMP_TAR"
chown -R "$TARGET_USER:$TARGET_USER" "$TARGET_HOME/capataz"

sudo systemctl restart capataz || true

echo "======================================================="
echo " ✅ CUENTAS DE JOSEMA INSTALADAS Y CAPATAZ REINICIADO!"
echo " Total cuentas activas:"
ls -la "$CAPATAZ_AUTH"/*.json
echo "======================================================="
