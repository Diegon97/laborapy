#!/usr/bin/env bash
# ==============================================================================
# LABORAPY & TOBI — INSTALADOR MAESTRO DE NODO BÚNKER (UBUNTU SERVER 24.04 LTS)
# ==============================================================================
# Convierte tu laptop Ryzen 5 5500U en un servidor de desarrollo 24/7 con:
# 1. Tapa cerrada sin suspenderse (HandleLidSwitch=ignore).
# 2. OpenCode Web Server 24/7 en puerto 4097 (igual que en tu PC/celular).
# 3. Cockpit Web UI en puerto 9090 (panel visual de CPU, RAM, discos y Docker).
# 4. Docker & Docker Compose oficiales.
# 5. Node.js 22 LTS + npm + pnpm + pm2.
# 6. Ollama + nomic-embed-text en puerto 11434 para embeddings de Tobi.
# 7. FFmpeg para procesamiento y transcripción de audios de TikTok/jurisprudencia.
# 8. Repositorio LaboraPy clonado y listo para desarrollar.
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
   LABORAPY & TOBI — PROVISIONAMIENTO DE NODO SERVIDOR UBUNTU
   Hardware: AMD Ryzen 5500U · 8GB RAM · Búnker 24/7
==================================================================
EOF
echo -e "${NC}"

# Detectar usuario no-root
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)

echo -e "${YELLOW}[1/8] Optimizando laptop para operar con la TAPA CERRADA 24/7...${NC}"
sudo sed -i 's/^#*HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#*HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#*HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind || true
echo -e "${GREEN}✓ Configuración de tapa cerrada aplicada.${NC}"

echo -e "${YELLOW}[2/8] Actualizando repositorios e instalando paquetes esenciales...${NC}"
sudo apt update -y
sudo apt install -y curl wget git htop tmux ufw build-essential ffmpeg ca-certificates gnupg lsb-release jq
echo -e "${GREEN}✓ Paquetes esenciales instalados.${NC}"

echo -e "${YELLOW}[3/8] Instalando Cockpit (Panel Visual Web de Telemetría en puerto 9090)...${NC}"
sudo apt install -y cockpit cockpit-pcp
sudo systemctl enable --now cockpit.socket
echo -e "${GREEN}✓ Cockpit instalado y activo en https://<IP>:9090${NC}"

echo -e "${YELLOW}[4/8] Instalando Docker Engine y Docker Compose oficiales...${NC}"
if ! command -v docker &> /dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt update -y
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$TARGET_USER" || true
  echo -e "${GREEN}✓ Docker instalado correctamente.${NC}"
else
  echo -e "${GREEN}✓ Docker ya estaba instalado.${NC}"
fi

echo -e "${YELLOW}[5/8] Instalando Node.js 22 LTS y herramientas de desarrollo...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
  sudo npm install -g pnpm pm2
  echo -e "${GREEN}✓ Node.js $(node -v) y pnpm instalados.${NC}"
else
  echo -e "${GREEN}✓ Node.js $(node -v) ya disponible.${NC}"
fi

echo -e "${YELLOW}[6/8] Instalando Ollama y modelo nomic-embed-text para Tobi...${NC}"
if ! command -v ollama &> /dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

# Configurar Ollama para escuchar en todas las interfaces de red (0.0.0.0:11434)
sudo mkdir -p /etc/systemd/system/ollama.service.d
cat << 'OLLAMA_CONF' | sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
OLLAMA_CONF
sudo systemctl daemon-reload
sudo systemctl restart ollama
echo "Descargando modelo de embeddings nomic-embed-text..."
ollama pull nomic-embed-text || true
echo -e "${GREEN}✓ Ollama y nomic-embed-text listos en puerto 11434.${NC}"

echo -e "${YELLOW}[7/8] Instalando OpenCode CLI y configurando OpenCode Server 24/7...${NC}"
curl -fsSL https://opencode.ai/install.sh | bash || true
sudo cp "$TARGET_HOME/.opencode/bin/opencode" /usr/local/bin/opencode 2>/dev/null || true

# Clonar LaboraPy en el home del usuario
WORKSPACE_DIR="$TARGET_HOME/laborapy"
if [ ! -d "$WORKSPACE_DIR" ]; then
  echo "Clonando repositorio LaboraPy en $WORKSPACE_DIR..."
  git clone https://github.com/Diegon97/laborapy.git "$WORKSPACE_DIR"
  chown -R "$TARGET_USER:$TARGET_USER" "$WORKSPACE_DIR"
fi

# Crear servicio systemd para OpenCode Server
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
sudo systemctl enable --now opencode.service
echo -e "${GREEN}✓ OpenCode Web Server activo como servicio 24/7 en puerto 4097.${NC}"

echo -e "${YELLOW}[8/8] Configurando Firewall UFW (puertos 22, 4097, 9090, 11434, 5173)...${NC}"
sudo ufw allow 22/tcp comment 'SSH' || true
sudo ufw allow 4097/tcp comment 'OpenCode Web' || true
sudo ufw allow 9090/tcp comment 'Cockpit Web Dashboard' || true
sudo ufw allow 11434/tcp comment 'Ollama IA' || true
sudo ufw allow 5173/tcp comment 'Vite Dev Server' || true
sudo ufw --force enable || true
echo -e "${GREEN}✓ Firewall configurado.${NC}"

# Obtener IP local
LOCAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n 1 || echo "IP_DE_TU_LAPTOP")

echo -e "\n${BLUE}==================================================================${NC}"
echo -e "${GREEN}   ¡NODO BÚNKER DE TOBI Y OPENCODE CONFIGURADO EXITOSAMENTE!${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo -e "Tu laptop ya es un servidor independiente 24/7 en tu red local:"
echo -e ""
echo -e "💻 1. OpenCode Web (Tu entorno de programación remoto):"
echo -e "   👉 ${YELLOW}http://${LOCAL_IP}:4097${NC}"
echo -e ""
echo -e "📊 2. Cockpit (Panel visual de CPU, RAM, Discos y Docker):"
echo -e "   👉 ${YELLOW}https://${LOCAL_IP}:9090${NC}"
echo -e "   (Usuario y contraseña de tu usuario de Ubuntu)"
echo -e ""
echo -e "🧠 3. Ollama IA (Embeddings y modelos locales para Tobi):"
echo -e "   👉 ${YELLOW}http://${LOCAL_IP}:11434${NC}"
echo -e ""
echo -e "📁 4. Directorio de Trabajo:"
echo -e "   ${WORKSPACE_DIR}"
echo -e ""
echo -e "💤 5. Operación: ¡Podés CERRAR LA TAPA de la laptop con tranquilidad!"
echo -e "=================================================================="
