// ============================================================
// Curva OD vs t: el gráfico de las curvas (media ± error o cada réplica) y, debajo, cómo se obtiene la ecuación de la
// fase exponencial (ln(OD), qué tramo, qué datos), la ecuación de cada curva y los parámetros.
// ============================================================
import { useMemo, useState } from 'react'
import { useOpcion } from '../../ui/opciones.js'
import { finito, media } from '../../calculo/comun/analisis.js'
import { etiquetaOd, nombreReplica } from '../../calculo/od/pipeline.js'
import { Encabezado, Vacio } from '../../ui/base.jsx'
import { Grafico } from '../../ui/graficos/grafico.jsx'
import { fs, fx } from '../../comun/utils.js'
import { BotonCinta, Cajon, Cinta, Grupo, Mosaico, OpcionesCinta } from '../../ui/cinta.jsx'
import { PanelPersonalizar } from '../../ui/graficos/personalizar.jsx'
import { GrupoMostrar, conEtiquetas, textoMostrar, useMostrar } from '../../ui/mostrar.jsx'
import { SelectorCepas, cepasOcultas } from '../../ui/cepas.jsx'
import { fichaMediaTiempo } from '../../fichas/index.js'
import { ParametrosOd } from './Parametros.jsx'
import { ajustesOd, resumenPorCepa, tramoOdRige } from '../../calculo/od/parametros.js'
import { GrupoModeloOd, useModeloOd } from './ModeloOd.jsx'
import { MODELOS_UFC, fraccionExp, lineasMedia } from '../../calculo/ufc/index.js'
import { TablaMediaTiempo } from '../../ui/tablaMedia.jsx'
import { replicaOd } from '../../datos/experimento.js'
import { mediaPorTiempo, textoErrMedia, egDeMedia } from '../../calculo/od/medias.js'

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
  const [ajusteRep, setAjusteRep] = useOpcion('curva.ajusteRep', false)   // un ajuste por réplica (cada una con su ecuación)
  const [ocultasRep, setOcultasRep] = useState([])   // réplicas (pocillos) ocultas en el gráfico
  const { modelo: modeloOd, lag: lagFijo, mcurv: mcurvOd, nmax: nmaxOd, pred: predOd } = useModeloOd()   // menú «Modelo» (ModeloOd.jsx)
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
  const ajustesTodas = useMemo(() => ajustesOd(s, modeloOd, muestras, lagFijo, ajusteRep && !s.porCepa), [s.pre, s.res, s.modoCurva, modeloOd, lagFijo, ajusteRep, mcurvOd, nmaxOd, muestras.join('|'), exp.aj.an_ancho, exp.aj.an_minpts, exp.aj.an_r2, exp.aj.an_lnmin]) // eslint-disable-line react-hooks/exhaustive-deps
  const ajustesM = ajustesTodas.filter((a) => visibles.includes(a.cepa) && !ocultasRep.includes(a.id))
  const kM = { lineal: (y) => 10 ** y, ln: (y) => y * Math.LN10, log10: (y) => y }[escala]
  if (modeloOd !== 'no' && base === 'OD') ajustesM.forEach((a) => {
    if (!a.c.ok) return
    series.push({ id: 'aj' + a.id, cepa: a.cepa, dash: a.dash || undefined, nombre: `${a.nombre}: ${modeloOd === 'lineal' ? 'linealizar log₁₀' : MODELOS_UFC[modeloOd]}`, color: a.color, ancho: 2, 
      data: Array.from({ length: 121 }, (_, i) => a.c.t0 + ((a.c.t1 - a.c.t0) * i) / 120).map((x) => ({ x, y: kM(a.c.pred10(x)), tip: `${a.id} · ${MODELOS_UFC[modeloOd]}
t = ${fx(x, 2)} h
OD = ${fx(10 ** a.c.pred10(x), 4)}` })) })
  })
  const hastaOd = Math.min(Math.max(Number(predOd?.hasta) > 0 ? Number(predOd.hasta) : 24, 0), 1000)
  if (predOd?.on && (modeloOd === 'baranyi' || modeloOd === 'huang') && base === 'OD') ajustesM.forEach((a) => {
    if (!a.c.ok || !(hastaOd > a.c.t1)) return
    series.push({ id: 'pr' + a.id, cepa: a.cepa, nombre: `${a.nombre}: predicción`, color: a.color, ancho: 2, dash: '7 5',
      data: Array.from({ length: 81 }, (_, i) => a.c.t1 + ((hastaOd - a.c.t1) * i) / 80).map((x) => ({ x, y: kM(a.c.pred10(x)), tip: `${a.id} · predicción\nt = ${fx(x, 2)} h\nOD = ${fx(10 ** a.c.pred10(x), 4)}` })) })
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
  // tiempos en que el logaritmo no existe (OD neta ≤ 0 en todas las lecturas): no se dibujan, y se avisa
  const sinLog = escala === 'lineal' ? [] : visibles.flatMap((cepa) => {
    const g = ws.filter((w) => w.Muestra === cepa)
    const crudo = new Set(g.flatMap((w) => w.t.filter((t, i) => finito(w.y[i]))))
    const ok = new Set(mediaPorTiempo(g, tr, error).filter((q) => finito(q.m)).map((q) => q.t))
    return [...crudo].filter((t) => !ok.has(t)).sort((a, b) => a - b).map((t) => `${cepa}: t = ${fx(t / 3600, 2)} h`)
  })
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
        {!s.porCepa && modeloOd !== 'no' && (
          <Grupo titulo="Ajuste">
            <OpcionesCinta valor={ajusteRep ? 'rep' : 'cepa'} onChange={(v) => setAjusteRep(v === 'rep')} opciones={[['cepa', 'Por cepa', 'x̄', null, 'Un ajuste por cepa, con la media de sus réplicas en cada tiempo'], ['rep', 'Por réplica', '⋮⋮', null, 'Un ajuste por réplica: cada una con su curva, su ecuación y sus parámetros, y la media ± DE de la cepa']]} />
          </Grupo>
        )}
        <GrupoModeloOd s={s} botonFases={<BotonCinta simbolo="▥" texto="Fases" activo={fases && unaCepa} deshabilitado={!unaCepa} onClick={() => setFases(!fases)} tip={unaCepa ? 'Mostrar u ocultar las fases (lag, exponencial, estacionaria) de la cepa\nCon Baranyi y Roberts o Huang las fases las fija el modelo; con Linealizar log₁₀ el tramo se elige en «Revisión de la OD», con «Fases…» en la curva de cada cepa' : 'Las fases son distintas en cada cepa: dejá una sola cepa visible para verlas'} />} />
        {s.porCepa && (
          <Grupo titulo="Ventana exponencial">
            <OpcionesCinta valor={s.modoCurva} onChange={(v) => s.setAj('placas_curva', v)} opciones={[['puntos', 'Sin promediar', '⋮', null, 'Por defecto: μmax de la ventana, su error, OD₀ y lag salen de la regresión con todos los pocillos; K y AUC, de la media. Baranyi y Roberts y Huang se ajustan siempre a la media de cada tiempo'], ['media', 'Promediada', 'x̄', null, 'Los parámetros se calculan sobre la media de los pocillos aceptados en cada tiempo']]} />
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
        {m.puntos && <p className="ayuda" style={{ marginTop: 8 }}>Media ± {etqErr} de las réplicas {replicaOd(exp.origenOd).tipo}. En log₁₀: log₁₀ de la media; barra de log₁₀(media − {etqErr}) a log₁₀(media + {etqErr}).{nBajo && <b className="aviso-texto"> n &lt; 3 en algunos tiempos.</b>}</p>}
        {fases && unaCepa && (r0 ? <p className="ayuda" style={{ marginTop: 6 }}><b>{cepaF}</b>: lag hasta {fx(r0.t_ini_ventana, 2)} h · fase exponencial de {fx(r0.t_ini_ventana, 2)} a {fx(r0.t_fin_ventana, 2)} h{trF.origen === 'modelo' ? ` (${MODELOS_UFC[modeloOd]}: μ ≥ ${fx(100 * fraccionExp(exp.aj), 0)} % de μ máx)` : trF.origen === 'respaldo' ? ' (sin ajuste del modelo: ventana de mayor pendiente)' : manualF ? ' (tramo manual)' : ' (automático)'} · {r0.t_fin_ventana >= tMax - 1e-6 ? 'sin fase estacionaria en los datos' : `estacionaria desde ${fx(r0.t_fin_ventana, 2)} h`}.</p> : <p className="ayuda" style={{ marginTop: 6 }}>{trF.aviso || `${cepaF}: sin fase exponencial detectada.`}</p>)}
        {sinLog.length > 0 && <p className="aviso-texto" style={{ marginTop: 6 }}>Sin valor en log₁₀ ({sinLog.join(' · ')}): OD neta ≤ 0.</p>}
      </Mosaico>
      <ParametrosOd s={s} ajustes={ajustesM} modelo={modeloOd} />
      <TablaMediaTiempo titulo={`${base} por cepa y tiempo`} filas={filasTabla} unidad={base} etqErr={etqErr} fmt={(x) => fx(x, 4)} ficha={(f, foco) => fichaDe(`${f.cepa}|${f.tSeg}`, foco)}
        nota="Media aritmética de las réplicas ± error; en log₁₀, log₁₀ de la media y de sus límites. EEM e IC 95 % requieren n ≥ 3." />
    </div>
  )
}
