// ============================================================
// Fases de una cepa (lag · exponencial · estacionaria): las fija el modelo (Baranyi y Roberts, Huang) o, con Linealizar log₁₀,
// la ventana automática de mayor pendiente. No se eligen a mano.
// ============================================================
import { finito } from '../../calculo/comun/analisis.js'

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

