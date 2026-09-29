#!/usr/bin/env bash
# ==============================================================================
# LABORAPY & TOBI — INSTALADOR MAESTRO DE NODO GRANJERO CAPATAZ (UBUNTU SERVER)
# ==============================================================================
# Convierte tu laptop Ryzen 5 5500U en el GRANJERO DEDICADO 24/7:
# 1. Tapa cerrada sin suspenderse (HandleLidSwitch=ignore).
# 2. CLIProxyAPI (Capataz Linux x86_64) en puerto 8317 escuchando en 0.0.0.0.
# 3. Soporte para Cuentas Google / Granjero Josema (Gemini 3.7 Flash Pro).
# 4. Bridge de Inferencia permanente para el Web Chat de Tobi (CERO ALUCINACIÓN).
# 5. OpenCode Web Server 24/7 en puerto 4097.
# 6. Cockpit Web UI en puerto 9090 (panel visual de CPU, RAM y telemetría).
# 7. Cloudflared (túnel seguro para conectar Vercel con la laptop sin abrir puertos).
# ==============================================================================

set -euo pipefail

# Colores para salida de terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
==================================================================
   LABORAPY & TOBI — PROVISIONAMIENTO DE NODO GRANJERO (CAPATAZ)
   Hardware: AMD Ryzen 5500U · 8GB RAM · Bridge Inferencia 24/7
   Motor: Gemini 3.7 Flash Pro (Cuentas Granjero Josema)
==================================================================
EOF
echo -e "${NC}"

# Detectar usuario no-root
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)

echo -e "${YELLOW}[1/7] Optimizando laptop para operar con la TAPA CERRADA 24/7...${NC}"
sudo sed -i 's/^#*HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#*HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#*HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind || true
echo -e "${GREEN}✓ Configuración de tapa cerrada aplicada (nunca se suspende).${NC}"

echo -e "${YELLOW}[2/7] Actualizando repositorios e instalando paquetes esenciales...${NC}"
sudo apt update -y
sudo apt install -y curl wget git htop tmux ufw build-essential ffmpeg ca-certificates gnupg lsb-release jq
echo -e "${GREEN}✓ Paquetes esenciales instalados.${NC}"

echo -e "${YELLOW}[3/7] Instalando Cockpit (Panel Visual Web de Telemetría en puerto 9090)...${NC}"
sudo apt install -y cockpit cockpit-pcp
sudo systemctl enable --now cockpit.socket
echo -e "${GREEN}✓ Cockpit instalado y activo en https://<IP>:9090${NC}"

echo -e "${YELLOW}[4/7] Instalando CLIProxyAPI (Capataz Linux x86_64) para Granjero Josema...${NC}"
CAPATAZ_DIR="$TARGET_HOME/capataz"
mkdir -p "$CAPATAZ_DIR/auth"
mkdir -p "$CAPATAZ_DIR/bin"

# Descargar la última versión de CLIProxyAPI para Linux amd64
TMP_TAR="/tmp/cliproxyapi.tar.gz"
DOWNLOAD_URL=$(curl -s https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest | jq -r '.assets[] | select(.name | contains("linux") and contains("amd64") and (contains("no-plugin") | not)) | .browser_download_url' | head -n 1)

if [ -n "$DOWNLOAD_URL" ] && [ "$DOWNLOAD_URL" != "null" ]; then
  echo "Descargando CLIProxyAPI desde: $DOWNLOAD_URL..."
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_TAR"
  tar -xzf "$TMP_TAR" -C "$CAPATAZ_DIR/bin"
  chmod +x "$CAPATAZ_DIR/bin/cli-proxy-api" 2>/dev/null || chmod +x "$CAPATAZ_DIR/bin/"*
  sudo cp "$CAPATAZ_DIR/bin/cli-proxy-api" /usr/local/bin/cli-proxy-api 2>/dev/null || true
  rm -f "$TMP_TAR"
  echo -e "${GREEN}✓ Binario nativo de CLIProxyAPI instalado en /usr/local/bin/cli-proxy-api.${NC}"
else
  echo -e "${YELLOW}⚠️ No se pudo obtener release automático de GitHub. Se usará binario local si existe.${NC}"
fi

# Generar archivo de configuración config.yaml para el Granjero en Ubuntu
cat << 'CONFIG_EOF' > "$CAPATAZ_DIR/config.yaml"
# Capataz — Granjero Dedicado Ubuntu (Laptop Ryzen 5500U)
# Escucha en todas las interfaces (0.0.0.0) en el puerto 8317
host: "0.0.0.0"
port: 8317
remote-management:
  allow-remote: true
  secret-key: "cpa-mgmt-d84bdbdfa89c23fcbe0c90203b91f530e5c56314"
auth-dir: "./auth"
api-keys:
  - "cpa-nodo-b348c415de9419898e7bd43852592a4a4dd3c1db"
debug: false
logging-to-file: true
usage-statistics-enabled: true
request-retry: 3
max-retry-credentials: 0
max-retry-interval: 30
transient-error-cooldown-seconds: 600
quota-exceeded:
  switch-project: true
  switch-preview-model: true
  antigravity-credits: false
routing:
  strategy: "round-robin"
  session-affinity: true
  session-affinity-ttl: "1h"
  session-affinity-subagents: false
CONFIG_EOF

chown -R "$TARGET_USER:$TARGET_USER" "$CAPATAZ_DIR"

# Crear servicio systemd para que el Capataz viva 24/7 y reviva ante reinicios
cat << EOF | sudo tee /etc/systemd/system/capataz.service > /dev/null
[Unit]
Description=Capataz Granjero Inferencia 24/7 (Gemini 3.7 Flash)
After=network.target

[Service]
Type=simple
User=$TARGET_USER
WorkingDirectory=$CAPATAZ_DIR
ExecStart=/usr/local/bin/cli-proxy-api
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now capataz.service || true
echo -e "${GREEN}✓ Servicio Capataz Granjero activado en systemd (puerto 8317).${NC}"

# Script auxiliar para vincular cuentas de Google (OAuth) directamente en la laptop
cat << 'LOGIN_SCRIPT' > "$CAPATAZ_DIR/agregar-cuenta.sh"
#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Iniciando vinculación de cuenta Google en Granjero..."
/usr/local/bin/cli-proxy-api --add-account || /usr/local/bin/cli-proxy-api -a
LOGIN_SCRIPT
chmod +x "$CAPATAZ_DIR/agregar-cuenta.sh"
chown "$TARGET_USER:$TARGET_USER" "$CAPATAZ_DIR/agregar-cuenta.sh"

echo -e "${YELLOW}[5/7] Instalando OpenCode CLI y configurando OpenCode Server 24/7...${NC}"
curl -fsSL https://opencode.ai/install.sh | bash || true
sudo cp "$TARGET_HOME/.opencode/bin/opencode" /usr/local/bin/opencode 2>/dev/null || true

WORKSPACE_DIR="$TARGET_HOME/laborapy"
if [ ! -d "$WORKSPACE_DIR" ]; then
  git clone https://github.com/Diegon97/laborapy.git "$WORKSPACE_DIR"
  chown -R "$TARGET_USER:$TARGET_USER" "$WORKSPACE_DIR"
fi

cat << EOF | sudo tee /etc/systemd/system/opencode.service > /dev/null
[Unit]
Description=OpenCode Web Server 24/7 (LaboraPy Node)
After=network.target

[Service]
Type=simple
User=$TARGET_USER
WorkingDirectory=$WORKSPACE_DIR
ExecStart=/usr/local/bin/opencode serve --port 4097 --hostname 0.0.0.0
Restart=always
RestartSec=5
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$TARGET_HOME/.opencode/bin

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now opencode.service || true
echo -e "${GREEN}✓ OpenCode Web Server activo en puerto 4097.${NC}"

echo -e "${YELLOW}[6/7] Instalando Cloudflared (Túnel seguro para conectar Vercel sin abrir puertos)...${NC}"
if ! command -v cloudflared &> /dev/null; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
  sudo apt update -y && sudo apt install -y cloudflared || true
  echo -e "${GREEN}✓ Cloudflared instalado (listo para crear túnel seguro con 1 comando).${NC}"
fi

echo -e "${YELLOW}[7/7] Configurando Firewall UFW (puertos 22, 4097, 8317, 9090)...${NC}"
sudo ufw allow 22/tcp comment 'SSH' || true
sudo ufw allow 4097/tcp comment 'OpenCode Web' || true
sudo ufw allow 8317/tcp comment 'Granjero Capataz Inferencia' || true
sudo ufw allow 9090/tcp comment 'Cockpit Web Dashboard' || true
sudo ufw --force enable || true
echo -e "${GREEN}✓ Firewall configurado.${NC}"

# Obtener IP local
LOCAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n 1 || echo "IP_DE_TU_LAPTOP")

echo -e "\n${BLUE}==================================================================${NC}"
echo -e "${GREEN}   ¡GRANJERO CAPATAZ DE TOBI CONFIGURADO EXITOSAMENTE!${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo -e "Tu laptop vieja es ahora el BRIDGE DE INFERENCIA permanente:"
echo -e ""
echo -e "🌾 1. Endpoint Granjero Inferencia (Gemini 3.7 Flash):"
echo -e "   👉 ${YELLOW}http://${LOCAL_IP}:8317/v1/chat/completions${NC}"
echo -e ""
echo -e "🔑 2. Cuentas de Granjero Josema (Copiar archivos de autenticación):"
echo -e "   Copia los archivos .json de tu PC desde 'C:\\Users\\dnunez.SWOOSH\\capataz\\auth\\*.json'"
echo -e "   a la carpeta '${CAPATAZ_DIR}/auth/' en esta laptop."
echo -e ""
echo -e "💻 3. OpenCode Web (Tu entorno de programación remoto):"
echo -e "   👉 ${YELLOW}http://${LOCAL_IP}:4097${NC}"
echo -e ""
echo -e "📊 4. Cockpit (Panel visual de CPU, RAM, Discos y Red):"
echo -e "   👉 ${YELLOW}https://${LOCAL_IP}:9090${NC}"
echo -e ""
echo -e "💤 5. Operación: ¡Podés CERRAR LA TAPA de la laptop y dejarla con el cable 24/7!"
echo -e "=================================================================="
