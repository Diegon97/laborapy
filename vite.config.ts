import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Permite conexiones desde localhost, Wi-Fi y Tailscale
    port: 5173,
    strictPort: true,
    // Permite cualquier host de Tailscale o MagicDNS (ej: dnunez-m2, *.ts.net, IP 100.94.65.20)
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
