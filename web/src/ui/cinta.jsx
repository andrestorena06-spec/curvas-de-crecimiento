// Cinta de herramientas (estilo Office): cada vista «pone» sus grupos de botones en la cinta de arriba con <Cinta>.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icono } from './base.jsx'
import { ICONO_DE_SIMBOLO } from './iconos.jsx'

export const CintaCtx = createContext(null)

// Lo que se ponga dentro aparece en la cinta (portal al nodo de la cinta)
export function Cinta({ children }) {
  const nodo = useContext(CintaCtx)
  return nodo ? createPortal(children, nodo) : null
}

export const Grupo = ({ titulo, children }) => (
  <div className="cinta-grupo">
    <div className="cinta-items">{children}</div>
    {titulo && <div className="cinta-titulo">{titulo}</div>}
  </div>
)

// Botón grande con ícono y texto
export const BotonCinta = ({ icono, texto, onClick, activo, deshabilitado, tip, peligro, simbolo }) => (
  <button className={`cinta-boton ${activo ? 'on' : ''} ${peligro ? 'peligro' : ''}`} onClick={onClick} disabled={deshabilitado} data-tip={tip} aria-pressed={activo || undefined}>
    {simbolo && !ICONO_DE_SIMBOLO[simbolo] ? <span className="simbolo">{simbolo}</span> : <Icono n={ICONO_DE_SIMBOLO[simbolo] || icono} size={24} />}
    <span>{texto}</span>
  </button>
)

// Grupo de opciones excluyentes (como un selector segmentado)
export const OpcionesCinta = ({ valor, onChange, opciones }) => opciones.map(([v, texto, simbolo, icono, tip]) => (
  <BotonCinta key={v} simbolo={simbolo} icono={icono} texto={texto} activo={valor === v} onClick={() => onChange(v)} tip={tip} />
))

// Cierra una ventanita con un clic afuera o con Esc. ignorar(e): true si el clic no cuenta (por ejemplo, el botón que la abre).
export function useCerrarAfuera(abierto, refs, onClose, ignorar) {
  useEffect(() => {
    if (!abierto) return
    const abajo = (e) => {
      if (refs.some((r) => r.current?.contains(e.target))) return
      if (ignorar?.(e)) return
      onClose()
    }
    const tecla = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', abajo, true)
    window.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', abajo, true); window.removeEventListener('keydown', tecla) }
  }, [abierto, onClose]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Botón de la cinta que abre un menú debajo (para elegir varias cosas sin ocupar la cinta). Se cierra con un clic afuera.
export function MenuCinta({ icono, simbolo, texto, tip, activo, ancho = 320, children }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState(null)
  const boton = useRef(null), menu = useRef(null)
  const cerrar = useCallback(() => setAbierto(false), [])
  useCerrarAfuera(abierto, [boton, menu], cerrar)
  useLayoutEffect(() => {
    if (!abierto || !boton.current) return
    const f = () => { const r = boton.current.getBoundingClientRect(); const c = r.left + r.width / 2; setPos({ top: r.bottom + 4, centro: c, left: Math.max(8, c - ancho / 2) }) }
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [abierto, ancho])
  // el menú queda centrado bajo su botón (sin salirse de la ventana): se mide su ancho real después de dibujarlo
  useLayoutEffect(() => {
    if (!abierto || !pos || !menu.current) return
    const w = menu.current.offsetWidth
    const l = Math.round(Math.max(8, Math.min(pos.centro - w / 2, window.innerWidth - w - 8)))
    if (l !== pos.left) setPos({ ...pos, left: l })
  })
  return (
    <span ref={boton} className="menu-cinta-ancla">
      <BotonCinta icono={icono} simbolo={simbolo} texto={<>{texto}<span className="flechita">▾</span></>} tip={abierto ? undefined : tip} activo={abierto || activo} onClick={() => setAbierto(!abierto)} />
      {abierto && pos && createPortal(<div ref={menu} className="menu-cinta" style={{ top: pos.top, left: pos.left, width: 'max-content', maxWidth: ancho }} role="dialog" aria-label={typeof texto === 'string' ? texto : undefined}>{children}</div>, document.body)}
    </span>
  )
}
// Sección de un MenuCinta: título chico y su contenido (botones de opciones o campos)
export const SeccionMenu = ({ titulo, children }) => (
  <div className="menu-cinta-seccion">{titulo && <div className="menu-cinta-titulo">{titulo}</div>}<div className="menu-cinta-fila">{children}</div></div>
)

// Campo chico dentro de la cinta (número o lista)
export const CampoCinta = ({ etiqueta, children, tip }) => (
  <label className="cinta-campo" data-tip={tip}><span>{etiqueta}</span>{children}</label>
)

// Panel desplegable que baja desde la cinta (ajustes detallados que no entran en ella).
// Todos los menús del programa están arriba: no hay paneles laterales. Se cierra con Esc o con un clic afuera.
export function Cajon({ titulo, abierto, onClose, children }) {
  const nodo = useContext(CintaCtx)
  const [pos, setPos] = useState({ top: 130, left: 0 })
  useLayoutEffect(() => {
    if (!abierto || !nodo) return
    const f = () => { const r = nodo.getBoundingClientRect(); setPos({ top: r.bottom, left: r.left }) }
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [abierto, nodo])
  const panel = useRef(null)
  useCerrarAfuera(abierto, [panel], onClose, (e) => !!e.target.closest?.('.cinta [aria-pressed="true"], .menu-contextual'))
  if (!abierto) return null
  return (
    <section ref={panel} className="panel-cinta" style={pos} aria-label={titulo}>
      <header><b>{titulo}</b><button className="chico" onClick={onClose}><Icono n="x" size={14} />Cerrar</button></header>
      <div className="cajon-cuerpo">{children}</div>
    </section>
  )
}

// Mosaico (tarjeta redondeada con título y acción opcional)
export const Mosaico = ({ titulo, accion, onAccion, children, className = '', style }) => (
  <section className={`mosaico ${className}`} style={style}>
    {(titulo || accion) && (
      <div className="mosaico-cab">
        {titulo && <h2>{titulo}</h2>}
        {accion && <button className="fantasma chico" onClick={onAccion}>{accion}<Icono n="flecha" size={14} /></button>}
      </div>
    )}
    {children}
  </section>
)
