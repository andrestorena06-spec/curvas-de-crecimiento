import { useOpcion } from '../../ui/opciones.js'
import { useMemo, useState } from 'react'
import { desvio, finito, media } from '../../calculo/comun/analisis.js'
import { clavePunto, nombreReplica, r3 } from '../../calculo/od/pipeline.js'
import { useTema, rellenoPocillo } from '../../estilo/tema.js'
import { Campo, Check, Encabezado, Icono, Modal, Num, Seg, Sel, Vacio } from '../../ui/base.jsx'
import { Grafico } from '../../ui/graficos/grafico.jsx'
import { LETRAS, fx } from '../../comun/utils.js'
import { VistaCalidadPlacas, ZoomTiempo } from './CalidadPlacas.jsx'
import { zonasVentana } from './FasesCepa.jsx'
import { tramoOdRige } from '../../calculo/od/parametros.js'
import { GrupoModeloOd } from './ModeloOd.jsx'
import { GrupoOutliers } from '../../ui/outliers.jsx'
import { GrupoMostrar, GrupoTipoError, conEtiquetas, textoMostrar, useMostrar } from '../../ui/mostrar.jsx'
import { mediaPorTiempo } from '../../calculo/od/medias.js'
import { BotonCinta, Cajon, Cinta, Grupo, MenuCinta, Mosaico, OpcionesCinta, SeccionMenu } from '../../ui/cinta.jsx'
import { PanelPersonalizar } from '../../ui/graficos/personalizar.jsx'

const CHIP_CAT = { OK: 'ok', Sospechoso: 'peligro', Divergentes: 'aviso', Ruidoso: 'aviso', Excluido: '', 'Sin réplicas': 'acento', Blanco: '', 'Sin datos': '' }
// en cinéticas (Tecan) el test entre réplicas compara el área bajo la curva de cada réplica y marca la réplica entera
const textoEntre = (origen) => (origen === 'tecan' ? '\nCompara el área bajo la curva (AUC) de las réplicas de cada cepa y marca la réplica entera, no puntos sueltos' : '\nEntre las réplicas de cada tiempo')
const nombreSerie = (e) => (e.origenOd === 'tecan' ? 'pocillo' : 'serie')

// ---------- ajustes ----------
// Blanco y opciones de los gráficos (Hampel, OD máxima, Outliers y OD₀ tienen su propio menú en la cinta)
export function AjustesCalidad({ s }) {
  const { exp, setAj } = s
  const aj = exp.aj
  const blancos = s.serie.config.filter((c) => c.EsBlanco)
  return (
    <div className="tarjeta ajustes">
      {exp.origenOd === 'tecan' && (<>
        <h3>Blanco</h3>
        {!aj.corregir_blanco ? <p className="ayuda">Restar el blanco está apagado (botón «Restar blanco» de la cinta).</p> : (<>
          <Campo label="Cómo se resta">
            <Sel value={aj.blanco_metodo} onChange={(v) => setAj('blanco_metodo', v)} opciones={[['tiempo', 'Promedio de los blancos, tiempo a tiempo'], ['const_media', 'Constante: media de todo el blanco'], ['const_min', 'Constante: mínimo del blanco']]} />
          </Campo>
          {blancos.length ? blancos.map((b) => {
            const us = exp.blancosSel || blancos.map((x) => x.Pocillo)
            return <Check key={b.Pocillo} label={`${b.Pocillo} · ${b.Muestra}`} checked={us.includes(b.Pocillo)}
              onChange={() => s.upd({ blancosSel: us.includes(b.Pocillo) ? us.filter((x) => x !== b.Pocillo) : [...us, b.Pocillo] })} />
          }) : <p className="aviso-caja">No hay pocillos de blanco. Marcalos en «Pocillos».</p>}
        </>)}
      </>)}
      {exp.origenOd === 'cubeta' && <p className="aviso-caja info">El blanco y las diluciones de la cubeta se aplican en «Cargar datos».</p>}


      <h3>Solo para los gráficos</h3>
      <p className="ayuda" style={{ marginTop: 0 }}>Suavizado y normalización solo afectan a los gráficos; los parámetros usan la OD sin transformar.</p>
      <Campo label="Suavizado"><Sel value={aj.suavizado} onChange={(v) => setAj('suavizado', v)} opciones={[['ninguno', 'Ninguno'], ['media', 'Media móvil'], ['mediana', 'Mediana móvil'], ['loess', 'LOESS']]} /></Campo>
      {(aj.suavizado === 'media' || aj.suavizado === 'mediana') && <Campo label="Ventana (puntos, impar)"><Num value={aj.suav_k} onChange={(v) => setAj('suav_k', v)} /></Campo>}
      {aj.suavizado === 'loess' && <Campo label="Span (0 a 1)"><Num value={aj.suav_span} onChange={(v) => setAj('suav_span', v)} /></Campo>}
      <Campo label="Normalizar"><Sel value={aj.normalizar} onChange={(v) => setAj('normalizar', v)} opciones={[['ninguna', 'Sin normalizar'], ['restar', 'Restar OD₀'], ['dividir', 'Dividir por OD₀']]} /></Campo>
    </div>
  )
}

// ---------- puntos de un pocillo con su estado ----------
function puntosDe(s, p) {
  const { datos } = s.serie
  const ys = datos.pocillos[p] || []
  const man = new Set(s.exp.E.puntosExcl), forz = new Set(s.exp.E.forzados)
  const w = s.pre.marcado.find((x) => x.Pocillo === p)
  const mapa = new Map(w ? w.filas.map((f) => [r3(f.t), f]) : [])
  const out = []
  datos.tiempos.forEach((t, i) => {
    let v = ys[i]
    if (!finito(v)) return
    const f = mapa.get(r3(t))
    if (f) v = f.yAntes
    else if (s.pre.blanco) { const b = s.pre.blanco.prom.get(r3(t)); if (b === undefined) return; v -= b }
    const k = clavePunto(p, t)
    let estado = 'En el análisis', detalle = ''
    if (f && f.motivo) { estado = f.motivo; detalle = f.detalle }
    if (f && f.marca && forz.has(k)) { estado = 'Reincorporado a mano'; detalle = `El filtro lo había marcado: ${f.detalle}` }
    else if (f && f.marca && !f.motivo) { estado = 'Marcado (sigue en el análisis)'; detalle = `${f.detalle} Solo se marca: sigue en el análisis (un clic lo excluye).` }
    if (man.has(k)) { estado = 'Excluido a mano'; detalle = 'Excluido con un clic. Otro clic lo reincorpora.' }
    out.push({ t, v, k, estado, detalle })
  })
  return out
}
const ESTILO_EST = (T) => ({
  'Reincorporado a mano': { color: T.aviso, forma: 'anillo' }, 'Aberrante (interpolado)': { color: T.aviso, forma: 'o' },
  'Aberrante (Hampel)': { color: T.peligro, forma: 'x' }, 'Aberrante (Dixon)': { color: T.peligro, forma: 'x' }, 'Aberrante (RSD)': { color: T.peligro, forma: 'x' },
  'OD sobre el máximo': { color: T.peligro, forma: 'x' }, 'Excluido a mano': { color: T.sec, forma: 'x' }, 'Aberrante (Grubbs)': { color: T.peligro, forma: 'x' },
  'Marcado (sigue en el análisis)': { color: T.aviso, forma: 'anillo' },
})

// ---------- ventana emergente de un pocillo ----------
export function ModalPocillo({ s, p, onClose }) {
  const T = useTema()
  const [ln, setLn] = useOpcion('calidad.ln', false)
  const [otras, setOtras] = useOpcion('calidad.otras', true)
  const c = s.serie.config.find((x) => x.Pocillo === p)
  const pts = puntosDe(s, p)
  const tr = (v) => (ln ? Math.log(v) : v)
  const ok = (v) => finito(v) && (!ln || v > 0)
  const est = s.estilos[p] || { color: T.acento }
  const usados = pts.filter((q) => ['En el análisis', 'Reincorporado a mano', 'Aberrante (interpolado)', 'Marcado (sigue en el análisis)'].includes(q.estado))
  const series = []
  if (otras && c) s.serie.config.filter((x) => x.Muestra === c.Muestra && !x.EsBlanco && x.Pocillo !== p).forEach((x) => {
    const w = s.pre.pre.find((y) => y.Pocillo === x.Pocillo)
    if (w) series.push({ id: 'o' + x.Pocillo, nombre: '', color: s.estilos[x.Pocillo]?.color || T.sec, opacidad: 0.45, ancho: 1.2,
      data: w.filas.filter((f) => ok(f.y)).map((f) => ({ x: f.t / 3600, y: tr(f.y), tip: `${nombreReplica(x.Muestra, x.Replica)} (${x.Pocillo})\nt = ${fx(f.t / 3600, 2)} h · ${fx(tr(f.y), 3)}` })) })
  })
  if (series.length) series.unshift({ id: 'ley-otras', nombre: 'Otras réplicas', color: T.sec, opacidad: 0.6, ancho: 1.2, data: [] })
  series.push({ id: 'p', nombre: c ? nombreReplica(c.Muestra, c.Replica) : p, color: est.color, ancho: 2, puntos: true, radio: 3,
    data: usados.filter((q) => ok(q.v)).map((q) => ({ x: q.t / 3600, y: tr(q.v), key: q.k, tip: `${q.estado}\nt = ${fx(q.t / 3600, 2)} h\n${ln ? 'ln(OD)' : 'OD'} = ${fx(tr(q.v), 4)}\nClic para excluir` })) })
  const E = ESTILO_EST(T)
  const extras = pts.filter((q) => !['En el análisis'].includes(q.estado) && ok(q.v) && q.estado !== 'Reincorporado a mano').map((q) => ({
    x: q.t / 3600, y: tr(q.v), key: q.k, ...(E[q.estado] || { color: T.peligro, forma: 'x' }),
    tip: `${q.estado}\nt = ${fx(q.t / 3600, 2)} h · ${ln ? 'ln(OD)' : 'OD'} = ${fx(tr(q.v), 4)}${q.detalle ? '\n' + q.detalle : ''}\nClic para ${q.estado === 'Marcado (sigue en el análisis)' ? 'excluirlo' : 'reincorporarlo'}`,
  }))
  pts.filter((q) => q.estado === 'Reincorporado a mano' && ok(q.v)).forEach((q) => extras.push({ x: q.t / 3600, y: tr(q.v), key: q.k, ...E['Reincorporado a mano'], tip: `${q.estado}\n${q.detalle}\nClic para volver a excluirlo` }))
  const fuera = s.pre.fuera.has(p)
  const noUsados = pts.filter((q) => q.estado !== 'En el análisis')
  const qc = s.pre.qc.find((q) => q.Pocillo === p)
  return (
    <Modal titulo={<>{c ? nombreReplica(c.Muestra, c.Replica) : p} <span className="chip" style={{ marginLeft: 6 }}>{s.exp.origenOd === 'tecan' ? `Pocillo ${p}` : `Serie ${c?.Muestra} · réplica ${c?.Replica}`}</span>
      {qc && <span className={`chip ${CHIP_CAT[qc.Categoria]}`} style={{ marginLeft: 6 }}>{fuera ? 'Excluido del análisis' : qc.Categoria}</span>}</>} onClose={onClose} ancho={980}
      pie={<>
        <button disabled={!noUsados.length} onClick={() => s.reincorporarPocillo(p)}><Icono n="refrescar" size={15} />Reincorporar todos los puntos</button>
        <button className="peligro" onClick={() => s.alternarPocillo(p)}>{s.exp.E.pocillosExcl.includes(p) ? (s.exp.origenOd === 'tecan' ? 'Reincorporar el pocillo' : 'Reincorporar la serie') : (s.exp.origenOd === 'tecan' ? 'Excluir el pocillo completo' : 'Excluir la serie completa')}</button>
        <span className="espacio" />
        <button className="primario" onClick={onClose}>Listo</button>
      </>}>
      <div className="fila" style={{ marginBottom: 6 }}>
        <Seg value={ln ? 'ln' : 'od'} onChange={(v) => setLn(v === 'ln')} opciones={[['od', 'OD'], ['ln', 'ln(OD)']]} />
        <Check label="Mostrar las otras réplicas de la cepa" checked={otras} onChange={setOtras} />
        <span className="espacio" />
      </div>
      <Grafico series={series} extras={extras} yTxt={ln ? 'ln(OD)' : 'OD (blanco restado)'} alto={340} estilo={s.estiloGrafico('pocillo')} idEstilo="pocillo" onPuntoClick={s.alternarPunto} nombre={s.exp.origenOd === 'tecan' ? `pocillo_${p}` : `serie_${c?.Muestra}_r${c?.Replica}`} />
      {qc && <p className="ayuda" style={{ marginTop: 8 }}><b>Control de calidad:</b> {qc.Estado}</p>}
      <h4>Puntos marcados o fuera del análisis ({noUsados.length})</h4>
      {!noUsados.length ? <p className="ayuda">Todos los puntos de este {nombreSerie(s.exp)} están en el análisis.</p> : (
        <div className="tabla-scroll" style={{ maxHeight: 220 }}><table className="tabla">
          <thead><tr><th className="num">Tiempo (h)</th><th className="num">OD</th><th>Estado</th><th>Motivo</th><th /></tr></thead>
          <tbody>{noUsados.map((q) => (
            <tr key={q.k}><td className="num">{fx(q.t / 3600, 2)}</td><td className="num">{fx(q.v, 4)}</td><td>{q.estado}</td><td style={{ whiteSpace: 'normal', minWidth: 300 }}>{q.detalle}</td>
              <td><button className="chico" onClick={() => s.alternarPunto(q.k)}>{q.estado === 'Reincorporado a mano' || q.estado === 'Marcado (sigue en el análisis)' ? 'Excluir' : 'Reincorporar'}</button></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Modal>
  )
}

// ---------- placa con las curvas de cada pocillo ----------
function VistaPlaca({ s, onAbrir }) {
  const T = useTema()
  const [hover, setHover] = useState(null)
  const m = useMemo(() => {
    const todos = s.pre.marcado.flatMap((w) => w.filas.filter((f) => finito(f.yAntes)))
    if (!todos.length) return null
    const ts = todos.map((f) => f.t / 3600), ys = todos.map((f) => f.yAntes)
    const a = Math.min(...ys), b = Math.max(...ys)
    return { t0: Math.min(...ts), t1: Math.max(...ts), y0: a - (b - a) * 0.06, y1: b + (b - a) * 0.06 }
  }, [s.pre])
  if (!m) return <Vacio>No hay datos para mostrar.</Vacio>
  const CW = 100, CH = 70, L = 24, TOP = 20
  const W = L + 12 * CW + 4, H = TOP + 8 * CH + 26
  const px = (t, c) => L + c * CW + 5 + ((t - m.t0) / (m.t1 - m.t0 || 1)) * (CW - 10)
  const py = (y, f) => TOP + f * CH + 16 + (1 - (y - m.y0) / (m.y1 - m.y0 || 1)) * (CH - 22)
  const porPoc = Object.fromEntries(s.pre.marcado.map((w) => [w.Pocillo, w]))
  const qc = Object.fromEntries(s.pre.qc.map((q) => [q.Pocillo, q]))
  return (
    <div className="placa-wrap" style={{ position: 'relative' }}>
      {hover && <div className="tip-graf" style={{ left: hover.x + 14, top: hover.y + 8 }}>{hover.t}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720, display: 'block' }} fontFamily="'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif"
        onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 12 }, (_, c) => <text key={c} x={L + c * CW + CW / 2} y={13} textAnchor="middle" fontSize="11" fill={T.sec}>{c + 1}</text>)}
        {LETRAS.map((f, i) => <text key={f} x={10} y={TOP + i * CH + CH / 2} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={T.sec}>{f}</text>)}
        {LETRAS.map((f, fi) => Array.from({ length: 12 }, (_, c) => {
          const p = f + (c + 1)
          const w = porPoc[p]
          const x0 = L + c * CW, y0 = TOP + fi * CH
          const fuera = s.pre.fuera.has(p)
          const col = s.estilos[p]?.color || T.sec
          const q = qc[p]
          const alerta = q && ['Sospechoso', 'Divergentes', 'Ruidoso'].includes(q.Categoria)
          const marcados = w ? w.filas.filter((r) => r.motivo).length : 0
          const manuales = s.exp.E.puntosExcl.filter((k) => k.startsWith(p + '|')).length
          return (
            <g key={p} style={w ? { cursor: 'pointer' } : undefined} onClick={w ? () => onAbrir(p) : undefined}
              onMouseMove={(e) => {
                if (!w) return setHover(null)
                const r = e.currentTarget.ownerSVGElement.getBoundingClientRect()
                setHover({ x: e.clientX - r.left, y: e.clientY - r.top, t: `${nombreReplica(w.Muestra, w.Replica)}${s.exp.origenOd === 'tecan' ? ` (${p})` : ''}${w.EsBlanco ? ' · blanco' : ''}\n${fuera ? 'Excluido del análisis' : q?.Estado || ''}${marcados + manuales ? `\n${marcados + manuales} puntos fuera` : ''}\nClic para ampliar` })
              }}>
              <rect x={x0 + 2} y={y0 + 2} width={CW - 4} height={CH - 4} rx="8" fill={w ? (fuera ? T.fondo : rellenoPocillo(col, { ...T, mezcla: T.mezcla + 0.22 })) : T.pocilloVacio}
                stroke={fuera && w ? T.peligro : alerta ? (q.Categoria === 'Sospechoso' ? T.peligro : T.aviso) : T.borde} strokeWidth={fuera && w ? 2.6 : alerta ? 1.6 : 1} />
              {w && (<>
                <polyline fill="none" strokeWidth="1.5" stroke={fuera ? T.eje : col} strokeDasharray={w.EsBlanco ? '2 2' : undefined} strokeLinejoin="round"
                  points={w.filas.filter((r) => finito(r.yAntes) && !r.motivo).map((r) => `${px(r.t / 3600, c).toFixed(1)},${py(r.yAntes, fi).toFixed(1)}`).join(' ')} />
                {w.filas.filter((r) => r.motivo && finito(r.yAntes)).map((r, i) => {
                  const X = px(r.t / 3600, c), Y = py(r.yAntes, fi)
                  return <path key={i} d={`M${X - 2.6},${Y - 2.6}L${X + 2.6},${Y + 2.6}M${X - 2.6},${Y + 2.6}L${X + 2.6},${Y - 2.6}`} stroke={T.peligro} strokeWidth="1.4" />
                })}
                <text x={x0 + 8} y={y0 + 13} fontSize="9.5" fill={fuera ? T.eje : T.texto}>{nombreReplica(w.Muestra, w.Replica).slice(0, 15)}</text>
                {marcados + manuales > 0 && <text x={x0 + CW - 8} y={y0 + 13} fontSize="9" textAnchor="end" fill={T.peligro}>✕{marcados + manuales}</text>}
              </>)}
            </g>
          )
        }))}
        <text x={L + 6 * CW} y={H - 6} textAnchor="middle" fontSize="11" fill={T.sec}>
          Tiempo {fx(m.t0, 1)} a {fx(m.t1, 1)} h · eje Y común de {fx(m.y0, 2)} a {fx(m.y1, 2)} OD · ✕ puntos fuera del análisis · borde rojo grueso: pocillo excluido · borde rojo fino: sospechoso · ámbar: divergente o ruidoso
        </text>
      </svg>
    </div>
  )
}

// ---------- cubeta: una curva por cepa con sus réplicas (no hay pocillos) ----------
function VistaCepas({ s, onAbrir, mo, error }) {
  const T = useTema()
  const est = ESTILO_EST(T)
  const cepas = [...new Set(s.serie.config.filter((c) => !c.EsBlanco).map((c) => c.Muestra))]
  const qc = Object.fromEntries(s.pre.qc.map((q) => [q.Pocillo, q]))
  const [zoom, setZoom] = useState(null)   // { m, t }: los puntos de una cepa en un tiempo, acercados
  const claves = new Map()
  const usado = (q) => !est[q.estado] || q.estado === 'Marcado (sigue en el análisis)' || q.estado === 'Reincorporado a mano'
  const lectDe = (m, t) => s.serie.config.filter((c) => c.Muestra === m && !c.EsBlanco).sort((a, b) => a.Replica - b.Replica).flatMap((c) => puntosDe(s, c.Pocillo).filter((q) => Math.abs(q.t / 3600 - t) < 1e-6).map((q) => ({
    Muestra: m, clave: q.k, Pocillo: c.Pocillo, Replica: c.Replica, Placa_T_h: t, EsBlanco: false, OD_leida: q.v, OD_corregida: q.v, tipOD: `OD = ${fx(q.v, 4)}`,
    Usado: !s.pre.fuera.has(c.Pocillo) && usado(q), Sospechoso: q.estado === 'Marcado (sigue en el análisis)', Motivo: q.estado + (q.detalle ? ' · ' + q.detalle : ''),
  })))
  return (
    <>
    <div className="grilla-cepas">
      {cepas.map((m) => {
        const reps = s.serie.config.filter((c) => c.Muestra === m && !c.EsBlanco).sort((a, b) => a.Replica - b.Replica)
        const series = [], extras = []
        reps.forEach((c) => {
          const fuera = s.pre.fuera.has(c.Pocillo)
          const pts = puntosDe(s, c.Pocillo)
          pts.forEach((q) => claves.set(q.k, { m, t: q.t / 3600 }))
          const color = s.estilos[c.Pocillo]?.color || s.colores[m]
          if (mo.replicas) series.push({ id: c.Pocillo, nombre: `Réplica ${c.Replica}`, color, dash: fuera ? '4 4' : undefined, opacidad: fuera ? 0.35 : 1, ancho: 1.6, linea: false, puntos: true, radio: 3,
            data: pts.filter((q) => !est[q.estado] || q.estado === 'Marcado (sigue en el análisis)').map((q) => ({ x: q.t / 3600, y: q.v, key: q.k, tip: `${m} · réplica ${c.Replica}\nt = ${fx(q.t / 3600, 2)} h · OD ${fx(q.v, 3)}\nClic: ver los puntos de ese tiempo` })) })
          if (mo.replicas) pts.filter((q) => est[q.estado]).forEach((q) => extras.push({ x: q.t / 3600, y: q.v, key: q.k, ...est[q.estado], tip: `${m} · réplica ${c.Replica}\n${q.estado}${q.detalle ? '\n' + q.detalle : ''}\nClic: ver los puntos de ese tiempo` }))
        })
        const filasM = (s.res || []).filter((r) => r.Muestra === m)
        const tiemposM = [...new Set(reps.flatMap((c) => puntosDe(s, c.Pocillo).map((q) => q.t / 3600)))].sort((a, b) => a - b)
        // puntos / barras / valores: la media de los pocillos aceptados en cada tiempo
        if (mo.puntos || mo.barras || conEtiquetas(mo)) {
          const mt = mediaPorTiempo((s.pre.proc || []).filter((w) => w.Muestra === m && !w.EsBlanco), (v) => v, error)
          series.push({ id: 'media' + m, nombre: 'Media', color: s.colores[m], linea: false, puntos: !!mo.puntos, radio: 3.6, errores: !!mo.barras,
            etiqueta: conEtiquetas(mo) ? (d) => d.valor : null,
            data: mt.map((q) => ({ x: q.t / 3600, y: q.m, lo: q.lo, hi: q.hi, key: (() => { const k = `T|${m}|${q.t / 3600}`; claves.set(k, { m, t: q.t / 3600 }); return k })(), valor: textoMostrar(mo, fx(q.m, 3), Number.isFinite(q.eLin) ? `± ${fx(q.eLin, 3)}` : ''), tip: `${m}
t = ${fx(q.t / 3600, 2)} h
media OD = ${fx(q.m, 4)}
n = ${q.n}` })) })
        }
        return (
          <div key={m} className="mosaico">
            <div className="mosaico-cab" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><h2><i className="punto" style={{ background: s.colores[m], marginRight: 6 }} />{m}</h2></div>
            <Grafico series={series} extras={extras} yTxt="OD" alto={240} zonas={zonasVentana(tramoOdRige(s, m, filasM).ventana, tiemposM[0], tiemposM[tiemposM.length - 1])} estilo={s.estiloGrafico('cepaCubeta')} idEstilo="cepaCubeta" onPuntoClick={(k) => { const z = claves.get(k); if (z) setZoom(z) }} nombre={`cubeta_${m}`} />
            <div className="fila" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {reps.map((c) => {
                const q = qc[c.Pocillo], fuera = s.pre.fuera.has(c.Pocillo)
                return <button key={c.Pocillo} className={`chico chip-boton ${fuera ? 'apagado' : ''}`} onClick={() => onAbrir(c.Pocillo)} data-tip={q?.Estado}>
                  Réplica {c.Replica} · <span className={`chip ${fuera ? '' : CHIP_CAT[q?.Categoria] || ''}`}>{fuera ? 'Excluida' : q?.Categoria || '—'}</span>
                </button>
              })}
            </div>
          </div>
        )
      })}
    </div>
    {zoom && <ZoomTiempo titulo={`${zoom.m} · t = ${fx(zoom.t, zoom.t % 1 ? 2 : 0)} h`} cepa={zoom.m} colores={s.colores} o={{ puntos: true, medias: mo.puntos, errores: mo.barras, etiquetas: conEtiquetas(mo), mostrar: mo, error }} onClick={s.alternarPunto} estilo={s.estiloGrafico('exclusion')} onClose={() => setZoom(null)} lect={lectDe(zoom.m, zoom.t)} />}
    </>
  )
}

// ---------- tabla por pocillo ----------
// Tabla de valores: cada réplica en cada tiempo (OD neta), su estado, y la media, DE y CV % de las réplicas que quedan en el análisis
function TablaValoresOd({ s }) {
  const fuera = s.pre.fuera
  const enAnalisis = new Map()
  s.pre.analisis.filter((w) => !w.EsBlanco).forEach((w) => w.t.forEach((t, i) => { const k = w.Muestra + '|' + r3(t); if (!enAnalisis.has(k)) enAnalisis.set(k, []); enAnalisis.get(k).push(w.y[i]) }))
  const filas = []
  s.serie.config.filter((c) => !c.EsBlanco).forEach((c) => puntosDe(s, c.Pocillo).forEach((p) => filas.push({ ...p, c })))
  const grupos = new Map()
  filas.forEach((x) => { const k = x.c.Muestra + '|' + r3(x.t); if (!grupos.has(k)) grupos.set(k, { m: x.c.Muestra, t: x.t, filas: [] }); grupos.get(k).filas.push(x) })
  const lista = [...grupos.values()].sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : a.t - b.t))
  const tecan = s.exp.origenOd === 'tecan'
  const sigue = (e) => /En el análisis|Marcado|Reincorporado/.test(e)
  const chip = (e, sale) => (sale || !sigue(e) ? 'peligro' : e === 'En el análisis' ? 'ok' : 'aviso')
  return (
    <div className="tabla-scroll alta"><table className="tabla">
      <thead><tr><th>Cepa</th><th className="num">t (h)</th><th className="num">{tecan ? 'Pocillo' : 'Réplica'}</th><th className="num">OD</th><th>Estado</th>
        <th className="num">Media</th><th className="num">DE</th><th className="num">CV %</th><th className="num">n</th><th /></tr></thead>
      <tbody>{lista.map((g) => {
        const v = (enAnalisis.get(g.m + '|' + r3(g.t)) || []).filter(finito)
        const mm = v.length ? media(v) : NaN, de = v.length > 1 ? desvio(v) : NaN, cv = v.length > 1 && mm > 0 ? (100 * de) / mm : NaN
        return g.filas.sort((a, b) => a.c.Replica - b.c.Replica).map((x, i) => {
          const sale = fuera.has(x.c.Pocillo)
          const excl = sale || !sigue(x.estado)
          return (
            <tr key={x.k} className={excl ? 'fuera' : ''} style={i === 0 ? { borderTop: '2px solid var(--borde2)' } : undefined}>
              <td className="grupo">{i === 0 ? <b>{g.m}</b> : ''}</td><td className="num grupo">{i === 0 ? fx(g.t / 3600, 2) : ''}</td>
              <td className="num">{tecan ? x.c.Pocillo : x.c.Replica}</td><td className="num">{fx(x.v, 4)}</td>
              <td><span className={'chip ' + chip(x.estado, sale)} data-tip={x.detalle || undefined}>{sale ? 'Réplica excluida' : x.estado}</span></td>
              <td className="num grupo">{i === 0 ? fx(mm, 4) : ''}</td><td className="num grupo">{i === 0 ? fx(de, 4) : ''}</td>
              <td className="num grupo">{i === 0 ? <span style={{ color: cv > 20 ? 'var(--aviso)' : undefined }}>{fx(cv, 0)}</span> : ''}</td>
              <td className="num grupo">{i === 0 ? v.length : ''}</td>
              <td>{!sale && <button className="chico" onClick={() => s.alternarPunto(x.k)}>{excl ? 'Reincorporar' : 'Excluir'}</button>}</td>
            </tr>
          )
        })
      })}</tbody>
    </table></div>
  )
}

export function Calidad({ s }) {
  const [vista, setVista] = useOpcion('calidad.vista.' + s.exp.origenOd, s.exp.origenOd === 'tecan' ? 'placa' : 'cepas')
  const [abierto, setAbierto] = useState(null)
  const [ajustes, setAjustes] = useState(false)
  const [mo, setMo] = useMostrar('calidadCubeta', { puntos: false, replicas: true })
  const [pers, setPers] = useState(false)   // cajón «Personalizar gráfico» (vista por cepa: los gráficos de cada cepa)
  const [errorOd, setErrorOd] = useOpcion('curva.error', 'sd')
  const { pre, exp, setAj } = s
  const aj = exp.aj
  const sinDatos = !s.serie.datos || !s.serie.config.length
  const irDatos = { tecan: 'placa', placas: 'placas', cubeta: 'lecturas' }[exp.origenOd]
  const marcados = pre && !pre.error ? pre.marcado.reduce((n, w) => n + w.filas.filter((f) => f.motivo).length, 0) : 0
  const cuenta = (cat) => (pre && !pre.error ? pre.qc.filter((q) => q.Categoria === cat).length : 0)
  return (
    <div className="pagina">
      {!s.porCepa && (
        <Cinta>
          {exp.origenOd !== 'tecan' && <GrupoMostrar m={mo} set={setMo} notas={{ puntos: 'La media de las réplicas aceptadas en cada tiempo', replicas: 'Cada réplica como una curva de puntos: clic en un punto para excluirlo o reincorporarlo', barras: 'Barras de error: el tipo (DE, EEM o IC 95 %) se elige en este mismo menú, «Tipo de error»' }} />}
          {<GrupoTipoError valor={errorOd} onChange={setErrorOd} nota={'\n(el mismo en todos los gráficos de OD)'} />}
          <GrupoModeloOd s={s} sinCurva={false} />
          {exp.origenOd === 'tecan' && (
            <Grupo titulo="Blanco">
              <BotonCinta simbolo="−B" texto="Restar blanco" activo={aj.corregir_blanco} onClick={() => setAj('corregir_blanco', !aj.corregir_blanco)} />
            </Grupo>
          )}
          <Grupo titulo="Hampel">
            <MenuCinta icono="hampel" texto="Filtro" activo={aj.hampel_on} ancho={330} tip={'Filtro de Hampel\nPicos aislados dentro de cada curva'}>
              <SeccionMenu titulo="Filtro de Hampel"><Check label="Activar" checked={aj.hampel_on} onChange={(v) => setAj('hampel_on', v)} /></SeccionMenu>
              <SeccionMenu titulo="Parámetros">
                <Campo label="Semiventana (puntos)"><Num value={aj.hampel_k} onChange={(v) => setAj('hampel_k', v)} ancho={70} /></Campo>
                <Campo label="Umbral (× MAD)"><Num value={aj.hampel_sigma} onChange={(v) => setAj('hampel_sigma', v)} ancho={70} /></Campo>
                <Campo label="Diferencia mínima (OD)"><Num value={aj.hampel_min} onChange={(v) => setAj('hampel_min', v)} ancho={70} /></Campo>
              </SeccionMenu>
              <SeccionMenu titulo="Puntos marcados"><Sel value={aj.hampel_accion} onChange={(v) => setAj('hampel_accion', v)} opciones={[['excluir', 'Excluirlos'], ['interpolar', 'Reemplazarlos por interpolación']]} /></SeccionMenu>
            </MenuCinta>
          </Grupo>
          <GrupoOutliers sobre={textoEntre(exp.origenOd)}
            v={{ metodo: aj.dixon_on ? aj.od_atip_metodo || 'q' : 'no', conf: aj.dixon_conf, cvmax: aj.od_cvmax, auto: aj.od_atip_auto === true }}
            set={{ metodo: (x) => { setAj('dixon_on', x !== 'no'); if (x !== 'no') setAj('od_atip_metodo', x) }, conf: (x) => setAj('dixon_conf', x), cvmax: (x) => setAj('od_cvmax', x), auto: (x) => setAj('od_atip_auto', x) }}>
              {exp.origenOd !== 'placas' && <SeccionMenu titulo="Réplicas que no concuerdan">
                <Campo label="Factor de desvío" ayuda="Sospechosa si su desvío medio a la mediana supera este factor × el de las otras réplicas"><Num value={aj.pocillo_factor} onChange={(v) => setAj('pocillo_factor', v)} ancho={64} /></Campo>
                <Campo label="Desvío mínimo (OD)"><Num value={aj.pocillo_min} onChange={(v) => setAj('pocillo_min', v)} ancho={64} /></Campo>
                <Campo label="Dif. AUC con 2 réplicas (%)"><Num value={aj.pocillo_div} onChange={(v) => setAj('pocillo_div', v)} ancho={64} /></Campo>
              </SeccionMenu>}
          </GrupoOutliers>
          {true && (
            <Grupo titulo="Gráfico">
              <BotonCinta icono="editar" texto="Personalizar" activo={pers} onClick={() => setPers(!pers)} tip={vista === 'cepas' && exp.origenOd !== 'tecan' ? 'Gráficos de cada cepa: títulos, tamaños de letra, grosores, eje Y, fondo y colores' : 'Gráfico de cada ' + (exp.origenOd === 'tecan' ? 'pocillo' : 'serie') + ' (se abre con un clic en la placa o la tabla): títulos, tamaños de letra, grosores, eje Y y fondo'} />
            </Grupo>
          )}
          <Grupo titulo="Vista">
            <OpcionesCinta valor={vista} onChange={setVista} opciones={exp.origenOd === 'tecan' ? [['placa', 'Placa', null, 'placa'], ['tabla', 'Tabla', null, 'tabla']] : [['cepas', 'Por cepa', null, 'curva'], ['tabla', 'Tabla', null, 'tabla']]} />
          </Grupo>
          <Grupo titulo="Detalle">
            <MenuCinta simbolo="OD₀" texto="OD₀" ancho={300} tip={'OD inicial\nNivel de partida para el lag y las generaciones'}>
              <SeccionMenu titulo="Cálculo de OD₀"><Sel value={aj.od0_metodo} onChange={(v) => setAj('od0_metodo', v)} opciones={[['auto', 'Automática (meseta inicial, tres fases)'], ['primeros', 'Media de los primeros N puntos']]} /></SeccionMenu>
              <SeccionMenu titulo="N puntos iniciales"><Num value={aj.n_od0} onChange={(v) => setAj('n_od0', v)} ancho={70} /></SeccionMenu>
            </MenuCinta>
            <BotonCinta icono="editar" texto="Más ajustes" activo={ajustes} onClick={() => setAjustes(!ajustes)} tip={'Blanco, suavizado y normalización de los gráficos'} />
          </Grupo>
        </Cinta>
      )}
      <Encabezado titulo="Revisión de la OD" sub={s.porCepa ? 'Blanco de cada placa y comparación de los pocillos de cada cepa. Las exclusiones son reversibles.' : 'Blanco, puntos aberrantes y outliers entre réplicas. Las exclusiones son reversibles.'} />
      {s.serie.avisos.map((a, i) => <div key={i} className="aviso-caja">{a}</div>)}
      {sinDatos ? <Vacio titulo="Todavía no hay curvas" accion={<button className="primario" onClick={() => s.irA(irDatos)}>Ir a cargar los datos</button>}>Cargá los datos y definí las cepas para ver el control de calidad.</Vacio> : s.porCepa ? <VistaCalidadPlacas s={s} /> : (
        pre?.error ? <div className="aviso-caja error">{pre.error}</div> : pre && (<>
          {vista === 'cepas' && exp.origenOd !== 'tecan' ? <VistaCepas s={s} onAbrir={setAbierto} mo={mo} error={errorOd} /> : (
          <Mosaico titulo={vista === 'placa' && exp.origenOd === 'tecan' ? 'Placa con la curva de cada pocillo' : 'OD por cepa y tiempo'}>
            {vista === 'placa' && exp.origenOd === 'tecan' ? <VistaPlaca s={s} onAbrir={setAbierto} /> : <TablaValoresOd s={s} />}
          </Mosaico>)}
        </>)
      )}
      <Cajon titulo="Personalizar gráfico" abierto={pers && !s.porCepa} onClose={() => setPers(false)}><PanelPersonalizar s={s} id={vista === 'cepas' && exp.origenOd !== 'tecan' ? 'cepaCubeta' : 'pocillo'} /></Cajon>
      <Cajon titulo="Más ajustes de la revisión" abierto={ajustes && !s.porCepa} onClose={() => setAjustes(false)}><AjustesCalidad s={s} /></Cajon>
      {abierto && pre && !pre.error && <ModalPocillo s={s} p={abierto} onClose={() => setAbierto(null)} />}
    </div>
  )
}
