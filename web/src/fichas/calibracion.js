// Fichas de la calibración OD ↔ UFC/mL y de la comparación de μ.
import { finito, media } from '../calculo/comun/analisis.js'
import { MODELOS_UFC } from '../calculo/ufc/index.js'
import { MODELOS_CALIB } from '../calculo/calibracion/calibracion.js'
import { f2, g, pasosMedia, sci } from './comun.js'
import { f3 } from './ufc.js'

// ==== Calibración OD ↔ UFC/mL
// par: fila de pares (Combinado); valoresOd: [{ etiqueta, x }] de la OD en ese tiempo (si hubo lectura); vecinos: { t1, y1, t2, y2 } si se interpoló
export function fichaPar(par, o = {}) {
  const pasos = []
  if (par.OD_interpolada && o.vecinos) {
    const { t1, y1, t2, y2 } = o.vecinos
    pasos.push({ titulo: 'OD interpolada', texto: `No hubo lectura de OD a T = ${par.T_h} h: se interpola entre las medias de las lecturas vecinas.`,
      formula: ['OD(T) = OD₁ + (T − t₁) · (OD₂ − OD₁) / (t₂ − t₁)'], cuenta: [`OD = ${g(y1)} + (${par.T_h} − ${g(t1)}) × (${g(y2)} − ${g(y1)}) / (${g(t2)} − ${g(t1)}) = ${g(par.OD)}`] })
  } else if (o.valoresOd?.length) {
    pasos.push(...pasosMedia(o.valoresOd, 'OD', 'sd').pasos.slice(0, 2).map((p, i) => (i === 0 ? { ...p, titulo: 'OD de las réplicas en ese tiempo (corregida, sin suavizar)' } : { ...p, titulo: 'OD media' })))
  }
  pasos.push({ titulo: 'UFC/mL del mismo tiempo', texto: `${sci(par.UFC_mL)} UFC/mL (log₁₀ = ${f2(par.log10_UFC)}), el valor de la cepa en ese tiempo de «Curva UFC vs t».` })
  pasos.push({ titulo: 'Fase', texto: par.fase ? `Según el ajuste de los recuentos de la cepa, a T = ${par.T_h} h está en fase ${par.fase === 'exponencial' ? 'exponencial: la velocidad del modelo es al menos la fracción elegida de μ máx' : par.fase === 'lag' ? 'de latencia' : 'estacionaria'}.` : 'Sin fases (el modelo de los recuentos no las distingue).',
    nota: par.usado ? `Entra en la recta${par.manual ? ' (elegido a mano)' : ''}.` : `No entra en la recta${par.manual ? ' (excluido a mano)' : ''}.` })
  return { titulo: 'Par OD–UFC', sujeto: `${par.Muestra} · T = ${par.T_h} h`, valor: `${g(par.OD, 3)} ↔ ${sci(par.UFC_mL)}`, metodos: 'comb', pasos }
}
export function fichaCalibracion(cal, pares, o = {}) {
  const modelo = cal.modelo
  if (!cal.ok) return { titulo: 'Calibración', sujeto: o.nombre, valor: '–', metodos: 'comb', pasos: [{ titulo: 'Sin ajuste', texto: cal.motivo }] }
  const p = pares.filter((q) => finito(q.od) && q.ufc > 0 && (modelo !== 'potencia' || q.od > 0))
  const x = modelo === 'potencia' ? p.map((q) => Math.log10(q.od)) : p.map((q) => q.od)
  const y = modelo === 'lineal' || modelo === 'proporcional' ? p.map((q) => q.ufc) : p.map((q) => Math.log10(q.ufc))
  const n = x.length, mx = media(x), my = media(y)
  const sxx = x.reduce((s, a) => s + (a - mx) ** 2, 0), sxy = x.reduce((s, a, i) => s + (a - mx) * (y[i] - my), 0)
  const fmt = (z) => (modelo === 'lineal' || modelo === 'proporcional' ? sci(z, 3) : g(z))
  const reg = modelo === 'proporcional'
    ? { titulo: 'Recta por el origen', formula: ['b = Σ ODᵢ·UFCᵢ / Σ ODᵢ²'], cuenta: [`b = ${sci(p.reduce((s, q) => s + q.od * q.ufc, 0), 3)} / ${g(p.reduce((s, q) => s + q.od ** 2, 0))} = ${sci(cal.coef.b, 3)}`] }
    : { titulo: 'Regresión por mínimos cuadrados', texto: `x = ${modelo === 'potencia' ? 'log₁₀ OD' : 'OD'}, y = ${modelo === 'lineal' ? 'UFC/mL' : 'log₁₀ UFC/mL'}; x̄ = ${g(mx)}, ȳ = ${fmt(my)}.`,
      formula: ['pendiente = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)²   ;   ordenada = ȳ − pendiente · x̄'],
      cuenta: [`pendiente = ${fmt(sxy)} / ${g(sxx)} = ${fmt(sxy / sxx)}   ;   ordenada = ${fmt(my - (sxy / sxx) * mx)}`] }
  const xs = Array.from({ length: 50 }, (_, i) => cal.rango[0] + ((cal.rango[1] - cal.rango[0]) * i) / 49)
  return { titulo: 'Ecuación de calibración', sujeto: o.nombre, valor: cal.ecuacion, metodos: 'comb', sub: `${MODELOS_CALIB[modelo]} · ${cal.n} pares · OD ${g(cal.rango[0], 3)} a ${g(cal.rango[1], 3)}`,
    pasos: [
      { titulo: `${n} pares usados`, texto: 'Pares de la misma cepa y tiempo (por defecto, solo los de la fase exponencial).',
        esquema: { tipo: 'grafico', alto: 210, xTxt: 'OD', yTxt: 'log₁₀ UFC/mL', series: [
          { id: 'p', nombre: 'pares', color: o.color || 'acento', linea: false, puntos: true, radio: 3.5, data: p.map((q) => ({ x: q.od, y: Math.log10(q.ufc) })) },
          { id: 'c', nombre: 'ajuste', color: 'acento2', ancho: 1.8, data: xs.map((z) => ({ x: z, y: Math.log10(cal.pred(z)) })).filter((d) => finito(d.y)) },
        ] } },
      reg,
      { titulo: 'Calidad, en log₁₀ para comparar los modelos', formula: ['rᵢ = log₁₀ UFCᵢ − log₁₀ predicho   ;   R² = 1 − Σ rᵢ² / Σ(log₁₀ UFCᵢ − media)²   ;   σ = √[ Σ rᵢ² / (n − p) ]'],
        cuenta: [`R² = ${f2(cal.R2, 3)}   ;   σ = ${f2(cal.sigma, 3)} log₁₀ (error típico ≈ ×/÷ ${f2(10 ** cal.sigma, 2)}, ${f2(cal.errorRelPct, 0)} %)`] },
    ], avisos: [cal.aviso, 'La calibración vale dentro del rango de OD medido y para el mismo organismo, medio y equipo.'].filter(Boolean) }
}
export function fichaConversion(cal, sentido, entrada, salida, o = {}) {
  const odUfc = sentido === 'od'
  const eqs = { clasico: ['log₁₀ UFC = m · OD + b', 'OD = (log₁₀ UFC − b) / m'], lineal: ['UFC = a + b · OD', 'OD = (UFC − a) / b'], proporcional: ['UFC = b · OD', 'OD = UFC / b'], potencia: ['log₁₀ UFC = a + b · log₁₀ OD', 'OD = 10^((log₁₀ UFC − a) / b)'] }[cal.modelo]
  return { titulo: odUfc ? 'OD → UFC/mL' : 'UFC/mL → OD', sujeto: o.nombre, valor: odUfc ? sci(salida) : g(salida, 4), unidad: odUfc ? 'UFC/mL' : 'OD', metodos: 'comb',
    pasos: [{ titulo: 'Con la ecuación ajustada', texto: cal.ecuacion, formula: [odUfc ? eqs[0] : eqs[1]], cuenta: [odUfc ? `OD = ${g(entrada, 4)} → ${sci(salida)} UFC/mL` : `UFC/mL = ${sci(entrada)} → OD = ${g(salida, 4)}`] },
      ...(o.err && finito(o.err.U) ? [{ titulo: 'Error de la conversión (IC 95 % de predicción)', texto: `Intervalo de predicción de la calibración, en log₁₀ UFC/mL${odUfc ? '' : ' (se lleva a la OD invirtiendo la ecuación)'}: la incertidumbre de una UFC/mL predicha con la recta ajustada con ${cal.n} pares.`,
        formula: ['U = t(0,975; n − k) · σ · √(1 + palanca)', 'palanca = 1/n + (x₀ − x̄)² / Sxx   (proporcional: x₀² / Σx²)'],
        cuenta: [`t(0,975; ${cal.gl}) = ${f2(o.err.tt, 3)} ; σ = ${f3(cal.sigma)} log₁₀ ; palanca = ${f3(o.err.pal)}`, `U = ${f2(o.err.tt, 3)} · ${f3(cal.sigma)} · √(1 + ${f3(o.err.pal)}) = ${f3(o.err.U)} log₁₀`, odUfc ? `IC 95 % = ${sci(o.err.lo)} a ${sci(o.err.hi)} UFC/mL` : `IC 95 % = ${g(o.err.lo, 4)} a ${g(o.err.hi, 4)} OD`],
        nota: 'En la recta y en el modelo log–log es exacto; en el lineal y el proporcional se aplica sobre el error típico en log₁₀ (aproximado). Fuera del rango calibrado la palanca crece y el intervalo se ensancha.' }] : [])],
    avisos: o.fuera ? [`Fuera del rango calibrado (OD ${g(cal.rango[0], 3)} a ${g(cal.rango[1], 3)}): es una extrapolación.`] : [] }
}

// ==== OD vs recuento: μ de las dos mediciones
export function fichaComparacion(m, rs, c) {
  const muOd = rs?.mu_max?.m, muU = c?.mu, q = muOd / muU
  return { titulo: 'μ por OD / μ por recuento', sujeto: m, valor: finito(q) ? f2(q) : '–', metodos: 'comb',
    pasos: [
      { titulo: 'μ por OD', texto: rs ? `${rs.unico ? 'Curva de la cepa (ventana deslizante)' : `Media de ${rs.mu_max.n} réplicas (ventana deslizante)`}: ${g(muOd)} h⁻¹.` : 'Sin datos de OD.' },
      { titulo: 'μ por recuento', texto: c?.ok ? `${MODELOS_UFC[c.modelo]}: ${g(muU)} h⁻¹.` : (c?.motivo || 'Sin ajuste.') },
      { titulo: 'Cociente', formula: ['cociente = μ OD / μ recuento'], cuenta: [`cociente = ${g(muOd)} / ${g(muU)} = ${f2(q)}`],
        nota: 'Si la OD siguiera exactamente a las células viables, el cociente sería ≈ 1. Un cociente distinto indica cambios en el tamaño de las células, agregación o pérdida de viabilidad. Es una comparación descriptiva (sin prueba estadística).' },
    ] }
}
