// ============================================================
// Parámetros de OD por cepa: resumen entre réplicas, ajuste del modelo a ln(OD) (con caché por cepa) y tramo exponencial que rige.
// Reciben el estado de la app (s): pre, res, serie, exp, colores, estilos.
// ============================================================
import { finito, media, mediana } from '../comun/analisis.js'
import { resumenReplicas } from '../comun/estadistica.js'
import { nombreReplica, opAnalisis } from './pipeline.js'
import { MODELOS_UFC, ajusteDmfit, fasesDeAjuste, fraccionExp } from '../ufc/index.js'
import { replicaOd } from '../../datos/experimento.js'
import { fs, fx } from '../../comun/utils.js'

export const CLAVES_RESUMEN = ['mu_max', 'td_h', 'lag_h', 'K', 'delta_od', 'generaciones', 'auc_od', 't_umbral_od_h', 'od0', 'r2']

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

// ---------- modelo ajustado a la OD de cada cepa (Linealizar log₁₀ o Baranyi y Roberts) ----------
// Por cepa: la media de las réplicas en cada tiempo; por réplica: sus lecturas. Con la OD del análisis (corregida, sin suavizar ni
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
  // el ajuste (Baranyi y Roberts) es costoso: se calcula UNA vez por análisis, modelo y CEPA,
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
    // Baranyi y Roberts o Huang con varias series (ajuste por cepa): la media de las réplicas en cada tiempo, como en los recuentos
    // (decisión del usuario 2026-11-16). Una sola serie (ajuste por réplica): sus lecturas. «Linealizar» sigue el modo de la curva.
    const conMedia = modelo === 'baranyi' || modelo === 'huang' ? g.length > 1 : s.porCepa && s.modoCurva === 'media'
    if (conMedia) {
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

// Ventana automática de una cepa: la mediana de las ventanas de sus réplicas (con una curva por réplica cada pocillo tiene la suya)
export function ventanaDeFilas(filas) {
  const f = (filas || []).filter((r) => finito(r.t_ini_ventana) && finito(r.t_fin_ventana))
  return f.length ? [mediana(f.map((r) => r.t_ini_ventana)), mediana(f.map((r) => r.t_fin_ventana))] : null
}

// Tramo (fase exponencial) de la OD de una cepa y quién lo fija, según el modelo de «Curva OD vs t» (opción curva.modelo):
//   Linealizar log₁₀ (o sin curva): la ventana de mayor pendiente (origen 'auto').
//   Baranyi y Roberts o Huang: lo fija el modelo (velocidad ≥ fracción de μ máx, aj.ufc_frac_exp) ('modelo').
//   Si el modelo no ajusta se usa el de la ventana y se avisa ('respaldo').
export const modeloOdDe = (s) => s.exp.opciones?.['curva.modelo'] || 'baranyi'

export function tramoOdRige(s, m, filas) {
  const f = filas || (s.res || []).filter((x) => x.Muestra === m)
  const modelo = modeloOdDe(s)
  const ventana = ventanaDeFilas(f)
  if ((modelo === 'baranyi' || modelo === 'huang') && m && f.length) {
    const a = ajustesOd(s, modelo, [m], s.exp.opciones?.['curva.lagfijo'] ?? '')[0]
    const fz = a?.c?.ok && a.c.mu > 0 ? fasesDeAjuste(a.c, fraccionExp(s.exp.aj)) : null
    if (fz && finito(fz.tIni) && finito(fz.tFin)) return { ventana: [fz.tIni, fz.tFin], origen: 'modelo', modelo }
    return { ventana, origen: 'respaldo', modelo, aviso: `${m}: el modelo de la OD no ajustó; se usa la ventana de mayor pendiente` }
  }
  return { ventana, origen: 'auto', modelo }
}

// ---------- μ por OD de cada cepa según el método elegido en «Modelo» ----------
// Una sola fuente para el Resumen, OD ↔ UFC, Datos y Métodos: el número informado SIEMPRE corresponde al método que se nombra.
//   «Linealizar log₁₀» o sin curva → ventana de ln(OD) (resumen entre réplicas, o EE de la pendiente con una curva por cepa)
//   Baranyi y Roberts o Huang     → μ del modelo (por cepa: ± EE del ajuste; por réplica: media ± DE de los ajustes)
// Si el modelo no ajusta se informa la de la ventana y se avisa (respaldo).
export const NOMBRE_METODO_OD = { ventana: 'ventana de ln(OD)', baranyi: 'Baranyi y Roberts', huang: 'Huang' }
export const metodoOdDe = (s) => { const m = modeloOdDe(s); return m === 'baranyi' || m === 'huang' ? m : 'ventana' }
export function muOdPorCepa(s) {
  if (!s.res?.length) return []
  const metodo = metodoOdDe(s), o = s.exp.opciones || {}
  const porRep = !!o['curva.ajusteRep'] && !s.porCepa
  return resumenPorCepa(s.res, ['mu_max', 'td_h', 'lag_h']).map((r) => {
    const cv = celdaResumen(r, 'mu_max'), ct = celdaResumen(r, 'td_h')
    const ventana = { Muestra: r.Muestra, r, metodo: 'ventana', etq: NOMBRE_METODO_OD.ventana, mu: r.mu_max.m, err: cv.err, tipoErr: cv.tipo, td: r.td_h.m, errTd: ct.err, lag: r.lag_h.m, n: r.nTxt, respaldo: '' }
    if (metodo === 'ventana') return ventana
    const aj = ajustesOd(s, metodo, [r.Muestra], o['curva.lagfijo'] ?? '', porRep).filter((a) => a.c?.ok && a.c.mu > 0)
    if (!aj.length) return { ...ventana, respaldo: `${MODELOS_UFC[metodo]} no ajustó: se informa la μ de la ventana de ln(OD)` }
    if (porRep) {
      const mu = resumenReplicas(aj.map((a) => a.c.mu)), lag = resumenReplicas(aj.map((a) => a.c.lag_h))
      return { Muestra: r.Muestra, r, metodo, etq: `${MODELOS_UFC[metodo]} (un ajuste por réplica)`, mu: mu.m, err: mu.sd, tipoErr: finito(mu.sd) ? 'DE' : null, td: Math.LN2 / mu.m, errTd: finito(mu.sd) ? (Math.LN2 / mu.m) * (mu.sd / mu.m) : NaN, lag: lag.m, errLag: lag.sd, n: String(aj.length), ajustes: aj, respaldo: '' }
    }
    const c = aj[0].c
    return { Muestra: r.Muestra, r, metodo, etq: MODELOS_UFC[metodo], mu: c.mu, err: c.ee_mu, tipoErr: finito(c.ee_mu) ? 'EE' : null, td: c.td_h, errTd: c.ee_td, lag: c.lag_h, errLag: c.ee_lag, n: r.nTxt, a: aj[0], respaldo: '' }
  })
}
// texto breve del método con el que se informa la μ por OD (para rótulos y notas)
export function textoMetodoOd(s, filas = muOdPorCepa(s)) {
  const base = filas.find((x) => !x.respaldo)?.etq || NOMBRE_METODO_OD.ventana
  const resp = filas.filter((x) => x.respaldo).map((x) => x.Muestra)
  return base + (resp.length ? ` (${resp.join(', ')}: ventana de ln(OD), el modelo no ajustó)` : '')
}
