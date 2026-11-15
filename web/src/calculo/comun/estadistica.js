// ============================================================
// Media ± error de réplicas: la ÚNICA implementación del programa (OD, UFC, placas, resumen de parámetros, fichas, Excel).
//   media   x̄ = Σxᵢ / n
//   DE      √[ Σ(xᵢ − x̄)² / (n − 1) ]            (n ≥ 2)
//   EEM     DE / √n                              (n ≥ 3)
//   IC 95 % ± t(0,975; n − 1) · DE / √n          (n ≥ 3)
// En log₁₀: log₁₀ de la media y de los extremos (media ∓ error); el error se calcula siempre con los valores lineales.
// ============================================================
import { desvio, finito, media } from './analisis.js'
import { tCuantil } from '../../comun/utils.js'

export const ERRORES = { sd: 'DE', sem: 'EEM', ic95: 'IC 95 %' }
export const N_MIN_EEM = 3

// estadísticos de un conjunto de valores (réplicas)
export function resumenReplicas(valores) {
  const v = (valores || []).filter(finito), n = v.length
  const m = n ? media(v) : NaN, sd = n > 1 ? desvio(v) : NaN
  const tt = n >= N_MIN_EEM ? tCuantil(0.975, n - 1) : NaN
  const sem = n >= N_MIN_EEM ? sd / Math.sqrt(n) : NaN
  return { n, v, m, sd, sem, tt, ic: n >= N_MIN_EEM ? tt * sem : NaN, cv: n > 1 && m > 0 ? (100 * sd) / m : NaN }
}

const lg10 = (x) => (finito(x) && x > 0 ? Math.log10(x) : NaN)
// el error elegido (DE, EEM o IC 95 %) y sus límites, en la magnitud y en log₁₀
export function errorElegido(est, tipo = 'sd') {
  const t = ERRORES[tipo] ? tipo : 'sd'
  const bajo = (t === 'sem' || t === 'ic95') && est.n < N_MIN_EEM
  const e = bajo ? NaN : t === 'sem' ? est.sem : t === 'ic95' ? est.ic : est.sd
  const lo = est.m - e, hi = est.m + e
  return { tipo: t, etq: ERRORES[t], bajo, e, lo, hi, mLog: lg10(est.m), loLog: lg10(lo), hiLog: lg10(hi) }
}
