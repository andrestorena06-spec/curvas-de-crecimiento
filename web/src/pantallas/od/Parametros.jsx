// ============================================================
// Parámetros de OD y comparación OD vs recuento. No es una pantalla propia:
//   · ParametrosOd va debajo del gráfico de «Curva OD vs t»: cómo se obtiene la ecuación (qué datos, ln(OD), qué tramo),
//     la ecuación de cada curva con su ventana y una calculadora, y los parámetros por cepa y por réplica
//   · SeccionComparacion va en «OD ↔ UFC»
// Cada número abre con un clic su ficha «Cómo se calculó».
// ============================================================
import { useMemo, useState } from 'react'
import { useOpcion } from '../../ui/opciones.js'
import { AYUDA, MODELOS_ETQ, PARAMS } from '../../app/ayuda.js'
import { desvio, finito, media } from '../../calculo/comun/analisis.js'
import { resumenReplicas } from '../../calculo/comun/estadistica.js'
import { ajustarModelo } from '../../calculo/comun/modelos.js'
import { nombreReplica, opAnalisis } from '../../calculo/od/pipeline.js'
import { MODELOS_UFC, NOMBRE_VARIANTE, ajusteDmfit, puntosUfc } from '../../calculo/ufc/index.js'
import { EcuacionModelo } from '../../ui/ecuacion.jsx'
import { EcRectaOd, EcRectaOdExp } from '../../ui/ecuacionBonita.jsx'
import { useTema } from '../../estilo/tema.js'
import { Campo, Check, Num, Seg, Sel } from '../../ui/base.jsx'
import { replicaOd } from '../../datos/experimento.js'
import { Grafico } from '../../ui/graficos/grafico.jsx'
import { Valor } from '../../fichas/FichaCalculo.jsx'
import { fichaComparacion, fichaModeloOd, fichaModeloUfc, fichaParamOd, fichaResumen } from '../../fichas/index.js'
import { fs, fx, tCuantil } from '../../comun/utils.js'
import { crecimientoPorCepa } from '../ufc/ParamUfc.jsx'

export const CLAVES_RESUMEN = ['mu_max', 'td_h', 'lag_h', 'K', 'delta_od', 'generaciones', 'auc_od', 't_umbral_od_h', 'od0', 'r2']
// tabla de todas las curvas: las columnas principales y, con «Más columnas», el resto
const CLAVES_PRINCIPALES = ['od0', 'mu_max', 'td_h', 'lag_h', 'K', 'generaciones', 'auc_od', 'r2']
const CLAVES_TABLA = ['od0', 'mu_max', 'td_h', 'lag_h', 'K', 't_K_h', 'delta_od', 'generaciones', 'auc_od', 'auc_ln', 't_umbral_od_h', 'dod_max', 't_max_dod_h', 'mu_spline', 't_estacionaria', 't_muerte', 'caida_pct', 'r2']
export const tipDe = (k) => (AYUDA[k] ? `${PARAMS[k]}\n${AYUDA[k].sig}\n\n${AYUDA[k].interp}` : PARAMS[k])

// Resumen por cepa: media, DE e IC 95 % entre réplicas.
//   · Varias filas por cepa (una por pocillo/serie): n = número de réplicas (pocillos o series, ver replicaOd) de UN experimento;
//     el «±» es la DE entre ellas.
//   · Una sola fila por cepa (placas por tiempo: una curva por cepa): n = pocillos por tiempo y el único error
//     disponible es el EE de la pendiente de μmax (se_mu), que NO es variabilidad entre réplicas.
//   · r[k].n = valores finitos que entraron en la media de ese parámetro (puede ser menor que n si alguna réplica no lo dio).
//   · td = ln 2 / μ̄ (con la μ media), no el promedio de los td; su DE e IC se propagan de los de μ (primer orden).
//   · R² no se promedia ni lleva DE (es la calidad de cada ajuste, no una magnitud): se informa el más bajo (el peor ajuste).
export function resumenPorCepa(res, claves = CLAVES_RESUMEN) {
  const muestras = [...new Set(res.map((r) => r.Muestra))]
  return muestras.map((m) => {
    const g = res.filter((r) => r.Muestra === m)
    const unico = g.length === 1
    const placas = unico && g[0].n_pocillos
    // placas por tiempo: n = pocillos de la cepa en cada tiempo (la curva junta los de todos los tiempos)
    const nTxt = placas ? (g[0].n_por_tiempo_min && g[0].n_por_tiempo_min !== g[0].n_por_tiempo_max ? `${g[0].n_por_tiempo_min}–${g[0].n_por_tiempo_max}` : String(g[0].n_por_tiempo_max || g[0].n_pocillos)) : String(g.length)
    const out = { Muestra: m, n: placas ? g[0].n_por_tiempo_max || g[0].n_pocillos : g.length, nTxt, n_lecturas: placas ? g[0].n_lecturas : NaN, n_curvas: g.length, unico,
      unidad: placas ? 'pocillos por tiempo' : 'réplicas', se_mu: unico ? g[0].mu_se : NaN }
    claves.forEach((k) => {
      const v = g.map((r) => r[k]).filter(finito)
      const n = v.length
      if (k === 'r2') { out[k] = { m: n ? Math.min(...v) : NaN, sd: NaN, n, ic: NaN, minimo: true }; return }
      const est = resumenReplicas(v)
      out[k] = { m: est.m, sd: est.sd, n, ic: est.ic }
    })
    if (claves.includes('td_h')) {
      const v = g.map((r) => r.mu_max).filter(finito)
      const est = resumenReplicas(v), n = est.n, mu = est.m, sd = est.sd
      if (n && mu > 0) {
        const td = Math.LN2 / mu, f = td / mu     // d td / d μ = −td / μ (en valor absoluto)
        out.td_h = { m: td, sd: finito(sd) ? f * sd : NaN, n, ic: finito(est.ic) ? f * est.ic : NaN, deMu: true }
      } else out.td_h = { m: NaN, sd: NaN, n: 0, ic: NaN, deMu: true }
    }
    return out
  })
}

// Texto del «±» de una celda del resumen.
//   tipo: 'DE' (entre réplicas), 'EE' (error estándar de la pendiente de μmax, una sola curva por cepa) o null
export function celdaResumen(r, k) {
  const c = r[k]
  // una curva por cepa: EE de la pendiente para μmax y, por el método delta, para td = ln 2 / μ (EE(td) = td · EE(μ) / μ)
  const ee = r.unico && (k === 'mu_max' || k === 'td_h') && finito(r.se_mu)
  const tipo = finito(c.sd) ? 'DE' : ee ? 'EE' : null
  const err = tipo === 'DE' ? c.sd : tipo === 'EE' ? (k === 'td_h' ? (c.m * r.se_mu) / r.mu_max.m : r.se_mu) : NaN
  return { tipo, err, pocoN: !r.unico && c.n > 1 && c.n < 3 }
}

// ficha de una celda del resumen por cepa: con una sola curva por cepa, la del parámetro de esa curva; si no, media ± DE
const etiquetaRep = (s) => (x) => `${nombreReplica(x.Muestra, x.Replica)}${s.exp.origenOd === 'tecan' ? ` (${x.Pocillo})` : ''}`
export const opcFicha = (s, m) => ({ nombre: m, color: s.colores[m], todos: s.porCepa && s.modoCurva === 'puntos' })
export function fichaCeldaResumen(s, r, k) {
  return () => {
    const filas = (s.res || []).filter((x) => x.Muestra === r.Muestra)
    if (r.unico) {
      const fila = filas[0]
      return fichaParamOd(k, fila, s.seriesAn.find((w) => w.Pocillo === fila.Pocillo), opAnalisis(s.serie.aj), opcFicha(s, r.Muestra))
    }
    // el cálculo de cada réplica (de su propia curva), para mostrarlo lado a lado antes de promediar
    const op = opAnalisis(s.serie.aj), claves = k === 'td_h' ? ['mu_max', 'td_h'] : [k]
    const etq = etiquetaRep(s)
    const porReplica = filas.map((fila) => ({ etiqueta: etq(fila), fichas: claves.map((kk) => fichaParamOd(kk, fila, s.seriesAn.find((w) => w.Pocillo === fila.Pocillo), op, { ...opcFicha(s, fila.Muestra), nombre: etq(fila) })) }))
    return fichaResumen(r, k, filas, { etiqueta: etq, porReplica })
  }
}
export const fichaCurva = (s, fila, k) => () => fichaParamOd(k, fila, s.seriesAn.find((w) => w.Pocillo === fila.Pocillo), opAnalisis(s.serie.aj),
  { ...opcFicha(s, fila.Muestra), nombre: s.porCepa ? fila.Muestra : `${nombreReplica(fila.Muestra, fila.Replica)}${s.exp.origenOd === 'tecan' ? ` (${fila.Pocillo})` : ''}` })

// Contenido de una celda del resumen: valor ± error (con la marca del tipo) y n del parámetro si difiere
export function CeldaResumen({ r, k, s }) {
  const c = celdaResumen(r, k)
  return (
    <td className="num">
      <Valor f={s ? fichaCeldaResumen(s, r, k) : null}>{fs(r[k].m, 4)}{c.tipo ? <small className="ayuda"> ± {fs(c.err, 2)}{c.tipo === 'EE' ? ' (EE)' : ''}</small> : null}</Valor>
      {!r.unico && r[k].n < r.n_curvas && r[k].n > 0 ? <small className="ayuda"> [n={r[k].n}]</small> : null}
      {c.pocoN ? <small style={{ color: 'var(--aviso)' }} data-tip="n < 3: DE e IC 95 % poco confiables"> ⚠</small> : null}
    </td>
  )
}

// Rótulos de n y de «±» para el encabezado de la tabla y el texto al pie
export const textoErrorResumen = (porCepa, origen) => porCepa
  ? 'n: pocillos por tiempo. μmax ± EE de la pendiente; EE(td) por el método delta. Los demás parámetros provienen de una sola curva.'
  : `Media ± DE de n réplicas ${replicaOd(origen).tipo} (${replicaOd(origen).de}) de un experimento. td = ln 2 / μ̄. R²: mínimo entre réplicas. [n = …]: parámetro no calculable en todas las réplicas.`
export const avisoNBajo = (resumen) => {
  const poco = resumen.filter((r) => !r.unico && r.n_curvas < 3).map((r) => `${r.Muestra} (n = ${r.n_curvas})`)
  return poco.length ? `Con n < 3 la DE tiene muy poca base y no se calculan EEM ni IC 95 %: ${poco.join(', ')}.` : null
}

// ---------- modelo ajustado a la OD de cada cepa (Linealizar log₁₀ o Baranyi y Roberts) ----------
// Usa TODOS los puntos de la cepa (cada lectura, no la media), con la OD del análisis (corregida, sin suavizar ni
// normalizar) y ln(OD). Con «Promediada» en placas por tiempo, la media de cada tiempo. Devuelve [{ id, nombre, color, c, cc }]:
// c = el ajuste (se dibuja), cc = lo que muestra la ecuación (sin ecuación si Baranyi y Roberts no llega a la meseta).
const cacheAjustesOd = new WeakMap()
// parámetros fijos del modelo de la OD (menú «Modelo» de Curva OD): curvatura m y OD máx (en OD; al ajuste va en log₁₀)
export const parFijosOd = (s) => {
  const o = s.exp.opciones || {}
  const m = Number(o['curva.mcurv']), n = Number(o['curva.nmax'])
  return { mcurv: m > 0 ? m : 1, nmax: n > 0 ? n : NaN, nmax10: n > 0 ? Math.log10(n) : NaN }
}
export function ajustesOd(s, modelo, muestras, lagFijo = '', porReplica = false) {
  if (!modelo || modelo === 'no' || !s.pre?.analisis) return []
  // el ajuste (Baranyi y Roberts sobre todos los puntos) es costoso: se calcula UNA vez por análisis, modelo y CEPA,
  // y lo reusan todas las pantallas (la curva con todas las cepas, las fases de una cepa, la calibración, Datos)
  const fijos = parFijosOd(s)
  const base = [modelo, lagFijo, fijos.mcurv, fijos.nmax10, s.modoCurva].join('#')
  let porRes = cacheAjustesOd.get(s.res || s.pre)
  if (!porRes) { porRes = new Map(); cacheAjustesOd.set(s.res || s.pre, porRes) }
  // por réplica (cinéticas y cubeta; en placas por tiempo cada tiempo es otro pocillo y no hay curvas por réplica):
  // una ecuación y sus parámetros por réplica
  if (porReplica && !s.porCepa) {
    const ws = s.pre.analisis.filter((w) => !w.EsBlanco)
    return muestras.flatMap((m) => ws.filter((w) => w.Muestra === m).sort((a, b) => a.Replica - b.Replica).map((w) => {
      const clave = base + '#r#' + w.Pocillo
      if (!porRes.has(clave)) porRes.set(clave, ajusteDeSeries(s, modelo, [w], lagFijo, fijos))
      const est = s.estilos?.[w.Pocillo] || {}
      const nombre = nombreReplica(m, w.Replica) + (s.exp.origenOd === 'tecan' ? ` (${w.Pocillo})` : '')
      return { ...porRes.get(clave), id: w.Pocillo, cepa: m, nombre, color: est.color || s.colores[m], dash: est.dash }
    }))
  }
  return muestras.map((m) => {
    const clave = base + '#' + m
    if (!porRes.has(clave)) porRes.set(clave, calcularAjustesOd(s, modelo, [m], lagFijo, fijos)[0])
    const a = porRes.get(clave)
    return { ...a, cepa: m, color: s.colores[m] }   // el color puede cambiar sin recalcular
  })
}
function calcularAjustesOd(s, modelo, muestras, lagFijo, fijos = parFijosOd(s)) {
  const ws = s.pre.analisis.filter((w) => !w.EsBlanco)
  return muestras.map((m) => ({ id: m, nombre: m, color: s.colores[m], ...ajusteDeSeries(s, modelo, ws.filter((w) => w.Muestra === m), lagFijo, fijos) }))
}
// Ajuste del modelo a las lecturas de las series g (en ln OD). Entran las OD ≥ «OD mínima para ln» (an_lnmin, 0,01 por defecto),
// el mismo criterio que la ventana de μmax: cerca del blanco el logaritmo amplifica el ruido (decisión del usuario 2026-11-13).
function ajusteDeSeries(s, modelo, g, lagFijo, fijos) {
  const op = opAnalisis(s.serie.aj)
  {
    let t = [], ly = []
    const excl = new Set()
    if (s.porCepa && s.modoCurva === 'media') {
      const por = new Map()
      g.forEach((w) => w.t.forEach((tt, i) => { if (finito(w.y[i])) { if (!por.has(tt)) por.set(tt, []); por.get(tt).push(w.y[i]) } }))
      por.forEach((v, tt) => { const mm = media(v); if (mm > 0 && mm >= op.lnmin) { t.push(tt / 3600); ly.push(Math.log(mm)) } else excl.add(tt / 3600) })
    } else g.forEach((w) => w.t.forEach((tt, i) => { const y = w.y[i]; if (finito(y) && y > 0 && y >= op.lnmin) { t.push(tt / 3600); ly.push(Math.log(y)) } else if (finito(y)) excl.add(tt / 3600) }))
    const c = ajusteDmfit(t, ly, modelo, fijos.nmax10, fijos.mcurv, { ancho: op.ancho, minpts: op.minpts, r2min: op.r2min, quota: op.quota, lagFijo: lagFijo === '' ? NaN : Number(lagFijo) })
    if (c.tDatos0 === undefined) { c.tDatos0 = c.t0; c.tDatos1 = c.t1 }
    const cc = c
    const ex = [...excl].sort((x, y) => x - y)
    const aviso = ex.length ? `Excluidos del ajuste (OD < ${fs(op.lnmin, 3)}): t = ${ex.map((x) => fx(x, 2)).join(', ')} h.` : ''
    return { c, cc, aviso, pts: { t, ly } }
  }
}

// ---------- cómo se calcula la ecuación de OD vs t (con los ajustes editables) ----------
function ComoSeCalcula({ s }) {
  const aj = s.exp.aj
  const op = opAnalisis(s.serie.aj)
  const ancho = Number(aj.an_ancho) || 2
  const n = (k, a = 56) => <Num value={aj[k]} onChange={(v) => s.setAj(k, v)} ancho={a} />
  return (
    <div className="tarjeta como-se-calcula">
      <h2>Cómo se obtiene la ecuación de OD vs t</h2>
      <ol>
        <li><b>Qué datos toma.</b> La OD corregida por el blanco{s.exp.origenOd !== 'tecan' ? ' y por la dilución' : ''}, sin suavizar ni normalizar, {s.porCepa ? (s.modoCurva === 'puntos' ? 'con todos los pocillos de la cepa en cada tiempo (cada placa es un tiempo)' : 'de la curva media de cada cepa (la media de sus pocillos en cada tiempo; cada placa es un tiempo)') : 'de cada réplica por separado (cada una da su propia ecuación; la cepa se resume con la media)'}. Las lecturas excluidas en la Revisión no entran.</li>
        <li><b>Sí, toma logaritmo: log₁₀(OD)</b>. En la fase exponencial OD = OD₀ · 10<sup>b·t</sup>, así que log₁₀(OD) = log₁₀(OD₀) + b · t es una recta; su pendiente b (log₁₀/h) da la velocidad específica μ = b · ln 10 (h⁻¹). Las lecturas con OD menor que {n('an_lnmin', 60)} no entran, porque cerca del blanco el logaritmo amplifica el ruido.</li>
        <li><b>Toma solo la fase exponencial</b>, no toda la curva: el lag del principio y la meseta del final quedan afuera. Para encontrarla, el programa recorre la curva con una ventana de {n('an_ancho', 48)} h{op.ancho > ancho + 1e-9 ? ` (agrandada a ${fx(op.ancho, 2)} h para que entren las lecturas mínimas)` : ''}, con al menos {n('an_minpts', 44)} lecturas; en cada posición ajusta una recta a log₁₀(OD) por mínimos cuadrados, y se queda con la de <b>mayor pendiente</b> entre las que son bien rectas (R² ≥ {n('an_r2', 52)}). Después <b>amplía</b> esa ventana con las vecinas cuya pendiente es al menos el <Num value={aj.an_quota ?? 95} onChange={(v) => s.setAj('an_quota', v)} ancho={52} /> % de la máxima (0 = no ampliar; es el método «quota» de <i>growthrates</i>) y reajusta la recta con todos sus puntos: así la fase exponencial no queda más corta de lo que muestran los datos. Esa ventana se ve sombreada en el gráfico de abajo, y se puede elegir otra a mano arrastrando sobre él.</li>
        <li><b>Resultado:</b> log₁₀(OD) = a + b · t, válida solo dentro de esa ventana. De ella salen el tiempo de duplicación (td = log₁₀ 2 / b) y el lag: {s.exp.aj.an_lag_metodo === 'umbral' ? `el tiempo en que la OD llega a ${fs(op.lag_factor, 3)} × OD₀` : 'el tiempo en que la recta cruza el nivel inicial log₁₀(OD₀)'} <Seg value={aj.an_lag_metodo || 'tangente'} onChange={(v) => s.setAj('an_lag_metodo', v)} opciones={[['tangente', 'Tangente'], ['umbral', 'Umbral']]} />{aj.an_lag_metodo === 'umbral' && <> factor {n('an_lag_factor', 44)}</>}.</li>
      </ol>
      <details className="mas-ajustes">
        <summary>Otros cálculos (opcionales)</summary>
        <div className="fila" style={{ flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
          <Check label="μ por spline (para comparar)" checked={!!aj.an_spline} onChange={(v) => s.setAj('an_spline', v)} />
          <Campo label="OD umbral (tiempo hasta OD)">{n('an_umbral_od', 70)}</Campo>
          <Campo label="Fase exponencial: fracción de μmax">{n('an_frac_exp', 60)}</Campo>
          <Campo label="Estacionaria: fracción de μmax">{n('an_frac_est', 60)}</Campo>
          <Campo label="Muerte: caída desde K (%)">{n('an_muerte_pct', 60)}</Campo>
        </div>
      </details>
    </div>
  )
}

// Parámetros por cepa cuando el modelo es Baranyi y Roberts: salen del ajuste de ese modelo
// valor ± error estándar (en chico); OD₀ y OD máx: EE(OD) = OD · ln 10 · EE(log₁₀ OD) (método delta)
const pmOd = (txt, ee) => <>{txt}{finito(ee) && ee > 0 && <small className="ayuda"> ± {fs(ee, 2)}</small>}</>
function TablaBaranyiOd({ s, ajustes }) {
  const filas = ajustes.filter((a) => a.c)
  const porRep = filas.some((a) => a.id !== a.cepa)
  // por réplica: media ± DE de las réplicas de cada cepa (μ, λ, OD₀, OD máx; td = ln 2 / μ̄)
  const resumenCepa = (m) => {
    const ok = filas.filter((a) => a.cepa === m && a.c.ok)
    const ms = (f) => { const v = ok.map(f).filter(finito); return { m: v.length ? media(v) : NaN, de: v.length > 1 ? desvio(v) : NaN, n: v.length } }
    return { n: ok.length, mu: ms((a) => a.c.mu), lag: ms((a) => a.c.lag_h), od0: ms((a) => 10 ** a.c.y0), odmax: ms((a) => (a.c.sinAsintota ? NaN : 10 ** a.c.yEnd)) }
  }
  const mde = (q, d) => (finito(q.m) ? <>{fs(q.m, d)}{finito(q.de) && <small className="ayuda"> ± {fs(q.de, 2)}</small>}</> : '–')
  // cada número abre su ficha «Cómo se calculó» (el mismo modelo que para las UFC, con la OD)
  const V = (a, foco, txt) => <Valor f={() => fichaModeloOd(a.c, a.pts, { foco, nombre: a.nombre, color: a.color })}>{txt}</Valor>
  return (
    <div className="tarjeta">
      <h2>{porRep ? 'Parámetros por réplica' : 'Parámetros por cepa'} <span className="ayuda" style={{ fontWeight: 400 }}>· {MODELOS_UFC[ajustes[0]?.c?.modelo] || 'Baranyi y Roberts'} sobre ln(OD), con {s.porCepa && s.modoCurva === 'media' ? 'la media de cada tiempo' : porRep ? 'las lecturas de cada réplica' : 'todos los puntos'}</span></h2>
      <div className="tabla-scroll"><table className="tabla">
        <thead><tr><th>Cepa</th><th className="num">μ (h⁻¹)</th><th className="num">td (h)</th><th className="num">Lag λ (h)</th><th className="num">OD₀ (ajustada)</th><th className="num">OD máx</th><th className="num">R²</th><th className="num" data-tip={'R² ajustado por grados de libertad = 1 − (1 − R²)·(n − 1)/(n − p)\nEs el «R-square» que informa DMFit'}>R² ajustado</th><th className="num">EE del ajuste</th><th className="num" data-tip="Grados de libertad: puntos menos parámetros">n − p</th></tr></thead>
        <tbody>{filas.map((a, i) => [(a.c.ok ? (
          <tr key={a.id}><td><i className="punto" style={{ background: a.color, marginRight: 6 }} /><b>{a.nombre}</b>{a.c.variante && a.c.variante !== 'completo' && <small className="ayuda" data-tip={(a.c.notaVariante ? a.c.notaVariante + '\n' : '') + 'Variante del modelo elegida según los datos, como DMFit:\nsin lag si el lag del modelo completo da 0; sin meseta si los datos no llegan a la fase estacionaria'}> · {NOMBRE_VARIANTE[a.c.variante]}</small>}</td>
            <td className="num">{V(a, 'mu', <>{fs(a.c.mu, 4)}{finito(a.c.ee_mu) && <small className="ayuda"> ± {fs(a.c.ee_mu, 2)}</small>}</>)}</td><td className="num">{V(a, 'td', pmOd(fs(Math.LN2 / a.c.mu, 3), a.c.ee_td))}</td><td className="num">{V(a, 'lag', <>{fs(a.c.lag_h, 3)}{finito(a.c.ee_lag) && a.c.ee_lag > 0 && <small className="ayuda"> ± {fs(a.c.ee_lag, 2)}</small>}{a.c.lagFijo && <small className="ayuda"> (fijo)</small>}</>)}</td><td className="num">{V(a, 'y0', pmOd(fs(10 ** a.c.y0, 3), 10 ** a.c.y0 * Math.LN10 * a.c.ee_y0))}</td>
            <td className="num">{a.c.sinAsintota ? 'sin meseta' : V(a, 'yEnd', pmOd(fs(10 ** a.c.yEnd, 3), 10 ** a.c.yEnd * Math.LN10 * a.c.ee_ymax))}</td><td className="num">{V(a, 'r2', fx(a.c.r2, 3))}</td><td className="num">{fx(a.c.r2adj, 3)}</td><td className="num">{V(a, 'se', fs(a.c.se, 3))}</td><td className="num">{V(a, 'gl', String(a.c.gl))}</td></tr>
        ) : <tr key={a.id}><td><i className="punto" style={{ background: a.color, marginRight: 6 }} /><b>{a.nombre}</b></td><td colSpan={9} className="ayuda">{a.c.motivo}</td></tr>),
          porRep && filas[i + 1]?.cepa !== a.cepa && (() => { const r = resumenCepa(a.cepa); return r.n > 0 && (
            <tr key={'media' + a.cepa} className="total"><td><b>{a.cepa} · media ± DE</b> <small className="ayuda">(n = {r.n})</small></td>
              <td className="num">{mde(r.mu, 4)}</td><td className="num">{finito(r.mu.m) && r.mu.m > 0 ? fs(Math.LN2 / r.mu.m, 3) : '–'}</td><td className="num">{mde(r.lag, 3)}</td>
              <td className="num">{mde(r.od0, 3)}</td><td className="num">{mde(r.odmax, 3)}</td><td colSpan={5} /></tr>
          ) })()])}</tbody>
      </table></div>
      <p className="ayuda" style={{ marginTop: 6 }}>{porRep ? 'Réplicas: valores ± error estándar del ajuste. Cepa: media ± DE de las réplicas; td = ln 2 / μ̄.' : 'Valores ± error estándar del ajuste.'}</p>
    </div>
  )
}

// ---------- parámetros de OD (van debajo del gráfico de Curva OD vs t) ----------
export function ParametrosOd({ s, ajustes = [], modelo = 'no' }) {
  const { res, exp } = s
  const [sel, setSel] = useOpcion('parametros.curva', null)
  const [todas, setTodas] = useOpcion('parametros.todasColumnas', false)
  const resumen = useMemo(() => (res?.length ? resumenPorCepa(res) : []), [res])
  if (!res?.length) return null
  const p = sel && res.some((r) => r.Pocillo === sel) ? sel : res[0].Pocillo
  const claves = todas ? CLAVES_TABLA : CLAVES_PRINCIPALES
  return (<>
    {modelo === 'baranyi' || modelo === 'huang' ? <TablaBaranyiOd s={s} ajustes={ajustes} /> : (
    <div className="tarjeta">
      <h2>Parámetros por cepa <span className="ayuda" style={{ fontWeight: 400 }}>· {s.porCepa ? `una curva por cepa (${s.modoCurva === 'puntos' ? 'todos los pocillos' : 'media de cada tiempo'}); μmax ± EE de la pendiente` : `media ± DE entre réplicas ${replicaOd(exp.origenOd).tipo} (${replicaOd(exp.origenOd).de}) de un experimento`}</span></h2>
      <div className="tabla-scroll alta"><table className="tabla">
        <thead><tr><th>Cepa</th><th className="num" data-tip={textoErrorResumen(s.porCepa, exp.origenOd)}>n</th>{CLAVES_RESUMEN.map((k) => <th key={k} className="num" data-tip={tipDe(k) + (k === 'td_h' ? '\n\nEn este resumen: td = ln 2 / μ̄ (con la μ media de la cepa), no el promedio de los td.' : '')}>{k === 'r2' && !s.porCepa ? 'R² (el más bajo)' : PARAMS[k]}</th>)}</tr></thead>
        <tbody>{resumen.map((r) => (
          <tr key={r.Muestra}><td><i className="punto" style={{ background: s.colores[r.Muestra], marginRight: 6 }} /><b>{r.Muestra}</b></td>
            <td className="num" data-tip={`${r.nTxt} ${r.unidad}${r.unico ? ` (${r.n_lecturas} lecturas en la curva de la cepa)` : ` (réplicas ${replicaOd(exp.origenOd).tipo} de un experimento)`}`}>{r.nTxt} <small className="ayuda">{r.unidad}</small></td>
            {CLAVES_RESUMEN.map((k) => <CeldaResumen key={k} r={r} k={k} s={s} />)}
          </tr>
        ))}</tbody>
      </table></div>
      <p className="ayuda" style={{ marginTop: 6 }}>{textoErrorResumen(s.porCepa, exp.origenOd)}</p>
      {avisoNBajo(resumen) && <div className="aviso-caja" style={{ marginTop: 6, marginBottom: 0 }}>{avisoNBajo(resumen)}</div>}
    </div>
    )}
    {(modelo === 'baranyi' || modelo === 'huang' || modelo === 'lineal') && ajustes.length > 0 && (
      <div className="tarjeta">
        <EcuacionModelo tipo="od" nombreArchivo="modelo OD" filas={ajustes.map((a) => ({ id: a.id, nombre: a.nombre, color: a.color, c: modelo !== 'lineal' ? a.cc : a.c, aviso: a.aviso }))}
          nota={modelo === 'lineal' ? 'Linealizar log₁₀: log₁₀(OD) = a + b·t en la fase exponencial de cada cepa.' : `${MODELOS_UFC[modelo]} sobre ln(OD), con todos los puntos.`} />
      </div>
    )}
    {!s.porCepa && (
      <div className="tarjeta">
        <div className="fila" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Cada réplica</h2>
          <span className="espacio" />
          <button className="fantasma chico" onClick={() => setTodas(!todas)} data-tip="Mostrar u ocultar los parámetros secundarios (tiempos característicos, dOD/dt, spline, fases)">{todas ? 'Menos columnas' : 'Más columnas'}</button>
        </div>
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>{exp.origenOd === 'tecan' ? 'Pocillo' : 'Serie'}</th><th>Cepa</th><th className="num">Rép.</th>{claves.map((k) => <th key={k} className="num" data-tip={tipDe(k)}>{PARAMS[k]}</th>)}<th>Ventana exponencial</th><th>Avisos</th></tr></thead>
          <tbody>{res.map((r) => (
            <tr key={r.Pocillo} className={r.Pocillo === p ? 'elegida' : ''}>
              <td><button className="fantasma chico" onClick={() => setSel(r.Pocillo)} data-tip="Ver su ecuación arriba"><b>{r.Pocillo}</b></button></td><td>{r.Muestra}</td><td className="num">{r.Replica}</td>
              {claves.map((k) => <td key={k} className="num"><Valor f={fichaCurva(s, r, k)}>{fs(r[k], 4)}</Valor></td>)}
              <td>{finito(r.t_ini_ventana) ? `${fx(r.t_ini_ventana, 2)}–${fx(r.t_fin_ventana, 2)} h${r.ventana_manual ? ' (manual)' : ''}` : '–'}</td>
              <td style={{ whiteSpace: 'normal', minWidth: 200, fontSize: 12 }}>{r.aviso}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    )}
    <ComoSeCalcula s={s} />
  </>)
}

// ---------- μ por OD y por recuento (va en «OD ↔ UFC») ----------
// μ por OD (resumen de las réplicas, ventana de mayor pendiente) y por recuento (modelo de las UFC), por cepa: la misma fuente
// para la pantalla OD ↔ UFC y para Datos
export function comparacionMu(s) {
  const resumen = s.res?.length ? resumenPorCepa(s.res, ['mu_max', 'td_h', 'lag_h']) : []
  const crec = s.ufcRes?.hay ? crecimientoPorCepa(s.ufcRes, s.exp.aj) : []
  return [...new Set([...resumen.map((r) => r.Muestra), ...crec.map((x) => x.Muestra)])].map((m) => {
    const r = resumen.find((x) => x.Muestra === m), c = crec.find((x) => x.Muestra === m)?.c
    return { Muestra: m, r, c, mu_OD_h: r?.mu_max.m, mu_UFC_h: c?.ok ? c.mu : NaN, cociente: r && c?.ok ? r.mu_max.m / c.mu : NaN, td_OD_h: r?.td_h.m, td_UFC_h: c?.ok ? c.td_h : NaN, lag_OD_h: r?.lag_h.m, lag_UFC_h: c?.ok ? c.lag_h : NaN }
  })
}
export function SeccionComparacion({ s }) {
  const resumen = useMemo(() => (s.res?.length ? resumenPorCepa(s.res, ['mu_max', 'td_h', 'lag_h']) : []), [s.res])
  const crec = s.ufcRes?.hay ? crecimientoPorCepa(s.ufcRes, s.exp.aj) : []
  const cepas = [...new Set([...resumen.map((r) => r.Muestra), ...crec.map((x) => x.Muestra)])]
  return (
    <div className="tarjeta">
      <h2>μ por OD y por recuento</h2>
      <div className="tabla-scroll"><table className="tabla">
        <thead><tr><th>Cepa</th><th className="num">μ por OD (h⁻¹)</th><th className="num">μ por recuento (h⁻¹)</th><th className="num" data-tip="Si la OD siguiera exactamente a las células viables, ≈ 1">μ OD / μ recuento</th><th className="num">td OD (min)</th><th className="num">td recuento (min)</th><th className="num">λ OD (h)</th><th className="num">λ recuento (h)</th></tr></thead>
        <tbody>{cepas.map((m) => {
          const r = resumen.find((x) => x.Muestra === m), c = crec.find((x) => x.Muestra === m)?.c
          const q = r && c?.ok ? r.mu_max.m / c.mu : NaN
          const fU = (foco) => () => fichaModeloUfc(c, puntosUfc(s.ufcRes, m, s.exp.aj), { foco, nombre: m, color: s.colores[m] })
          return (
            <tr key={m}><td><i className="punto" style={{ background: s.colores[m], marginRight: 6 }} /><b>{m}</b></td>
              {r ? <CeldaResumen r={r} k="mu_max" s={s} /> : <td className="num">–</td>}
              <td className="num">{c?.ok ? <Valor f={fU('mu')}>{fs(c.mu, 4)}</Valor> : '–'}</td>
              <td className="num"><Valor f={() => fichaComparacion(m, r, c)}><b>{fx(q, 2)}</b></Valor></td>
              {r ? <CeldaResumen r={r} k="td_h" s={s} /> : <td className="num">–</td>}
              <td className="num">{c?.ok ? <Valor f={fU('td')}>{fs(c.td_h, 4)}</Valor> : '–'}</td>
              {r ? <CeldaResumen r={r} k="lag_h" s={s} /> : <td className="num">–</td>}
              <td className="num">{c?.ok && finito(c.lag_h) ? <Valor f={fU('lag')}>{fs(c.lag_h, 3)}</Valor> : '–'}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
      <p className="ayuda" style={{ marginTop: 6 }}>μ OD: pendiente de ln(OD) en la fase exponencial ({s.porCepa ? 'curva de la cepa' : 'media de las réplicas'}). μ UFC: ajuste del modelo a ln(UFC/mL). Cociente descriptivo, sin prueba estadística.</p>
    </div>
  )
}
