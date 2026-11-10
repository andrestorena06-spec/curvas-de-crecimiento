// Guardar un gráfico como imagen: un solo botón abre esta ventana para elegir formato, tamaño,
// resolución, fondo y nombre, con una vista previa del resultado.
// También el contexto con el que el clic derecho de un gráfico abre «Personalizar gráfico».
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { exportarSVG } from '../utils.js'
import { Campo, Modal, Num, Seg } from './base.jsx'

export const GraficoCtx = createContext({ abrirPersonalizar: null })
export const useGraficoCtx = () => useContext(GraficoCtx)

const PRESETS = [['pantalla', 'Como en pantalla'], ['800x500', '800 × 500'], ['1200x750', '1200 × 750'], ['1600x900', '1600 × 900 (16:9)'], ['1000x1000', '1000 × 1000 (cuadrado)'], ['a mano', 'Otro']]

// renderizar(ancho, alto, refSvg, fondoBlanco) dibuja el gráfico con ese tamaño para la vista previa y la descarga
// Letras: el dibujo se arma en un lienzo más chico (tamaño / factor) y se agranda al guardar, así los textos, las líneas
// y los puntos crecen juntos y el gráfico se lee igual de bien con cualquier tamaño de imagen.
// Automático: factor = ancho / 700 (entre 1 y 3): una imagen de 1200 px de ancho sale con letras 1,7 veces más grandes.
const LETRAS_OPC = [['auto', 'Automático'], ['1', '1×'], ['1.5', '1,5×'], ['2', '2×'], ['3', '3×']]
export const factorLetras = (modo, ancho) => (modo === 'auto' ? Math.max(1, Math.min(3, Math.round((ancho / 700) * 10) / 10)) : Number(modo) || 1)

// cepas: las cepas del gráfico (si hay más de una se pueden elegir cuáles guardar, juntas o una imagen por cepa)
// renderizar(ancho, alto, ref, fondoBlanco, cepasElegidas): cepasElegidas = null (todas) o la lista de cepas que se dibujan
export function ModalGuardarImagen({ nombre, anchoPantalla, altoPantalla, renderizar, cepas = [], onClose }) {
  const [formato, setFormato] = useState('png')
  const [preset, setPreset] = useState('pantalla')
  const [w, setW] = useState(Math.round(anchoPantalla))
  const [h, setH] = useState(Math.round(altoPantalla))
  const [escala, setEscala] = useState('3')
  const [fondo, setFondo] = useState('tema')
  const [nom, setNom] = useState(nombre || 'grafico')
  const [letras, setLetras] = useState('auto')
  const [color, setColor] = useState('color')
  const [sel, setSel] = useState(cepas)
  const [modoImg, setModoImg] = useState('junto')
  const refsCepas = useMemo(() => cepas.map(() => ({ current: null })), [cepas.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const [real, setReal] = useState(null)
  const svg = useRef()
  useEffect(() => {
    if (preset === 'pantalla') { setW(Math.round(anchoPantalla)); setH(Math.round(altoPantalla)) }
    else if (preset !== 'a mano') { const [a, b] = preset.split('x').map(Number); setW(a); setH(b) }
  }, [preset, anchoPantalla, altoPantalla])
  useEffect(() => {
    const t = setTimeout(() => { const v = svg.current?.viewBox?.baseVal; if (v) setReal([Math.round(v.width), Math.round(v.height)]) }, 60)
    return () => clearTimeout(t)
  })
  const ancho = Math.max(200, Math.min(4000, Number(w) || 800)), alto = Math.max(150, Math.min(4000, Number(h) || 500))
  const caja = 640, k = Math.min(1, caja / ancho)
  const k2 = Number(escala) || 1
  const fl = factorLetras(letras, ancho)
  const grises = color === 'grises'
  const selEf = cepas.filter((c) => sel.includes(c))
  const varias = cepas.length > 1
  const separadas = varias && modoImg === 'separadas' && selEf.length > 1
  const sinCepas = varias && selEf.length === 0
  const cepasPrev = !varias ? null : separadas ? [selEf[0]] : selEf.length === cepas.length ? null : selEf
  const seguro = (t) => String(t).replace(/[\\/:*?"<>|]+/g, '_')
  const guardar = () => {
    const fondoColor = fondo === 'transparente' && formato !== 'jpg' ? null : fondo === 'blanco' || formato === 'jpg' && fondo === 'transparente' ? '#ffffff' : undefined
    const base = seguro(nom || 'grafico')
    const exportar = (nodo, nombreArch) => exportarSVG(nodo, nombreArch, formato, fondoColor, formato === 'svg' ? fl : k2 * fl, grises)
    if (separadas) selEf.forEach((c) => { const nodo = refsCepas[cepas.indexOf(c)]?.current; if (nodo) exportar(nodo, base + '_' + seguro(c)) })
    else if (svg.current) exportar(svg.current, base)
    onClose()
  }
  return (
    <Modal titulo="Guardar imagen" onClose={onClose} ancho={720}
      pie={<><button onClick={onClose}>Cancelar</button><button className="primario" onClick={guardar} disabled={sinCepas}>{separadas ? `Guardar ${selEf.length} imágenes ${formato.toUpperCase()}` : `Guardar ${formato.toUpperCase()}`}</button></>}>
      {varias && (
        <div style={{ marginBottom: 14, padding: '10px 14px', border: '1px solid var(--borde)', borderRadius: 10, background: 'var(--panel2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Cepas del gráfico</div>
          <div className="fila" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            {cepas.map((c) => (
              <label key={c} style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <input type="checkbox" checked={sel.includes(c)} onChange={() => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c])} />{c}
              </label>
            ))}
          </div>
          {selEf.length > 1 && (
            <Seg value={modoImg} onChange={setModoImg} opciones={[['junto', 'Todas las cepas en una imagen'], ['separadas', `Una imagen por cada cepa (${selEf.length} imágenes)`]]} />
          )}
          {separadas && <p className="ayuda" style={{ margin: '8px 0 0' }}>Se guardan {selEf.length} archivos, cada uno con una sola cepa y los mismos ejes: {seguro(nom || 'grafico')}_{seguro(selEf[0])}.{formato}, … La vista previa muestra la primera.</p>}
          {selEf.length === 0 && <p className="aviso-texto" style={{ margin: '8px 0 0' }}>Elegí al menos una cepa.</p>}
        </div>
      )}
      <div className="fila" style={{ flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
        <Campo label="Formato"><Seg value={formato} onChange={setFormato} opciones={[['png', 'PNG'], ['jpg', 'JPG'], ['svg', 'SVG']]} /></Campo>
        <Campo label="Tamaño">
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>{PRESETS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </Campo>
        <Campo label="Ancho (px)"><Num value={w} onChange={(v) => { setW(v); setPreset('a mano') }} ancho={80} /></Campo>
        <Campo label="Alto (px)"><Num value={h} onChange={(v) => { setH(v); setPreset('a mano') }} ancho={80} /></Campo>
        {formato !== 'svg' && <Campo label="Resolución"><Seg value={escala} onChange={setEscala} opciones={[['1', '1×'], ['2', '2×'], ['3', '3×'], ['4', '4×']]} /></Campo>}
        <Campo label="Letras"><Seg value={letras} onChange={setLetras} opciones={LETRAS_OPC} /></Campo>
        <Campo label="Color"><Seg value={color} onChange={setColor} opciones={[['color', 'Color'], ['grises', 'Escala de grises']]} /></Campo>
        <Campo label="Fondo"><Seg value={fondo} onChange={setFondo} opciones={[['tema', 'Como se ve'], ['blanco', 'Blanco'], ...(formato !== 'jpg' ? [['transparente', 'Transparente']] : [])]} /></Campo>
        <Campo label="Nombre del archivo"><input value={nom} onChange={(e) => setNom(e.target.value)} style={{ width: 220 }} /></Campo>
      </div>
      <p className="ayuda" style={{ margin: '10px 0 6px' }}>
        Vista previa{real ? ` · ${Math.round(real[0] * fl)} × ${Math.round(real[1] * fl)} px` : ''} · letras ×{String(Math.round(fl * 10) / 10).replace('.', ',')}{formato !== 'svg' && real ? ` · archivo de ${Math.round(real[0] * fl * k2)} × ${Math.round(real[1] * fl * k2)} px` : ''}{formato === 'svg' ? ' · vectorial: se puede agrandar sin perder calidad' : ''}{grises ? ' · las cepas de brillo parecido pueden verse iguales: conviene distinguirlas con puntos y rótulos' : ''}
      </p>
      <div style={{ width: ancho * k, height: (real ? real[1] * fl : alto) * k, overflow: 'hidden', border: '1px solid var(--borde)', borderRadius: 8, background: fondo === 'transparente' ? 'repeating-conic-gradient(var(--panel2) 0% 25%, transparent 0% 50%) 50% / 16px 16px' : undefined, filter: grises ? 'grayscale(1)' : undefined }}>
        <div style={{ width: ancho / fl, transform: `scale(${k * fl})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
          {renderizar(ancho / fl, alto / fl, svg, fondo === 'blanco' || formato === 'jpg' && fondo === 'transparente', cepasPrev)}
        </div>
      </div>
      {separadas && (
        <div style={{ position: 'fixed', left: -99999, top: 0, width: ancho / fl, pointerEvents: 'none' }} aria-hidden="true">
          {selEf.map((c) => <div key={c}>{renderizar(ancho / fl, alto / fl, refsCepas[cepas.indexOf(c)], fondo === 'blanco' || formato === 'jpg' && fondo === 'transparente', [c])}</div>)}
        </div>
      )}
    </Modal>
  )
}
