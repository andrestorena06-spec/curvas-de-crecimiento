// ============================================================
// Recuento de UFC a partir de diluciones seriadas (grilla de gotas, tabla o placas de Petri).
//   Réplica: UFC/mL = C · D / V con una sola dilución por cepa y tiempo (la elegida o la sugerida).
//   Tiempo: media aritmética de las réplicas; error DE, EEM o IC 95 % sobre los valores lineales.
//   En log₁₀: log₁₀ de la media; la barra va de log₁₀(media − error) a log₁₀(media + error).
// ============================================================
import { LETRAS, convertirNumero } from '../od/lectura.js'
import { desvio, finito, interpolar, media } from '../comun/analisis.js'
import { ERRORES, errorElegido, resumenReplicas } from '../comun/estadistica.js'
import { fx, sciCorto, tCuantil } from '../../comun/utils.js'

// ---------- parámetros ----------
export const ufcDef = () => ({
  vol: 0.02,            // mL por gota
  factor: 5,            // cada pocillo está `factor` veces más diluido que el anterior (= volumen final / toma)
  toma: 40, final: 200, // µL que se pasan de un pocillo al siguiente y volumen final de cada pocillo
  primero: 'dilucion',  // 'madre': el pocillo 1 es la solución madre · 'dilucion': el pocillo 1 ya es una dilución
  madre: { usar: false, toma: 20, final: 200 },  // solución madre (opcional): se toma `toma` µL para llegar al pocillo 1 con volumen `final`
  c0: 1e6,              // UFC/mL esperadas en el pocillo de partida a T = 0 (solo guía)
  min: 3, max: 30,      // colonias por gota que se consideran contables
  tiempos: [0, 1, 2, 3, 4, 5, 6],
  esperadoDe: 'od',     // 'od' (según la curva de OD) o 'manual'
  estimados: true,      // incluir en las medias las estimaciones fuera del rango contable
})
export const tablaDef = () => ({ vol: 100, factor: 10, min: 25, max: 250, nd: 6, filas: [] })  // vol en µL

// metodo: 'gota' (gotas sobre una placa de 96 con diluciones seriadas) o 'extendida' (placas de Petri, tabla o sectores)
// petri: [{ id, nombre, n (sectores), sectores: [{ muestra, t, lineas: [{ id, k (dilución −k), rep, n (colonias) }] }] }]
// placasG: placas de 96 con gotas: [{ id, nombre, filas: { A: { muestra, t, rep, desde, hasta } }, conteos: { A1: n } }]
//   cada FILA es una réplica de una muestra a un tiempo; cada COLUMNA, una dilución seriada (de `desde` a `hasta`)
export const ufcVacio = () => ({ metodo: 'gota', par: ufcDef(), placasG: [], esperado: {}, tabla: tablaDef(), petri: [] })

// factor que hay que aplicar a la columna j respecto de la suspensión original: D(j) = mult × f^j
export const multDe = (par) => {
  const f = par.factor
  if (par.primero === 'madre') return 1 / f
  const f0 = par.madre?.usar && par.madre.toma > 0 ? par.madre.final / par.madre.toma : f
  return f0 / f
}
export const dilucionDe = (par, j) => multDe(par) * par.factor ** j
// «10^−x» con el orden de magnitud de la dilución (para los encabezados)
export const potenciaDe = (par, j) => -Math.log10(dilucionDe(par, j))
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·' }
export const texto10 = (x) => '10' + String(Number(x.toFixed(2))).replace(/[-0-9.]/g, (c) => SUP[c])

// sesiones anteriores: una grilla de muestras por pocillo + un bloque de conteos por tiempo -> una placa por tiempo
export function placasDeGrilla(layout, conteos, esperado) {
  const filasLetra = [...new Set(layout.map((c) => c.Pocillo[0]))].sort()
  const muestraDe = (L) => layout.find((c) => c.Pocillo[0] === L)?.Muestra
  const repDe = {}
  const reps = {}
  filasLetra.forEach((L) => { const m = muestraDe(L); reps[m] = (reps[m] || 0) + 1; repDe[L] = reps[m] })
  const ts = Object.keys(conteos).map(Number).filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return ts.map((t, i) => ({
    id: 'g' + i + Math.random().toString(36).slice(2, 6), nombre: `Placa T=${t} h`,
    filas: Object.fromEntries(filasLetra.map((L) => [L, { muestra: muestraDe(L), t, rep: repDe[L], desde: 1, hasta: 12 }])),
    conteos: { ...(conteos[claveT(t)] || {}) },
  }))
}

export const normalizarUfc = (u = {}) => {
  const d = ufcVacio()
  const petri = Array.isArray(u.petri) ? u.petri : []
  const filasTabla = Array.isArray(u.tabla?.filas) ? u.tabla.filas : []
  return {
    metodo: u.metodo || (!(Array.isArray(u.layout) && u.layout.length) && (filasTabla.length || petri.length) ? 'extendida' : 'gota'),
    petri,
    par: { ...d.par, ...(u.par || {}), madre: { ...d.par.madre, ...(u.par?.madre || {}) } },
    placasG: Array.isArray(u.placasG) ? u.placasG : (Array.isArray(u.layout) && u.layout.length && u.conteos ? placasDeGrilla(u.layout, u.conteos) : []),
    esperado: u.esperado && typeof u.esperado === 'object' ? u.esperado : {},
    tabla: { ...d.tabla, ...(u.tabla || {}), filas: Array.isArray(u.tabla?.filas) ? u.tabla.filas : [] },
  }
}
export const lineasPetri = (u) => (u.petri || []).flatMap((p) => (p.sectores || []).flatMap((s, i) => (s?.lineas || []).map((l) => ({ ...l, placa: p.nombre, sector: i + 1, muestra: s.muestra, t: s.t }))))
export const hayConteos = (u) => (u.metodo === 'extendida'
  ? (u.tabla?.filas || []).some((f) => Object.values(f.c || {}).some(finito)) || lineasPetri(u).some((l) => finito(l.n))
  : (u.placasG || []).some((p) => Object.values(p.conteos || {}).some(finito)))

const colDe = (p) => Number(p.slice(1))
const filaDe = (p) => p[0]
export const claveT = (t) => String(Math.round(Number(t) * 1000) / 1000)

// ---------- estimación de UFC/mL de una réplica ----------
// cont: { k: colonias } (k = columna de la dilución); par: { vol (mL), factor, min, max, D: [dilución total por columna], usar: k elegido a mano }
// Se usa UNA sola dilución por réplica: la elegida a mano o, si no, la sugerida (ver sugerirDilucion).
// estado: ok | bajo (estimado bajo el rango) | alto (estimado sobre el rango) | cero (< límite de detección) | incontable (> límite) | sin_datos
export const dilDe = (par, k) => (par.D && finito(par.D[k]) ? par.D[k] : (par.mult || 1) * par.factor ** k)
const entradas = (cont) => Object.entries(cont || {}).map(([k, c]) => [Number(k), Number(c)]).filter(([k, c]) => finito(k) && finito(c) && c >= 0)

// Dilución sugerida: la única con conteo; si hay varias, la que cae dentro del rango contable (si hay más de una,
// la de más colonias, que tiene menor error relativo de Poisson); si ninguna está en rango, la más cercana al rango;
// si todas dieron 0, la menos diluida (da el límite de detección más bajo).
export function sugerirDilucion(cont, par) {
  const e = entradas(cont)
  if (!e.length) return null
  if (e.length === 1) return e[0][0]
  const enRango = e.filter(([, c]) => c >= par.min && c <= par.max).sort((x, y) => y[1] - x[1])
  if (enRango.length) return enRango[0][0]
  const bajo = e.filter(([, c]) => c > 0 && c < par.min).sort((x, y) => y[1] - x[1])
  if (bajo.length) return bajo[0][0]
  const sobre = e.filter(([, c]) => c > par.max).sort((x, y) => x[1] - y[1])
  if (sobre.length) return sobre[0][0]
  return e.sort((x, y) => dilDe(par, x[0]) - dilDe(par, y[0]))[0][0]
}

// Todas las réplicas de una cepa en un mismo tiempo usan la MISMA dilución. Sugerencia: la dilución con más
// réplicas dentro del rango contable; a igualdad, la que tienen más réplicas y después la de más colonias
// (sin pasar el doble del máximo). Si ninguna réplica tiene conteos en rango, la que daría la mejor estimación.
export function sugerirDilucionGrupo(conts, par) {
  const ks = [...new Set(conts.flatMap((c) => entradas(c).map(([k]) => k)))]
  if (!ks.length) return null
  const puntaje = (k) => {
    const v = conts.map((c) => Number((c || {})[k])).filter((x) => finito(x) && x >= 0)
    const enRango = v.filter((x) => x >= par.min && x <= par.max).length
    const contables = v.filter((x) => x > 0 && x <= 2 * par.max)
    return [enRango, v.length, contables.length, contables.reduce((s, x) => s + Math.min(x, par.max), 0)]
  }
  const mejor = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false }
  let kb = ks[0], pb = puntaje(ks[0])
  ks.slice(1).forEach((k) => { const p = puntaje(k); if (mejor(p, pb)) { kb = k; pb = p } })
  return kb
}

export function estimarUfc(cont, par) {
  const e = entradas(cont)
  const vacio = { ufc: NaN, lo: NaN, hi: NaN, estado: 'sin_datos', usados: [], S: 0, lim: NaN, sugerida: null, manual: false }
  if (!e.length) return vacio
  const sugerida = sugerirDilucion(cont, par)
  const fija = par.usar !== undefined && par.usar !== null && par.usar !== ''
  // dilución fijada para el grupo (cepa y tiempo): si esta réplica no la tiene, no se calcula con otra
  if (fija && !e.some(([k]) => k === Number(par.usar))) return { ...vacio, estado: 'sin_dilucion', usados: [], sugerida, manual: !!par.manual }
  const k = fija ? Number(par.usar) : sugerida
  const manual = fija ? !!par.manual : false
  const c = e.find(([kk]) => kk === k)[1]
  const D = par.vol / dilDe(par, k)                 // mL de suspensión original sembrados
  const base = { usados: [k], S: c, sugerida, manual, D }
  if (c === 0) return { ...vacio, ...base, estado: 'cero', lim: 3 / D }   // límite de detección (≈ 3 colonias esperadas)
  if (c > 2 * par.max) return { ...vacio, ...base, estado: 'incontable' }
  const estado = c < par.min ? 'bajo' : c > par.max ? 'alto' : 'ok'
  return { ufc: c / D, lo: NaN, hi: NaN, estado, lim: NaN, ...base }
}


// ---------- recuentos de una experiencia ----------
// Una fila por réplica: { Muestra, T_h, Replica, Fila, origen, cont, par }
export function registrosConteo(u) {
  const out = []
  const { par } = u
  if (u.metodo !== 'extendida') {
    const grupos = new Map()
    const parG = { vol: par.vol, factor: par.factor, min: par.min, max: par.max, mult: multDe(par) }
    ;(u.placasG || []).forEach((p) => Object.entries(p.filas || {}).forEach(([L, f]) => {
      if (!f || !f.muestra || !finito(Number(f.t))) return
      const c = {}
      for (let j = Number(f.desde) || 1; j <= (Number(f.hasta) || 12); j++) { const n = (p.conteos || {})[L + j]; if (finito(n)) c[j] = n }
      const k = `${f.muestra}|${Number(f.t)}|${Number(f.rep) || 1}`
      if (grupos.has(k)) Object.assign(grupos.get(k).cont, c)
      else grupos.set(k, { Muestra: f.muestra, T_h: Number(f.t), Replica: Number(f.rep) || 1, Fila: L, origen: 'gotas', cont: c, par: parG })
    }))
    grupos.forEach((g) => out.push(g))
    return out
  }
  const tb = u.tabla
  // sectores de placas de Petri: cada línea es una dilución de una réplica
  const grupos = new Map()
  lineasPetri(u).forEach((l) => {
    if (!l.muestra || !finito(Number(l.t)) || !finito(l.n)) return
    const k = `${l.muestra}|${Number(l.t)}|${Number(l.rep) || 1}`
    if (!grupos.has(k)) grupos.set(k, { Muestra: l.muestra, T_h: Number(l.t), Replica: Number(l.rep) || 1, cont: {} })
    grupos.get(k).cont[Number(l.k)] = Number(l.n)
  })
  grupos.forEach((g) => out.push({ ...g, Fila: '', origen: 'petri', par: { vol: tb.vol / 1000, factor: tb.factor, min: tb.min, max: tb.max } }))
  ;(tb?.filas || []).forEach((f) => {
    if (!f.muestra || !finito(Number(f.t))) return
    const c = {}
    Object.entries(f.c || {}).forEach(([k, n]) => { if (finito(n)) c[Number(k)] = Number(n) })
    out.push({ Muestra: f.muestra, T_h: Number(f.t), Replica: Number(f.replica) || 1, Fila: '', origen: 'tabla', cont: c,
      par: { vol: (Number(f.vol) || tb.vol) / 1000, factor: tb.factor, min: tb.min, max: tb.max, D: tb.D, usar: f.dil, manual: f.dilManual } })
  })
  return out
}

const NOMBRE_ESTADO = {
  ok: 'En rango', bajo: 'Estimado (bajo el rango)', alto: 'Estimado (sobre el rango)', cero: 'Menor que el límite de detección',
  incontable: 'Incontable (sobre el rango)', sin_datos: 'Sin datos', sin_dilucion: 'Sin conteo en la dilución de la cepa',
}
export const textoEstado = (e) => NOMBRE_ESTADO[e] || e

// Resultados por réplica y por muestra y tiempo
export function calcularUfc(u) {
  const regs = registrosConteo(u)
  const reps = regs.map((r) => {
    const est = estimarUfc(r.cont, r.par)
    const n = Object.keys(r.cont).length
    return {
      Muestra: r.Muestra, T_h: r.T_h, Fila: r.Fila || '', Replica: r.Replica, Origen: r.origen, Conteos: n,
      Diluciones_usadas: est.usados.map((k) => `columna ${k + 1} (${r.cont[k]} col.)`).join(', '), Dilucion_elegida: est.manual ? 'a mano' : 'sugerida',
      _manual: est.manual, _sugerida: est.sugerida,
      UFC_mL: est.ufc, Estado: textoEstado(est.estado), _estado: est.estado,
      log10: finito(est.ufc) && est.ufc > 0 ? Math.log10(est.ufc) : NaN, Colonias_usadas: est.S, Limite: est.lim,
      _cont: r.cont, _par: r.par, _usados: est.usados, _S: est.S, _D: est.D,
    }
  })
  const incluirEst = u.par.estimados !== false
  const res = []
  const claves = [...new Map(reps.filter((r) => r.Conteos > 0).map((r) => [`${r.Muestra}|${r.T_h}`, [r.Muestra, r.T_h]])).values()]
  claves.forEach(([m, t]) => {
    const g = reps.filter((r) => r.Muestra === m && r.T_h === t)
    // réplicas que entran: con la dilución del grupo contada (en rango, o estimadas si se usan estimados)
    const pool = g.filter((r) => finito(r._D) && r._D > 0 && (r._estado === 'ok' || (incluirEst && ['bajo', 'alto', 'cero'].includes(r._estado))))
    // concentración de cada réplica = C · D / V (0 si no tuvo colonias en la dilución usada); el valor del tiempo es su media
    const vals = pool.map((r) => (r._S > 0 ? r.UFC_mL : 0))
    const n = vals.length, mm = n ? media(vals) : NaN, sd = n > 1 ? desvio(vals) : NaN
    const S = pool.reduce((a, r) => a + r._S, 0), V = pool.reduce((a, r) => a + r._D, 0)
    const estados = [...new Set(g.map((r) => r._estado))]
    res.push({
      Muestra: m, T_h: t, Replicas: g.length, Con_conteos: g.filter((r) => r.Conteos > 0).length, N: n,
      _vals: vals, _pool: pool.map((r, i) => ({ Replica: r.Replica, C: r._S, D: r._D, k: r._usados[0], ufc: vals[i], estado: r._estado })),
      Colonias_suma: n ? S : NaN,
      UFC_mL: mm, DE: sd, log10: mm > 0 ? Math.log10(mm) : NaN, CV_pct: n > 1 && mm > 0 ? (100 * sd) / mm : NaN,
      Estado: estados.includes('ok') && estados.length === 1 ? 'En rango' : estados.map(textoEstado).join(' · '),
      Limite: n && S === 0 ? 3 / V : NaN,
    })
  })
  res.sort((a, b) => (a.Muestra < b.Muestra ? -1 : a.Muestra > b.Muestra ? 1 : a.T_h - b.T_h))
  const muestras = [...new Set(regs.map((r) => r.Muestra))]
  const ts = [...new Set(regs.map((r) => r.T_h))].sort((a, b) => a - b)
  return { reps, res, muestras, ts, hay: reps.some((r) => r.Conteos > 0) }
}

// Resultados sin algunas réplicas (botones de réplica de Curva UFC, como en Curva OD): solo para el gráfico, la media y la
// tabla; el ajuste de los modelos no cambia. ocultas: lista de `cepa|réplica`.
export function sinReplicasUfc(ufcRes, ocultas) {
  if (!ufcRes?.hay || !ocultas?.length) return ufcRes
  const fuera = new Set(ocultas)
  const res = ufcRes.res.map((r) => {
    const pool = (r._pool || []).filter((q) => !fuera.has(`${r.Muestra}|${q.Replica}`))
    if (pool.length === (r._pool || []).length) return r
    const vals = pool.map((q) => q.ufc), n = vals.length, mm = n ? media(vals) : NaN, sd = n > 1 ? desvio(vals) : NaN
    return { ...r, _pool: pool, _vals: vals, N: n, UFC_mL: mm, DE: sd, log10: mm > 0 ? Math.log10(mm) : NaN, CV_pct: n > 1 && mm > 0 ? (100 * sd) / mm : NaN, Colonias_suma: n ? pool.reduce((a, q) => a + q.C, 0) : NaN }
  })
  return { ...ufcRes, res, reps: ufcRes.reps.filter((x) => !fuera.has(`${x.Muestra}|${x.Replica}`)) }
}

// ---------- valor de un tiempo y su error (el MISMO cálculo que la OD) ----------
// Valor = media aritmética de las UFC/mL de las réplicas. Error = DE, EEM (DE/√n) o IC 95 % (t(0,975; n − 1)·DE/√n),
// calculado con las UFC/mL (datos lineales). En escala log₁₀: log₁₀ de esa media, y la barra va de log₁₀(media − error)
// a log₁₀(media + error) (la misma barra que en lineal, con el eje en log). Con menos de 3 réplicas no hay EEM ni IC.
export const ERRORES_UFC = ERRORES
// (compatibilidad: ya no hay opciones de «valor de cada tiempo»)
export const centroUfc = () => 'media'
export const centroLog10 = (r) => r?.log10
export const valorUfc = (r) => r?.UFC_mL
export const etiquetaErrorUfc = (centro, tipo) => ERRORES_UFC[tipo] || 'DE'
// estadísticos de las réplicas de un tiempo: UNA sola fuente para la tabla, las fichas, el Excel y las barras
export const estadisticaUfc = (r) => resumenReplicas(r?._vals)
export const errorMediaUfc = errorElegido
export function errorUfc(r, escala = 'log10', tipo = 'sd') {
  const est = estadisticaUfc(r), eg = errorMediaUfc(est, tipo)
  const cv = est.n > 1 && est.m > 0 ? (100 * est.sd) / est.m : NaN
  if (escala === 'lineal') return { m: est.m, lo: finito(eg.e) ? eg.lo : NaN, hi: finito(eg.e) ? eg.hi : NaN, err: eg.e, rango: false, cv, n: est.n, nBajo: eg.bajo }
  return { m: eg.mLog, lo: finito(eg.e) ? eg.loLog : NaN, hi: finito(eg.e) ? eg.hiLog : NaN, err: NaN, rango: true, cv, n: est.n, nBajo: eg.bajo }
}
// solo el error, para escribirlo sobre el punto: «± error» en lineal; «[log₁₀ inf – log₁₀ sup]» en log₁₀
export function errorTextoUfc(e, lin) {
  const f = (v) => (lin ? sciUfc(v) : v.toFixed(2).replace('.', ','))
  if (e.rango) return finito(e.hi) ? `[${finito(e.lo) ? f(e.lo) : '–'} – ${f(e.hi)}]` : ''
  return finito(e.err) ? `± ${f(e.err)}` : ''
}
export function textoErrorUfc(e, lin) {
  const f = (v) => (lin ? sciUfc(v) : v.toFixed(2).replace('.', ','))
  if (!finito(e.m)) return ''
  const t = errorTextoUfc(e, lin)
  return t ? `${f(e.m)}\n${t}` : f(e.m)
}
export const sciUfc = sciCorto
// Líneas del globo (tooltip) del valor de una cepa en un tiempo; cada pantalla pone el encabezado y la indicación del clic
export function tipValorUfc(r, centro, tipo = 'sd') {
  if (!r) return []
  const est = estadisticaUfc(r), eg = errorMediaUfc(est, tipo)
  return lineasMedia({ m: est.m, eg, n: est.n, unidad: 'UFC/mL', fmt: sciCorto, extra: finito(r.Colonias_suma) ? `${r.Colonias_suma} colonias` : '' })
}
// texto común de OD y UFC: media (y su log₁₀), error con su rango (y el rango en log₁₀) y n
export function lineasMedia({ m, eg, n, unidad, fmt, extra = '' }) {
  const out = [`media = ${fmt(m)} ${unidad} (log₁₀ ${fx(eg.mLog, 3)})`]
  if (finito(eg.e)) out.push(`${eg.etq} = ± ${fmt(eg.e)} ${unidad}: ${fmt(eg.lo)} a ${fmt(eg.hi)} (log₁₀ ${finito(eg.loLog) ? fx(eg.loLog, 3) : '–'} a ${fx(eg.hiLog, 3)})`)
  else out.push(`${eg.etq}: ${n < 2 ? 'con una sola réplica' : 'con menos de 3 réplicas'} no se calcula`)
  out.push(`n = ${n} réplica${n === 1 ? '' : 's'}${extra ? ` · ${extra}` : ''}`)
  return out
}

// ---------- concentración esperada (guía de la grilla de gotas) ----------
export const tiemposG = (u) => [...new Set((u.placasG || []).flatMap((p) => Object.values(p.filas || {}).filter((f) => f && f.muestra).map((f) => Number(f.t))))].filter(finito).sort((a, b) => a - b)
export function esperadoStock(ufc, curva) {
  const out = {}
  const { par, esperado } = ufc
  tiemposG(ufc).forEach((t) => {
    const k = claveT(t)
    if (par.esperadoDe === 'manual' && finito(esperado[k])) { out[k] = esperado[k]; return }
    if (par.esperadoDe === 'od' && curva && curva.t.length > 2) {
      const y0 = curva.y[0]
      const yt = interpolar(curva.t, curva.y, [t * 3600])[0]
      if (finito(y0) && y0 > 0 && finito(yt)) { out[k] = par.c0 * (yt / y0); return }
    }
    out[k] = finito(esperado[k]) ? esperado[k] : par.c0
  })
  return out
}
export const coloniasEsperadas = (stock, j, par) => (stock / dilucionDe(par, j)) * par.vol
export const contable = (n, par) => finito(n) && n >= par.min && n <= par.max

// ------------------------------------------------------------
// Lectura de una plantilla / planilla de conteos desde Excel (matriz cruda): bloques «T=<horas>»
// Las celdas con TEXTO son muestras; las celdas con NÚMEROS son conteos de colonias.
// ------------------------------------------------------------
export function leerPlantillaUfc(raw) {
  const re = /^\s*T\s*=\s*([0-9]+(?:[.,][0-9]+)?)\s*$/i
  const layout = new Map()
  const conteos = {}
  const esperado = {}
  const tiempos = []
  for (let r = 0; r < raw.length; r++) {
    let m = null
    for (const c of raw[r]) { m = re.exec(String(c ?? '')); if (m) break }
    if (!m) continue
    const t = convertirNumero(m[1])
    const k = claveT(t)
    tiempos.push(t)
    for (let i = r; i < Math.min(raw.length, r + 5); i++) {
      if (/conc/i.test(String(raw[i][0] ?? ''))) {
        const v = raw[i].slice(1).map(convertirNumero).find(finito)
        if (finito(v)) esperado[k] = v
        break
      }
    }
    for (let i = r + 1, q = 0; i < Math.min(raw.length, r + 22) && q < 8; i++) {
      const cel = raw[i]
      const cl = cel.findIndex((x) => String(x ?? '').trim().toUpperCase() === LETRAS[q])
      if (cl < 0) continue
      const vals = cel.slice(cl + 1, cl + 13)
      vals.forEach((v, j) => {
        const p = LETRAS[q] + (j + 1)
        if (v === '' || v === null || v === undefined) return
        const n = typeof v === 'number' ? v : NaN
        if (finito(n)) {
          if (!conteos[k]) conteos[k] = {}
          conteos[k][p] = n
        } else {
          const txt = String(v).trim()
          if (txt && !layout.has(p)) layout.set(p, txt)
        }
      })
      q++
    }
  }
  if (!tiempos.length) throw new Error('No encontré bloques «T=…» con la placa A..H. Cada bloque empieza con una celda «T=0», «T=1», etc.')
  return {
    layout: [...layout].map(([Pocillo, Muestra]) => ({ Pocillo, Muestra })),
    conteos, esperado, tiempos: [...new Set(tiempos)].sort((a, b) => a - b),
  }
}

// ------------------------------------------------------------
// Tabla de recuentos desde Excel: encabezados «Muestra», «Tiempo (h)», «Réplica» y columnas de dilución
// («Sin diluir», «0», «-1», «-2», …). Devuelve filas { muestra, replica, t, c: { k: colonias } }.
// ------------------------------------------------------------
export function leerTablaConteos(raw) {
  let h = -1
  for (let r = 0; r < Math.min(raw.length, 40); r++) {
    if (raw[r].some((x) => /^\s*(muestra|cepa|sample)\s*$/i.test(String(x ?? '')))) { h = r; break }
  }
  if (h < 0) throw new Error('No encontré una fila de encabezados con la columna «Muestra».')
  const enc = raw[h].map((x) => String(x ?? '').trim())
  const ix = (re) => enc.findIndex((x) => re.test(x))
  const iM = ix(/^(muestra|cepa|sample)$/i), iT = ix(/^(tiempo|time|t)\b/i), iR = ix(/^(r[eé]plica|rep)/i), iV = ix(/^volumen/i)
  const cols = []
  enc.forEach((x, j) => {
    const sinDil = /^(sin diluir|sd|directa?|0|10\^?0)$/i.test(x)
    const m = /^[−-]\s*(\d+)$/.exec(x) || /^10\s*\^?\s*[−-]\s*(\d+)$/i.exec(x) || /^dil(?:uci[oó]n)?\s*[−-]?\s*(\d+)$/i.exec(x)
    if (sinDil) cols.push([j, 0])
    else if (m) cols.push([j, Number(m[1])])
  })
  if (!cols.length) throw new Error('No encontré columnas de recuento («Sin diluir», «-1», «-2», …).')
  const filas = []
  for (let r = h + 1; r < raw.length; r++) {
    const f = raw[r]
    const muestra = String(f[iM] ?? '').trim()
    if (!muestra) continue
    const c = {}
    cols.forEach(([j, k]) => { const v = convertirNumero(f[j]); if (finito(v)) c[k] = v })
    filas.push({ muestra, replica: iR >= 0 ? Number(convertirNumero(f[iR])) || 1 : 1, t: iT >= 0 ? convertirNumero(f[iT]) : 0, vol: iV >= 0 ? convertirNumero(f[iV]) : undefined, c })
  }
  if (!filas.length) throw new Error('La tabla no tiene filas con nombre de muestra.')
  return { filas, nd: Math.max(...cols.map(([, k]) => k)) + 1 }
}
