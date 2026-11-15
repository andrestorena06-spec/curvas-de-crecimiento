// ============================================================
// Crecimiento a partir de los recuentos: recta de log₁₀ (fase exponencial), Baranyi y Roberts y Huang,
// con las variantes de DMFit (sin lag, sin meseta). Un solo ajuste por cepa para todas las pantallas.
// ============================================================
import { finito, media, regLineal } from '../comun/analisis.js'
import { baranyiF, erroresAjuste, huangF, levenbergMarquardt } from '../comun/modelos.js'
import { centroLog10, centroUfc, sciUfc } from './conteo.js'

// ---------- crecimiento a partir de los recuentos: modelos de DMFit (ComBase) ----------
// Se ajustan a TODOS los puntos (ninguno se descarta para mejorar el R²), por mínimos cuadrados sobre ln(UFC/mL):
//   lineal:   y = y₀ + μ t
//   baranyi:  Baranyi y Roberts (1994): y = y₀ + μ A(t) − (1/m)·ln[1 + (e^{mμA(t)} − 1) / e^{m(y_máx − y₀)}]
//             (m = curvatura hacia la meseta, aj.ufc_mcurv; m = 1 es la forma habitual)
//   bifasico: Baranyi y Roberts sin asíntota (lag + fase exponencial): y = y₀ + μ A(t)
//   A(t) = t + ln(e^{−μt} + e^{−h₀} − e^{−μt−h₀}) / μ ;  λ = h₀ / μ
// Como en DMFit, se informan la velocidad en log₁₀ UFC/mL por hora («Rate»), y₀ e y_final en log₁₀, R² y el
// error estándar del ajuste (en log₁₀), con los grados de libertad n − p.
// Solo dos modelos: «Linealizar log₁₀» (recta de ln N en la fase exponencial) y Baranyi y Roberts. El «bifásico» de sesiones viejas
// se trata como Baranyi y Roberts.
export const MODELOS_UFC = { lineal: 'Linealizar log₁₀ (recta de log₁₀ en la fase exponencial)', baranyi: 'Baranyi y Roberts', huang: 'Huang' }
export const modeloUfc = (aj) => (aj?.ufc_modelo === 'lineal' ? 'lineal' : aj?.ufc_modelo === 'huang' ? 'huang' : 'baranyi')
// lag fijo (h): se fija λ en el ajuste de Baranyi y Roberts o de Huang (estabiliza μ cuando hay pocos puntos)
export const lagFijoUfc = (aj) => { const v = aj?.ufc_lagfijo; return v === '' || v === null || v === undefined || !finito(Number(v)) || Number(v) < 0 ? NaN : Number(v) }
// curvatura m del Baranyi y Roberts (aj.ufc_mcurv, por defecto 1)
export const mcurvUfc = (aj) => { const v = Number(aj?.ufc_mcurv); return finito(v) && v > 0 ? v : 1 }
const NPAR = { lineal: 2, baranyi: 4, huang: 4 }
const MIN_T = { lineal: 2, baranyi: 4, huang: 4 }

const f2 = (x) => (finito(x) ? x.toFixed(2).replace('.', ',') : '–')

// t (h) y ly = ln(UFC/mL) de cada punto. ymaxFijo10: N máx en log₁₀ fijado por el usuario (solo Baranyi y Roberts).
// mcurv: curvatura m del Baranyi y Roberts (1 por defecto).
// Modelo «Linealizar log₁₀»: recta de ln N contra t en la FASE EXPONENCIAL (la ventana de pendiente máxima entre las que son bien
// rectas), igual que μmax por OD. t en horas, ly = ln de cada punto (todos los puntos, o los valores de cada tiempo).
// op: { ancho (h), minpts, r2min }. Devuelve el mismo objeto que ajusteDmfit. y₀ = ordenada al origen (log₁₀) para que la
// ecuación sea ln N(t) = a + μ t; c.t0 y c.t1 = la ventana (donde la ecuación vale); c.tDatos0/1 = rango de los datos.
export function ajusteClasico(t, ly, op = {}) {
  const idx = t.map((_, i) => i).filter((i) => finito(t[i]) && finito(ly[i])).sort((a, b) => t[a] - t[b])
  const tt = idx.map((i) => t[i]), yy = idx.map((i) => ly[i])
  const n = tt.length, nT = new Set(tt).size
  const vacio = { ok: false, modelo: 'lineal', n, nT, mu: NaN, avisos: [] }
  if (nT < 3) return { ...vacio, motivo: `El modelo «Linealizar log₁₀» necesita al menos 3 tiempos con datos (hay ${nT}).` }
  const tu = [...new Set(tt)]
  const paso = tu.slice(1).map((x, i) => x - tu[i]).sort((a, b) => a - b)[Math.floor((tu.length - 1) / 2)] || 1
  const minpts = Math.max(3, Math.round(op.minpts || 3)), r2min = op.r2min ?? 0.95
  const ancho = Math.max(Number(op.ancho) || 2, paso * (minpts - 1) * 1.0001)
  const vent = []
  for (let i = 0; i < n; i++) {
    const j = []
    for (let k = 0; k < n; k++) if (tt[k] >= tt[i] && tt[k] <= tt[i] + ancho + 1e-9) j.push(k)
    if (j.length < minpts || new Set(j.map((k) => tt[k])).size < 3) continue
    const x = j.map((k) => tt[k]), y = j.map((k) => yy[k])
    const rg = regLineal(x, y)
    if (!finito(rg.b)) continue
    vent.push({ ini: Math.min(...x), fin: Math.max(...x), n: j.length, a: rg.a, b: rg.b, r2: rg.r2, x, y })
  }
  // tramo elegido a mano (op.ventana = [t0, t1]): la recta se ajusta a todos los puntos de ese tramo
  let manual = null
  if (op.ventana && finito(op.ventana[0]) && finito(op.ventana[1])) {
    const j = []
    for (let k = 0; k < n; k++) if (tt[k] >= op.ventana[0] - 1e-9 && tt[k] <= op.ventana[1] + 1e-9) j.push(k)
    if (j.length >= 3 && new Set(j.map((k) => tt[k])).size >= 3) {
      const x = j.map((k) => tt[k]), y = j.map((k) => yy[k]), rg = regLineal(x, y)
      if (finito(rg.b)) manual = { ini: Math.min(...x), fin: Math.max(...x), n: j.length, a: rg.a, b: rg.b, r2: rg.r2, x, y }
    }
  }
  if (!vent.length && !manual) return { ...vacio, motivo: 'No hay una ventana con suficientes recuentos para ajustar la recta de la fase exponencial.' }
  const avisos = []
  // solo compiten las ventanas de ancho (casi) completo; si ninguna cumple, todas
  const anchoMax = vent.length ? Math.max(...vent.map((v) => v.fin - v.ini)) : 0
  const ventC = vent.filter((v) => v.fin - v.ini >= 0.8 * anchoMax - 1e-9)
  let cand = manual ? [manual] : ventC.filter((v) => v.r2 >= r2min)
  if (!manual && !cand.length) cand = vent.filter((v) => v.r2 >= r2min)
  if (!cand.length) { cand = vent; avisos.push(`Ninguna ventana alcanza R² ≥ ${r2min.toFixed(2).replace('.', ',')}: se usó la de mayor pendiente.`) }
  let w = cand.reduce((m, v) => (v.b > m.b ? v : m), cand[0])
  // quota (como fit_easylinear de growthrates): las ventanas contiguas con pendiente ≥ quota · máxima se suman a la mejor y se reajusta la recta
  let ampliada = false
  const quota = finito(op.quota) && op.quota > 0 && op.quota < 1 ? op.quota : NaN
  if (!manual && finito(quota) && w.b > 0) {
    let L = vent.indexOf(w), R = L
    while (L > 0 && vent[L - 1].b >= quota * w.b) L--
    while (R < vent.length - 1 && vent[R + 1].b >= quota * w.b) R++
    const ini = vent[L].ini, fin = vent[R].fin
    if (ini < w.ini - 1e-9 || fin > w.fin + 1e-9) {
      const x = [], y = []
      for (let k = 0; k < n; k++) if (tt[k] >= ini - 1e-9 && tt[k] <= fin + 1e-9) { x.push(tt[k]); y.push(yy[k]) }
      const rg = regLineal(x, y)
      if (finito(rg.b) && rg.b > 0) { w = { ini: Math.min(...x), fin: Math.max(...x), n: x.length, a: rg.a, b: rg.b, r2: rg.r2, x, y }; ampliada = true }
    }
  }
  if (!(w.b > 0)) return { ...vacio, motivo: 'La pendiente de ln N no es positiva: sin crecimiento detectable.' }
  const L = Math.LN10
  const sse = w.y.reduce((s, y, i) => s + (y - w.a - w.b * w.x[i]) ** 2, 0) / (L * L)
  const gl = w.n - 2
  const yInit = media(yy.filter((_, i) => tt[i] === tt[0]))   // nivel inicial observado (ln)
  const lag = Math.max(0, (yInit - w.a) / w.b)
  // errores estándar de la recta (mínimos cuadrados): EE(b) = s/√Sxx, EE(a) = s·√(1/n + x̄²/Sxx), cov(a, b) = −x̄·s²/Sxx (s en ln)
  const xm = media(w.x), Sxx = w.x.reduce((acc, v) => acc + (v - xm) ** 2, 0)
  const s2ln = gl > 0 ? (sse * L * L) / gl : NaN
  const vb = s2ln / Sxx, va = s2ln * (1 / w.n + (xm * xm) / Sxx), cab = (-xm * s2ln) / Sxx
  const eeMu = Math.sqrt(vb)
  // λ = (y_inicial − a)/b, método delta con la covarianza de (a, b); el nivel inicial observado se toma como dato
  const dl = yInit - w.a
  const vLag = va / w.b ** 2 + (dl * dl * vb) / w.b ** 4 + (2 * dl * cab) / w.b ** 3
  const eeLag = lag > 0 && finito(vLag) ? Math.sqrt(Math.max(0, vLag)) : NaN
  if (!manual && !ampliada && w.fin >= tt[n - 1] - 1e-9 && vent.length > 2 && vent[vent.length - 1].b > vent[vent.length - 2].b) avisos.push('La fase exponencial no está bien definida: el tramo termina en el último punto de la corrida y la curva todavía se acelera. Si la corrida es más larga o el cultivo sigue creciendo, el tramo cambia; podés elegirlo a mano en «Fases…».')
  if (gl <= 1) avisos.push(`La recta usa solo ${w.n} puntos (${gl} grado${gl === 1 ? '' : 's'} de libertad): μ es poco firme. Más tiempos de muestreo en la fase exponencial lo resuelven.`)
  return {
    ok: true, modelo: 'lineal', n, nT, k: 2, gl, pred10: (x) => (w.a + w.b * x) / L, mcurv: NaN, convergio: true, avisos,
    mu: w.b, rate: w.b / L, td_h: Math.LN2 / w.b, lag_h: lag, h0: NaN, a: w.a, yInit10: yInit / L,
    y0: w.a / L, yEnd: NaN, sinAsintota: false, r2: w.r2, r2adj: gl > 0 ? 1 - ((1 - w.r2) * (w.n - 1)) / gl : NaN, se: gl > 0 ? Math.sqrt(sse / gl) : NaN,
    ee_mu: eeMu, ee_lag: eeLag, ee_y0: Math.sqrt(va) / L, ee_ymax: NaN, ee_td: finito(eeMu) ? (Math.LN2 / w.b) * (eeMu / w.b) : NaN,
    t0: w.ini, t1: w.fin, tDatos0: tt[0], tDatos1: tt[n - 1], nVentana: w.n, ymaxFijo: false, mesetaExtrapolada: false, ventana: { ini: w.ini, fin: w.fin, n: w.n }, ventanaAmpliada: ampliada,
  }
}

// Variantes del modelo (las de DMFit): completo, sin lag (λ = 0), sin meseta (sin fase estacionaria) y lineal (ninguna de las dos)
export const NOMBRE_VARIANTE = { completo: 'completo', sinLag: 'sin lag', sinMeseta: 'sin meseta', lineal: 'sin lag ni meseta' }

export function ajusteDmfit(t, ly, modelo = 'baranyi', ymaxFijo10 = NaN, mcurv = 1, op = null) {
  if (modelo === 'lineal') return ajusteClasico(t, ly, op || {})
  const esBar = modelo === 'baranyi'
  const fijo = finito(ymaxFijo10) ? ymaxFijo10 * Math.LN10 : NaN
  // Variante del modelo (como DMFit): sinLag = λ fijo en 0 (h₀ = 0); sinMeseta = sin el término de la fase estacionaria
  // (Baranyi: y = y₀ + μA(t); Huang: y = y₀ + μB(t)); las dos juntas = recta. Sin variante pedida se ajusta el modelo
  // completo y, si los datos no sostienen el lag (λ en 0) o la meseta (asíntota sin límite), se reajusta la variante reducida.
  const vari = op?.variante || null
  const lagUsuario = finito(op?.lagFijo) && op.lagFijo >= 0
  const lagF = lagUsuario ? Number(op.lagFijo) : vari?.sinLag ? 0 : NaN
  const sinMes = !!vari?.sinMeseta && !finito(ymaxFijo10)
  const mc = esBar && finito(mcurv) && mcurv > 0 ? mcurv : 1
  const idx = t.map((_, i) => i).filter((i) => finito(t[i]) && finito(ly[i])).sort((a, b) => t[a] - t[b])
  const tt = idx.map((i) => t[i]), yy = idx.map((i) => ly[i])
  const n = tt.length, nT = new Set(tt).size
  const vacio = { ok: false, modelo, n, nT, mu: NaN, avisos: [] }
  if (nT < MIN_T[modelo]) return { ...vacio, motivo: `El modelo ${MODELOS_UFC[modelo]} necesita al menos ${MIN_T[modelo]} tiempos con datos (hay ${nT}).` }
  // N máx fijado: tiene que estar por encima de todo lo medido (si no, la curva no puede pasar por los datos)
  if (finito(fijo) && fijo <= Math.max(...yy)) {
    return { ...vacio, motivo: `El N máx fijado (${f2(ymaxFijo10)} log₁₀) no es mayor que el máximo observado (${f2(Math.max(...yy) / Math.LN10)} log₁₀): no se puede usar. Poné un N máx mayor o dejalo vacío.` }
  }
  const mx = media(tt), my = media(yy)
  let sxx = 0, sxy = 0
  tt.forEach((v, i) => { sxx += (v - mx) ** 2; sxy += (v - mx) * (yy[i] - my) })
  const b = sxx > 0 ? sxy / sxx : NaN
  const ymin = Math.min(...yy), ymaxObs = Math.max(...yy)
  if (!(ymaxObs - ymin > 0.05)) return { ...vacio, motivo: 'Los recuentos casi no cambian: no hay crecimiento para ajustar.' }
  const span = tt[n - 1] - tt[0] || 1
  // pendiente máxima entre tiempos consecutivos (medias) como valor inicial de μ
  const tu = [...new Set(tt)]
  const mu_t = tu.map((x) => media(yy.filter((_, i) => tt[i] === x)))
  let mu0 = finito(b) && b > 0 ? b : (ymaxObs - ymin) / span
  for (let i = 0; i + 1 < tu.length; i++) mu0 = Math.max(mu0, (mu_t[i + 1] - mu_t[i]) / (tu[i + 1] - tu[i]))
  // y₀ no puede pasar el máximo medido ni el N máx fijado
  const y0Hi = finito(fijo) ? Math.min(ymaxObs, fijo) : ymaxObs
  // parámetros: y₀, y máx, μ y q (Baranyi y Roberts: h₀, con λ = h₀/μ; Huang: λ). Se ajustan los libres.
  const nomQ = esBar ? 'h₀' : 'λ'
  const nombresTodos = ['y₀', 'y máx', 'μ', nomQ]
  const libre = [true, !finito(fijo) && !sinMes, true, !finito(lagF)]
  const ix = [0, 1, 2, 3].filter((i) => libre[i])
  const armar = (p) => {
    let k = 0
    const y0 = p[k++], ym = libre[1] ? p[k++] : fijo, mu = p[k++]
    const q = libre[3] ? p[k++] : esBar ? mu * lagF : lagF
    return [y0, ym, mu, q]
  }
  // sin meseta: solo el lag y la fase exponencial. A(t) de Baranyi (q = h₀) y B(t) de Huang (q = λ, α = 4)
  const Abar = (x, mu, h0) => x + Math.log(Math.exp(-mu * x) + Math.exp(-h0) - Math.exp(-mu * x - h0)) / mu
  const Bhua = (x, lam) => x + Math.log((1 + Math.exp(-4 * (x - lam))) / (1 + Math.exp(4 * lam))) / 4
  const F = sinMes
    ? (x, y0, ym, mu, q) => y0 + mu * (esBar ? Abar(x, mu, q) : Bhua(x, q))
    : (x, y0, ym, mu, q) => (esBar ? baranyiF(x, y0, ym, mu, q, mc) : huangF(x, y0, ym, mu, q))
  const fn = (p, x) => { const [y0, ym, mu, q] = armar(p); return x.map((v) => F(v, y0, ym, mu, q)) }
  const lo = [ymin - 3, ymin, 1e-4, 0], hi = [y0Hi, ymaxObs + 5, 20, esBar ? 200 : Math.max(2 * tt[n - 1], 4 * span, 10)]
  let mejor = null, mejorConv = null
  // Puntos de partida del lag. El lag de los modelos se cuenta desde t = 0, y los datos pueden empezar más tarde (por ejemplo,
  // la OD por debajo del mínimo para el logaritmo no entra): los arranques se reparten en el rango MEDIDO (t₀ + fracción del
  // intervalo) y se agrega el lag por la tangente (donde la recta de máxima pendiente cruza el nivel inicial). Si no, el ajuste
  // puede quedar en un mínimo local plano (μ ≈ 0) y no dibujar la curva.
  let iMax = 0, sMax = -Infinity
  for (let i = 0; i + 1 < tu.length; i++) { const sl = (mu_t[i + 1] - mu_t[i]) / (tu[i + 1] - tu[i]); if (sl > sMax) { sMax = sl; iMax = i } }
  const lagTan = sMax > 0 ? tu[iMax] - (mu_t[iMax] - mu_t[0]) / sMax : NaN
  const lags = [0, ...[0, 0.15, 0.3, 0.5, 0.7, 0.85].map((fr) => tt[0] + fr * span), ...(finito(lagTan) && lagTan > 0 ? [lagTan] : [])]
  // Varios puntos de partida: cada uno avanza unas pocas iteraciones y solo los 3 mejores (menor SCE) siguen hasta converger.
  // Da el mismo resultado que llevarlos todos al final, con una fracción del costo (con cinéticas de Tecan, ~165 lecturas
  // por cepa, llevar los 16 arranques hasta 800 iteraciones tardaba más de un segundo por cepa).
  const loL = ix.map((i) => lo[i]), hiL = ix.map((i) => hi[i])
  const previos = []
  for (const lag0 of lags) for (const fm of [0.6, 1]) {
    const m0 = Math.max(mu0 * fm, 1e-3)
    const p0 = [mu_t[0], ymaxObs, m0, esBar ? Math.min(m0 * lag0, hi[3]) : Math.min(lag0, hi[3])]
    const r = levenbergMarquardt(fn, ix.map((i) => p0[i]), loL, hiL, tt, yy, 40)
    if (finito(r.rss) && r.p.every(finito)) previos.push(r)
  }
  previos.sort((a, b) => a.rss - b.rss)
  for (const r0 of previos.slice(0, 3)) {
    const r = r0.conv || r0.estancado ? r0 : levenbergMarquardt(fn, r0.p, loL, hiL, tt, yy)
    if (!finito(r.rss) || !r.p.every(finito)) continue
    if (!mejor || r.rss < mejor.rss) mejor = r
    // se prefieren los arranques que cumplieron el criterio de convergencia
    if (r.conv && !r.estancado && (!mejorConv || r.rss < mejorConv.rss)) mejorConv = r
  }
  if (!mejor) return { ...vacio, motivo: 'El modelo no convergió.' }
  let convergio = true
  if (mejorConv) mejor = mejorConv
  else convergio = false
  const limites = []
  // parámetros pegados a un límite (la asíntota en el límite superior se informa aparte como «sin meseta»; lag nulo es un valor posible)
  ;(mejor.enLimite || []).forEach(({ i, lado }) => {
    const nom = nombresTodos[ix[i]]
    if (nom === 'y máx' && lado === 'superior') return
    if ((nom === 'h₀' || nom === 'λ') && lado === 'inferior') return
    limites.push(`${nom} en el límite ${lado}`)
  })
  const [y0, ymax, mu, q] = armar(mejor.p)
  const pred = (x) => F(x, y0, ymax, mu, q)
  // solución degenerada: la curva quedó plana (no describe el crecimiento): no se informa como ajuste
  const rssPlano = yy.reduce((acc, v) => acc + (v - my) ** 2, 0)
  if (!(mu > 1e-3) || !(mejor.rss < 0.5 * rssPlano)) return { ...vacio, motivo: `El ajuste de ${MODELOS_UFC[modelo]} no encontró una curva de crecimiento (quedó plano en todos los puntos de partida).` }
  const par = { y0, ymax, mu, q, sinAsintota: sinMes || (!finito(fijo) && ymax >= ymaxObs + 5 - 1e-3) }
  const h0 = esBar ? q : mu * q
  const lag = esBar ? q / mu : q
  // errores estándar de los parámetros libres (como el summary de modFit): cov = s² (JᵀJ)⁻¹
  const EE = erroresAjuste(fn, mejor.p, tt, yy)
  const L = Math.LN10
  const pos = (i) => ix.indexOf(i)   // posición del parámetro i entre los libres (−1 si está fijo)
  const seDe = (i) => (EE && pos(i) >= 0 ? EE.se[pos(i)] : NaN)
  const covDe = (i, j) => (EE && pos(i) >= 0 && pos(j) >= 0 ? EE.cov[pos(i)][pos(j)] : NaN)
  const seMu = seDe(2)
  let seLag = NaN
  if (finito(lagF)) seLag = 0
  else if (esBar) {   // λ = h₀/μ: método delta con la covarianza de (h₀, μ)
    const v = covDe(3, 3) / mu ** 2 + (q ** 2 * covDe(2, 2)) / mu ** 4 - (2 * q * covDe(2, 3)) / mu ** 3
    seLag = finito(v) ? Math.sqrt(Math.max(0, v)) : NaN
  } else seLag = seDe(3)
  const corrMuLag = EE && pos(2) >= 0 && pos(3) >= 0 ? covDe(2, 3) / (seDe(2) * seDe(3)) : NaN
  // aumento = y(t_fin) − y(t_ini) del modelo; su error por el método delta: gradiente numérico respecto de los parámetros libres
  let seAum = NaN
  if (EE) {
    const dif = (p) => { const v = fn(p, [tt[0], tt[n - 1]]); return v[1] - v[0] }
    const d0 = dif(mejor.p)
    const g = mejor.p.map((v, j) => { const h = 1e-6 * Math.max(1, Math.abs(v)), q = mejor.p.slice(); q[j] += h; return (dif(q) - d0) / h })
    const va = g.reduce((acc, gi, i) => acc + g.reduce((a2, gj, j) => a2 + gi * gj * EE.cov[i][j], 0), 0)
    if (finito(va)) seAum = Math.sqrt(Math.max(0, va))
  }
  // bondad del ajuste en log₁₀ (como DMFit)
  const res = yy.map((v, i) => (v - pred(tt[i])) / L)
  const sse = res.reduce((s2, r) => s2 + r * r, 0)
  const m10 = my / L
  const sst = yy.reduce((s2, v) => s2 + (v / L - m10) ** 2, 0)
  const k = NPAR[modelo] - (finito(fijo) || sinMes ? 1 : 0) - (finito(lagF) ? 1 : 0)
  const gl = n - k
  const avisos = []
  if (!convergio) avisos.push('El ajuste no cumplió el criterio de convergencia en ningún punto de partida: se muestra el mejor intento; tomá los parámetros con cautela.')
  if (limites.length) avisos.push(`Parámetros en el límite permitido (${limites.join(', ')}): ese valor no es un óptimo libre del ajuste.`)
  if (gl <= 1 || nT <= k) avisos.push(`Pocos grados de libertad (n − p = ${n} − ${k} = ${gl}${nT < n ? `; ${nT} tiempos distintos` : ''}): con tan pocos puntos por parámetro el modelo pasa casi por todos los datos y sus parámetros quedan mal determinados; los errores estándar pueden ser engañosos.`)
  if (!EE && gl > 0) avisos.push('No se pudieron calcular los errores estándar de los parámetros: algunos no están determinados por los datos (probá fijar el lag o N máx).')
  else if (finito(corrMuLag) && Math.abs(corrMuLag) > 0.95) avisos.push(`μ y λ correlacionados (r = ${corrMuLag.toFixed(2).replace('.', ',')}); fijar el lag estabiliza μ.`)
  const out = {
    ok: finito(par.mu), modelo, n, nT, k, gl, pred10: (x) => pred(x) / L, mcurv: mc, convergio, avisos,
    mu, rate: mu / L, td_h: mu > 0 ? Math.LN2 / mu : NaN, lag_h: lag, h0,
    y0: y0 / L, yEnd: par.sinAsintota ? NaN : ymax / L, sinAsintota: !!par.sinAsintota, r2: sst > 0 ? 1 - sse / sst : NaN, r2adj: sst > 0 && n - k > 0 ? 1 - ((sse / sst) * (n - 1)) / (n - k) : NaN, se: n > k ? Math.sqrt(sse / (n - k)) : NaN,
    // errores estándar de los parámetros (μ y λ en sus unidades; y₀ e y máx en log₁₀) y correlación μ–λ
    ee_mu: seMu, ee_lag: seLag, ee_y0: seDe(0) / L, ee_ymax: seDe(1) / L, ee_td: mu > 0 && finito(seMu) ? (Math.LN2 / mu) * (seMu / mu) : NaN, ee_aumento: seAum / Math.LN10, corr_mu_lag: corrMuLag,
    lagFijo: lagUsuario, variante: vari ? (vari.sinLag && sinMes ? 'lineal' : vari.sinLag ? 'sinLag' : sinMes ? 'sinMeseta' : 'completo') : 'completo', yAsint10: ymax / L,
    t0: tt[0], t1: tt[n - 1], ymaxFijo: finito(fijo),
    // la asíntota queda bastante por encima del máximo medido: los datos no llegan a la meseta y N máx es extrapolado
    mesetaExtrapolada: !finito(fijo) && !par.sinAsintota && ymax - Math.max(...yy) > 0.3,
  }
  // Variante según los datos (como DMFit): λ en 0 → sin lag; asíntota sin límite → sin meseta; las dos → recta.
  // Se reajusta con menos parámetros: la curva casi no cambia, pero los errores y n − p ya no cargan un parámetro que los datos no sostienen.
  if (!vari && op?.variantes !== false) {
    const lagCero = !lagUsuario && lag <= 1e-4 * Math.max(1, span)
    const mesNo = !finito(fijo) && par.sinAsintota
    if (lagCero || mesNo) {
      const r = ajusteDmfit(t, ly, modelo, ymaxFijo10, mcurv, { ...(op || {}), variante: { sinLag: lagCero, sinMeseta: mesNo } })
      if (r.ok && finito(r.mu)) return { ...r, notaVariante: `Variante ${NOMBRE_VARIANTE[r.variante]}: ${lagCero && mesNo ? 'sin fase de latencia ni meseta' : lagCero ? 'λ = 0 en el modelo completo' : 'sin fase estacionaria en los datos'}.` }
    }
    // Sin grados de libertad (n − p ≤ 0, p. ej. 4 tiempos y 4 parámetros): el modelo completo pasa por todos los puntos,
    // R² = 1 y no hay errores. Se ajusta la variante reducida (sin lag o sin meseta) que deja menor SCE con n − p > 0.
    if (gl <= 0) {
      const cand = [!lagUsuario && { sinLag: true }, !finito(fijo) && { sinMeseta: true }].filter(Boolean)
        .map((vr) => ajusteDmfit(t, ly, modelo, ymaxFijo10, mcurv, { ...(op || {}), variante: vr }))
        .filter((r) => r.ok && finito(r.mu) && r.gl > 0)
        .sort((a, b) => a.se ** 2 * a.gl - b.se ** 2 * b.gl)
      if (cand.length) return { ...cand[0], notaVariante: `Variante ${NOMBRE_VARIANTE[cand[0].variante]}: con ${n} tiempos el modelo completo no deja grados de libertad (n − p = ${gl}).` }
    }
  }
  return out
}

// ---------- N máx fijado ----------
// Si el usuario cargó un N máx (log₁₀) en «Predicción», se usa en TODAS las pantallas (tabla, curva, predicción y fases),
// esté o no encendido «Predecir».
export const predDe = (aj) => ({ on: false, hasta: 24, nmax: '', objetivo: '', ...(aj?.ufc_pred || {}) })
export const nmaxFijado = (aj) => { const v = predDe(aj).nmax; return v === '' || v === null || v === undefined || !finito(Number(v)) ? NaN : Number(v) }

// ---------- un solo ajuste por cepa ----------
// El mismo ajuste (modelo elegido, N máx fijado, curvatura m y centro de cada tiempo) se usa en la tabla de
// parámetros, la curva, la predicción y las fases de la calibración: μ y λ son los mismos en todas las pantallas.
// ventana del modelo Linealizar log₁₀: la de «μmax por ventana deslizante» (an_ancho, an_minpts, an_r2)
// ampliar la ventana con las vecinas de pendiente ≥ quota × la máxima (aj.an_quota en %, por defecto 95; 0 = no ampliar)
export const cuotaDe = (aj) => { const v = aj?.an_quota === undefined || aj?.an_quota === '' ? 95 : Number(aj.an_quota); return finito(v) && v > 0 && v < 100 ? v / 100 : NaN }
const opClasico = (aj) => ({ ancho: Number(aj?.an_ancho) || 2, minpts: Number(aj?.an_minpts) || 3, r2min: Number(aj?.an_r2) || 0.95, quota: cuotaDe(aj) })
export const opClasicoDe = opClasico
const opClasicoCepa = (aj) => ({ ...opClasico(aj), lagFijo: lagFijoUfc(aj) })
const cacheAjuste = new WeakMap()
export function ajusteCepaUfc(ufcRes, m, aj) {
  const modelo = modeloUfc(aj)
  const nmax = modelo !== 'lineal' ? nmaxFijado(aj) : NaN
  const mc = mcurvUfc(aj)
  const clave = [m, modelo, nmax, mc, centroUfc(aj), JSON.stringify(opClasicoCepa(aj, m))].join('|')
  let porRes = cacheAjuste.get(ufcRes)
  if (!porRes) { porRes = new Map(); cacheAjuste.set(ufcRes, porRes) }
  if (porRes.has(clave)) return porRes.get(clave)
  const { t, ly } = puntosUfc(ufcRes, m, aj)
  const c = ajusteDmfit(t, ly, modelo, nmax, mc, opClasicoCepa(aj, m))
  if (c.tDatos0 === undefined) { c.tDatos0 = c.t0; c.tDatos1 = c.t1 }
  c.avisosPuntos = puntosExcluidosUfc(ufcRes, m, aj)
  porRes.set(clave, c)
  return c
}

// Tiempos (o réplicas) de una cepa que no entran al ajuste de crecimiento porque no tienen un valor > 0:
// 0 colonias (por debajo del límite de detección) o conteos incontables. No se descartan en silencio.
export function puntosExcluidosUfc(ufcRes, m, aj) {
  const out = []
  ufcRes.res.filter((r) => r.Muestra === m && !(finito(r.UFC_mL) && r.UFC_mL > 0)).sort((a, b) => a.T_h - b.T_h).forEach((r) => {
    if (r.N > 0 && r.Colonias_suma === 0) out.push(`T = ${r.T_h} h: 0 colonias en ${r.N} réplica${r.N === 1 ? '' : 's'} (menos que el límite de detección, ≈ ${sciUfc(r.Limite)} UFC/mL)`)
    else out.push(`T = ${r.T_h} h: ${String(r.Estado || 'sin réplicas utilizables').toLowerCase()}${r.N === 0 ? ' (ninguna réplica utilizable)' : ''}`)
  })
  return out
}

// ---------- predicción con Baranyi y Roberts ----------
// Usa el ajuste de la cepa (Baranyi y Roberts) y extiende la curva hasta aj.ufc_pred.hasta horas. Si los datos no llegan
// a la fase estacionaria, la asíntota no se puede estimar: hay que indicar N máx (log₁₀), por ejemplo el de otros ensayos.
const T_MAX_PRED = 1e5   // h: límite de la búsqueda del tiempo en que se llega a un nivel
export function prediccionUfc(ufcRes, m, aj) {
  const o = predDe(aj)
  const c = ajusteCepaUfc(ufcRes, m, aj)
  if (!c.ok) return { ok: false, c, motivo: c.motivo }
  if (c.modelo === 'lineal') return { ok: false, c, motivo: 'la predicción usa Baranyi y Roberts o Huang: elegí uno de esos modelos en «Modelo de ajuste (DMFit)» (así la tabla, la predicción y la calibración usan el mismo ajuste)' }
  // sin meseta en los datos y sin N máx fijado: se predice igual, con la asíntota en su límite (observado + 5 ln ≈ 2,2 log₁₀), y se avisa
  // «Hasta» vacío (o 0) = 24 h: antes quedaba en 0 y la predicción no se extendía más allá del último recuento
  const hasta0 = o.hasta === '' || o.hasta === null || o.hasta === undefined ? NaN : Number(o.hasta)
  const hasta = Math.min(Math.max(finito(hasta0) && hasta0 > 0 ? hasta0 : 24, c.t1), T_MAX_PRED)
  const f = c.pred10
  // tiempo en que la curva llega a un nivel (es creciente: bisección, con el intervalo acotado)
  const tiempoA = (y) => {
    if (!finito(y)) return NaN
    if (f(c.t0) >= y) return c.t0
    let lo = c.t0, hi = Math.max(hasta, c.t1, 1)
    for (let i = 0; i < 60 && hi < T_MAX_PRED && !(f(hi) >= y); i++) hi = Math.min(hi * 2, T_MAX_PRED)
    if (!(f(hi) >= y)) return NaN
    for (let i = 0; i < 80; i++) { const mm = (lo + hi) / 2; if (f(mm) < y) lo = mm; else hi = mm }
    return (lo + hi) / 2
  }
  const N = 160
  const puntos = Array.from({ length: N + 1 }, (_, i) => c.t0 + ((hasta - c.t0) * i) / N).map((x) => ({ x, y: f(x) }))
  return {
    ok: true, c, hasta, puntos, yHasta: f(hasta), sinMeseta: !!c.sinAsintota, tMeseta: c.sinAsintota ? NaN : tiempoA(c.yEnd - 0.1),
    objetivo: o.objetivo === '' ? NaN : Number(o.objetivo), tObjetivo: o.objetivo === '' ? NaN : tiempoA(Number(o.objetivo)),
  }
}

// Puntos del ajuste de una cepa: el valor de cada tiempo (log de la media de las réplicas), como en DMFit
export function puntosUfc(ufcRes, m, aj) {
  const r = ufcRes.res.filter((x) => x.Muestra === m && finito(x.UFC_mL) && x.UFC_mL > 0)
  return { t: r.map((x) => x.T_h), ly: r.map((x) => Math.log(x.UFC_mL)) }
}

// Parámetros de crecimiento por recuento de cada cepa con el modelo elegido.
// Aumento y generaciones salen del MISMO modelo que y₀ y μ: lo que sube la curva ajustada entre el primer y el último
// tiempo medido (log₁₀ N(t_fin) − log₁₀ N(t_ini)); generaciones = aumento / log₁₀ 2. Si no hay ajuste, de los valores
// centrales observados (primer tiempo y máximo), y se indica (aumentoDe).
export function crecimientoUfc(ufcRes, m, aj) {
  const f = { ...ajusteCepaUfc(ufcRes, m, aj) }
  if (f.ok && f.pred10 && f.modelo !== 'lineal') {
    const ini = f.pred10(f.t0), fin = f.pred10(f.t1)
    Object.assign(f, { log10_N0: ini, log10_fin: fin, crecimiento_log10: fin - ini, generaciones: (fin - ini) / Math.log10(2), ee_generaciones: f.ee_aumento / Math.log10(2), aumentoDe: 'modelo' })
    return f
  }
  const cen = centroUfc(aj)
  const med = ufcRes.res.filter((x) => x.Muestra === m && finito(x.UFC_mL) && x.UFC_mL > 0).sort((a, b) => a.T_h - b.T_h)
  if (med.length) {
    const lg = med.map((x) => centroLog10(x, cen))
    const N0 = lg[0], Nmax = Math.max(...lg)
    Object.assign(f, { log10_N0: N0, log10_fin: Nmax, crecimiento_log10: Nmax - N0, generaciones: (Nmax - N0) / Math.log10(2), aumentoDe: 'observado' })
  }
  return f
}

// ---------- fases del crecimiento según el ajuste de la cepa ----------
// Se usa el MISMO ajuste de la tabla (Baranyi y Roberts o bifásico, con el N máx fijado si lo hay). Un tiempo está en
// fase exponencial cuando la velocidad instantánea del modelo es al menos una fracción de μ máx (aj.ufc_frac_exp,
// por defecto 0,5); antes es lag y después, estacionaria. El modelo lineal no distingue fases.
export const FRACCION_EXP = 0.5
export const fraccionExp = (aj) => { const v = Number(aj?.ufc_frac_exp); return finito(v) && v > 0 && v < 1 ? v : FRACCION_EXP }
export function fasesUfc(ufcRes, m, aj) {
  const c = ajusteCepaUfc(ufcRes, m, aj)
  if (!c.ok || !(c.mu > 0)) return { ok: false, c, motivo: c.motivo || 'Sin crecimiento' }
  if (c.modelo === 'lineal') {
    // Linealizar log₁₀: la fase exponencial ES la ventana de la recta; antes es lag y después estacionaria
    const fase = (x) => (x >= c.t0 - 1e-9 && x <= c.t1 + 1e-9 ? 'exponencial' : x < c.t0 ? 'lag' : 'estacionaria')
    return { ok: true, c, fase, frac: NaN, tIni: c.t0, tFin: c.t1, sigue: c.t1 >= c.tDatos1 - 1e-9 }
  }
  return fasesDeAjuste(c, fraccionExp(aj))
}
// fases de un ajuste de Baranyi y Roberts o Huang (sirve para la OD y para las UFC): exponencial = velocidad ≥ frac · μ máx
export function fasesDeAjuste(c, frac) {
  const h = 1e-3
  const rel = (x) => ((c.pred10(x + h) - c.pred10(x - h)) / (2 * h)) * Math.LN10 / c.mu
  // tiempo de máxima velocidad: separa el lag (antes) de la estacionaria (después)
  const N = 400, t0 = c.t0, t1 = c.t1
  const grilla = Array.from({ length: N + 1 }, (_, i) => t0 + ((t1 - t0) * i) / N)
  const tPico = grilla.reduce((a, x) => (rel(x) > rel(a) ? x : a), t0)
  const fase = (x) => (rel(x) >= frac ? 'exponencial' : x < tPico ? 'lag' : 'estacionaria')
  const enExp = grilla.filter((x) => fase(x) === 'exponencial')
  // los límites son los tiempos exactos en que la velocidad cruza la fracción de μ máx (bisección entre puntos de la grilla)
  const cruce = (a, b) => { let lo = a, hi = b; const eb = fase(b) === 'exponencial'; for (let i = 0; i < 50; i++) { const mm = (lo + hi) / 2; if ((fase(mm) === 'exponencial') === eb) hi = mm; else lo = mm } return (lo + hi) / 2 }
  const i0 = grilla.findIndex((x) => fase(x) === 'exponencial'), i1 = grilla.length - 1 - [...grilla].reverse().findIndex((x) => fase(x) === 'exponencial')
  return {
    ok: true, c, fase, frac,
    tIni: enExp.length ? (i0 > 0 ? cruce(grilla[i0 - 1], grilla[i0]) : grilla[0]) : NaN, tFin: enExp.length ? (i1 < N ? cruce(grilla[i1], grilla[i1 + 1]) : grilla[N]) : NaN,
    sigue: enExp.length > 0 && enExp[enExp.length - 1] >= t1 - 1e-9,   // la fase exponencial sigue al final de los datos
  }
}

// Tramo (fase exponencial) de las UFC que rige para una cepa, y quién lo fija:
//   Linealizar log₁₀: el automático de la recta (origen 'auto').
//   Baranyi y Roberts o Huang: lo fija el modelo (velocidad ≥ fracción de μ máx) (origen 'modelo').
//   Si el modelo no ajusta (pocos tiempos, no converge) se usa el automático de la recta y se avisa (origen 'respaldo').
export function tramoUfcRige(ufcRes, m, aj, fz) {
  const f = fz || fasesUfc(ufcRes, m, aj)
  const ok = (x) => x?.ok && finito(x.tIni) && finito(x.tFin)
  const modelo = modeloUfc(aj)
  if (modelo === 'lineal') {
    return ok(f) ? { ventana: [f.tIni, f.tFin], origen: 'auto', modelo } : { ventana: null, origen: 'ninguno', modelo }
  }
  if (ok(f)) return { ventana: [f.tIni, f.tFin], origen: 'modelo', modelo }
  const g = fasesUfc(ufcRes, m, { ...aj, ufc_modelo: 'lineal', ufc_ventana: {}, calib_ventana: {} })
  return ok(g)
    ? { ventana: [g.tIni, g.tFin], origen: 'respaldo', modelo, aviso: `${m}: el modelo no ajustó (${f?.motivo || 'sin ajuste'}); se usa el tramo automático de la recta de «Linealizar log₁₀»` }
    : { ventana: null, origen: 'ninguno', modelo, aviso: `${m}: sin fase exponencial detectada (${f?.motivo || 'sin ajuste'})` }
}

// ---------- curva del crecimiento por recuento ----------
// La curva que se dibuja es la del modelo elegido (aj.ufc_modelo), el mismo de los parámetros; aj.ufc_suave === false:
// sin curva. (Las sesiones que tenían «spline» muestran la del modelo.)
export const metodoCurvaUfc = (aj) => (aj.ufc_suave === false ? 'no' : 'baranyi')
// Devuelve { ok, puntos: [{ x, y (log10) }], motivo } o null si no se pide curva
export function curvaUfc(ufcRes, m, aj) {
  if (metodoCurvaUfc(aj) === 'no') return null
  const c = ajusteCepaUfc(ufcRes, m, aj)
  if (!c.ok) return { ok: false, motivo: c.motivo }
  return { ok: true, puntos: Array.from({ length: 121 }, (_, i) => c.t0 + ((c.t1 - c.t0) * i) / 120).map((x) => ({ x, y: c.pred10(x) })) }
}
