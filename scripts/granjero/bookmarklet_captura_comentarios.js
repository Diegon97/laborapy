/**
 * =============================================================================
 * EXTRACTOR DE COMENTARIOS 1-CLIC PARA NAVEGADOR (TIKTOK / INSTAGRAM / FACEBOOK)
 * =============================================================================
 * Instrucciones de uso en 10 segundos:
 * 1. Abrí en tu navegador (Chrome / Edge) el video o post del abogado laboralista:
 *    - TikTok: cualquier video de @yampeylaboral o @juanbernis
 *    - Instagram: cualquier Reel o post de @yampeylaboral o @juanbernis
 *    - Facebook: cualquier post de Yampey Laboral o Juan Bernis
 * 2. Presioná F12 en tu teclado (o clic derecho -> "Inspeccionar") y andá a la pestaña "Console" (Consola).
 * 3. Pegá este código entero y dale ENTER.
 * 4. El script scrolleará suavemente para cargar los comentarios y te descargará
 *    automáticamente un archivo "comentarios_raw.json" en tu carpeta de Descargas.
 * 5. Luego ejecutás en tu terminal:
 *    python scripts/granjero/cosechador_redes_py.py -f "C:\Users\...\Downloads\comentarios_raw.json" -p tiktok -a yampey
 * =============================================================================
 */

(async function cosecharComentariosRedes() {
  console.log("%c🌾 INICIANDO EXTRACTOR DE COMENTARIOS LABORAPY...", "color: #10b981; font-size: 16px; font-weight: bold;");

  const host = window.location.hostname;
  let plataforma = "desconocida";
  if (host.includes("tiktok.com")) plataforma = "tiktok";
  else if (host.includes("instagram.com")) plataforma = "instagram";
  else if (host.includes("facebook.com")) plataforma = "facebook";

  console.log(`📡 Plataforma detectada: ${plataforma.toUpperCase()}`);

  const comentarios = new Set();

  function extraerTextos() {
    let selectores = [];
    if (plataforma === "tiktok") {
      // Selectores estándar de comentarios de TikTok Web
      selectores = [
        '[data-e2e="comment-level-1"] [dir="auto"]',
        'p[data-e2e="comment-level-1"]',
        '.tiktok-q9aj5z-PCommentText',
        '[class*="PCommentText"]',
        '[class*="SpanCommentText"]'
      ];
    } else if (plataforma === "instagram") {
      // Selectores de comentarios de Instagram Web
      selectores = [
        'ul ul span[dir="auto"]',
        'div[role="button"] + div span[dir="auto"]',
        'li[role="menuitem"] span[dir="auto"]',
        'span._ap3a._aaco._aacu._aacx._aad7._aade'
      ];
    } else if (plataforma === "facebook") {
      // Selectores de comentarios de Facebook Web
      selectores = [
        'div[dir="auto"][style*="text-align"]',
        'div[lang] div[dir="auto"]',
        '.x11i5rnm.xat24cr.x1mh8g0r.x1vvkbs'
      ];
    }

    selectores.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const txt = el.innerText ? el.innerText.trim() : "";
        // Filtrar nombres de usuario cortos o tiempos ("hace 2 d", "Responder")
        if (txt.length >= 15 && !txt.startsWith("Responder") && !txt.includes("Ver traducción")) {
          comentarios.add(txt);
        }
      });
    });
  }

  // Scroll automático para forzar carga de comentarios
  console.log("⏳ Scrolleando para capturar comentarios... (esperá unos 10-15 segundos)");
  
  let intentos = 0;
  const maxIntentos = 15;

  const interval = setInterval(() => {
    extraerTextos();
    window.scrollBy(0, 800);
    
    // Si hay un contenedor de comentarios específico, scrollearlo
    const commentBox = document.querySelector('[class*="CommentListContainer"]') || 
                       document.querySelector('div[style*="overflow: hidden auto"]') ||
                       document.querySelector('div[role="dialog"]');
    if (commentBox) {
      commentBox.scrollTop += 800;
    }

    intentos++;
    console.log(`📊 Comentarios capturados hasta ahora: ${comentarios.size}`);

    if (intentos >= maxIntentos) {
      clearInterval(interval);
      finalizarDescarga();
    }
  }, 1200);

  function finalizarDescarga() {
    extraerTextos();
    const listado = Array.from(comentarios);
    console.log(`%c✓ ¡CAPTURA FINALIZADA! Total extraídos: ${listado.length}`, "color: #34d399; font-size: 14px; font-weight: bold;");

    if (listado.length === 0) {
      alert("No se encontraron comentarios visibles. Asegurate de tener abierta la sección de comentarios del video o post.");
      return;
    }

    const blob = new Blob([JSON.stringify(listado, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comentarios_${plataforma}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("%c📥 Archivo JSON descargado listo para pasar por cosechador_redes_py.py", "color: #60a5fa; font-size: 13px;");
  }
})();
