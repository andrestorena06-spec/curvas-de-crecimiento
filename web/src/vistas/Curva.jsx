// ============================================================
// Curva OD vs t: el gráfico de las curvas (media ± error o cada réplica) y, debajo, cómo se obtiene la ecuación de la
// fase exponencial (ln(OD), qué tramo, qué datos), la ecuación de cada curva y los parámetros. Clic en un valor: cómo se calculó.
// ============================================================
import { useMemo, useState } from 'react'
import { useOpcion } from '../ui/opciones.js'
import { desvio, finito, media } from '../motor/analisis.js'
import { etiquetaOd, nombreReplica } from '../motor/pipeline.js'
import { Encabezado, Icono, Num, Sel, Vacio } from '../ui/base.jsx'
import { Grafico } from '../ui/grafico.jsx'
import { fs, fx, tCuantil } from '../utils.js'
import { BotonCinta, Cajon, CampoCinta, Cinta, Grupo, Mosaico, OpcionesCinta } from '../ui/cinta.jsx'
import { PanelPersonalizar } from '../ui/personalizar.jsx'
import { GrupoMostrar, conEtiquetas, textoMostrar, useMostrar } from '../ui/mostrar.jsx'
import { SelectorCepas, cepasOcultas } from '../ui/cepas.jsx'
import { fichaMediaTiempo } from '../fichas/definiciones.js'
import { ParametrosOd, ajustesOd, resumenPorCepa } from './Parametros.jsx'
import { tramoOdRige } from './FasesCepa.jsx'
import { OPCIONES_MODELO_UFC } from './ParamUfc.jsx'
import { MODELOS_UFC, fraccionExp, lineasMedia } from '../motor/ufc.js'
import { TablaMediaTiempo } from '../ui/tablaMedia.jsx'

// Media ± error de las réplicas en cada tiempo, SIEMPRE con los valores lineales (el mismo cálculo que las UFC/mL).
// En escala log (tr ≠ identidad) el valor es tr(media) y la barra va de tr(media − error) a tr(media + error): la misma
// barra que en lineal, con el eje en log. EEM e IC 95 % solo con 3 o más réplicas.
export function mediaPorTiempo(series, tr, error) {
  const por = new Map()
  series.forEach((w) => w.t.forEach((t, i) => { const v = w.y[i]; if (finito(v)) { if (!por.has(t)) por.set(t, []); por.get(t).push(v) } }))
  const lineal = tr(2) === 2 && tr(0.5) === 0.5
  return [...por.keys()].sort((a, b) => a - b).map((t) => {
    const v = por.get(t), n = v.length, mL = media(v), sd = n > 1 ? desvio(v) : NaN
    const e = error === 'sem' ? (n > 2 ? sd / Math.sqrt(n) : NaN) : error === 'ic95' ? (n > 2 ? (tCuantil(0.975, n - 1) * sd) / Math.sqrt(n) : NaN) : sd
    const lo = mL - e, hi = mL + e
    return { t, n, sd, mLin: mL, eLin: e, m: tr(mL), lo: finito(e) ? tr(lo) : NaN, hi: finito(e) ? tr(hi) : NaN, err: lineal ? e : NaN, rango: !lineal }
  })
}
// texto del error sobre el punto: «± error» en lineal; «[inf – sup]» en log
export const textoErrMedia = (q, d = 3) => (q.rango ? (finito(q.hi) ? `[${finito(q.lo) ? fx(q.lo, d) : '–'} – ${fx(q.hi, d)}]` : '') : finito(q.err) ? `± ${fx(q.err, d)}` : '')
// el error de un punto en el formato de lineasMedia (globos de OD y UFC con el mismo texto)
export const egDeMedia = (q, etq) => {
  const L = (x) => (finito(x) && x > 0 ? Math.log10(x) : NaN)
  return { etq, e: q.eLin, lo: q.mLin - q.eLin, hi: q.mLin + q.eLin, mLog: L(q.mLin), loLog: L(q.mLin - q.eLin), hiLog: L(q.mLin + q.eLin) }
}

// Sin curvas procesadas se muestra el aviso ANTES de los hooks de la pantalla (si no, React falla al pasar de «sin datos» a «con datos»)
export function Curva({ s }) {
  const hay = s.pre && !s.pre.error && s.pre.proc.some((w) => !w.EsBlanco)
  if (!hay) return <div className="pagina"><Encabezado titulo="Curva OD vs t" /><Vacio titulo="Todavía no hay curvas procesadas">{s.pre?.error || 'Completá la carga de datos y el control de calidad.'}</Vacio></div>
  return <CurvaOd s={s} />
}

function CurvaOd({ s }) {
  const { pre, exp } = s
  const [escalaG, setEscala] = useOpcion('curva.escala', 'lineal')
  const escala = escalaG === 'ln' ? 'log10' : escalaG   // la escala ln ya no existe (sesiones viejas)
  const [error, setError] = useOpcion('curva.error', 'sd')
  const ocultas = cepasOcultas(exp)
  const [ocultasRep, setOcultasRep] = useState([])   // réplicas (pocillos) ocultas en el gráfico
  const [modeloOd, setModeloOd] = useOpcion('curva.modelo', 'baranyi')
  const [lagFijo, setLagFijo] = useOpcion('curva.lagfijo', '')   // lag fijo (h) del modelo de la OD (Baranyi y Roberts / Huang)
  // Mostrar (el mismo grupo en todos los gráficos): puntos = media de cada tiempo, réplicas = cada pocillo o réplica
  const [m, setM] = useMostrar('curva', { puntos: true, replicas: exp.origenOd === 'placas' })
  const [pers, setPers] = useState(false)
  // «Fases»: sombrea lag / exponencial / estacionaria de una cepa y deja elegir el tramo exponencial arrastrando sobre el gráfico
  const [fases, setFases] = useOpcion('curva.fases', false)
  const [cepaFase, setCepaFase] = useOpcion('curva.cepaFase', '')
  // ¿hay curva de blanco para mostrar? (la cubeta resta un blanco único, sin curva)
  const hayBlancoCinta = (exp.origenOd === 'tecan' && (pre?.marcado || []).some((w) => w.EsBlanco && w.filas.length)) || (exp.origenOd === 'placas' && (s.serie.extra?.blancos || []).some((b) => finito(b.valor)))
  const wsTodas = useMemo(() => (pre && !pre.error ? pre.proc.filter((w) => !w.EsBlanco) : []), [pre])
  const resumen = useMemo(() => (s.res?.length ? resumenPorCepa(s.res, ['mu_max', 'td_h']) : []), [s.res])
  const muestras = [...new Set(wsTodas.map((w) => w.Muestra))]
  // las réplicas ocultas no se dibujan ni entran en la media del gráfico (el análisis no cambia)
  const ws = s.porCepa ? wsTodas : wsTodas.filter((w) => !ocultasRep.includes(w.Pocillo))

  // lo que se grafica (con normalización, OD / OD₀ u OD − OD₀: solo para el gráfico)
  const base = etiquetaOd(s.serie.aj)
  const ETQ_Y = { lineal: base, ln: `ln(${base})`, log10: `log₁₀(${base})` }
  const TRANS = { lineal: (v) => v, ln: (v) => (v > 0 ? Math.log(v) : NaN), log10: (v) => (v > 0 ? Math.log10(v) : NaN) }
  const tr = TRANS[escala]
  const visibles = muestras.filter((m) => !ocultas.includes(m))
  let series = []
  let nBajo = false   // algún tiempo con menos de 3 lecturas en la media (el error tiene poca base)
  const etqErr = { sd: 'DE', sem: 'EEM', ic95: 'IC 95 %' }[error]
  visibles.forEach((cepa) => {
    const g = ws.filter((w) => w.Muestra === cepa)
    const mt = mediaPorTiempo(g, tr, error)
    const ns = mt.map((q) => q.n), nmin = ns.length ? Math.min(...ns) : 0, nmax = ns.length ? Math.max(...ns) : 0
    if (nmin < 3) nBajo = true
    // réplicas: cada pocillo / réplica como puntos sueltos (placas por tiempo: los pocillos de cada tiempo)
    if (m.replicas) {
      if (s.porCepa) series.push({ id: 'p' + cepa, cepa, nombre: '', color: s.colores[cepa], linea: false, puntos: true, radio: 3, opacidad: 0.8,
        data: g.flatMap((w) => w.t.map((t, i) => ({ x: t / 3600, y: tr(w.y[i]), tip: `${cepa} · pocillo\nt = ${fx(t / 3600, 2)} h\n${ETQ_Y[escala]} = ${fx(tr(w.y[i]), 4)}` }))) })
      else g.forEach((w) => {
        const e = s.estilos[w.Pocillo] || {}
        series.push({ id: w.Pocillo, cepa, nombre: nombreReplica(w.Muestra, w.Replica), color: e.color || s.colores[cepa], linea: false, puntos: true, radio: 2.6, opacidad: 0.85,
          data: w.t.map((t, i) => ({ x: t / 3600, y: tr(w.y[i]), tip: `${nombreReplica(w.Muestra, w.Replica)}${exp.origenOd === 'tecan' ? ` (${w.Pocillo})` : ''}\nt = ${fx(t / 3600, 2)} h\n${ETQ_Y[escala]} = ${fx(tr(w.y[i]), 4)}` })) })
      })
    }
    // puntos / barras / valores: la media de cada tiempo (y su error)
    if (m.puntos || m.barras || conEtiquetas(m)) series.push({
      id: cepa, cepa, nombre: `${cepa}${m.puntos ? '' : ' (error)'} (n = ${nmin === nmax ? nmax : `${nmin}–${nmax}`})`, color: s.colores[cepa], linea: false, puntos: !!m.puntos, radio: 3.4,
      errores: !!m.barras,
      etiqueta: conEtiquetas(m) ? (d) => d.valor : null,
      data: mt.map((q) => ({ x: q.t / 3600, y: q.m, lo: q.lo, hi: q.hi, key: `${cepa}|${q.t}`,
        valor: textoMostrar(m, fx(q.m, 3), textoErrMedia(q)),
        tip: [`${cepa} · t = ${fx(q.t / 3600, 2)} h`, ...lineasMedia({ m: q.mLin, eg: egDeMedia(q, etqErr), n: q.n, unidad: base, fmt: (x) => fx(x, 4) }), 'Clic: cómo se calculó'].join('\n') })),
    })
  })
  // ficha de un punto de la media: las réplicas de ese tiempo, su media y su error
  // Tecan con la OD sin transformar: lectura cruda y blanco de ese pocillo en ese tiempo
  const detTecan = (w, tt) => {
    if (exp.origenOd !== 'tecan' || s.aj?.normalizar) return null
    const f = (pre?.marcado || []).find((x) => x.Pocillo === w.Pocillo)?.filas.find((r) => r.t === tt)
    return f && finito(f.yRaw) && finito(f.yAntes) ? [f.yRaw, f.yRaw - f.yAntes] : null
  }
  const fichaDe = (k, foco = '') => {
    const i = k.lastIndexOf('|'), m = k.slice(0, i), t = Number(k.slice(i + 1))
    const valores = ws.filter((w) => w.Muestra === m).flatMap((w) => w.t.map((tt, j) => (tt === t && finito(w.y[j]) ? { etiqueta: s.porCepa ? `réplica ${w.Replica}` : nombreReplica(w.Muestra, w.Replica), x: w.y[j], det: detTecan(w, tt) } : null)).filter(Boolean))
    return valores.length ? fichaMediaTiempo({ valores, t: t / 3600, nombre: m, tipo: error, unidad: base, etiquetaValor: `${base} media`, foco, fmt: (x) => fs(x, 4) }) : null
  }
  const abrir = (k, foco = '') => { const f = fichaDe(k, foco); if (f) s.abrirFicha(f) }
  // curva del blanco: la OD leída de los pocillos de blanco (Tecan) o el blanco de cada placa (placas por tiempo), sin restar nada
  const blancosTecan = exp.origenOd === 'tecan' && pre?.marcado ? pre.marcado.filter((w) => w.EsBlanco && w.filas.length) : []
  const blancosPlacas = exp.origenOd === 'placas' ? (s.serie.extra?.blancos || []).filter((b) => finito(b.valor)) : []
  const hayBlanco = blancosTecan.length > 0 || blancosPlacas.length > 0
  if (m.blanco && hayBlanco) {
    const grisB = '#8C9BB0'
    if (blancosTecan.length) {
      const serie1 = (w) => ({ t: w.filas.map((f) => f.t), y: w.filas.map((f) => f.yRaw) })
      if (m.replicas && !m.puntos) blancosTecan.forEach((w) => series.push({ id: 'bl' + w.Pocillo, nombre: `Blanco ${w.Pocillo}`, color: grisB, linea: false, puntos: true, radio: 2.4, opacidad: 0.8,
        data: serie1(w).t.map((t, i) => ({ x: t / 3600, y: tr(serie1(w).y[i]), tip: `Blanco ${w.Pocillo} (OD leída)
t = ${fx(t / 3600, 2)} h
OD = ${fx(serie1(w).y[i], 4)}` })) }))
      else {
        const mt = mediaPorTiempo(blancosTecan.map(serie1), tr, error)
        series.push({ id: 'blanco', nombre: `Blanco (n = ${blancosTecan.length}, OD leída)`, color: grisB, banda: true, linea: false, puntos: true, radio: 3,
          data: mt.map((q) => ({ x: q.t / 3600, y: q.m, lo: q.lo, hi: q.hi, tip: `Blanco (OD leída, sin restar)
t = ${fx(q.t / 3600, 2)} h
media = ${fx(q.m, 4)}
n = ${q.n} pocillos` })) })
      }
    } else series.push({ id: 'blanco', nombre: 'Blanco de cada placa (OD leída)', color: grisB, linea: false, puntos: true, forma: 'cuadrado', radio: 4, errores: true,
      data: blancosPlacas.filter((b) => finito(tr(b.valor))).map((b) => ({ x: b.t, y: tr(b.valor), lo: finito(b.de) ? tr(b.valor - b.de) : NaN, hi: finito(b.de) ? tr(b.valor + b.de) : NaN, tip: `Blanco de la placa t = ${fx(b.t, 2)} h (OD leída)
media = ${fx(b.valor, 4)}${finito(b.de) ? ` ± ${fx(b.de, 4)} (DE)` : ''}
n = ${b.n} pocillos` })) })
  }
  // curva del modelo (Linealizar log₁₀ o Baranyi y Roberts), solo si se grafica la OD sin normalizar
  // el ajuste se hace UNA vez para todas las cepas (ocultar o mostrar una cepa no lo recalcula)
  const ajustesTodas = useMemo(() => ajustesOd(s, modeloOd, muestras, lagFijo), [s.pre, s.res, s.modoCurva, modeloOd, lagFijo, muestras.join('|'), exp.aj.an_ancho, exp.aj.an_minpts, exp.aj.an_r2, exp.aj.an_lnmin]) // eslint-disable-line react-hooks/exhaustive-deps
  const ajustesM = ajustesTodas.filter((a) => visibles.includes(a.id))
  const kM = { lineal: (y) => 10 ** y, ln: (y) => y * Math.LN10, log10: (y) => y }[escala]
  if (modeloOd !== 'no' && base === 'OD') ajustesM.forEach((a) => {
    if (!a.c.ok) return
    series.push({ id: 'aj' + a.id, cepa: a.id, nombre: `${a.nombre}: ${modeloOd === 'lineal' ? 'linealizar log₁₀' : MODELOS_UFC[modeloOd]}`, color: a.color, ancho: 2, 
      data: Array.from({ length: 121 }, (_, i) => a.c.t0 + ((a.c.t1 - a.c.t0) * i) / 120).map((x) => ({ x, y: kM(a.c.pred10(x)), tip: `${a.id} · ${MODELOS_UFC[modeloOd]}
t = ${fx(x, 2)} h
OD = ${fx(10 ** a.c.pred10(x), 4)}` })) })
  })
  // Fases de la cepa elegida: lag antes de la ventana exponencial, estacionaria después
  const unaCepa = visibles.length === 1   // las fases difieren entre cepas: solo se muestran con una cepa visible
  const cepaF = visibles[0]
  const filasF = (s.res || []).filter((r) => r.Muestra === cepaF)
  const trF = tramoOdRige(s, cepaF, filasF)
  const venF = trF.ventana
  const r0 = venF ? { t_ini_ventana: venF[0], t_fin_ventana: venF[1] } : null
  const tsF = ws.filter((w) => w.Muestra === cepaF).flatMap((w) => w.t.map((t) => t / 3600))
  const tMin = tsF.length ? Math.min(...tsF) : NaN, tMax = tsF.length ? Math.max(...tsF) : NaN
  const manualF = trF.origen === 'manual'
  const zonas = fases && unaCepa && r0 ? [
    { x0: tMin, x1: r0.t_ini_ventana, color: '#5B8DB8', etiqueta: 'Lag' },
    { x0: r0.t_ini_ventana, x1: r0.t_fin_ventana, color: '#D98B2B', etiqueta: 'Exponencial' },
    { x0: r0.t_fin_ventana, x1: tMax, color: '#7A8794', etiqueta: 'Estacionaria' },
  ] : []
  const setTramo = (v) => filasF.forEach((r) => s.setVentana(r.Pocillo, v))
  // tiempos en que el logaritmo no existe (OD neta ≤ 0 en todas las lecturas): no se dibujan, y se avisa
  const sinLog = escala === 'lineal' ? [] : visibles.flatMap((cepa) => {
    const g = ws.filter((w) => w.Muestra === cepa)
    const crudo = new Set(g.flatMap((w) => w.t.filter((t, i) => finito(w.y[i]))))
    const ok = new Set(mediaPorTiempo(g, tr, error).filter((q) => finito(q.m)).map((q) => q.t))
    return [...crudo].filter((t) => !ok.has(t)).sort((a, b) => a - b).map((t) => `${cepa}: t = ${fx(t / 3600, 2)} h`)
  })
  const nombreErr = { sd: 'desviación estándar', sem: 'error estándar de la media', ic95: 'IC 95 %' }[error]
  // tabla por cepa y tiempo: los mismos valores del gráfico (media y error de las réplicas visibles, en la escala elegida)
  const filasTabla = visibles.flatMap((cepa) => mediaPorTiempo(ws.filter((w) => w.Muestra === cepa), (v) => v, error).filter((q) => finito(q.mLin)).map((q) => ({ clave: `${cepa}|${q.t}`, cepa, color: s.colores[cepa], t: q.t / 3600, tSeg: q.t, n: q.n, m: q.mLin, e: q.eLin })))
  const deLog = (x) => (escala === 'ln' ? Math.exp(x) : 10 ** x)
  // μ media y td = ln 2 / μ̄ (el mismo cálculo que el resumen por cepa de Parámetros)
  const muDe = (m) => resumen.find((r) => r.Muestra === m)?.mu_max.m ?? NaN
  const tdDe = (m) => resumen.find((r) => r.Muestra === m)?.td_h.m ?? NaN
  return (
    <div className="pagina">
      <Cinta>
        <GrupoMostrar m={m} set={setM} blanco={hayBlancoCinta} />
        <Grupo titulo="Escala del eje Y">
          <OpcionesCinta valor={escala} onChange={setEscala} opciones={[['lineal', 'Lineal', 'OD', null, 'OD tal cual'], ['log10', 'log₁₀', 'lg', null, 'Logaritmo decimal: la fase exponencial se ve como una recta']]} />
        </Grupo>
        <Grupo titulo="Modelo">
          <OpcionesCinta valor={modeloOd} onChange={setModeloOd} opciones={OPCIONES_MODELO_UFC} />
          {(modeloOd === 'baranyi' || modeloOd === 'huang') && <CampoCinta etiqueta="Lag fijo (h)" tip={'Fijar el lag λ (horas) en el ajuste: estabiliza μ cuando hay pocos puntos, porque μ y el lag se compensan entre sí\nVacío: lo estima el ajuste'}><Num value={lagFijo} onChange={(x) => setLagFijo(x === '' ? '' : x)} ancho={52} /></CampoCinta>}
        </Grupo>
        <Grupo titulo="Fases">
          {(modeloOd === 'baranyi' || modeloOd === 'huang') && <CampoCinta etiqueta="Fracción de μ máx" tip={'Con Baranyi y Roberts o Huang las fases las fija el modelo:\nun tiempo es exponencial cuando su velocidad es al menos esta fracción de μ máx (entre 0 y 1; por defecto 0,5)\nLa misma que en las fases de las UFC'}><Num value={exp.aj.ufc_frac_exp ?? 0.5} onChange={(x) => s.setAj('ufc_frac_exp', x)} ancho={52} /></CampoCinta>}
          <BotonCinta simbolo="▥" texto="Fases" activo={fases && unaCepa} deshabilitado={!unaCepa} onClick={() => setFases(!fases)} tip={unaCepa ? 'Mostrar u ocultar las fases (lag, exponencial, estacionaria) de la cepa\nCon Baranyi y Roberts o Huang las fases las fija el modelo; con Linealizar log₁₀ el tramo se elige en «Revisión de la OD», con «Fases…» en la curva de cada cepa' : 'Las fases son distintas en cada cepa: dejá una sola cepa visible para verlas'} />
        </Grupo>
        {s.porCepa && (
          <Grupo titulo="Curva de cada cepa">
            <OpcionesCinta valor={s.modoCurva} onChange={(v) => s.setAj('placas_curva', v)} opciones={[['puntos', 'Sin promediar', '⋮', null, 'Por defecto: μmax, su error, OD₀, lag y el modelo salen de la regresión con todos los pocillos; K y AUC, de la media'], ['media', 'Promediada', 'x̄', null, 'Los parámetros se calculan sobre la media de los pocillos aceptados en cada tiempo']]} />
          </Grupo>
        )}
        <Grupo titulo="Gráfico">
          <BotonCinta icono="editar" texto="Personalizar" activo={pers} onClick={() => setPers(!pers)} tip="Títulos, valores sobre los puntos, tamaños de letra, grosores, ejes, leyenda, fondo y colores de las cepas" />
        </Grupo>
      </Cinta>
      <Cajon titulo="Personalizar gráfico" abierto={pers} onClose={() => setPers(false)}><PanelPersonalizar s={s} id="curva" /></Cajon>
      <Encabezado titulo="Curva OD vs t" sub={`${exp.cond.organismo ? exp.cond.organismo + ' · ' : ''}${exp.cond.medio ? exp.cond.medio + ' · ' : ''}${exp.cond.temperatura ? exp.cond.temperatura + ' °C · ' : ''}OD${exp.cond.lambda ? ` a ${exp.cond.lambda} nm` : ''}, con blanco restado y sin los puntos excluidos.${exp.aj.camino_on && exp.origenOd !== 'cubeta' ? ' OD llevada a 1 cm de camino óptico.' : ''}${base !== 'OD' ? ` Gráfico normalizado (${base}); los parámetros se calculan con la OD sin normalizar.` : ''}${(s.serie.aj.suavizado || 'ninguno') !== 'ninguno' ? ' Curvas suavizadas solo para el gráfico.' : ''}`} />
      <SelectorCepas s={s} muestras={muestras} hayMas={ocultasRep.length > 0} onMostrarTodas={() => setOcultasRep([])}
        tip={(m, on) => `${m}\nμmax ${fs(muDe(m), 3)} h⁻¹${finito(tdDe(m)) ? ` · td ${fx(tdDe(m), 2)} h` : ''}\n${on ? 'Clic para ocultar la cepa' : 'Clic para mostrarla'}`}
        extra={(m, on) => {
          const reps = s.porCepa ? [] : wsTodas.filter((w) => w.Muestra === m).sort((a, b) => a.Replica - b.Replica)
          return on && reps.length > 1 && reps.map((w) => {
            const vis = !ocultasRep.includes(w.Pocillo)
            return <button key={w.Pocillo} className={`rep ${vis ? 'on' : ''}`} style={vis ? { background: s.estilos[w.Pocillo]?.color || s.colores[m] } : undefined}
              onClick={() => setOcultasRep(vis ? [...ocultasRep, w.Pocillo] : ocultasRep.filter((x) => x !== w.Pocillo))}
              data-tip={`${nombreReplica(w.Muestra, w.Replica)}${exp.origenOd === 'tecan' ? ` · pocillo ${w.Pocillo}` : ''}\n${vis ? 'Clic para ocultarla del gráfico y de la media' : 'Clic para mostrarla'}`}>{w.Replica}</button>
          })
        }} />
      <Mosaico titulo={`${base} vs tiempo${m.puntos ? ` · media${m.barras ? ` ± ${etqErr}` : ''}` : ''}${m.replicas ? (s.porCepa ? ' · todos los pocillos' : ' · cada réplica') : ''}`}>
        <Grafico series={series} yTxt={ETQ_Y[escala] + (m.puntos && m.barras ? ` (media ± ${etqErr})` : '')} alto={470} nombre={`curva_${exp.nombre}`}
          titulo={exp.nombre} estilo={s.estiloGrafico('curva')} idEstilo="curva" onPuntoClick={m.puntos ? abrir : undefined} zonas={zonas} />
        {m.puntos && <p className="ayuda" style={{ marginTop: 8 }}>Cada punto es la media de las réplicas visibles de la cepa en ese tiempo; la barra es la {nombreErr}; n = réplicas técnicas (pocillos o series) de un mismo experimento{s.porCepa ? ', es decir, pocillos por tiempo' : ''}, y la leyenda indica el rango de n cuando cambia por exclusiones. En log₁₀ el punto es el log₁₀ de la media y la barra va de log₁₀(media − error) a log₁₀(media + error), con el error calculado con la OD lineal. Clic en un punto: cómo se calculó. Arrastrá sobre el gráfico para acercar y hacé doble clic para volver; clic derecho para personalizarlo o guardarlo.{nBajo && <b className="aviso-texto"> Hay tiempos con n &lt; 3: el error ({etqErr}) tiene muy poca base{error === 'ic95' ? ' y el IC 95 % con n = 2 usa t = 12,7' : ''}.</b>}</p>}
        {fases && unaCepa && (r0 ? <p className="ayuda" style={{ marginTop: 6 }}><b>{cepaF}</b>: lag hasta {fx(r0.t_ini_ventana, 2)} h · fase exponencial de {fx(r0.t_ini_ventana, 2)} a {fx(r0.t_fin_ventana, 2)} h{trF.origen === 'modelo' ? ` (lo fija el modelo ${MODELOS_UFC[modeloOd]}: velocidad ≥ ${fx(100 * fraccionExp(exp.aj), 0)} % de μ máx)` : trF.origen === 'respaldo' ? ' (el modelo no ajustó: ventana de mayor pendiente)' : manualF ? ' (tramo elegido a mano)' : ' (automático)'} · estacionaria desde {fx(r0.t_fin_ventana, 2)} h. {trF.origen === 'modelo' ? 'La fracción de μ máx se cambia en esta cinta.' : 'Para cambiar el tramo, abrí «Fases…» en la curva de la cepa, en «Revisión de la OD».'}</p> : <p className="ayuda" style={{ marginTop: 6 }}>{trF.aviso || `${cepaF}: sin fase exponencial detectada.`}</p>)}
        {sinLog.length > 0 && <p className="aviso-texto" style={{ marginTop: 6 }}>No se dibujan en log₁₀ ({sinLog.join(' · ')}): la OD neta (corregida por el blanco) es ≤ 0 en todas las lecturas de ese tiempo y el logaritmo no existe.</p>}
      </Mosaico>
      <ParametrosOd s={s} ajustes={ajustesM} modelo={modeloOd} />
      <TablaMediaTiempo titulo={`${base} por cepa y tiempo`} filas={filasTabla} unidad={base} etqErr={etqErr} fmt={(x) => fx(x, 4)} ficha={(f, foco) => fichaDe(`${f.cepa}|${f.tSeg}`, foco)}
        nota="Media aritmética de las réplicas visibles de cada cepa en cada tiempo, con su error y su rango; en log₁₀, el log₁₀ de esa media y de los extremos del rango (la escala del gráfico no cambia las cuentas). Con menos de 3 réplicas no hay EEM ni IC 95 %." />
    </div>
  )
}
