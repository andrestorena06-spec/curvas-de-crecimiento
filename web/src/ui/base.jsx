import { useEffect, useRef, useState } from 'react'
import { Icono } from './iconos.jsx'

export const Campo = ({ label, children, ayuda, style }) => (
  <label className="campo" style={style}>
    <span>{label}{ayuda && <i data-tip={ayuda} style={{ marginLeft: 5, fontStyle: 'normal', color: 'var(--acento)' }}>ⓘ</i>}</span>
    {children}
  </label>
)

// Número con texto libre: acepta coma decimal y vacío
export function Num({ value, onChange, step = 'any', min, max, style, placeholder, ancho }) {
  const [txt, setTxt] = useState(value === '' || value === null || value === undefined || Number.isNaN(value) ? '' : String(value).replace('.', ','))
  const ultimo = useRef(value)
  useEffect(() => {
    if (value !== ultimo.current) { setTxt(value === '' || value === null || value === undefined || Number.isNaN(value) ? '' : String(value).replace('.', ',')); ultimo.current = value }
  }, [value])
  return (
    <input inputMode="decimal" value={txt} placeholder={placeholder} step={step} min={min} max={max} style={{ width: ancho, ...style }}
      onChange={(e) => {
        const t = e.target.value
        setTxt(t)
        const s = t.trim().replace(',', '.')
        if (s === '') { ultimo.current = ''; onChange(''); return }
        const n = Number(s)
        if (Number.isFinite(n)) { ultimo.current = n; onChange(n) }
      }} />
  )
}

// Tablas para cargar datos: las flechas mueven el cursor entre casillas y Enter baja a la fila siguiente
export function navegarTabla(e) {
  const k = e.key
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(k) || e.target.tagName !== 'INPUT') return
  const td = e.target.closest('td'), tr = td?.parentElement
  if (!tr) return
  const col = [...tr.children].indexOf(td)
  const conInput = (c) => c && c.querySelector('input')
  let destino = null
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    const paso = k === 'ArrowLeft' ? -1 : 1
    for (let j = col + paso; j >= 0 && j < tr.children.length && !destino; j += paso) if (conInput(tr.children[j])) destino = tr.children[j]
  } else {
    let f = k === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling
    while (f && !conInput(f.children[col])) f = k === 'ArrowUp' ? f.previousElementSibling : f.nextElementSibling
    destino = f?.children[col]
  }
  e.preventDefault()
  if (!destino) return
  const inp = destino.querySelector('input')
  inp.focus()
  inp.select()
}

export const Sel = ({ value, onChange, opciones, style }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={style}>
    {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
)

export const Check = ({ label, checked, onChange, ayuda }) => (
  <label className="check">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}{ayuda && <small>{ayuda}</small>}</span>
  </label>
)

export const Seg = ({ value, onChange, opciones }) => (
  <div className="seg">
    {opciones.map(([v, t]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{t}</button>)}
  </div>
)

export function Modal({ titulo, children, pie, onClose, ancho = 560 }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true">
        <header><b>{titulo}</b>{onClose && <button className="fantasma icono" aria-label="Cerrar" onClick={onClose}><Icono n="x" /></button>}</header>
        <div className="cuerpo">{children}</div>
        {pie && <footer>{pie}</footer>}
      </div>
    </div>
  )
}

export const Vacio = ({ titulo, children, accion }) => (
  <div className="vacio">
    {titulo && <b>{titulo}</b>}
    <div>{children}</div>
    {accion && <div style={{ marginTop: 14 }}>{accion}</div>}
  </div>
)

export const Encabezado = ({ titulo, sub, children }) => (
  <div className="encabezado">
    <div><h1>{titulo}</h1>{sub && <p className="sub">{sub}</p>}</div>
    {children && <div className="fila">{children}</div>}
  </div>
)

// Zona para soltar o elegir un archivo
export function ZonaCarga({ onArchivos, acepta, titulo = 'Elegí o soltá un archivo', texto, multiple = false, compacta = false }) {
  const ref = useRef()
  const [sobre, setSobre] = useState(false)
  return (
    <div className={`zona-carga ${sobre ? 'sobre' : ''}`} style={compacta ? { padding: 14 } : undefined}
      onClick={() => ref.current.click()} onDragOver={(e) => { e.preventDefault(); setSobre(true) }} onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); if (e.dataTransfer.files.length) onArchivos([...e.dataTransfer.files]) }}>
      <Icono n="subir" size={compacta ? 20 : 26} />
      <b>{titulo}</b>
      {texto && <small>{texto}</small>}
      <input ref={ref} type="file" hidden multiple={multiple} accept={acepta} onChange={(e) => { if (e.target.files.length) onArchivos([...e.target.files]); e.target.value = '' }} />
    </div>
  )
}

// Globo de ayuda global: cualquier elemento con data-tip muestra su texto (la primera línea en negrita)
export function Globo() {
  const [g, setG] = useState(null)
  useEffect(() => {
    const mover = (e) => {
      const el = e.target.closest?.('[data-tip]')
      if (!el || !el.dataset.tip) return setG(null)
      const x = Math.min(e.clientX + 14, window.innerWidth - 450)
      const y = e.clientY + 16 > window.innerHeight - 160 ? e.clientY - 120 : e.clientY + 16
      setG({ x, y, t: el.dataset.tip })
    }
    const salir = () => setG(null)
    window.addEventListener('mousemove', mover)
    window.addEventListener('scroll', salir, true)
    return () => { window.removeEventListener('mousemove', mover); window.removeEventListener('scroll', salir, true) }
  }, [])
  if (!g) return null
  const [t1, ...resto] = g.t.split('\n')
  return <div className="globo" style={{ left: g.x, top: g.y }}>{resto.length ? <><b>{t1}</b>{resto.join('\n')}</> : t1}</div>
}

// Íconos: juego propio en iconos.jsx
export { Icono } from './iconos.jsx'

