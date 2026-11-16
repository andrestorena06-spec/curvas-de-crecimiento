// ============================================================
// Media ± error de las réplicas de OD en cada tiempo (gráficos, tablas, calibración, Datos y Excel).
// ============================================================
import { finito, media } from '../comun/analisis.js'
import { fx } from '../../comun/utils.js'
import { lineasMedia } from '../ufc/index.js'
import { errorElegido, resumenReplicas } from '../comun/estadistica.js'

// Media ± error de las réplicas en cada tiempo, SIEMPRE con los valores lineales (el mismo cálculo que las UFC/mL).
// En escala log (tr ≠ identidad) el valor es tr(media) y la barra va de tr(media − error) a tr(media + error): la misma
// barra que en lineal, con el eje en log. EEM e IC 95 % solo con 3 o más réplicas.
export function mediaPorTiempo(series, tr, error) {
  const por = new Map()
  series.forEach((w) => w.t.forEach((t, i) => { const v = w.y[i]; if (finito(v)) { if (!por.has(t)) por.set(t, []); por.get(t).push(v) } }))
  const lineal = tr(2) === 2 && tr(0.5) === 0.5
  return [...por.keys()].sort((a, b) => a - b).map((t) => {
    const est = resumenReplicas(por.get(t)), n = est.n, mL = est.m, sd = est.sd
    const e = errorElegido(est, error).e
    const lo = mL - e, hi = mL + e
    return { t, n, sd, mLin: mL, eLin: e, m: tr(mL), lo: finito(e) ? tr(lo) : NaN, hi: finito(e) ? tr(hi) : NaN, err: lineal ? e : NaN, rango: !lineal }
  })
}

// texto del error sobre el punto: «± error» en lineal; «[inf – sup]» en log
export const textoErrMedia = (q, d = 3) => (q.rango ? (finito(q.hi) ? `[${finito(q.lo) ? fx(q.lo, d) : '–'} – ${fx(q.hi, d)}]` : '') : finito(q.err) ? `± ${fx(q.err, d)}` : '')

// el error de un punto en el formato de lineasMedia (globos de OD y UFC con el mismo texto)
export const egDeMedia = (q, etq) => {
  const L = (x) => (finito(x) && x > 0 ? Math.log10(x) : NaN)
  return { etq, e: q.eLin, lo: q.mLin - q.eLin, hi: q.mLin + q.eLin, mLog: L(q.mLin), loLog: L(q.mLin - q.eLin), hiLog: L(q.mLin + q.eLin) }
}
