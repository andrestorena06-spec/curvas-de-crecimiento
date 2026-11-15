// ============================================================
// Fases de una cepa (lag · exponencial · estacionaria): las fija el modelo (Baranyi y Roberts, Huang) o, con Linealizar log₁₀,
// la ventana automática de mayor pendiente. No se eligen a mano.
// ============================================================
import { finito } from '../../calculo/comun/analisis.js'
import { fasesDeAjuste, fraccionExp } from '../../calculo/ufc/index.js'
import { ajustesOd } from './Parametros.jsx'

export const COLORES_FASES = { lag: '#5B8DB8', exp: '#D98B2B', est: '#7A8794' }

// zonas sombreadas de las tres fases según la ventana exponencial de las filas de resultados de la cepa
export function zonasVentana(ven, tMin, tMax, rotular = false) {
  if (!ven || !finito(ven[0]) || !finito(ven[1]) || !finito(tMin) || !finito(tMax)) return []
  return [
    { x0: tMin, x1: ven[0], color: COLORES_FASES.lag, etiqueta: rotular ? 'Lag' : '' },
    { x0: ven[0], x1: ven[1], color: COLORES_FASES.exp, etiqueta: rotular ? 'Exponencial' : '' },
    { x0: ven[1], x1: tMax, color: COLORES_FASES.est, etiqueta: rotular ? 'Estacionaria' : '' },
  ]
}
// Ventana automática de una cepa: la mediana de las ventanas de sus réplicas (con una curva por réplica cada pocillo tiene la suya)
const mediana = (v) => { const a = v.slice().sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2 }
export function ventanaDeFilas(filas) {
  const f = (filas || []).filter((r) => finito(r.t_ini_ventana) && finito(r.t_fin_ventana))
  return f.length ? [mediana(f.map((r) => r.t_ini_ventana)), mediana(f.map((r) => r.t_fin_ventana))] : null
}
export function zonasFases(filas, tMin, tMax, rotular = false, elegida = null) {
  return zonasVentana(elegida || ventanaDeFilas(filas), tMin, tMax, rotular)
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
