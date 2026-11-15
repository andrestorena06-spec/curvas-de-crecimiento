// Fichas de la OD: parámetros de cada curva, OD de cubeta y blanco de placa.
import { finito, media, od0TresFases, runmed3, trapz, ventanasLn } from '../calculo/comun/analisis.js'
import { AYUDA, PARAMS, explicarResultado } from '../app/ayuda.js'
import { fx, tCuantil } from '../comun/utils.js'
import { avisosDe, g, hs, pasosMedia, v } from './comun.js'

// ==== OD: parámetros de una curva (réplica, o curva de la cepa en placas por tiempo)
// puntos de la curva analizada en horas (en placas «sin promediar», todos los pocillos)
function puntosSerie(w, todos) {
  const t0 = (todos && w.tPts ? w.tPts : w.t).map((s) => s / 3600), y0 = todos && w.yPts ? w.yPts : w.y
  const idx = t0.map((_, i) => i).filter((i) => finito(t0[i]) && finito(y0[i])).sort((a, b) => t0[a] - t0[b])
  return { t: idx.map((i) => t0[i]), y: idx.map((i) => y0[i]) }
}
const puntosLn = (p, op) => p.t.map((t, i) => ({ x: t, y: p.y[i] > 0 && p.y[i] >= op.lnmin ? Math.log(p.y[i]) : NaN })).filter((d) => finito(d.y))
// regresión de la ventana con los mismos puntos que usa el motor (los válidos para ln entre el inicio y el fin)
function regVentana(p, r, op) {
  const idx = p.t.map((_, i) => i).filter((i) => p.t[i] >= r.t_ini_ventana - 1e-9 && p.t[i] <= r.t_fin_ventana + 1e-9 && p.y[i] > 0 && p.y[i] >= op.lnmin)
  const xs = idx.map((i) => p.t[i]), ys = idx.map((i) => Math.log(p.y[i]))
  const n = xs.length, tm = media(xs), ym = media(ys)
  const sxx = xs.reduce((s, x) => s + (x - tm) ** 2, 0), sxy = xs.reduce((s, x, i) => s + (x - tm) * (ys[i] - ym), 0)
  const mu = sxy / sxx, a = ym - mu * tm
  const sse = xs.reduce((s, x, i) => s + (ys[i] - a - mu * x) ** 2, 0), sst = ys.reduce((s, y) => s + (y - ym) ** 2, 0)
  return { n, tm, ym, sxx, sxy, mu, a, sse, sst }
}

export function fichaMu(r, w, op, o = {}) {
  const p = puntosSerie(w, o.todos)
  const base = { titulo: 'μmax: velocidad específica máxima', sujeto: o.nombre, unidad: 'h⁻¹', metodos: 'param', que: AYUDA.mu_max.sig,
    ajustes: [`ventana ${g(op.ancho, 3)} h`, `≥ ${op.minpts} puntos`, `R² ≥ ${g(op.r2min, 3)}`, `OD ≥ ${g(op.lnmin, 3)} para ln`, ...(r.ventana_manual ? ['ventana elegida a mano'] : []), ...(o.todos ? ['todos los pocillos'] : [])] }
  if (!finito(r.mu_max)) return { ...base, valor: '–', pasos: [{ titulo: 'No se pudo calcular', texto: r.aviso || 'No hay ventanas válidas.' }] }
  const R = regVentana(p, r, op)
  const ln = puntosLn(p, op)
  const vent = r.ventana_manual ? [] : ventanasLn(p.t, p.y, op.ancho, op.minpts, op.lnmin) || []
  const gl = R.n - 2, tc = gl > 0 ? tCuantil(0.975, gl) : NaN, ic = finito(r.mu_se) ? tc * r.mu_se : NaN
  const pasos = [
    { titulo: 'La OD pasa a logaritmo natural', texto: `En fase exponencial N = N₀·e^(μt), así que ln(OD) crece en línea recta y su pendiente es μ. Entran las ${ln.length} lecturas con OD ≥ ${g(op.lnmin, 3)}${ln.length < p.t.length ? ` (quedan afuera ${p.t.length - ln.length}: cerca del blanco el logaritmo amplifica el ruido)` : ''}.`,
      formula: [v('y', 1), ' = ln(OD) = ln(OD₀) + ', v('μ', 3), ' · ', v('t', 2)] },
    r.ventana_manual
      ? { titulo: 'Ventana elegida a mano', texto: `Se usó la ventana de ${hs(r.t_ini_ventana)} a ${hs(r.t_fin_ventana)} (${R.n} puntos), elegida arrastrando sobre el gráfico de la réplica.` }
      : { titulo: `Se prueban todas las ventanas de ${g(op.ancho, 3)} h`, texto: `Hay ${vent.length} ventanas con ${op.minpts} puntos o más; en cada una se ajusta una recta. Gana la de mayor pendiente entre las de R² ≥ ${g(op.r2min, 3)}: de ${hs(r.t_ini_ventana)} a ${hs(r.t_fin_ventana)}.`,
        esquema: { tipo: 'grafico', alto: 170, xTxt: 'Centro de la ventana (h)', yTxt: 'Pendiente (h⁻¹)', series: [
          { id: 'ok', nombre: `R² ≥ ${g(op.r2min, 3)}`, color: 'acento', linea: false, puntos: true, radio: 3, data: vent.filter((x) => x.r2 >= op.r2min).map((x) => ({ x: x.t_mid, y: x.pendiente, tip: `${hs(x.t_ini)} a ${hs(x.t_fin)}\npendiente ${g(x.pendiente)} · R² ${g(x.r2, 3)}` })) },
          { id: 'no', nombre: `R² < ${g(op.r2min, 3)}`, color: 'tenue', linea: false, puntos: true, radio: 2.4, data: vent.filter((x) => !(x.r2 >= op.r2min)).map((x) => ({ x: x.t_mid, y: x.pendiente, tip: `${hs(x.t_ini)} a ${hs(x.t_fin)}\npendiente ${g(x.pendiente)} · R² ${g(x.r2, 3)}` })) },
        ], extras: [{ x: (r.t_ini_ventana + r.t_fin_ventana) / 2, y: r.mu_max, color: 'aviso', forma: 'anillo', tip: 'Ventana elegida' }] } },
    { titulo: 'Recta de mínimos cuadrados en la ventana', texto: `Con los ${R.n} puntos de la ventana: t̄ = ${g(R.tm)} h, ȳ = ${g(R.ym)}.`,
      formula: [v('μ', 3), ' = Σ(', v('t', 2), ' − t̄)(', v('y', 1), ' − ȳ) / Σ(', v('t', 2), ' − t̄)²   ;   a = ȳ − ', v('μ', 3), ' · t̄'],
      cuenta: [v('μ', 3), ` = ${g(R.sxy, 5)} / ${g(R.sxx, 5)} = `, v(`${g(r.mu_max)} h⁻¹`, 3), `   ;   a = ${g(R.ym)} − ${g(r.mu_max)} × ${g(R.tm)} = ${g(R.a)}`],
      esquema: { tipo: 'grafico', alto: 220, yTxt: 'ln(OD)', ventana: [r.t_ini_ventana, r.t_fin_ventana], series: [
        { id: 'ln', nombre: 'ln(OD)', color: o.color || 'acento', linea: false, puntos: true, radio: 2.6, data: ln },
        { id: 'r', nombre: 'recta de la ventana', color: 'acento2', ancho: 1.8, dash: '6 4', data: [Math.max(p.t[0], r.t_ini_ventana - 1.5), Math.min(p.t[p.t.length - 1], r.t_fin_ventana + 1.5)].map((x) => ({ x, y: R.a + r.mu_max * x })) },
      ] } },
    { titulo: 'Qué tan recta es la ventana y error de μ', texto: 'R² mide cuánto de la variación de ln(OD) en la ventana explica la recta. El error estándar de la pendiente mide el ruido dentro de la ventana: no mide la variación entre réplicas.',
      formula: ['R² = 1 − SSE / SST   ;   EE(', v('μ', 3), ') = |', v('μ', 3), '| · √[ (1 − R²) / (R² · (n − 2)) ]'],
      cuenta: [`R² = 1 − ${g(R.sse, 4)} / ${g(R.sst, 4)} = ${g(r.r2, 4)}   ;   EE = ${finito(r.mu_se) ? g(r.mu_se, 3) : '–'} h⁻¹`, ...(finito(ic) ? [`\nIC 95 % = μ ± t(0,975; ${gl}) · EE = ${g(r.mu_max)} ± ${g(tc, 4)} × ${g(r.mu_se, 3)} = ${g(r.mu_max - ic, 4)} a ${g(r.mu_max + ic, 4)} h⁻¹`] : [])] },
  ]
  if (finito(r.mu_spline)) pasos.push({ titulo: 'Para comparar (no reemplaza a μmax)', texto: `μ por spline de suavizado (máximo de la derivada de una curva suave de ln(OD), sin elegir ventana) = ${g(r.mu_spline)} h⁻¹. Si difiere mucho de μmax, revisá la ventana o el ruido. Los modelos de toda la curva (Gompertz, logístico, Richards, Baranyi) se ajustan con «Ajustar modelos» en el detalle de la curva.` })
  return { ...base, valor: g(r.mu_max), sub: `EE ${finito(r.mu_se) ? g(r.mu_se, 3) : '–'} · R² ${g(r.r2, 4)} · ${R.n} puntos · ${hs(r.t_ini_ventana)} a ${hs(r.t_fin_ventana)}`, pasos, avisos: avisosDe(r) }
}

// R² de la ventana de μmax: residuos de cada lectura respecto de la recta
export function fichaR2Od(r, w, op, o = {}) {
  const p = puntosSerie(w, o.todos)
  const base = { titulo: 'R² de la ventana', sujeto: o.nombre, unidad: '', metodos: 'param', que: AYUDA.r2.sig }
  if (!finito(r.mu_max)) return { ...base, valor: '–', pasos: [{ titulo: 'No se pudo calcular', texto: r.aviso || 'No hay ventanas válidas.' }] }
  const idx = p.t.map((_, i) => i).filter((i) => p.t[i] >= r.t_ini_ventana - 1e-9 && p.t[i] <= r.t_fin_ventana + 1e-9 && p.y[i] > 0 && p.y[i] >= op.lnmin)
  const xs = idx.map((i) => p.t[i]), ys = idx.map((i) => Math.log(p.y[i])), ps = xs.map((t) => r.intercepto + r.mu_max * t)
  const ym = media(ys), sse = ys.reduce((s, y, i) => s + (y - ps[i]) ** 2, 0), sst = ys.reduce((s, y) => s + (y - ym) ** 2, 0)
  return { ...base, valor: g(r.r2, 4), sub: `ventana de ${hs(r.t_ini_ventana)} a ${hs(r.t_fin_ventana)} · ${xs.length} lecturas`, pasos: [
    { titulo: 'Qué tan cerca queda la recta de cada lectura', texto: 'Para cada lectura de la ventana se compara ln(OD) medido con la recta ln(OD) = a + μ·t.',
      esquema: { tipo: 'tabla', columnas: ['t (h)', 'ln(OD) observado', 'ln(OD) de la recta', 'residuo', 'residuo²'], filas: xs.map((t, i) => [fx(t, 2), fx(ys[i], 4), fx(ps[i], 4), fx(ys[i] - ps[i], 4), g((ys[i] - ps[i]) ** 2, 3)]), pie: ['Σ', '', '', '', g(sse, 4)] } },
    { titulo: 'R² = 1 − lo que la recta no explica / lo que varía ln(OD)', formula: ['R² = 1 − SSE / SST   ;   SST = Σ(ln OD − media)²'],
      cuenta: [`media de ln(OD) = ${g(ym)}   ;   SST = ${g(sst, 4)}   ;   SSE = ${g(sse, 4)}`, '\n', `R² = 1 − ${g(sse, 4)} / ${g(sst, 4)} = ${g(r.r2, 4)}`],
      nota: `El programa elige entre las ventanas con R² ≥ ${g(op.r2min, 3)}; este valor dice qué tan recta es la ventana elegida.` },
  ], avisos: avisosDe(r) }
}

export function fichaTd(r, o = {}) {
  const base = { titulo: 'Tiempo de duplicación', sujeto: o.nombre, unidad: 'h', metodos: 'param', que: AYUDA.td_h.sig }
  if (!(r.mu_max > 0)) return { ...base, valor: '–', pasos: [{ titulo: 'No se puede calcular', texto: 'Hace falta una μmax positiva.' }] }
  const tdh = Math.LN2 / r.mu_max
  return { ...base, valor: g(r.td_h), sub: finito(r.td_se_h) ? `EE ${g(r.td_se_h, 3)} h (propagado desde μ)` : '',
    pasos: [
      { titulo: 'De μ a tiempo de duplicación', texto: 'Si la población se duplica en un tiempo td: 2·N₀ = N₀·e^(μ·td), y despejando td = ln 2 / μ.',
        formula: ['td = ln 2 / ', v('μ', 3)], cuenta: ['td = 0,6931 / ', v(`${g(r.mu_max)} h⁻¹`, 3), ` = ${g(r.td_h)} h`] },
      ...(finito(r.td_se_h) ? [{ titulo: 'Error propagado desde μ', texto: 'Aproximación de primer orden: el error relativo de td es el mismo que el de μ.',
        formula: ['EE(td) = td · EE(', v('μ', 3), ') / ', v('μ', 3)], cuenta: [`EE(td) = ${g(r.td_h)} × ${g(r.mu_se, 3)} / ${g(r.mu_max)} = ${g(r.td_se_h, 3)} h`] }] : []),
    ], avisos: avisosDe(r) }
}

export function fichaLag(r, w, op, o = {}) {
  const p = puntosSerie(w, o.todos)
  const base = { titulo: 'Lag (λ)', sujeto: o.nombre, unidad: 'h', metodos: 'param', que: AYUDA.lag_h.sig, ajustes: [op.lag_metodo === 'umbral' ? `umbral: ${g(op.lag_factor, 3)} × OD₀` : 'tangente en μmax'] }
  if (op.lag_metodo === 'umbral') {
    const ys = runmed3(p.y), u = op.lag_factor * r.od0
    const i = ys.findIndex((y) => y >= u)
    const pasos = [
      { titulo: 'Nivel a alcanzar', texto: `OD₀ = ${g(r.od0)}; el lag es el primer tiempo en que la curva (suavizada con una mediana móvil de 3 puntos) llega a ${g(op.lag_factor, 3)} × OD₀.`,
        cuenta: [`umbral = ${g(op.lag_factor, 3)} × ${g(r.od0)} = ${g(u)}`] },
      i > 0
        ? { titulo: 'Interpolación entre las dos lecturas que lo rodean', formula: ['λ = t₁ + (umbral − y₁) · (t₂ − t₁) / (y₂ − y₁)'],
          cuenta: [`λ = ${g(p.t[i - 1])} + (${g(u)} − ${g(ys[i - 1])}) × (${g(p.t[i])} − ${g(p.t[i - 1])}) / (${g(ys[i])} − ${g(ys[i - 1])}) = ${g(r.lag_h)} h`] }
        : { titulo: i === 0 ? 'Ya estaba sobre el umbral en la primera lectura' : 'Nunca llega al umbral', texto: i === 0 ? `λ = ${hs(p.t[0])}` : 'El lag queda vacío.' },
    ]
    return { ...base, valor: g(r.lag_h), pasos, avisos: avisosDe(r) }
  }
  if (!finito(r.mu_max) || !(r.mu_max > 0)) return { ...base, valor: g(r.lag_h), pasos: [{ titulo: 'Sin recta de μmax', texto: 'Sin μmax no hay tangente: se informó el lag por umbral.' }], avisos: avisosDe(r) }
  const lnod0 = Math.log(r.od0), lagT = (lnod0 - r.intercepto) / r.mu_max
  const ln = puntosLn(p, op)
  const x1 = Math.min(p.t[p.t.length - 1], r.t_fin_ventana + 1)
  return { ...base, valor: g(r.lag_h), pasos: [
    { titulo: 'La recta de μmax', texto: `Es la recta de la ventana de mayor pendiente (${hs(r.t_ini_ventana)} a ${hs(r.t_fin_ventana)}).`, formula: ['ln OD = ', v('a', 1), ' + ', v('μ', 3), ' · t'], cuenta: ['ln OD = ', v(g(r.intercepto), 1), ' + ', v(g(r.mu_max), 3), ' · t'] },
    { titulo: 'El nivel inicial', texto: `OD₀ = ${g(r.od0)} (${r.od0_metodo || 'ver su ficha'}), así que ln OD₀ = ${g(lnod0)}.` },
    { titulo: 'Donde la recta cruza el nivel inicial', texto: 'Es la definición clásica del lag: el tiempo que el cultivo «pierde» antes de crecer a velocidad máxima.',
      formula: ['λ = (ln OD₀ − ', v('a', 1), ') / ', v('μ', 3)],
      cuenta: [`λ = (${g(lnod0)} − (`, v(g(r.intercepto), 1), ')) / ', v(g(r.mu_max), 3), ` = ${g(lagT)} h${lagT < 0 ? '  → negativo (ya crecía al empezar): se informa 0' : ''}`],
      esquema: { tipo: 'grafico', alto: 220, yTxt: 'ln(OD)', ventana: [r.t_ini_ventana, r.t_fin_ventana], series: [
        { id: 'ln', nombre: 'ln(OD)', color: o.color || 'acento', linea: false, puntos: true, radio: 2.6, data: ln },
        { id: 'tg', nombre: 'recta de μmax', color: 'acento2', ancho: 1.6, dash: '6 4', data: [Math.max(lagT, p.t[0]), x1].map((x) => ({ x, y: r.intercepto + r.mu_max * x })) },
        { id: 'od0', nombre: 'ln OD₀', color: 'sec', ancho: 1.2, dash: '2 3', data: [p.t[0], Math.max(lagT, p.t[0]) + 0.5].map((x) => ({ x, y: lnod0 })) },
      ], extras: [{ x: Math.max(lagT, p.t[0]), y: lnod0, color: 'aviso', forma: 'anillo', tip: `λ = ${g(r.lag_h)} h` }] } },
  ], avisos: avisosDe(r) }
}

export function fichaOd0(r, w, op, o = {}) {
  const p = puntosSerie(w, o.todos)
  const base = { titulo: 'OD₀: OD inicial', sujeto: o.nombre, unidad: '', metodos: 'param', que: AYUDA.od0.sig, ajustes: [/^autom/.test(r.od0_metodo || '') ? 'automática (tres fases)' : `media de los primeros ${op.n_od0} puntos`] }
  if (/^autom/.test(r.od0_metodo || '')) {
    const tf = od0TresFases(p.t, p.y, op.lnmin, r.t_fin_ventana)
    if (tf) {
      const ln = puntosLn(p, op).filter((d) => d.x <= r.t_fin_ventana + 1e-9)
      const x1 = r.t_fin_ventana
      return { ...base, valor: g(r.od0), pasos: [
        { titulo: 'Puntos desde el inicio hasta el final de la ventana de μmax', texto: `${ln.length} lecturas con OD ≥ ${g(op.lnmin, 3)} hasta ${hs(x1)}. Tomar solo la primera lectura es ruidoso: se usa toda la meseta inicial.` },
        { titulo: 'Modelo de tres fases (Buchanan et al., 1997), sin la estacionaria', formula: ['ln OD = ', v('y₀', 1), '  si t ≤ ', v('λ', 2), '   ;   ', v('y₀', 1), ' + μ·(t − ', v('λ', 2), ')  si t > ', v('λ', 2)],
          texto: 'Se prueban 300 valores de λ; para cada uno, y₀ y μ salen de una regresión lineal sobre x = máx(0, t − λ), y se elige el λ con la menor suma de cuadrados.',
          cuenta: [v(`λ = ${g(tf.lam)} h`, 2), '   ;   ', v(`y₀ = ${g(tf.y0)}`, 1), `   ;   μ = ${g(tf.mu)} h⁻¹   ;   ${tf.n_base} puntos en la meseta`],
          esquema: { tipo: 'grafico', alto: 200, yTxt: 'ln(OD)', series: [
            { id: 'ln', nombre: 'ln(OD)', color: o.color || 'acento', linea: false, puntos: true, radio: 2.6, data: ln },
            { id: 'tf', nombre: 'tres fases', color: 'acento2', ancho: 1.8, data: [p.t[0], tf.lam, x1].map((x) => ({ x, y: tf.y0 + tf.mu * Math.max(0, x - tf.lam) })) },
          ] } },
        { titulo: 'OD₀ es la meseta', formula: ['OD₀ = e^', v('y₀', 1)], cuenta: ['OD₀ = e^', v(g(tf.y0), 1), ` = ${g(r.od0)}`] },
      ], avisos: avisosDe(r) }
    }
  }
  const n0 = Math.min(Math.max(1, Math.round(op.n_od0)), p.y.length), ys = p.y.slice(0, n0)
  return { ...base, valor: g(r.od0), pasos: [
    { titulo: `Media de los primeros ${n0} puntos`, formula: ['OD₀ = (y₁ + … + yₙ) / n'], cuenta: [`OD₀ = (${ys.map((y) => g(y)).join(' + ')}) / ${n0} = ${g(media(ys))}`],
      nota: media(ys) < op.lnmin ? `Es menor que la OD mínima para ln (${g(op.lnmin, 3)}): se usó ${g(op.lnmin, 3)}.` : '' },
  ], avisos: avisosDe(r) }
}

export function fichaK(r, w, o = {}) {
  const p = puntosSerie(w, false)
  const ys = runmed3(p.y)
  let iK = 0
  ys.forEach((y, i) => { if (y > ys[iK]) iK = i })
  const vec = p.y.slice(Math.max(0, iK - 1), iK + 2)
  return { titulo: 'K: OD máxima', sujeto: o.nombre, valor: g(r.K), unidad: 'OD', metodos: 'param', que: AYUDA.K.sig, sub: `a las ${hs(r.t_K_h)}`,
    pasos: [
      { titulo: 'Se suaviza con una mediana móvil de 3 puntos', texto: 'Cada lectura se reemplaza por la mediana de ella y sus dos vecinas (en los extremos, la regla de Tukey). Así un pico aislado (una burbuja) no cuenta como máximo.',
        cuenta: [`en el máximo: mediana(${vec.map((y) => g(y)).join(' ; ')}) = ${g(ys[iK])}`] },
      { titulo: 'K es el valor más alto de la curva suavizada', cuenta: [`K = ${g(r.K)} a las ${hs(r.t_K_h)}`],
        esquema: { tipo: 'grafico', alto: 200, yTxt: 'OD', series: [
          { id: 'od', nombre: 'OD', color: o.color || 'acento', linea: false, puntos: true, radio: 2.4, data: p.t.map((x, i) => ({ x, y: p.y[i] })) },
          { id: 'sv', nombre: 'mediana móvil de 3', color: 'acento2', ancho: 1.6, data: p.t.map((x, i) => ({ x, y: ys[i] })) },
        ], extras: [{ x: r.t_K_h, y: r.K, color: 'aviso', forma: 'anillo', tip: `K = ${g(r.K)}` }] } },
    ], avisos: r.t_K_h >= p.t[p.t.length - 1] - 1e-9 ? ['K está en la última lectura: el cultivo puede no haber llegado a la meseta.'] : [] }
}

export function fichaGeneraciones(r, o = {}) {
  return { titulo: 'Generaciones', sujeto: o.nombre, valor: g(r.generaciones), unidad: '', metodos: 'param', que: AYUDA.generaciones.sig,
    pasos: [{ titulo: 'Cuántas veces se duplicó la OD de OD₀ a K', texto: 'Cada generación duplica la población: K = OD₀ · 2ⁿ, así que n = log₂(K / OD₀).',
      formula: ['n = log₂(', v('K', 1), ' / ', v('OD₀', 2), ') = ln(K / OD₀) / ln 2'],
      cuenta: ['n = log₂(', v(g(r.K), 1), ' / ', v(g(r.od0), 2), `) = log₂(${g(r.K / r.od0)}) = ${g(r.generaciones)}`] }] }
}
export function fichaDeltaOd(r, o = {}) {
  return { titulo: 'ΔOD', sujeto: o.nombre, valor: g(r.delta_od), unidad: 'OD', metodos: 'param', que: AYUDA.delta_od.sig,
    pasos: [{ titulo: 'K menos OD₀', formula: ['ΔOD = ', v('K', 1), ' − ', v('OD₀', 2)], cuenta: ['ΔOD = ', v(g(r.K), 1), ' − ', v(g(r.od0), 2), ` = ${g(r.delta_od)}`] }] }
}
export function fichaAuc(r, w, o = {}) {
  const p = puntosSerie(w, false)
  const tr = p.y.slice(1).map((y, i) => ((p.y[i] + y) / 2) * (p.t[i + 1] - p.t[i]))
  return { titulo: 'AUC de OD', sujeto: o.nombre, valor: g(r.auc_od), unidad: 'OD·h', metodos: 'param', que: AYUDA.auc_od.sig,
    pasos: [{ titulo: 'Regla del trapecio', texto: `Entre cada par de lecturas la curva se aproxima por una recta y se suma el área de los ${tr.length} trapecios, de ${hs(p.t[0])} a ${hs(p.t[p.t.length - 1])}.`,
      formula: ['AUC = Σ ½ (yᵢ + yᵢ₊₁) · (tᵢ₊₁ − tᵢ)'],
      cuenta: [`AUC = ${tr.slice(0, 3).map((x) => g(x, 3)).join(' + ')}${tr.length > 3 ? ` + … (${tr.length} términos)` : ''} = ${g(trapz(p.t, p.y))} OD·h`],
      esquema: { tipo: 'grafico', alto: 190, yTxt: 'OD', series: [{ id: 'a', nombre: 'OD', color: o.color || 'acento', banda: true, puntos: true, radio: 2.2, data: p.t.map((x, i) => ({ x, y: p.y[i], lo: 0, hi: p.y[i] })) }] } }] }
}
// el resto de los parámetros de OD: el texto del cálculo con los valores
function fichaGenerica(r, k, op, o = {}) {
  const ex = explicarResultado(r, k, op)
  return { titulo: PARAMS[k] || k, sujeto: o.nombre, valor: g(r[k]), unidad: '', metodos: 'param', que: AYUDA[k]?.sig,
    pasos: [{ titulo: 'Cómo se calculó', texto: ex.calculo }, ...(ex.error && !/^Este parámetro no tiene/.test(ex.error) ? [{ titulo: 'Error', texto: ex.error }] : [])], avisos: avisosDe(r) }
}
// ficha de un parámetro de OD de una curva. w: la serie analizada; o: { nombre, color, todos (placas sin promediar) }
export function fichaParamOd(k, r, w, op, o = {}) {
  if (!r || !w) return null
  const conPuntos = { ...o, todos: o.todos && !['K', 't_K_h', 'auc_od', 'auc_ln', 't_umbral_od_h', 't_max_dod_h', 'dod_max', 'caida_pct', 't_muerte', 'od_final'].includes(k) }
  if (k === 'r2') return fichaR2Od(r, w, op, conPuntos)
  if (k === 'mu_max') return fichaMu(r, w, op, conPuntos)
  if (k === 'td_h') return fichaTd(r, o)
  if (k === 'lag_h') return fichaLag(r, w, op, conPuntos)
  if (k === 'od0') return fichaOd0(r, w, op, conPuntos)
  if (k === 'K' || k === 't_K_h') return fichaK(r, w, o)
  if (k === 'generaciones') return fichaGeneraciones(r, o)
  if (k === 'delta_od') return fichaDeltaOd(r, o)
  if (k === 'auc_od') return fichaAuc(r, w, o)
  return fichaGenerica(r, k, op, o)
}

// ---------- OD de cubeta (blanco y diluciones) ----------
export function fichaOdCubeta(fila, m, c) {
  const blanco = m.yaCorregido ? 0 : Number(m.blanco) || 0
  const lect = Object.entries(fila.od || {}).map(([k, x]) => [Number(k), Number(x)]).filter(([, x]) => finito(x)).sort((a, b) => a[0] - b[0])
  const filas = lect.map(([k, x]) => ({ k, x, neta: x - blanco, corr: (x - blanco) * m.factor ** k, dentro: x - blanco >= m.vmin && x - blanco <= m.vmax }))
  const us = filas.filter((q) => (c.usados || []).includes(q.k))
  return { titulo: 'OD corregida', sujeto: `${fila.muestra} · réplica ${fila.replica} · t = ${fila.t} h`, valor: g(c.od), unidad: 'OD', metodos: 'origen',
    pasos: [
      { titulo: 'Lectura menos blanco, por el factor de la dilución', formula: ['OD = (', v('L', 1), ' − ', v('B', 2), ') × f^k'],
        texto: `B = ${g(blanco)}${m.yaCorregido ? ' (el equipo ya restó el blanco)' : ''}; f = ${m.factor}; ventana lineal del equipo: OD neta entre ${m.vmin} y ${m.vmax}.`,
        cuenta: filas.flatMap((q, i) => [...(i ? ['\n'] : []), `${q.k ? `dilución −${q.k}` : 'sin diluir'}: (`, v(g(q.x), 1), ' − ', v(g(blanco), 2), `) × ${m.factor}^${q.k} = ${g(q.corr)}${q.dentro ? '   ✓ en la ventana' : '   (fuera de la ventana)'}`]) },
      { titulo: us.length > 1 ? 'Media de las lecturas dentro de la ventana' : 'Lectura usada', cuenta: [us.length > 1 ? `OD = (${us.map((q) => g(q.corr)).join(' + ')}) / ${us.length} = ${g(c.od)}` : `OD = ${g(c.od)}`],
        nota: c.estado !== 'ok' ? 'Ninguna lectura cayó dentro de la ventana: se usó la más cercana al centro.' : '' },
    ] }
}
// ---------- blanco de una placa (placas por tiempo) ----------
export function fichaBlancoPlaca(bl, lect, t) {
  const us = (lect || []).filter((l) => l.EsBlanco && l.Usado), fuera = (lect || []).filter((l) => l.EsBlanco && !l.Usado)
  const vals = us.map((l) => ({ etiqueta: l.Pocillo, x: l.OD_leida }))
  const base = { titulo: 'Blanco de la placa', sujeto: `t = ${hs(t)}${bl.origen !== t ? ` (tomado de la placa de ${hs(bl.origen)})` : ''}`, valor: g(bl.valor), unidad: 'OD', metodos: 'origen',
    que: 'OD del medio sin inocular de esa placa: se resta a cada lectura antes de multiplicar por la dilución.' }
  if (!vals.length) return { ...base, pasos: [{ titulo: 'Media de los blancos aceptados', texto: `${bl.n} pocillo${bl.n === 1 ? '' : 's'} (${(bl.pocillos || []).join(', ')}): media = ${g(bl.valor)}.` }] }
  const M = pasosMedia(vals, 'OD', 'sd')
  return { ...base, pasos: [...M.pasos.slice(0, 2), ...(fuera.length ? [{ titulo: 'Pocillos de blanco que no entran', texto: fuera.map((l) => `${l.Pocillo} (${g(l.OD_leida)}): ${l.Motivo || 'excluido'}`).join(' · ') }] : [])] }
}
