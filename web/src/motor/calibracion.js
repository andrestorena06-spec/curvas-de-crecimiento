// ============================================================
// Calibración OD ↔ UFC/mL: ajusta una curva a los pares (OD corregida, UFC/mL) de las mismas muestras y tiempos,
// para estimar las UFC/mL a partir de la OD (y viceversa) dentro del rango calibrado.
// ============================================================
import { finito, media } from './analisis.js'
import { tCuantil } from '../utils.js'

export const MODELOS_CALIB = {
  clasico: 'Recta: log₁₀ UFC = m·OD + b',
  lineal: 'Lineal: UFC = a + b·OD',
  proporcional: 'Proporcional: UFC = b·OD (por el origen)',
  potencia: 'Potencia (log–log): log₁₀ UFC = a + b·log₁₀ OD',
}

const n4 = (x) => String(Number(x.toPrecision(4))).replace('.', ',')
const e3 = (x) => x.toExponential(3).replace('.', ',').replace('e+', 'E+').replace('e-', 'E-')
function regresion(x, y) {
  const mx = media(x), my = media(y)
  let sxx = 0, sxy = 0
  x.forEach((v, i) => { sxx += (v - mx) ** 2; sxy += (v - mx) * (y[i] - my) })
  if (!(sxx > 0)) return null
  const b = sxy / sxx
  return { a: my - b * mx, b }
}

// pares: [{ od, ufc }] con ufc > 0 (la OD puede ser ≤ 0 salvo en los modelos log–log y proporcional).
// La OD es la corregida por el blanco, sin suavizar ni normalizar (ver paresOdUfc en Combinado.jsx).
export function ajustarCalibracion(pares, modelo) {
  // la OD puede ser negativa (lecturas por debajo del blanco); solo el modelo log–log necesita OD > 0
  const p = pares.filter((q) => finito(q.od) && (modelo !== 'potencia' || q.od > 0) && finito(q.ufc) && q.ufc > 0)
  const sinPositiva = modelo === 'potencia' ? pares.filter((q) => finito(q.od) && q.od <= 0 && finito(q.ufc) && q.ufc > 0).length : 0
  const vacio = { ok: false, modelo, n: p.length }
  // el modelo proporcional (por el origen) supone UFC = 0 con OD = 0: con OD ≤ 0 no tiene sentido físico
  const odNoPos = p.filter((q) => q.od <= 0).length
  if (modelo === 'proporcional' && odNoPos) return { ...vacio, motivo: `El modelo proporcional (por el origen) no admite OD ≤ 0 (${odNoPos} de ${p.length} par${p.length > 1 ? 'es' : ''} con OD ≤ 0): una OD nula o negativa daría UFC ≤ 0. Usá la recta log₁₀ UFC = m·OD + b o el modelo lineal, o revisá el blanco.` }
  if (p.length < 3) return { ...vacio, motivo: sinPositiva ? `Hacen falta al menos 3 pares OD–UFC con OD > 0: el modelo log–log no admite OD ≤ 0 (${sinPositiva} par${sinPositiva > 1 ? 'es' : ''} con OD ≤ 0). Usá la recta log₁₀ UFC = m·OD + b o el modelo lineal.` : 'Hacen falta al menos 3 pares OD–UFC.' }
  const od = p.map((q) => q.od), ufc = p.map((q) => q.ufc), lg = ufc.map(Math.log10)
  let pred, coef, eq, inv
  if (modelo === 'clasico') {
    const r = regresion(od, lg)
    if (!r) return { ...vacio, motivo: 'La OD no varía.' }
    coef = { m: r.b, b: r.a }
    pred = (x) => 10 ** (r.b * x + r.a)
    inv = (u) => (r.b !== 0 ? (Math.log10(u) - r.a) / r.b : NaN)
    eq = `log₁₀ UFC = ${n4(r.b)}·OD ${r.a < 0 ? '−' : '+'} ${n4(Math.abs(r.a))}`
  } else if (modelo === 'lineal') {
    const r = regresion(od, ufc)
    if (!r) return { ...vacio, motivo: 'La OD no varía.' }
    coef = { a: r.a, b: r.b }
    pred = (x) => { const v = r.a + r.b * x; return v > 0 ? v : NaN }
    inv = (u) => (r.b !== 0 ? (u - r.a) / r.b : NaN)
    eq = `UFC = ${e3(r.a)} ${r.b < 0 ? '−' : '+'} ${e3(Math.abs(r.b))}·OD`
  } else if (modelo === 'proporcional') {
    const b = od.reduce((s, x, i) => s + x * ufc[i], 0) / od.reduce((s, x) => s + x * x, 0)
    coef = { b }
    pred = (x) => b * x
    inv = (u) => (b > 0 ? u / b : NaN)
    eq = `UFC = ${e3(b)}·OD`
  } else if (modelo === 'potencia') {
    const r = regresion(od.map(Math.log10), lg)
    if (!r) return { ...vacio, motivo: 'La OD no varía.' }
    coef = { a: r.a, b: r.b }
    pred = (x) => (x > 0 ? 10 ** (r.a + r.b * Math.log10(x)) : NaN)
    inv = (u) => (r.b !== 0 ? 10 ** ((Math.log10(u) - r.a) / r.b) : NaN)
    eq = `log₁₀ UFC = ${n4(r.a)} ${r.b < 0 ? '−' : '+'} ${n4(Math.abs(r.b))}·log₁₀ OD`
  } else return { ...vacio, motivo: 'Modelo desconocido.' }
  // error típico en órdenes de magnitud y R² (ambos en log₁₀ para poder comparar los modelos). SSE y SST se calculan
  // con el MISMO conjunto de pares: los que el modelo puede predecir (en el lineal, los de UFC predicha > 0).
  const res = p.map((q) => { const v = pred(q.od); return finito(v) && v > 0 ? Math.log10(q.ufc) - Math.log10(v) : NaN })
  const iok = res.map((r, i) => (finito(r) ? i : -1)).filter((i) => i >= 0)
  const k = modelo === 'proporcional' ? 1 : 2
  const sse = iok.reduce((s, i) => s + res[i] * res[i], 0)
  const sigma = iok.length > k ? Math.sqrt(sse / (iok.length - k)) : NaN
  const lgOk = iok.map((i) => lg[i])
  const ml = media(lgOk)
  const sst = lgOk.reduce((s, v) => s + (v - ml) ** 2, 0)
  const sinPred = p.length - iok.length
  // Error de una predicción: intervalo de predicción 95 % en log₁₀ UFC/mL para una OD x0:
  //   U = t(0,975; n − k) · σ · √(1 + palanca), con palanca = 1/n + (x0 − x̄)² / Sxx  (x = OD, o log₁₀ OD en el modelo log–log)
  //   y, en el modelo proporcional (por el origen), x0² / Σ x²
  // Es exacto en la recta y en el log–log; en el lineal y el proporcional se aplica sobre el error típico en log₁₀ (aproximado).
  const xs = modelo === 'potencia' ? od.map(Math.log10) : od
  const mxs = media(xs), sxx = xs.reduce((s, v) => s + (v - mxs) ** 2, 0), sx2 = od.reduce((s, v) => s + v * v, 0)
  const gl = iok.length - k
  const tt = gl > 0 ? tCuantil(0.975, gl) : NaN
  const errorPred = (x0) => {
    const xq = modelo === 'potencia' ? Math.log10(x0) : x0
    const pal = modelo === 'proporcional' ? (x0 * x0) / sx2 : 1 / p.length + (xq - mxs) ** 2 / sxx
    const U = tt * sigma * Math.sqrt(1 + pal)
    const v = pred(x0)
    return finito(U) && finito(v) && v > 0 ? { U, lo: v / 10 ** U, hi: v * 10 ** U, tt, pal } : { U: NaN, lo: NaN, hi: NaN, tt, pal }
  }
  return {
    ok: true, modelo, n: p.length, nR2: iok.length, sinPred, coef, ecuacion: eq, pred, inv, sigma, errorPred, gl, R2: sst > 0 ? 1 - sse / sst : NaN,
    rango: [Math.min(...od), Math.max(...od)], rangoUfc: [Math.min(...ufc), Math.max(...ufc)], errorRelPct: (10 ** (finito(sigma) ? sigma : 0) - 1) * 100,
    aviso: sinPred ? `${sinPred} par${sinPred > 1 ? 'es' : ''} con UFC predicha ≤ 0: no entra${sinPred > 1 ? 'n' : ''} en el R² ni en el error típico.` : '',
  }
}

// OD que corresponde a unas UFC/mL dadas: inversa exacta de la ecuación ajustada (admite OD negativas, salvo en el
// modelo log–log y el proporcional). Si no hay inversa, búsqueda por bisección en un intervalo alrededor del rango
// calibrado, que sirve también con OD negativas.
export function odDesdeUfc(cal, ufc) {
  if (!cal.ok || !(ufc > 0)) return NaN
  if (cal.inv) { const x = cal.inv(ufc); return finito(x) ? x : NaN }
  const ancho = Math.max(cal.rango[1] - cal.rango[0], Math.abs(cal.rango[0]), Math.abs(cal.rango[1]), 1e-3)
  let lo = cal.rango[0] - 4 * ancho, hi = cal.rango[1] + 4 * ancho
  const f = (x) => cal.pred(x)
  const flo = f(lo), fhi = f(hi)
  if (!finito(flo) || !finito(fhi) || (ufc - flo) * (ufc - fhi) > 0) return NaN
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if ((f(m) - ufc) * (flo - ufc) > 0) lo = m; else hi = m }
  return (lo + hi) / 2
}

// Error de la conversión UFC/mL → OD: la incertidumbre U (log₁₀) de las UFC a la OD hallada se lleva a la OD
// invirtiendo la ecuación en ufc·10^−U y ufc·10^U. Devuelve { od, lo, hi } (lo ≤ hi) o NaN.
export function odDesdeUfcConError(cal, ufc) {
  const od = odDesdeUfc(cal, ufc)
  if (!finito(od) || !cal.errorPred) return { od, lo: NaN, hi: NaN }
  const { U, tt, pal } = cal.errorPred(od)
  if (!finito(U)) return { od, lo: NaN, hi: NaN }
  const a = odDesdeUfc(cal, ufc / 10 ** U), b = odDesdeUfc(cal, ufc * 10 ** U)
  return finito(a) && finito(b) ? { od, lo: Math.min(a, b), hi: Math.max(a, b), U, tt, pal } : { od, lo: NaN, hi: NaN }
}

// ¿Una OD está fuera del rango calibrado? (para avisar que es una extrapolación, en los dos sentidos de la conversión)
export const fueraDeRango = (cal, od) => !!cal?.ok && finito(od) && (od < cal.rango[0] - 1e-12 || od > cal.rango[1] + 1e-12)
