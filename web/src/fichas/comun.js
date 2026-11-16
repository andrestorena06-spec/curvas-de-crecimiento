// Fichas «Cómo se calculó»: formato de números y media ± error de réplicas (comunes a OD y UFC).
// Una ficha: { titulo, sujeto, valor, unidad, sub, que, pasos: [{ titulo, texto, formula, cuenta, esquema, nota }], avisos, ajustes, metodos }.
import { finito, media } from '../calculo/comun/analisis.js'
import { AYUDA, PARAMS } from '../app/ayuda.js'
import { N_MIN_EEM, resumenReplicas } from '../calculo/comun/estadistica.js'
import { fs, fx, sci } from '../comun/utils.js'

// ---------- formato ----------
export { sci }
export const g = (x, d = 4) => fs(x, d)         // cifras significativas
export const f2 = (x, d = 2) => fx(x, d)        // decimales fijos
export const v = (t, c) => ({ v: String(t), c }) // variable coloreada
export const hs = (t) => `${fx(t, 2)} h`
// dilución: entera (1/125, 1/15.625) mientras se pueda leer; si no, en potencia de 10
export const dil = (D) => (Math.abs(D - 1) < 1e-9 ? 'sin diluir' : Math.abs(D - Math.round(D)) < 1e-6 && D < 1e7 ? `1/${String(Math.round(D)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')}` : `1/${sci(D, 2)}`)
export const avisosDe = (r) => String(r?.aviso || '').split('; ').filter(Boolean)

// ---------- media ± error de varios valores (réplicas) ----------
// valores: [{ etiqueta, x }]; tipo: 'sd' | 'sem' | 'ic95'
export function pasosMedia(valores, unidad, tipo = 'sd', fmt = g) {
  // los números salen de resumenReplicas (calculo/comun/estadistica.js): la ficha solo muestra la cuenta
  const xs = valores.map((q) => q.x), n = xs.length, est = resumenReplicas(xs), m = est.m, sd = est.sd, tc = est.tt
  const pasos = [
    { titulo: `Los ${n} valores`, texto: valores.map((q) => `${q.etiqueta}: ${fmt(q.x)}`).join(' · '),
      esquema: { tipo: 'tira', valores: valores.map((q) => ({ x: q.x, etiqueta: q.etiqueta })), media: m, de: sd, unidad } },
    { titulo: 'Media', formula: ['x̄ = Σxᵢ / n'], cuenta: [`x̄ = (${xs.map((x) => fmt(x)).join(' + ')}) / ${n} = ${fmt(m)}`] },
  ]
  if (n > 1) {
    pasos.push({ titulo: 'Desviación estándar (cuánto se separan entre sí)', texto: 'Se divide por n − 1 porque la media salió de los mismos datos (corrección de Bessel).',
      formula: ['DE = √[ Σ(xᵢ − x̄)² / (n − 1) ]'], cuenta: [`DE = √[ ${fmt(xs.reduce((s, x) => s + (x - m) ** 2, 0), 4)} / ${n - 1} ] = ${fmt(sd)}`] })
    if (tipo !== 'sd' && n < N_MIN_EEM) pasos.push({ titulo: tipo === 'sem' ? 'Error estándar de la media' : 'Intervalo de confianza del 95 %', texto: `Con ${n} réplicas no se calcula: hacen falta al menos ${N_MIN_EEM}.` })
    if (tipo !== 'sd' && n >= N_MIN_EEM) pasos.push({ titulo: tipo === 'sem' ? 'Error estándar de la media' : 'Intervalo de confianza del 95 % de la media',
      formula: [tipo === 'sem' ? 'EEM = DE / √n' : 'IC 95 % = ± t(0,975; n − 1) · DE / √n'],
      cuenta: [tipo === 'sem' ? `EEM = ${fmt(sd)} / √${n} = ${fmt(est.sem)}` : `IC 95 % = ± ${g(tc, 4)} × ${fmt(sd)} / √${n} = ± ${fmt(est.ic)}`] })
  }
  return { pasos, m, sd, n, tc }
}
// Cómo se calculó el valor de CADA réplica: una columna por réplica y una fila por paso con cuenta (se toman de la ficha de cada una).
// porReplica: [{ etiqueta, fichas: [ficha de cada parámetro necesario] }]
const aTexto = (c) => (c || []).map((p) => (typeof p === 'string' ? p : p?.v ?? '')).join('').replace(/\s+;\s+/g, '\n').replace(/\s*\n\s*/g, '\n').trim()
function tablaPorReplica(porReplica) {
  if (!porReplica?.length) return null
  const filas = []
  const claves = new Map()
  porReplica.forEach((pr, j) => pr.fichas.forEach((f, fi) => (f?.pasos || []).filter((p) => p.cuenta).forEach((p, orden) => {
    const k = fi + '|' + orden
    if (!claves.has(k)) { claves.set(k, filas.length); filas.push({ titulo: p.titulo, celdas: porReplica.map(() => '–') }) }
    filas[claves.get(k)].celdas[j] = aTexto(p.cuenta)
  })))
  if (!filas.length) return null
  const valores = ['Valor', ...porReplica.map((pr) => { const f = pr.fichas[pr.fichas.length - 1]; return f ? `${f.valor}${f.unidad ? ' ' + f.unidad : ''}` : '–' })]
  return { tipo: 'tabla', clase: 'por-replica con-total', columnas: ['Cálculo', ...porReplica.map((pr) => pr.etiqueta)], filas: [...filas.map((f) => [f.titulo, ...f.celdas]), valores] }
}
const pasoReplicas = (porReplica, n) => {
  const t = tablaPorReplica(porReplica)
  return t ? [{ titulo: `Cómo se calculó el valor de cada una de las ${n} réplicas`, texto: 'Cada réplica tiene su propia curva y su propio cálculo: acá están lado a lado. Después se promedian.', esquema: t }] : []
}
// resumen por cepa: media ± DE entre réplicas de un parámetro de OD
export function fichaResumen(rs, k, filas, o = {}) {
  const etq = o.etiqueta || ((r) => `réplica ${r.Replica}`)
  const avisoN = (n) => (n > 0 && n < 3 ? [`Con n = ${n} ${n === 2 ? 'la DE tiene muy poca base y no se calculan EEM ni IC 95 %' : 'no hay DE'} (hacen falta al menos 3 réplicas).`] : [])
  const nota = 'Son réplicas de UN experimento: para generalizar a la cepa hacen falta experimentos independientes.'
  // ninguna réplica dio el parámetro: se explica por qué (los avisos de cada curva)
  const kBase = k === 'td_h' ? 'mu_max' : k
  if (!filas.some((r) => finito(r[kBase]))) {
    return { titulo: `${PARAMS[k] || k} de la cepa`, sujeto: rs.Muestra, valor: '–', metodos: 'replicas', que: AYUDA[k]?.sig,
      pasos: [{ titulo: 'Ninguna réplica dio este parámetro', texto: filas.map((r) => `${etq(r)}: ${r.aviso || 'sin valor'}`).join(' · ') }] }
  }
  if (k === 'r2') {
    const vals = filas.map((r) => ({ etiqueta: etq(r), x: r.r2 })).filter((q) => finito(q.x))
    return { titulo: 'R² de la ventana (el más bajo)', sujeto: rs.Muestra, valor: g(rs.r2.m), metodos: 'replicas', que: 'Calidad del ajuste lineal de ln(OD) en la ventana de μmax de cada réplica.',
      pasos: [...pasoReplicas(o.porReplica, vals.length), { titulo: 'No se promedia', texto: `El R² dice qué tan bien ajusta la recta de cada réplica; no es una magnitud de la cepa, así que no lleva media ni DE. Se informa el peor de las ${vals.length} réplicas: ${vals.map((q) => `${q.etiqueta} ${g(q.x)}`).join(' · ')}.`,
        esquema: { tipo: 'tira', valores: vals, unidad: 'R²' } }] }
  }
  if (k === 'td_h') {
    const vals = filas.map((r) => ({ etiqueta: etq(r), x: r.mu_max })).filter((q) => finito(q.x))
    const M = pasosMedia(vals, 'h⁻¹', 'sd')
    const td = Math.LN2 / M.m, sdTd = finito(M.sd) ? (td * M.sd) / M.m : NaN
    return { titulo: 'Tiempo de duplicación de la cepa', sujeto: rs.Muestra, valor: g(rs.td_h.m), unidad: 'h', metodos: 'replicas', que: AYUDA.td_h.sig,
      sub: finito(sdTd) ? `± ${g(sdTd, 3)} h (propagado desde la DE de μ)` : '',
      pasos: [...pasoReplicas(o.porReplica, M.n), ...M.pasos.slice(0, 2).map((p, i) => (i === 0 ? { ...p, titulo: `μmax de las ${M.n} réplicas` } : { ...p, titulo: 'Media de la μmax de las réplicas' })),
        { titulo: 'td con la μ media (no el promedio de los td)', texto: 'Promediar los td daría otro número (el promedio de 1/μ no es 1/promedio de μ).',
          formula: ['td = ln 2 / μ̄'], cuenta: [`td = 0,6931 / ${g(M.m)} = ${g(td)} h`] },
        ...(finito(sdTd) ? [{ titulo: 'DE propagada desde la de μ', formula: ['DE(td) = td · DE(μ) / μ̄'], cuenta: [`DE(td) = ${g(td)} × ${g(M.sd)} / ${g(M.m)} = ${g(sdTd, 3)} h`] }] : [])],
      avisos: avisoN(M.n), nota }
  }
  const vals = filas.map((r) => ({ etiqueta: etq(r), x: r[k] })).filter((q) => finito(q.x))
  const M = pasosMedia(vals, '', 'ic95')
  return { titulo: `${PARAMS[k] || k} de la cepa`, sujeto: rs.Muestra, valor: g(M.m), unidad: '', metodos: 'replicas', que: AYUDA[k]?.sig,
    sub: finito(M.sd) ? `DE ${g(M.sd)} · n = ${M.n}` : `n = ${M.n}`, pasos: [...pasoReplicas(o.porReplica, M.n), ...M.pasos.map((p) => (p.titulo === 'Media' ? { ...p, titulo: 'Media de las réplicas' } : p))], avisos: [...avisoN(M.n), ...(vals.length < filas.length ? [`${filas.length - vals.length} réplica(s) no dieron este parámetro.`] : [])], nota }
}
// Media ± error de las réplicas en un tiempo: el MISMO cálculo para la OD y para las UFC/mL. Los valores son siempre los
// lineales (OD o UFC/mL de cada réplica). En escala log₁₀ el valor es el log₁₀ de esa media y la barra va de
// log₁₀(media − error) a log₁₀(media + error).
// foco: '' (todo), 'media', 'error', 'rango', 'log' o 'rangolog': cada número de la tabla abre SOLO su cuenta.
export function fichaMediaTiempo({ valores, t, nombre, tipo = 'sd', unidad = 'OD', etiquetaValor = '', foco = '', detalle = null, fmt = g, avisos = [], metodos = 'replicas', ajustes = null }) {
  const M = pasosMedia(valores, unidad, tipo, fmt)
  // cómo se obtuvo el valor de CADA réplica (OD: lectura − blanco; UFC: C / V), antes de promediar
  const det = valores.filter((q) => q.det)
  if (det.length) M.pasos.unshift({ titulo: `Cómo se obtuvo el valor de cada una de las ${det.length} réplicas`, texto: 'Cada réplica se lee y se le resta el blanco de ese tiempo; recién después se promedian.',
    esquema: { tipo: 'tabla', clase: 'por-replica', columnas: ['Réplica', 'Lectura', 'Blanco', 'OD = lectura − blanco'], filas: det.map((q) => [q.etiqueta, g(q.det[0]), g(q.det[1]), `${g(q.det[0])} − ${g(q.det[1])} = ${g(q.x)}`]) } })
  if (detalle) M.pasos.unshift({ titulo: detalle.titulo, texto: detalle.texto, esquema: { tipo: 'tabla', clase: 'por-replica', columnas: detalle.columnas, filas: detalle.filas } })
  const etq = { sd: 'DE', sem: 'EEM', ic95: 'IC 95 %' }[tipo] || 'DE'
  const bajo = tipo !== 'sd' && M.n < 3
  const err = bajo || M.n < 2 ? NaN : tipo === 'sem' ? M.sd / Math.sqrt(M.n) : tipo === 'ic95' ? (M.tc * M.sd) / Math.sqrt(M.n) : M.sd
  const lo = M.m - err, hi = M.m + err
  const L = (x) => (finito(x) && x > 0 ? Math.log10(x) : NaN)
  const fl = (x) => (finito(x) ? fx(x, 3) : '–')
  const esBase = (p) => /^(Los \d|Cómo se obtuvo|UFC\/mL de cada)/.test(p.titulo)
  const pBase = M.pasos.filter(esBase), pMedia = M.pasos.filter((p) => p.titulo === 'Media')
  let pErr = M.pasos.filter((p) => !esBase(p) && p.titulo !== 'Media')
  if (bajo) pErr = pErr.filter((p) => /^Desviación/.test(p.titulo))
  const pRango = { titulo: 'Rango', formula: ['rango = x̄ − error a x̄ + error'], cuenta: [`rango = ${fmt(M.m)} − ${fmt(err)} a ${fmt(M.m)} + ${fmt(err)} = ${fmt(lo)} a ${fmt(hi)} ${unidad}`] }
  const pLog = { titulo: 'log₁₀ de la media', texto: 'En escala log₁₀ el valor es el logaritmo de la media ya calculada (no se vuelve a promediar).', formula: ['log₁₀ x̄'], cuenta: [`log₁₀(${fmt(M.m)}) = ${fl(L(M.m))}`] }
  const pRangoLog = { titulo: 'Rango en log₁₀', texto: 'Se pasa a log₁₀ cada extremo del rango: es la misma barra que en escala lineal, con el eje en log₁₀.', formula: ['log₁₀(x̄ − error) a log₁₀(x̄ + error)'],
    cuenta: [lo > 0 ? `log₁₀(${fmt(lo)}) a log₁₀(${fmt(hi)}) = ${fl(L(lo))} a ${fl(L(hi))}` : `x̄ − error = ${fmt(lo)} ≤ 0 no tiene logaritmo: la barra no tiene extremo inferior. Superior: log₁₀(${fmt(hi)}) = ${fl(L(hi))}`] }
  const base = { sujeto: `${nombre} · t = ${hs(t)}`, metodos, avisos: [...avisos, ...(bajo ? [`Con menos de 3 réplicas no se calcula el ${etq}.`] : [])], ...(ajustes ? { ajustes } : {}) }
  const tit = etiquetaValor || `${unidad} media`, subN = `n = ${M.n}`
  const conErr = finito(err)
  if (foco === 'media') return { ...base, titulo: tit, valor: fmt(M.m), unidad, sub: subN, pasos: [...pBase, ...pMedia] }
  if (foco === 'error') return { ...base, titulo: `${etq} (${unidad})`, valor: conErr ? `± ${fmt(err)}` : '–', unidad, sub: `media ${fmt(M.m)} · ${subN}`, pasos: [...pBase, ...pMedia, ...pErr] }
  if (foco === 'rango') return { ...base, titulo: `Rango (${unidad})`, valor: conErr ? `${fmt(lo)} a ${fmt(hi)}` : '–', unidad, sub: conErr ? `media ${fmt(M.m)} ± ${fmt(err)} (${etq})` : subN, pasos: [...pBase, ...pMedia, ...pErr, ...(conErr ? [pRango] : [])] }
  if (foco === 'log') return { ...base, titulo: `log₁₀ de la media`, valor: fl(L(M.m)), unidad: `log₁₀ ${unidad}`, sub: `media ${fmt(M.m)} ${unidad}`, pasos: [...pBase, ...pMedia, pLog] }
  if (foco === 'rangolog') return { ...base, titulo: 'Rango en log₁₀', valor: conErr ? `${fl(L(lo))} a ${fl(L(hi))}` : '–', unidad: `log₁₀ ${unidad}`, sub: conErr ? `log₁₀ de ${fmt(lo)} a ${fmt(hi)} ${unidad}` : subN, pasos: [...pBase, ...pMedia, ...pErr, ...(conErr ? [pRango, pRangoLog] : [])] }
  return { ...base, titulo: tit, valor: fmt(M.m), unidad, sub: conErr ? `± ${fmt(err)} (${etq}) · ${subN}` : subN, pasos: [...pBase, ...pMedia, ...pErr, ...(conErr ? [pRango] : []), pLog, ...(conErr ? [pRangoLog] : [])] }
}
