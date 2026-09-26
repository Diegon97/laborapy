import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function tobiLocalDevPlugin(): Plugin {
  return {
    name: 'tobi-local-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        for await (const chunk of req) {
          body += chunk
        }

        let parsed: any = {}
        try {
          parsed = JSON.parse(body)
        } catch {
          res.statusCode = 400
          res.end('Invalid JSON')
          return
        }

        const prompt = parsed.prompt || ''
        const history = Array.isArray(parsed.history)
          ? parsed.history
              .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && h.content)
              .map((h: any) => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: String(h.content),
              }))
          : []

        const mode = parsed.mode === 'deepthink' ? 'deepthink' : 'flash'
        const messages = [...history, { role: 'user', content: prompt }]

        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        })

        try {
          const upstream = await fetch('http://127.0.0.1:8319/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({
              model: mode,
              temperature: 0.1,
              stream: true,
              messages,
            }),
          })

          if (!upstream.ok || !upstream.body) {
            const vercelFallback = await fetch('https://calculadora-rrhh-py.vercel.app/api/assistant', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
              body,
            })
            if (vercelFallback.ok && vercelFallback.body) {
              const reader = vercelFallback.body.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(value)
              }
              res.end()
              return
            }
            res.write(`data: ${JSON.stringify({ type: 'error', text: 'Error upstream en nodo local y fallback' })}\n\n`)
            res.end()
            return
          }

          const reader = upstream.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === 'data: [DONE]') continue
              if (trimmed.startsWith('data:')) {
                try {
                  const data = JSON.parse(trimmed.slice(5).trim())
                  const delta = data.choices?.[0]?.delta?.content
                  if (delta) {
                    res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`)
                  }
                } catch {
                  // ignorar lineas intermedias
                }
              }
            }
          }

          res.write(`data: ${JSON.stringify({ type: 'done', provider: 'capataz-local', model: mode })}\n\n`)
          res.end()
        } catch (err: any) {
          try {
            const vercelFallback = await fetch('https://calculadora-rrhh-py.vercel.app/api/assistant', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
              body,
            })
            if (vercelFallback.ok && vercelFallback.body) {
              const reader = vercelFallback.body.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(value)
              }
              res.end()
              return
            }
          } catch {
            // ignorar
          }
          res.write(`data: ${JSON.stringify({ type: 'error', text: err?.message || 'Error de conexion' })}\n\n`)
          res.end()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tobiLocalDevPlugin()],
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
