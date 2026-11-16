// ============================================================
// Pares OD–UFC/mL de la fase exponencial común, recta de calibración y comparación de μ por OD y por recuento.
// Una sola fuente para la pantalla OD ↔ UFC, Datos, Métodos y el Excel.
// ============================================================
import { MODELOS_UFC, tramoUfcRige, centroUfc, fasesUfc, crecimientoPorCepa } from '../ufc/index.js'
import { ajustarCalibracion } from './calibracion.js'
import { finito, interpolar, media } from '../comun/analisis.js'
import { mediaPorTiempo } from '../od/medias.js'
import { tramoOdRige, muOdPorCepa } from '../od/parametros.js'

// Series de OD para la calibración: las mismas del análisis (pre.analisis: OD corregida por el blanco y la dilución,
// sin los puntos ni pocillos excluidos, sin suavizar ni normalizar), con las que se calculan los parámetros.
export function seriesOdCalibracion(pre) {
  if (!pre || pre.error) return []
  return (pre.analisis || []).filter((w) => !w.EsBlanco)
}

// Pares OD–UFC de la misma cepa y tiempo (la OD media se interpola si no hay lectura exacta en ese tiempo)
// tipoErr: error de la OD media (DE, EEM o IC 95 %) que acompaña a cada par. La UFC es el valor central de cada tiempo
// (la media de las UFC/mL de las réplicas).
export function paresOdUfc(s, tipoErr = 'sd') {
  if (!s.pre || s.pre.error || !s.ufcRes?.hay) return []
  const ws = seriesOdCalibracion(s.pre)
  const cen = centroUfc(s.exp?.aj)
  const out = []
  s.ufcRes.res.filter((r) => finito(r.UFC_mL) && r.UFC_mL > 0).forEach((r) => {
    const g = ws.filter((w) => w.Muestra === r.Muestra)
    if (!g.length) return
    const mt = mediaPorTiempo(g, (v) => v, tipoErr)
    if (mt.length < 1) return
    const ts = mt.map((q) => q.t / 3600)
    if (r.T_h < ts[0] - 1e-9 || r.T_h > ts[ts.length - 1] + 1e-9) return
    const exacto = mt.find((q) => Math.abs(q.t / 3600 - r.T_h) < 1e-6)
    const od = exacto ? exacto.m : interpolar(ts, mt.map((q) => q.m), [r.T_h])[0]
    const eOd = exacto ? exacto.hi - exacto.m : interpolar(ts, mt.map((q) => q.hi - q.m), [r.T_h])[0]
    const lg = r.log10, u = r.UFC_mL
    out.push({ Muestra: r.Muestra, T_h: r.T_h, OD: od, OD_err: eOd, _ufc: r, OD_interpolada: !exacto, UFC_mL: u, log10_UFC: lg })
  })
  return out
}

// Calibración OD ↔ UFC/mL de un experimento: los pares (con la fase de la OD y la de las UFC en cada tiempo, y si se usan)
// y la recta log₁₀ UFC = m·OD + b de cada cepa. UNA sola función para la pantalla «OD ↔ UFC», Datos y Métodos.
//   Por defecto se usan los pares de la fase exponencial COMÚN a OD y UFC (opción combinado.soloExp; apagada, todos);
//   aj.calib_incl guarda los pares marcados o desmarcados a mano ({ 'cepa|T': true/false }).
export function calibracionDe(s, tipoErr = 'sd') {
  const { exp, ufcRes } = s
  const pares = paresOdUfc(s, tipoErr)
  const soloExp = exp.opciones?.['combinado.soloExp'] !== false
  const ventOdE = (m) => tramoOdRige(s, m).ventana
  const cepasU = ufcRes?.hay ? [...new Set(ufcRes.res.map((r) => r.Muestra))] : []
  const fases = Object.fromEntries(cepasU.map((m) => [m, fasesUfc(ufcRes, m, exp.aj)]))
  const tramosU = Object.fromEntries(cepasU.map((m) => [m, tramoUfcRige(ufcRes, m, exp.aj, fases[m])]))
  // 'vacio' = los dos tramos no se solapan; null = ninguno detectado
  const coincide = (m) => {
    const a = ventOdE(m), b = tramosU[m]?.ventana || null
    if (a && b) { const lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]); return lo <= hi + 1e-9 ? [lo, hi] : 'vacio' }
    return a || b || null
  }
  const incl = exp.aj.calib_incl || {}
  const paresF = pares.map((p) => {
    const f = fases[p.Muestra]
    const fase = f?.ok ? f.fase(p.T_h) : ''
    const vm = coincide(p.Muestra)
    const auto = !soloExp || (vm === 'vacio' ? false : vm ? p.T_h >= vm[0] - 1e-9 && p.T_h <= vm[1] + 1e-9 : !f?.ok || fase === 'exponencial')
    const clave = `${p.Muestra}|${p.T_h}`
    const vo = ventOdE(p.Muestra)
    const faseOd = vo ? (p.T_h < vo[0] - 1e-9 ? 'lag' : p.T_h > vo[1] + 1e-9 ? 'estacionaria' : 'exponencial') : ''
    return { ...p, fase, faseOd, auto, clave, manual: clave in incl, usado: clave in incl ? incl[clave] : auto }
  })
  const usados = paresF.filter((p) => p.usado)
  const calCepa = Object.fromEntries([...new Set(paresF.map((p) => p.Muestra))].map((m) => [m, ajustarCalibracion(usados.filter((p) => p.Muestra === m).map((p) => ({ od: p.OD, ufc: p.UFC_mL })), 'clasico')]))
  return { pares: paresF, usados, calCepa, fases, coincide, ventOdE, soloExp }
}

// ---------- μ por OD y por recuento (va en «OD ↔ UFC») ----------
// μ por OD (con el método elegido en «Modelo» de la OD: muOdPorCepa) y por recuento (modelo de las UFC), por cepa: la misma
// fuente para la pantalla OD ↔ UFC y para Datos. Cada fila dice con qué método salió cada μ.
export function comparacionMu(s) {
  const od = muOdPorCepa(s)
  const crec = s.ufcRes?.hay ? crecimientoPorCepa(s.ufcRes, s.exp.aj) : []
  return [...new Set([...od.map((x) => x.Muestra), ...crec.map((x) => x.Muestra)])].map((m) => {
    const x = od.find((q) => q.Muestra === m), c = crec.find((q) => q.Muestra === m)?.c
    return { Muestra: m, r: x?.r, x, c, Metodo_OD: x ? x.etq : '', mu_OD_h: x ? x.mu : NaN, Metodo_UFC: c?.ok ? MODELOS_UFC[c.modelo] : '', mu_UFC_h: c?.ok ? c.mu : NaN, cociente: x && c?.ok ? x.mu / c.mu : NaN, Error_OD: x?.tipoErr || '', EE_mu_OD_h: x ? x.err : NaN, EE_mu_UFC_h: c?.ok ? c.ee_mu : NaN, td_OD_h: x ? x.td : NaN, EE_td_OD_h: x ? x.errTd : NaN, td_UFC_h: c?.ok ? c.td_h : NaN, EE_td_UFC_h: c?.ok ? c.ee_td : NaN, lag_OD_h: x ? x.lag : NaN, EE_lag_OD_h: x ? x.errLag : NaN, lag_UFC_h: c?.ok ? c.lag_h : NaN, EE_lag_UFC_h: c?.ok ? c.ee_lag : NaN, Aviso: x?.respaldo || '' }
  })
}
