// Copiar tablas con formato de publicación. Al copiar (Ctrl + C o menú) una selección que toca una tabla, en el
// portapapeles van:
//   · text/html: tabla de tres líneas (línea gruesa arriba y abajo, fina bajo el encabezado), Arial 10 pt, sin fondos ni
//     colores, números alineados a la derecha y sin cortes de línea; una línea fina separa los grupos (cada cepa).
//     Word, PowerPoint y Google Docs la pegan así.
//   · text/plain: las mismas celdas separadas por tabulaciones (Excel).
// Entran el encabezado y las filas que toca la selección. Las columnas vacías (botones, casillas) no se copian.
// Las tablas de carga con selección de celdas (ui/planilla.js) manejan su propia copia y esta no interviene.

const valor = (td) => {
  const i = td.querySelector('input, select')
  if (i) return i.tagName === 'SELECT' ? (i.selectedOptions[0]?.text || '') : i.type === 'checkbox' ? (i.checked ? 'Sí' : 'No') : i.value || ''
  return (td.innerText || '').replace(/\s+/g, ' ').trim()
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const esNumero = (s) => /^[±−\-–+]?\s*[\d(]/.test(s) || /^[\d,.]+\s*[–-]\s*[\d,.]/.test(s) || /^(n\s*[<≥]|[–—]$)/.test(s)

function tablaPublicacion(tabla, sel) {
  const cab = [...(tabla.tHead?.rows || [])].filter((tr) => tr.cells.length)
  const cuerpo = [...(tabla.tBodies[0]?.rows || [])].filter((tr) => sel.containsNode(tr, true))
  if (!cuerpo.length) return null
  const filas = [...cab, ...cuerpo].map((tr) => [...tr.cells].map((c) => ({ t: valor(c), span: c.colSpan || 1, th: c.tagName === 'TH' })))
  // columnas vacías en todas las filas del cuerpo y del encabezado: fuera (botones, casillas, íconos)
  const nCol = Math.max(...filas.map((f) => f.reduce((s, c) => s + c.span, 0)))
  const usada = Array(nCol).fill(false)
  filas.forEach((f) => { let k = 0; f.forEach((c) => { if (c.t && c.span === 1) usada[k] = true; k += c.span }) })
  const limpia = filas.map((f) => { let k = 0; return f.filter((c) => { const ok = c.span > 1 || usada[k]; k += c.span; return ok }) })
  const nCab = cab.length
  const borde = (w) => `${w}pt solid #000`
  const celda = (c, i, j, nueva) => {
    const enCab = i < nCab, ultima = i === limpia.length - 1
    const num = !enCab && j > 0 && esNumero(c.t)
    const st = [
      'font-family:Arial,Helvetica,sans-serif', 'font-size:10pt', 'color:#000', 'background:transparent', 'white-space:nowrap',
      'padding:2pt 8pt', `text-align:${enCab ? (j > 0 ? 'right' : 'left') : num ? 'right' : 'left'}`, 'vertical-align:bottom',
      `font-weight:${enCab ? 'normal' : 'normal'}`,
      i === 0 ? `border-top:${borde(1.5)}` : nueva ? `border-top:${borde(0.5)}` : 'border-top:none',
      enCab && i === nCab - 1 ? `border-bottom:${borde(0.75)}` : ultima ? `border-bottom:${borde(1.5)}` : 'border-bottom:none',
      'border-left:none', 'border-right:none',
    ].join(';')
    const tag = enCab ? 'th' : 'td'
    return `<${tag}${c.span > 1 ? ` colspan="${c.span}"` : ''} style="${st}">${esc(c.t)}</${tag}>`
  }
  // grupos: una línea fina cuando cambia la primera columna (cada cepa)
  let previo = null
  const html = limpia.map((f, i) => {
    const primero = f[0]?.t || ''
    const nueva = i > nCab && primero && previo !== null && primero !== previo
    if (i >= nCab) previo = primero
    return `<tr>${f.map((c, j) => celda(c, i, j, nueva)).join('')}</tr>`
  }).join('')
  const tsv = limpia.map((f) => f.map((c) => c.t).join('\t')).join('\r\n')
  return { html: `<table style="border-collapse:collapse;border:none;margin:0">${html}</table>`, tsv }
}

export function activarCopiaTablas() {
  const copiar = (e) => {
    if (e.defaultPrevented) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
    const tablas = [...document.querySelectorAll('table.tabla')].filter((t) => sel.containsNode(t, true) && !t.closest('.no-copia'))
    if (!tablas.length) return
    const partes = tablas.map((t) => tablaPublicacion(t, sel)).filter(Boolean)
    if (!partes.length) return
    e.clipboardData.setData('text/html', `<html><body>${partes.map((p) => p.html).join('<p>&nbsp;</p>')}</body></html>`)
    e.clipboardData.setData('text/plain', partes.map((p) => p.tsv).join('\r\n\r\n'))
    e.preventDefault()
  }
  document.addEventListener('copy', copiar)
  const quitarBoton = botonCopiar()
  return () => { document.removeEventListener('copy', copiar); quitarBoton() }
}

// ---- botón «Copiar tabla» ----
// Un solo botón flotante (fuera de React, en el body) que aparece en la esquina superior derecha de la tabla sobre la
// que está el mouse. Copia la tabla entera con el mismo formato de publicación.
const todaLaTabla = { containsNode: () => true }
export async function copiarTablaCompleta(tabla) {
  const p = tablaPublicacion(tabla, todaLaTabla)
  if (!p) return false
  const html = `<html><body>${p.html}</body></html>`
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([p.tsv], { type: 'text/plain' }) })])
      return true
    }
  } catch { /* sin permiso: se intenta con el método viejo */ }
  // respaldo: un elemento temporal con la tabla, seleccionado y copiado con execCommand
  const caja = document.createElement('div')
  caja.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff'
  caja.innerHTML = p.html
  document.body.appendChild(caja)
  const r = document.createRange(); r.selectNodeContents(caja)
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r)
  const ok = document.execCommand('copy')
  s.removeAllRanges(); caja.remove()
  return ok
}

function botonCopiar() {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'boton-copiar-tabla no-imprimir'
  b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16V4h12"/><path d="M8 8h12v12H8z"/></svg><span>Copiar tabla</span>'
  b.title = 'Copia la tabla con formato de publicación (tres líneas, Arial 10) para pegar en Word, PowerPoint o Google Docs; en Excel llega como celdas'
  document.body.appendChild(b)
  let actual = null, ocultar = null
  const ubicar = () => {
    if (!actual || !document.body.contains(actual)) { b.classList.remove('visible'); actual = null; return }
    const marco = actual.closest('.tabla-scroll') || actual
    const r = marco.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) { b.classList.remove('visible'); return }
    b.classList.add('visible')   // primero visible: con display none el ancho es 0
    b.style.top = `${Math.max(4, r.top - 30)}px`
    b.style.left = `${Math.max(4, Math.min(window.innerWidth - b.offsetWidth - 8, r.right - b.offsetWidth))}px`
  }
  const sobre = (e) => {
    if (e.target === b || b.contains(e.target)) { clearTimeout(ocultar); return }
    const t = e.target.closest?.('table.tabla')
    if (t && !t.closest('.no-copia') && t.tBodies[0]?.rows.length) { clearTimeout(ocultar); if (t !== actual) { actual = t; b.querySelector('span').textContent = 'Copiar tabla' } ubicar(); return }
    if (actual) { clearTimeout(ocultar); ocultar = setTimeout(() => { b.classList.remove('visible'); actual = null }, 900) }
  }
  b.addEventListener('click', async () => {
    if (!actual) return
    const ok = await copiarTablaCompleta(actual)
    b.querySelector('span').textContent = ok ? 'Copiada' : 'No se pudo copiar'
    setTimeout(() => { b.querySelector('span').textContent = 'Copiar tabla' }, 1600)
  })
  const mover = () => { if (actual) ubicar() }
  document.addEventListener('mouseover', sobre)
  window.addEventListener('scroll', mover, true)
  window.addEventListener('resize', mover)
  return () => { document.removeEventListener('mouseover', sobre); window.removeEventListener('scroll', mover, true); window.removeEventListener('resize', mover); b.remove() }
}
