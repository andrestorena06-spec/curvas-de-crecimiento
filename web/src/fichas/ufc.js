// Fichas de UFC: réplica, valor de cada tiempo y modelos de crecimiento.
import { finito, media } from '../calculo/comun/analisis.js'
import { MODELOS_UFC, NOMBRE_VARIANTE, dilDe } from '../calculo/ufc/index.js'
import { fx, tCuantil } from '../comun/utils.js'
import { dil, f2, fichaMediaTiempo, g, hs, sci, v } from './comun.js'

// ==== UFC
const etqCol = (par, k) => dil(dilDe(par, k))
// UFC/mL de una réplica: una dilución, C · D / V
export function fichaUfcReplica(r, o = {}) {
  const p = r._par || {}
  const ent = Object.entries(r._cont || {}).map(([k, c]) => [Number(k), Number(c)]).filter(([, c]) => finito(c)).sort((a, b) => dilDe(p, a[0]) - dilDe(p, b[0]))
  const k = (r._usados || [])[0]
  const D = finito(k) ? dilDe(p, k) : NaN, V = p.vol, C = r._S, Vo = V / D
  const sujeto = `${r.Muestra} · T = ${r.T_h} h · réplica ${r.Replica}`
  const pasos = [
    { titulo: 'Diluciones contadas', texto: `Todas las réplicas de ${r.Muestra} a T = ${r.T_h} h usan la misma dilución, ${r._manual ? 'elegida a mano' : `la que tiene más réplicas dentro del rango contable (${p.min} a ${p.max} colonias)`}.`,
      esquema: { tipo: 'diluciones', columnas: ent.map(([kk, c]) => ({ etiqueta: etqCol(p, kk), colonias: c, estado: kk === k ? 'elegida' : c > 2 * p.max ? 'incontable' : c >= p.min && c <= p.max ? 'rango' : '' })) } },
  ]
  if (r._estado === 'sin_dilucion') return { titulo: 'UFC/mL de la réplica', sujeto, valor: '–', metodos: 'ufc', pasos: [...pasos, { titulo: 'Sin conteo en la dilución de la cepa', texto: 'Esta réplica no tiene conteo en la dilución elegida para su cepa y tiempo: no se calcula con otra.' }] }
  pasos.push({ titulo: 'Volumen de suspensión original sembrado', texto: `Se sembraron V = ${g(V * 1000, 4)} µL de la dilución ${dil(D)}: es como haber sembrado V/D mL de la suspensión original.`,
    formula: [v('V', 2), ' / ', v('D', 4), ' = mL de suspensión original'], cuenta: [v(`${g(V)} mL`, 2), ' / ', v(sci(D), 4), ' = ', `${sci(Vo, 3)} mL`] })
  if (r._estado === 'cero') {
    pasos.push({ titulo: '0 colonias: límite de detección', texto: 'Con 0 colonias no hay concentración medible. Se informa el límite de detección: la concentración para la que se esperarían 3 colonias (si se esperan 3, la probabilidad de ver 0 es ≈ 5 %).',
      formula: ['límite ≈ 3 · ', v('D', 4), ' / ', v('V', 2)], cuenta: [`límite ≈ 3 / ${sci(Vo, 3)} mL = ${sci(r.Limite)} UFC/mL`] })
    return { titulo: 'UFC/mL de la réplica', sujeto, valor: `< ${sci(r.Limite)}`, unidad: 'UFC/mL', metodos: 'ufc', pasos }
  }
  if (r._estado === 'incontable') return { titulo: 'UFC/mL de la réplica', sujeto, valor: 'incontable', metodos: 'ufc', pasos: [...pasos, { titulo: 'Incontable', texto: `${C} colonias: más del doble del máximo contable (${p.max}). Las colonias se superponen y se subcuenta.` }] }
  pasos.push({ titulo: 'Concentración', formula: ['UFC/mL = ', v('C', 1), ' · ', v('D', 4), ' / ', v('V', 2)],
    cuenta: ['UFC/mL = ', v(C, 1), ' × ', v(sci(D), 4), ' / ', v(`${g(V)} mL`, 2), ` = ${sci(r.UFC_mL)}`] })
  const avisos = []
  if (r._estado === 'bajo' || r._estado === 'alto') avisos.push(`${C} colonias está ${r._estado === 'bajo' ? 'debajo' : 'arriba'} del rango contable (${p.min} a ${p.max}): es una estimación con error grande.`)
  if (o.dixon) avisos.push(`Marcada como atípica: ${o.dixon}`)
  if (o.fuera) avisos.push('Esta réplica está excluida del promedio.')
  else avisos.push('El valor de la cepa en este tiempo es la media de las UFC/mL de sus réplicas (clic en el valor del tiempo, en Curva UFC vs t).')
  return { titulo: 'UFC/mL de la réplica', sujeto, valor: sci(r.UFC_mL), unidad: 'UFC/mL', sub: `log₁₀ = ${f2(r.log10)}`, metodos: 'ufc', pasos, avisos,
    ajustes: [`rango ${p.min}–${p.max} colonias`, `${g(V * 1000, 4)} µL sembrados`] }
}

// UFC/mL de una cepa en un tiempo: media aritmética de las UFC/mL de las réplicas ± su error (la misma ficha que la OD).
// Cada número de la tabla abre SOLO su cálculo (foco).
export function fichaUfcTiempo(r, o = {}) {
  const pool = r._pool || []
  const sujeto = `${r.Muestra} · T = ${r.T_h} h`
  if (!pool.length) return { titulo: 'UFC/mL del tiempo', sujeto, valor: '–', metodos: 'ufc', pasos: [{ titulo: 'Sin réplicas utilizables', texto: String(r.Estado || '') }] }
  const valores = pool.map((q) => ({ etiqueta: `réplica ${q.Replica}`, x: q.ufc }))
  const detalle = { titulo: `UFC/mL de cada réplica (${pool.length} de ${r.Replicas})`,
    texto: `Todas con la misma dilución. UFC/mL = C / V, con V = mL de suspensión original sembrados (volumen sembrado / dilución).${o.excluidas ? ` Quedan afuera: ${o.excluidas}.` : ''}`,
    columnas: ['Réplica', 'Colonias C', 'V (mL)', 'UFC/mL = C / V'],
    filas: pool.map((q) => [`réplica ${q.Replica}`, String(q.C), sci(q.D, 3), q.C > 0 ? `${q.C} / ${sci(q.D, 3)} = ${sci(q.ufc)}` : '0 colonias → 0']) }
  return fichaMediaTiempo({ valores, t: r.T_h, nombre: r.Muestra, tipo: o.error || 'sd', unidad: 'UFC/mL', etiquetaValor: 'UFC/mL media', foco: o.foco || '', detalle, fmt: (x) => sci(x),
    avisos: o.estimadas ? [`Incluye réplicas estimadas fuera del rango contable: ${o.estimadas}.`] : [], metodos: 'ufc' })
}


// Ajuste del modelo de crecimiento por recuento: cada número de la tabla abre SU cálculo (foco = el parámetro que se tocó):
// y₀, μ, velocidad, td, λ, y máx, R², EE y n − p. Modelos: Linealizar log₁₀ (recta de ln N en la fase exponencial) y Baranyi y Roberts.
const PARAM_UFC = {
  rate: ['Velocidad máxima', 'log₁₀ UFC/mL por hora', (c) => f2(c.rate, 3)], mu: ['μ: velocidad específica máxima', 'h⁻¹', (c) => g(c.mu)], td: ['Tiempo de duplicación', 'h', (c) => g(c.td_h)],
  lag: ['Lag (λ)', 'h', (c) => g(c.lag_h, 3)], y0: ['y₀', 'log₁₀ UFC/mL', (c) => f2(c.y0)], yEnd: ['y máx (asíntota)', 'log₁₀ UFC/mL', (c) => (finito(c.yEnd) ? f2(c.yEnd) : 'sin meseta')],
  r2: ['R² del ajuste', '', (c) => f2(c.r2, 3)], se: ['Error estándar del ajuste', 'log₁₀', (c) => f2(c.se, 3)], gl: ['Grados de libertad (n − p)', '', (c) => String(c.gl)],
}
export const f3 = (x) => fx(x, 3)
export function fichaModeloUfc(c, pts, o = {}) {
  const foco = PARAM_UFC[o.foco] ? o.foco : 'mu'
  const [nom, uni, val] = PARAM_UFC[foco]
  const sujeto = o.nombre
  if (!c?.ok) return { titulo: nom, sujeto, valor: '–', metodos: 'ufccrec', pasos: [{ titulo: 'Sin ajuste', texto: c?.motivo || '' }] }
  const L = Math.LN10
  const cl = c.modelo === 'lineal'
  const x = pts.t, y10 = pts.ly.map((y) => y / L)
  // puntos que usa la cuenta: todos (Baranyi y Roberts) o los de la ventana de la fase exponencial (Linealizar log₁₀)
  const idx = x.map((_, i) => i).filter((i) => !cl || (x[i] >= c.t0 - 1e-9 && x[i] <= c.t1 + 1e-9))
  const xs = idx.map((i) => x[i]), ys = idx.map((i) => y10[i]), ps = xs.map((t) => c.pred10(t))
  const nP = xs.length, mY = media(ys)
  const sse = ys.reduce((sum, y, i) => sum + (y - ps[i]) ** 2, 0), sst = ys.reduce((sum, y) => sum + (y - mY) ** 2, 0)
  const curva = Array.from({ length: 81 }, (_, i) => c.t0 + ((c.t1 - c.t0) * i) / 80).map((t) => ({ x: t, y: c.pred10(t) }))
  const datos = { id: 'p', nombre: 'datos', color: o.color || 'acento', linea: false, puntos: true, forma: 'cuadrado', radio: 3.5, data: x.map((t, i) => ({ x: t, y: y10[i], tip: `t = ${fx(t, 2)} h\nlog₁₀ = ${f3(y10[i])}` })) }
  const mod = { id: 'm', nombre: cl ? 'recta de la fase exponencial' : 'modelo', color: 'acento2', ancho: 1.8, dash: cl ? '6 4' : undefined, data: curva }
  const graf = (extra = [], extras = [], alto = 210) => ({ tipo: 'grafico', alto, yTxt: 'log₁₀ UFC/mL', ventana: cl ? [c.t0, c.t1] : undefined, series: [datos, mod, ...extra], extras })
  const tablaRes = { tipo: 'tabla', columnas: ['t (h)', 'log₁₀ observado', 'log₁₀ del modelo', 'residuo', 'residuo²'],
    filas: xs.map((t, i) => [fx(t, 2), f3(ys[i]), f3(ps[i]), f3(ys[i] - ps[i]), g((ys[i] - ps[i]) ** 2, 3)]), pie: ['Σ', '', '', '', g(sse, 4)] }
  const ventTxt = cl ? `la ventana de la fase exponencial (${hs(c.t0)} a ${hs(c.t1)}, ${nP} puntos)` : `los ${nP} puntos`
  const ec = cl ? ['ln N = ', v('a', 1), ' + ', v('μ', 3), ' · t']
    : c.modelo === 'huang' ? ['y = ', v('y₀', 1), ' + ', v('y máx', 4), ' − ln[ e^y₀ + (e^y máx − e^y₀) · e^(−', v('μ', 3), '·B(t)) ]   ;   B(t) = t + (1/4) · ln[ (1 + e^(−4(t − ', v('λ', 2), '))) / (1 + e^(4', v('λ', 2), ')) ]']
    : ['y = ', v('y₀', 1), ' + ', v('μ', 3), '·A(t) − (1/m)·ln[1 + (e^(m·μ·A(t)) − 1) / e^(m·(', v('y máx', 4), ' − y₀))]   ;   A(t) = t + ln(e^(−μt) + e^(−', v('h₀', 2), ') − e^(−μt − h₀)) / μ']
  // regresión de la ventana (Linealizar log₁₀): t̄, ȳ, Sxx, Sxy con los mismos puntos
  const lnY = xs.map((_, i) => ys[i] * L)
  const tm = media(xs), ym = media(lnY)
  const sxx = xs.reduce((sum, t) => sum + (t - tm) ** 2, 0), sxy = xs.reduce((sum, t, i) => sum + (t - tm) * (lnY[i] - ym), 0)
  let pasos = []
  const avisos = [...(c.avisos || [])]
  // Baranyi y Huang se ajustan en ln N: el parámetro sale en ln y se informa en log₁₀ (÷ ln 10)
  const pasoLn = (sim, val10, ee10, col) => [
    { titulo: 'Resultado del ajuste (en ln N)', texto: 'El ajuste trabaja con y = ln N.', cuenta: [v(`${sim} = ${g(val10 * L, 4)}`, col), ...(finito(ee10) && ee10 > 0 ? [`   ;   EE = ${g(ee10 * L, 3)}`] : []), '  (ln N)'] },
    { titulo: 'Paso a log₁₀', formula: [`${sim} (log₁₀) = ${sim} (ln) / ln 10`],
      cuenta: [`${sim} = ${g(val10 * L, 4)} / 2,3026 = `, v(`${f2(val10, 3)} log₁₀`, col), ` = ${sci(10 ** val10)} UFC/mL`, ...(finito(ee10) && ee10 > 0 ? [`
EE = ${g(ee10 * L, 3)} / 2,3026 = ${g(ee10, 3)} log₁₀`] : [])] },
  ]
  if (foco === 'y0') {
    if (cl) {
      pasos = [
        { titulo: 'Qué es y₀ en el modelo Linealizar log₁₀', texto: `Es la ordenada al origen de la recta de ln N: lo que valdría log₁₀ N en t = 0 si la fase exponencial se prolongara hacia atrás (no es el recuento inicial medido).`, formula: ['a = ȳ − ', v('μ', 3), ' · t̄   ;   y₀ = a / ln 10'] },
        { titulo: `Con ${ventTxt}`, texto: `t̄ = ${g(tm)} h, ȳ = ${g(ym)} (en ln N).`, cuenta: [`a = ${g(ym)} − ${g(c.mu)} × ${g(tm)} = ${g(c.a)}   ;   y₀ = ${g(c.a)} / 2,3026 = `, v(`${f2(c.y0, 3)} log₁₀`, 1)],
          esquema: graf([], [{ x: 0, y: c.y0, color: 'aviso', forma: 'anillo', tip: `y₀ = ${f2(c.y0, 3)}` }]) },
      ]
    } else {
      pasos = [
        { titulo: 'y₀ es un parámetro del ajuste', texto: 'Uno de los parámetros que se ajustan juntos (y₀, y máx, μ y h₀) por mínimos cuadrados sobre y = ln N. En t = 0, A(0) = 0: la curva vale y₀.', formula: ec },
        ...pasoLn('y₀', c.y0, c.ee_y0, 1),
        { titulo: 'Comparado con lo medido', texto: `El primer recuento (t = ${fx(x[0], 2)} h) fue log₁₀ = ${f3(y10[0])}; el modelo vale ${f3(c.pred10(x[0]))} en ese tiempo.`, esquema: graf([], [{ x: Math.min(0, c.t0), y: c.y0, color: 'aviso', forma: 'anillo', tip: `y₀ = ${f2(c.y0, 3)}` }]) },
      ]
    }
  } else if (foco === 'mu') {
    if (cl) {
      pasos = [
        { titulo: 'Recta de mínimos cuadrados en la fase exponencial', texto: `Con ${ventTxt}, en escala ln N: t̄ = ${g(tm)} h, ȳ = ${g(ym)}.`, formula: [v('μ', 3), ' = Σ(t − t̄)(y − ȳ) / Σ(t − t̄)²'], cuenta: [v('μ', 3), ` = ${g(sxy, 5)} / ${g(sxx, 5)} = `, v(`${g(c.mu)} h⁻¹`, 3)] },
        { titulo: 'Cuál es la fase exponencial', texto: `El programa prueba todas las ventanas de ${g(c.ventana ? (c.t1 - c.t0) : 0, 3)} h o más con al menos 3 puntos y se queda con la de mayor pendiente entre las que son bien rectas (R² ≥ 0,95).`, esquema: graf() },
      ]
    } else {
      const grilla = Array.from({ length: 401 }, (_, i) => c.t0 + ((c.t1 - c.t0) * i) / 400)
      const der = (t) => ((c.pred10(t + 1e-4) - c.pred10(t - 1e-4)) / 2e-4) * L
      const tP = grilla.reduce((m, t) => (der(t) > der(m) ? t : m), c.t0)
      pasos = [
        { titulo: 'μ es un parámetro del ajuste', texto: 'Es la velocidad específica máxima del modelo de Baranyi y Roberts: la pendiente de ln N cuando el crecimiento ya salió del lag y todavía no lo frena la meseta. El programa la ajusta junto con y₀, y máx y h₀ por mínimos cuadrados.', formula: ec },
        { titulo: 'Qué valor tiene', cuenta: [v(`μ = ${g(c.mu)} h⁻¹`, 3), `   ·   pendiente máxima de la curva ajustada = ${g(der(tP))} h⁻¹ (a las ${hs(tP)})`], texto: der(tP) < c.mu * 0.97 ? 'La pendiente máxima queda algo por debajo de μ porque la meseta empieza a frenar la curva antes de que alcance su velocidad plena.' : '',
          esquema: graf([{ id: 'tg', nombre: 'pendiente máxima', color: 'sec', ancho: 1.3, dash: '5 4', data: [Math.max(c.t0, tP - 1.2), Math.min(c.t1, tP + 1.2)].map((t) => ({ x: t, y: c.pred10(tP) + (der(tP) / L) * (t - tP) })) }]) },
      ]
    }
  } else if (foco === 'rate') {
    pasos = [{ titulo: 'De μ (en ln) a velocidad en log₁₀', texto: 'DMFit informa la velocidad en log₁₀ UFC/mL por hora («Rate»): se pasa de logaritmo natural a decimal dividiendo por ln 10.', formula: ['velocidad = ', v('μ', 3), ' / ln 10'], cuenta: ['velocidad = ', v(`${g(c.mu)} h⁻¹`, 3), ` / 2,3026 = ${f2(c.rate, 3)} log₁₀ UFC/mL por hora`] },
      { titulo: 'Qué dice', texto: `Cada hora, en la fase exponencial, la concentración sube ${f2(c.rate, 3)} órdenes de magnitud (×${g(10 ** c.rate, 3)} por hora).` }]
  } else if (foco === 'td') {
    pasos = [{ titulo: 'Tiempo en que la población se duplica', texto: 'Si N crece como e^(μ·t), N se duplica cuando μ·td = ln 2.', formula: ['td = ln 2 / ', v('μ', 3)], cuenta: ['td = 0,6931 / ', v(`${g(c.mu)} h⁻¹`, 3), ` = ${g(c.td_h)} h  (= ${g(c.td_h * 60)} min)`] }]
  } else if (foco === 'lag') {
    if (cl) {
      pasos = [
        { titulo: 'Donde la recta de la fase exponencial cruza el nivel inicial', texto: `Nivel inicial: el recuento medio del primer tiempo, ln N = ${g(c.yInit10 * L)} (log₁₀ ${f2(c.yInit10, 3)}). La recta es ln N = ${g(c.a)} + ${g(c.mu)}·t.`, formula: ['λ = (ln N inicial − ', v('a', 1), ') / ', v('μ', 3)],
          cuenta: [`λ = (${g(c.yInit10 * L)} − (`, v(g(c.a), 1), ')) / ', v(g(c.mu), 3), ` = ${g(c.lag_h, 3)} h${(c.yInit10 * L - c.a) / c.mu < 0 ? '  → negativo: se informa 0' : ''}`],
          esquema: graf([{ id: 'ini', nombre: 'nivel inicial', color: 'sec', ancho: 1.2, dash: '2 3', data: [x[0], c.t1].map((t) => ({ x: t, y: c.yInit10 })) }], [{ x: c.lag_h, y: c.yInit10, color: 'aviso', forma: 'anillo', tip: `λ = ${g(c.lag_h, 3)} h` }]) },
      ]
    } else if (c.modelo === 'huang') {
      pasos = [{ titulo: 'λ es un parámetro del ajuste (Huang)', texto: 'En el modelo de Huang el lag λ es uno de los 4 valores que el programa mueve (junto con y₀, y máx y μ) hasta que la curva queda lo más cerca posible de los datos: no sale de una fórmula con otros parámetros.', formula: ec,
        cuenta: [v(`λ = ${g(c.lag_h, 3)} h`, 2)] }]
    } else {
      const fin = Math.min(c.t1, c.lag_h + (finito(c.yEnd) ? (c.yEnd - c.y0) / c.rate : c.t1 - c.lag_h))
      pasos = [
        { titulo: 'h₀ es el parámetro del ajuste; λ sale de h₀ y μ', texto: 'h₀ mide el «estado fisiológico» inicial de las células (h₀ = 0: ya adaptadas, sin lag). El lag es el tiempo que tardaría en acumularse ese trabajo de adaptación a velocidad μ.', formula: ['λ = ', v('h₀', 2), ' / ', v('μ', 3)],
          cuenta: ['λ = ', v(`${g(c.h0, 4)}`, 2), ' / ', v(`${g(c.mu)} h⁻¹`, 3), ` = ${g(c.lag_h, 3)} h`] },
        { titulo: 'Cómo se ve en el gráfico', texto: 'La recta de pendiente máxima corta el nivel inicial y₀ en t = λ.', esquema: graf([{ id: 'tg', nombre: 'pendiente máxima', color: 'sec', ancho: 1.3, dash: '5 4', data: [c.lag_h, fin].map((t) => ({ x: t, y: c.y0 + c.rate * (t - c.lag_h) })) }, { id: 'y0', nombre: 'y₀', color: 'sec', ancho: 1, dash: '2 3', data: [c.t0, Math.max(fin, c.lag_h + 0.5)].map((t) => ({ x: t, y: c.y0 })) }], [{ x: c.lag_h, y: c.y0, color: 'aviso', forma: 'anillo', tip: `λ = ${g(c.lag_h, 3)} h` }]) },
      ]
    }
  } else if (foco === 'yEnd') {
    if (cl) {
      pasos = [{ titulo: 'El modelo Linealizar log₁₀ no tiene asíntota', texto: 'Solo describe la fase exponencial: no estima dónde se frena el crecimiento. Para eso, usá Baranyi y Roberts.' }]
    } else {
      pasos = [
        { titulo: 'y máx es un parámetro del ajuste', texto: 'Nivel de la meseta (fase estacionaria). Se ajusta junto con y₀, μ y h₀ sobre y = ln N.', formula: ec },
        ...(finito(c.yEnd) ? pasoLn('y máx', c.yEnd, c.ee_ymax, 4) : []),
        { titulo: 'Comparación con los datos', cuenta: [finito(c.yEnd) ? v(`y máx = ${f2(c.yEnd, 3)} log₁₀`, 4) : 'y máx: sin meseta (quedó en el límite del ajuste)', `   ·   recuento más alto medido = ${f2(Math.max(...y10), 3)} log₁₀${c.ymaxFijo ? '   ·   fijado a mano' : ''}`],
          texto: c.mesetaExtrapolada ? 'La meseta queda bastante por encima del último dato: los recuentos no llegaron a la fase estacionaria y y máx es una extrapolación.' : '',
          esquema: finito(c.yEnd) ? graf([{ id: 'ym', nombre: 'y máx', color: 'sec', ancho: 1.2, dash: '5 4', data: [c.t0, c.t1].map((t) => ({ x: t, y: c.yEnd })) }]) : undefined },
      ]
    }
  } else if (foco === 'r2') {
    pasos = [
      { titulo: 'Qué tan cerca pasa el modelo de cada punto', texto: `Para cada uno de ${ventTxt} se compara lo medido con lo que da el modelo (en log₁₀).`, esquema: tablaRes },
      { titulo: 'R² = 1 − lo que el modelo no explica / lo que varían los datos', formula: ['R² = 1 − SSE / SST   ;   SST = Σ(observado − media)²'],
        cuenta: [`media de los observados = ${f3(mY)}   ;   SST = ${g(sst, 4)}   ;   SSE = ${g(sse, 4)}`, '\n', `R² = 1 − ${g(sse, 4)} / ${g(sst, 4)} = `, v(f2(c.r2, 3), 1)],
        nota: nP - c.k <= 1 ? 'Con tan pocos grados de libertad el R² es casi siempre alto: no dice mucho sobre qué tan bueno es el modelo.' : '' },
    ]
  } else if (foco === 'se') {
    pasos = [
      { titulo: 'Los residuos (lo medido menos el modelo)', texto: 'Un buen ajuste deja residuos repartidos al azar alrededor de cero. Si forman una curva (primero positivos, después negativos, etc.), el modelo no describe bien la forma de los datos.', esquema: { tipo: 'grafico', alto: 170, xTxt: 'Tiempo (h)', yTxt: 'Residuo (log₁₀)', series: [{ id: 'res', nombre: 'residuo', color: o.color || 'acento', linea: false, puntos: true, radio: 3.4, data: xs.map((t, i) => ({ x: t, y: ys[i] - ps[i], tip: `t = ${fx(t, 2)} h\nresiduo = ${f3(ys[i] - ps[i])} log₁₀` })) }, { id: 'cero', nombre: 'cero', color: 'sec', ancho: 1, dash: '4 3', data: [Math.min(...xs), Math.max(...xs)].map((t) => ({ x: t, y: 0 })) }] } },
      { titulo: 'Los mismos residuos en una tabla', esquema: tablaRes },
      { titulo: 'Error estándar del ajuste', texto: 'Es el desvío típico de los residuos, descontando los parámetros que el modelo usó para acercarse a los datos (se divide por n − p y no por n).', formula: ['EE = √[ SSE / (n − p) ]'],
        cuenta: [`EE = √( ${g(sse, 4)} / (${nP} − ${c.k}) ) = √( ${g(sse, 4)} / ${nP - c.k} ) = `, v(`${f2(c.se, 3)} log₁₀`, 1)], nota: `Un EE de ${f2(c.se, 2)} log₁₀ equivale a una desviación típica de ×/÷ ${f2(10 ** c.se, 2)} entre el modelo y los recuentos.` },
    ]
  } else { // gl
    pasos = [
      { titulo: 'Puntos que entran', texto: `${nP} puntos (${new Set(xs).size} tiempos distintos)${cl ? `: los de ${ventTxt}` : ', todos: ninguno se descarta para mejorar el R²'}.` },
      { titulo: 'Parámetros que ajusta el modelo', texto: cl ? 'Linealizar log₁₀: la ordenada al origen a y la pendiente μ.' : `Baranyi y Roberts${c.variante && c.variante !== 'completo' ? ` (variante ${NOMBRE_VARIANTE[c.variante]}, elegida según los datos como en DMFit)` : ''}: y₀${c.variante === 'sinMeseta' || c.variante === 'lineal' ? ' (sin y máx: no hay fase estacionaria)' : `, y máx${c.ymaxFijo ? ' (fijado a mano: no cuenta)' : ''}`}, μ${c.variante === 'sinLag' || c.variante === 'lineal' ? ' (sin h₀: el lag del modelo completo daba 0)' : ' y h₀'} (la curvatura m = ${g(c.mcurv, 3)} está fija).`, cuenta: [`p = ${c.k}`] },
      { titulo: 'Grados de libertad', formula: ['g.l. = n − p'], cuenta: [`g.l. = ${nP} − ${c.k} = `, v(String(c.gl), 1)], nota: c.gl <= 1 ? 'Con 0 o 1 grado de libertad el modelo pasa casi por todos los puntos: sus parámetros son poco firmes. Más tiempos de muestreo lo resuelven.' : '' },
    ]
  }
  // errores estándar de los parámetros libres: cov = s²·(JᵀJ)⁻¹ (lo que informan nls y modFit)
  const tcrit = c.gl > 0 ? tCuantil(0.975, c.gl) : NaN
  const eeDe = { mu: [c.ee_mu, c.mu, 'h⁻¹', 'μ'], rate: [c.ee_mu / Math.LN10, c.rate, 'log₁₀/h', 'velocidad'], td: [c.ee_td, c.td_h, 'h', 'td'], lag: [c.ee_lag, c.lag_h, 'h', 'λ'], y0: [c.ee_y0, c.y0, 'log₁₀', 'y₀'], yEnd: [c.ee_ymax, c.yEnd, 'log₁₀', 'y máx'] }[foco]
  if (eeDe && finito(eeDe[0]) && eeDe[0] > 0) {
    const [ee, val0, un, sim] = eeDe
    const deriv = !cl && (foco === 'y0' || foco === 'yEnd') ? 'EE en ln dividido por ln 10 (paso anterior).' : { rate: 'velocidad = μ / ln 10, así que EE(velocidad) = EE(μ) / ln 10.', td: 'td = ln 2 / μ; por el método delta, EE(td) = td · EE(μ) / μ.' }[foco]
    const txtEE = cl
      ? { mu: 'Error estándar de la pendiente de la recta (mínimos cuadrados): EE(μ) = s / √Sxx, con s² = SSE/(n − 2) y Sxx = Σ(t − t̄)².', y0: 'Error estándar de la ordenada al origen: EE(a) = s · √(1/n + t̄²/Sxx), pasado a log₁₀ (÷ ln 10).', lag: 'λ = (y inicial − a)/μ; por el método delta con la covarianza de a y μ (cov = −t̄·s²/Sxx), tomando el nivel inicial observado como dato.' }[foco]
      : 'Sale de la matriz de covarianza del ajuste no lineal: cov = s²·(JᵀJ)⁻¹, con J la matriz de derivadas del modelo respecto de cada parámetro y s² = SSE/(n − p). Dice cuánto se mueve el parámetro si los datos cambian dentro de su ruido.'
    pasos.push({ titulo: `Error estándar de ${sim}`, texto: [deriv, txtEE].filter(Boolean).join(' '),
      formula: [`IC 95 % = ${sim} ± t(0,975; n − p) · EE`],
      cuenta: [`EE(${sim}) = ${g(ee, 3)} ${un}`, ...(finito(tcrit) ? [`\nIC 95 % = ${g(val0)} ± ${g(tcrit, 3)} × ${g(ee, 3)} = ${g(val0 - tcrit * ee)} a ${g(val0 + tcrit * ee)} ${un}`] : [])],
      nota: finito(c.corr_mu_lag) && Math.abs(c.corr_mu_lag) > 0.9 ? `μ y λ están correlacionados (r = ${f2(c.corr_mu_lag, 2)}): sus errores son grandes porque los datos no permiten separar bien ambos efectos. Fijar el lag estabiliza μ.` : '' })
  }
  if (c.lagFijo && foco === 'lag') pasos.unshift({ titulo: 'Lag fijado por el usuario', texto: `El lag λ = ${g(c.lag_h, 3)} h se fijó a mano: no es un resultado del ajuste y no tiene error.` })
  const pasosF = pasos.filter(Boolean)
  const aHuang = (x) => (typeof x === 'string' ? x.replace(/Baranyi y Roberts/g, 'Huang').replace(/h₀/g, 'λ') : Array.isArray(x) ? x.map(aHuang) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k2, v2]) => [k2, k2 === 'c' || k2 === 'color' || k2 === 'id' || k2 === 'tipo' ? v2 : aHuang(v2)])) : x)
  const pasosM = c.modelo === 'huang' ? aHuang(pasosF) : pasosF
  return { titulo: nom, sujeto, valor: val(c), unidad: uni, metodos: 'ufccrec', sub: `${MODELOS_UFC[c.modelo]} · R² ${f2(c.r2, 3)} · n − p = ${c.gl}`, pasos: pasosM, avisos,
    ajustes: [MODELOS_UFC[c.modelo], ...(c.modelo === 'baranyi' ? [`m = ${g(c.mcurv, 3)}`] : []), ...(c.ymaxFijo ? ['N máx fijado'] : []), ...(c.lagFijo ? ['lag fijado'] : [])] }
}
// Baranyi y Roberts ajustado a la OD de una cepa: es el mismo modelo y la misma cuenta que para las UFC, con las unidades de la OD
const aOd = (x) => (typeof x === 'string' ? x.replace(/log₁₀ UFC\/mL/g, 'log₁₀ OD').replace(/ UFC\/mL/g, ' OD').replace(/ln N/g, 'ln OD').replace(/recuentos?/g, 'lecturas')
  : Array.isArray(x) ? x.map(aOd) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v2]) => [k, k === 'c' || k === 'color' || k === 'id' || k === 'tipo' ? v2 : aOd(v2)])) : x)
export function fichaModeloOd(c, pts, o = {}) {
  const f = fichaModeloUfc(c, pts, o)
  const r = aOd(f)
  return { ...r, metodos: 'param', ajustes: (r.ajustes || []).filter((t) => !/valor de cada tiempo|réplicas/.test(t)) }
}
export function fichaAumentoUfc(c, o = {}) {
  const gen = o.foco === 'gen'
  if (!c?.ok) return { titulo: gen ? 'Generaciones' : 'Aumento', sujeto: o.nombre, valor: '–', metodos: 'ufccrec', pasos: [{ titulo: 'Sin ajuste', texto: c?.motivo || '' }] }
  return { titulo: gen ? 'Generaciones' : 'Aumento en el ensayo', sujeto: o.nombre, valor: gen ? f2(c.generaciones) : f2(c.crecimiento_log10), unidad: gen ? '' : 'log₁₀', metodos: 'ufccrec',
    pasos: [
      { titulo: c.aumentoDe === 'modelo' ? 'Lo que sube la curva del modelo en el período medido' : 'Con los valores observados', texto: c.aumentoDe === 'modelo' ? `Del primer tiempo (${hs(c.t0)}) al último (${hs(c.t1)}), con el mismo modelo que da y₀ y μ.` : 'Primer valor y máximo observados.',
        formula: ['aumento = log₁₀ N(t fin) − log₁₀ N(t ini)'], cuenta: [`aumento = ${f2(c.log10_fin, 3)} − ${f2(c.log10_N0, 3)} = ${f2(c.crecimiento_log10, 3)} log₁₀`] },
      { titulo: 'Generaciones', texto: 'Cada generación duplica la población: log₁₀ 2 = 0,301 por generación.', formula: ['generaciones = aumento / log₁₀ 2'], cuenta: [`generaciones = ${f2(c.crecimiento_log10, 3)} / 0,30103 = ${f2(c.generaciones)}`] },
    ] }
}
export function fichaPrediccionUfc(p, o = {}) {
  const c = p.c
  const pasos = [
    { titulo: 'La misma curva, más allá del último recuento', texto: `Se evalúa el ajuste ${c.modelo === 'huang' ? 'de Huang' : 'de Baranyi y Roberts'} de la cepa (y₀ = ${f2(c.y0, 3)}, μ = ${g(c.mu)} h⁻¹, λ = ${g(c.lag_h, 3)} h, y máx = ${f2(c.yEnd, 3)}${c.ymaxFijo ? ' fijado' : ''}) hasta ${hs(p.hasta)}.`,
      cuenta: [`log₁₀ N(${hs(p.hasta)}) = ${f2(p.yHasta, 3)} → ${sci(10 ** p.yHasta)} UFC/mL`] },
    { titulo: 'Tiempo hasta un nivel', texto: 'La curva es creciente: el tiempo en que llega a un nivel se busca por bisección (se parte el intervalo a la mitad hasta encontrarlo).',
      cuenta: [`meseta (y máx − 0,1 = ${f2(c.yEnd - 0.1, 2)}): ${finito(p.tMeseta) ? hs(p.tMeseta) : p.sinMeseta ? 'sin meseta estimable' : 'no llega'}${finito(p.objetivo) ? `   ;   objetivo ${f2(p.objetivo)}: ${finito(p.tObjetivo) ? hs(p.tObjetivo) : 'no llega'}` : ''}`] },
  ]
  return { titulo: 'Predicción', sujeto: o.nombre, valor: f2(p.yHasta), unidad: 'log₁₀ UFC/mL', metodos: 'ufccrec', pasos,
    avisos: p.hasta > c.t1 ? [`Más allá de ${hs(c.t1)} (último recuento) es una extrapolación: depende de que el modelo y la meseta sigan valiendo.`] : [] }
}
