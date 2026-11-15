// «Guardar imagen»: la MISMA ventana para todos los gráficos (botón de arriba a la derecha o clic derecho › Guardar imagen).
// Se guarda el gráfico tal como se ve (cepas visibles, zoom y estilo). La proporción se ajusta arrastrando la esquina
// de la vista previa o escribiendo el ancho y el alto. También el contexto con el que el clic derecho abre «Personalizar gráfico».
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { exportarSVG } from '../../comun/utils.js'
import { Modal, Num, Seg } from '../base.jsx'

export const GraficoCtx = createContext({ abrirPersonalizar: null })
export const useGraficoCtx = () => useContext(GraficoCtx)

const PRESETS = [['pantalla', 'Como en pantalla'], ['800x500', '800 × 500'], ['1200x750', '1200 × 750'], ['1600x900', '1600 × 900 (16:9)'], ['1000x1000', '1000 × 1000'], ['a mano', 'Personalizado']]
const LETRAS_OPC = [['auto', 'Auto'], ['1', '1×'], ['1.5', '1,5×'], ['2', '2×'], ['3', '3×']]
// Letras: el dibujo se arma en un lienzo más chico (tamaño / factor) y se agranda al guardar; en automático, factor = ancho / 700 (1 a 3)
export const factorLetras = (modo, ancho) => (modo === 'auto' ? Math.max(1, Math.min(3, Math.round((ancho / 700) * 10) / 10)) : Number(modo) || 1)
const CAJA_H = 430   // alto máximo de la vista previa (px de pantalla); el ancho es el del recuadro

const Seccion = ({ titulo, children }) => (
  <section className="gi-seccion"><div className="gi-titulo">{titulo}</div>{children}</section>
)
const Fila = ({ etiqueta, children }) => <label className="gi-fila"><span>{etiqueta}</span><div>{children}</div></label>

// renderizar(ancho, alto, refSvg, fondoBlanco) dibuja el gráfico con ese tamaño (vista previa y archivo)
export function ModalGuardarImagen({ nombre, anchoPantalla, altoPantalla, renderizar, onClose }) {
  const [formato, setFormato] = useState('png')
  const [preset, setPreset] = useState('pantalla')
  const [w, setW] = useState(Math.round(anchoPantalla))
  const [h, setH] = useState(Math.round(altoPantalla))
  const [escala, setEscala] = useState('3')
  const [fondo, setFondo] = useState('tema')
  const [nom, setNom] = useState(nombre || 'grafico')
  const [letras, setLetras] = useState('auto')
  const [color, setColor] = useState('color')
  const [real, setReal] = useState(null)
  const svg = useRef()
  const arrastre = useRef(null)
  const previa = useRef(null)
  const [cajaW, setCajaW] = useState(560)
  useLayoutEffect(() => {
    const f = () => { if (previa.current) setCajaW(Math.max(240, previa.current.clientWidth - 30)) }
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  useEffect(() => {
    if (preset === 'pantalla') { setW(Math.round(anchoPantalla)); setH(Math.round(altoPantalla)) }
    else if (preset !== 'a mano') { const [a, b] = preset.split('x').map(Number); setW(a); setH(b) }
  }, [preset, anchoPantalla, altoPantalla])
  useEffect(() => {
    const t = setTimeout(() => { const v = svg.current?.viewBox?.baseVal; if (v) setReal([Math.round(v.width), Math.round(v.height)]) }, 60)
    return () => clearTimeout(t)
  })
  const ancho = Math.max(200, Math.min(4000, Number(w) || 800)), alto = Math.max(150, Math.min(4000, Number(h) || 500))
  const fl = factorLetras(letras, ancho)
  const altoReal = real ? real[1] * fl : alto
  const k = Math.min(1, cajaW / ancho, CAJA_H / altoReal)
  const k2 = Number(escala) || 1
  const grises = color === 'grises'
  const blanco = fondo === 'blanco' || (formato === 'jpg' && fondo === 'transparente')
  const seguro = (t) => String(t).replace(/[\\/:*?"<>|]+/g, '_')
  const guardar = () => {
    const fondoColor = fondo === 'transparente' && formato !== 'jpg' ? null : blanco ? '#ffffff' : undefined
    if (svg.current) exportarSVG(svg.current, seguro(nom || 'grafico'), formato, fondoColor, formato === 'svg' ? fl : k2 * fl, grises)
    onClose()
  }
  // arrastrar la esquina de la vista previa cambia el ancho y el alto (la escala queda fija mientras se arrastra)
  const empezar = (e) => {
    e.preventDefault()
    arrastre.current = { x: e.clientX, y: e.clientY, w: ancho, h: alto, k }
    const mover = (ev) => {
      const a = arrastre.current
      if (!a) return
      setPreset('a mano')
      setW(Math.round(Math.max(200, a.w + (ev.clientX - a.x) / a.k)))
      setH(Math.round(Math.max(150, a.h + (ev.clientY - a.y) / a.k)))
    }
    const soltar = () => { arrastre.current = null; window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar) }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  const pxArchivo = real && formato !== 'svg' ? `${Math.round(real[0] * fl * k2)} × ${Math.round(real[1] * fl * k2)} px` : formato === 'svg' ? 'vectorial' : ''
  return (
    <Modal titulo="Guardar imagen" onClose={onClose} ancho={1000}
      pie={<><span className="ayuda" style={{ marginRight: 'auto' }}>Archivo: {pxArchivo}</span><button onClick={onClose}>Cancelar</button><button className="primario" onClick={guardar}>Guardar {formato.toUpperCase()}</button></>}>
      <div className="gi">
        <div className="gi-previa" ref={previa}>
          <div className="gi-lienzo" style={{ width: ancho * k, height: altoReal * k, background: fondo === 'transparente' && formato !== 'jpg' ? 'repeating-conic-gradient(var(--panel2) 0% 25%, transparent 0% 50%) 50% / 16px 16px' : undefined, filter: grises ? 'grayscale(1)' : undefined }}>
            <div style={{ width: ancho / fl, transform: `scale(${k * fl})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
              {renderizar(ancho / fl, alto / fl, svg, blanco)}
            </div>
            <span className="gi-tirador" onPointerDown={empezar} data-tip="Arrastrar para cambiar el tamaño y la proporción" />
          </div>
          <div className="gi-medida">{ancho} × {alto} px</div>
        </div>
        <div className="gi-opciones">
          <Seccion titulo="Archivo">
            <Fila etiqueta="Nombre"><input value={nom} onChange={(e) => setNom(e.target.value)} /></Fila>
            <Fila etiqueta="Formato"><Seg value={formato} onChange={setFormato} opciones={[['png', 'PNG'], ['jpg', 'JPG'], ['svg', 'SVG']]} /></Fila>
          </Seccion>
          <Seccion titulo="Tamaño">
            <Fila etiqueta="Medida"><select value={preset} onChange={(e) => setPreset(e.target.value)}>{PRESETS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Fila>
            <Fila etiqueta="Ancho × alto">
              <span className="gi-par"><Num value={w} onChange={(v) => { setW(v); setPreset('a mano') }} ancho={76} /><span>×</span><Num value={h} onChange={(v) => { setH(v); setPreset('a mano') }} ancho={76} /><span className="tenue">px</span></span>
            </Fila>
            {formato !== 'svg' && <Fila etiqueta="Resolución"><Seg value={escala} onChange={setEscala} opciones={[['1', '1×'], ['2', '2×'], ['3', '3×'], ['4', '4×']]} /></Fila>}
          </Seccion>
          <Seccion titulo="Aspecto">
            <Fila etiqueta="Letras"><Seg value={letras} onChange={setLetras} opciones={LETRAS_OPC} /></Fila>
            <Fila etiqueta="Color"><Seg value={color} onChange={setColor} opciones={[['color', 'Color'], ['grises', 'Grises']]} /></Fila>
            <Fila etiqueta="Fondo"><Seg value={fondo} onChange={setFondo} opciones={[['tema', 'Como se ve'], ['blanco', 'Blanco'], ...(formato !== 'jpg' ? [['transparente', 'Transparente']] : [])]} /></Fila>
          </Seccion>
        </div>
      </div>
    </Modal>
  )
}
