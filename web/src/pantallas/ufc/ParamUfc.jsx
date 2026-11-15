// ============================================================
// Parámetros de crecimiento por recuento (modelos de DMFit): selector de modelo, tabla por cepa (cada número abre su
// ficha «Cómo se calculó»), avisos del ajuste, ecuación y calculadora. Es el mismo ajuste de la curva, la predicción y la
// calibración (ajusteCepaUfc).
// ============================================================
import { finito } from '../../calculo/comun/analisis.js'
import { MODELOS_UFC, NOMBRE_VARIANTE, ajusteCepaUfc, crecimientoUfc, mcurvUfc, modeloUfc, nmaxFijado, predDe, puntosUfc } from '../../calculo/ufc/index.js'
import { Icono, Num } from '../../ui/base.jsx'
import { GrupoModelo } from '../../ui/modeloCinta.jsx'
import { EcuacionModelo } from '../../ui/ecuacion.jsx'
import { Valor } from '../../fichas/FichaCalculo.jsx'
import { fichaAumentoUfc, fichaModeloUfc } from '../../fichas/index.js'
import { fs, fx } from '../../comun/utils.js'

export const crecimientoPorCepa = (ufcRes, aj) => [...new Set(ufcRes.res.map((r) => r.Muestra))].map((m) => ({ Muestra: m, c: crecimientoUfc(ufcRes, m, aj) }))
// Sin curva / Linealizar log₁₀ / Baranyi y Roberts: el mismo grupo en Curva OD y en Curva UFC
export const OPCIONES_MODELO_UFC = [
  ['no', 'Sin curva', '·', null, 'Solo los puntos, sin la curva del modelo'],
  ['lineal', 'Linealizar log₁₀', '⟋', null, 'Linealizar log₁₀: recta de ln N contra t en la fase exponencial (la ventana de mayor pendiente), como μmax'],
  ['baranyi', 'Baranyi y Roberts', '∫', null, 'Baranyi y Roberts: lag, fase exponencial y asíntota, ajustado a todos los puntos (4 o más tiempos)'],
  ['huang', 'Huang', 'H', null, 'Huang (2008): lag, fase exponencial y asíntota con una transición más suave; el lag λ es un parámetro directo del ajuste (4 o más tiempos)'],
]

// «Modelo» de las UFC (el componente común de ui/modeloCinta.jsx con las claves de los recuentos): Curva UFC, Revisión y calibración
export function GrupoModeloUfc({ s, sinCurva = true, prediccion = true, botonFases = null }) {
  const aj = s.exp.aj
  const pred = predDe(aj)
  const setPred = (k, x) => s.upd((e) => ({ aj: { ...e.aj, ufc_pred: { ...predDe(e.aj), [k]: x } } }))
  return (
    <GrupoModelo sinCurva={sinCurva} prediccion={prediccion} botonFases={botonFases}
      v={{ modelo: aj.ufc_suave === false ? 'no' : modeloUfc(aj), lag: aj.ufc_lagfijo ?? '', mcurv: mcurvUfc(aj), nmax: pred.nmax, frac: aj.ufc_frac_exp ?? 0.5, pred }}
      set={{
        modelo: (x) => s.upd((e) => ({ aj: { ...e.aj, ufc_suave: x !== 'no', ...(x !== 'no' ? { ufc_modelo: x } : {}) } })),
        lag: (x) => s.setAj('ufc_lagfijo', x), mcurv: (x) => s.setAj('ufc_mcurv', x), nmax: (x) => setPred('nmax', x),
        frac: (x) => s.setAj('ufc_frac_exp', x), pred: setPred,
      }} />
  )
}
// el MISMO modelo rige las fases de las UFC (Revisión de los recuentos): sin «Sin curva»
export const GrupoModeloFasesUfc = ({ s }) => <GrupoModeloUfc s={s} sinCurva={false} />

// tabla de parámetros por cepa, avisos, ecuación y calculadora
export function SeccionUfc({ s, muestras }) {
  const { exp, ufcRes } = s
  const aj = exp.aj
  const modelo = modeloUfc(aj)
  const mc = mcurvUfc(aj)
  const nmaxF = nmaxFijado(aj)
  const crec = crecimientoPorCepa(ufcRes, aj).filter(({ Muestra }) => !muestras || muestras.includes(Muestra))
  const f = (m, c, foco) => () => fichaModeloUfc(c, puntosUfc(ufcRes, m, aj), { foco, nombre: m, color: s.colores[m] })
  const fa = (m, c, foco) => () => fichaAumentoUfc(c, { foco, nombre: m })
  // valor ± error estándar (el error en chico, como en μ); sin error calculable, solo el valor
  const pm = (txt, ee, d = 2) => <>{txt}{finito(ee) && ee > 0 && <small className="ayuda"> ± {fs(ee, d)}</small>}</>
  const celda = (m, c, foco, txt, tip) => <td className="num" data-tip={tip}><Valor f={f(m, c, foco)}>{txt}</Valor></td>
  const av = crec.flatMap(({ Muestra, c }) => [...(c.ok ? c.avisos || [] : []).map((a) => [Muestra, a]), ...(c.avisosPuntos || []).map((a) => [Muestra, `${a}: no entra al ajuste de crecimiento.`])])
  return (
    <div className="tarjeta">
      <div className="fila" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Parámetros de crecimiento por recuento <span className="ayuda" style={{ fontWeight: 400 }}>· {MODELOS_UFC[modelo]}{modelo === 'baranyi' ? `, m = ${fs(mc, 3)}` : ''}, ajustado al valor de cada tiempo {modelo === 'lineal' ? '(fase exponencial)' : 'con todos los puntos (como DMFit)'}. Valores ± error estándar del ajuste.</span></h2>
      </div>
      <div className="tabla-scroll alta"><table className="tabla">
        <thead><tr><th>Cepa</th><th className="num" data-tip="Velocidad máxima de crecimiento en log₁₀ UFC/mL por hora («Rate» de DMFit)">Velocidad (log₁₀/h)</th><th className="num" data-tip="μ = velocidad × ln 10">μ (h⁻¹)</th><th className="num" data-tip="td = ln 2 / μ, en horas">td (h)</th><th className="num" data-tip="λ = h₀ / μ (el modelo lineal no tiene lag)">Lag λ (h)</th><th className="num" data-tip="Valor inicial del modelo">y₀ (log₁₀)</th><th className="num" data-tip="Asíntota del modelo (solo Baranyi y Roberts)">y máx (log₁₀)</th><th className="num">R²</th><th className="num" data-tip={'R² ajustado por grados de libertad = 1 − (1 − R²)·(n − 1)/(n − p)\nEs el «R-square» que informa DMFit'}>R² ajustado</th><th className="num" data-tip="Error estándar del ajuste = √(SSE / (n − p)), en log₁₀">EE ajuste</th><th className="num">Puntos</th><th className="num" data-tip={'Grados de libertad = puntos − parámetros del modelo\n(lineal 2; Baranyi y Roberts 4, o 3 con N máx fijado; bifásico 3)\nCon 0 o 1 el modelo pasa casi por todos los puntos: parámetros poco identificables'}>n − p</th><th className="num" data-tip="Lo que sube la curva del modelo entre el primer y el último tiempo medido">Aumento (log₁₀)</th><th className="num" data-tip="Aumento / log₁₀ 2">Generaciones</th></tr></thead>
        <tbody>{crec.map(({ Muestra: m, c }) => (
          <tr key={m}><td><i className="punto" style={{ background: s.colores[m], marginRight: 6 }} /><b>{m}</b>{c.ok && c.variante && c.variante !== 'completo' && <small className="ayuda" data-tip={(c.notaVariante ? c.notaVariante + '\n' : '') + 'Variante del modelo elegida según los datos, como DMFit:\nsin lag si el lag del modelo completo da 0; sin meseta si los datos no llegan a la fase estacionaria'}> · {NOMBRE_VARIANTE[c.variante]}</small>}</td>
            {c.ok ? <>
              {celda(m, c, 'rate', pm(fx(c.rate, 3), c.ee_mu / Math.LN10))}{celda(m, c, 'mu', pm(fs(c.mu, 4), c.ee_mu))}{celda(m, c, 'td', pm(fs(c.td_h, 4), c.ee_td))}{celda(m, c, 'lag', finito(c.lag_h) ? <>{fs(c.lag_h, 3)}{finito(c.ee_lag) && c.ee_lag > 0 && <small className="ayuda"> ± {fs(c.ee_lag, 2)}</small>}{c.lagFijo && <small className="ayuda"> (fijo)</small>}</> : '–')}
              {celda(m, c, 'y0', pm(fx(c.y0, 2), c.ee_y0))}{celda(m, c, 'yEnd', finito(c.yEnd) ? pm(fx(c.yEnd, 2), c.ee_ymax) : c.sinAsintota ? 'sin meseta' : '–', c.sinAsintota ? 'Los recuentos no llegan a la fase estacionaria: la asíntota no se puede estimar.\nFijá N máx (log₁₀) en la cinta o usá el modelo Linealizar log₁₀.' : undefined)}
              {celda(m, c, 'r2', fx(c.r2, 3))}<td className="num">{fx(c.r2adj, 3)}</td>{celda(m, c, 'se', fx(c.se, 3))}<td className="num">{c.n}</td>
              <td className="num" style={{ color: c.gl <= 1 ? 'var(--aviso)' : undefined }}><Valor f={f(m, c, 'gl')}>{finito(c.gl) ? c.gl : '–'}</Valor>{(c.avisos || []).length > 0 && <span className="aviso-texto" data-tip={c.avisos.join('\n\n')}> ⚠</span>}</td>
              <td className="num"><Valor f={fa(m, c, 'aumento')}>{pm(fx(c.crecimiento_log10, 2), c.aumentoDe === 'modelo' ? c.ee_aumento : NaN)}</Valor></td><td className="num"><Valor f={fa(m, c, 'gen')}>{pm(fx(c.generaciones, 2), c.aumentoDe === 'modelo' ? c.ee_generaciones : NaN)}</Valor></td>
            </> : <td colSpan={13} className="ayuda">{c.motivo}</td>}
          </tr>
        ))}</tbody>
      </table></div>
      {av.length > 0 && <div className="aviso-caja" style={{ marginTop: 8 }}>{av.map(([m, a], i) => <div key={i}><b>{m}:</b> {a}</div>)}</div>}
      <EcuacionModelo tipo="ufc" nombreArchivo="modelo UFC" nota={`${MODELOS_UFC[modelo]}${modelo === 'baranyi' ? `, curvatura m = ${fs(mc, 3)}${finito(nmaxF) ? `, N máx fijado en ${fx(nmaxF, 2)} log₁₀` : ''}` : ''}, sobre log₁₀(UFC/mL). Es el mismo ajuste de la curva, la predicción y la calibración.`}
        filas={crec.map(({ Muestra, c }) => {
          const cc = c.ok && c.sinAsintota ? { ok: false, motivo: 'Los recuentos no llegan a la fase estacionaria: la asíntota no se puede estimar. Fijá N máx (log₁₀) en la cinta o usá el modelo Linealizar log₁₀.' } : c
          return { id: Muestra, nombre: Muestra, color: s.colores[Muestra], c: cc }
        })} />
    </div>
  )
}
