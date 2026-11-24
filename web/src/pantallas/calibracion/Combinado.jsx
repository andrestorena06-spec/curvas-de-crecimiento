import { valorUfc, tipValorUfc, centroUfc, errorTextoUfc, errorUfc, etiquetaErrorUfc } from '../../calculo/ufc/index.js'
import { etiquetaOd } from '../../calculo/od/pipeline.js'
import { useOpcion } from '../../ui/opciones.js'
import { useMemo, useState } from 'react'
import { MODELOS_CALIB, fueraDeRango, odDesdeUfcConError } from '../../calculo/calibracion/calibracion.js'
import { finito, media } from '../../calculo/comun/analisis.js'
import { useTema } from '../../estilo/tema.js'
import { Encabezado, Num, Vacio } from '../../ui/base.jsx'
import { BotonCinta, CampoCinta, Cinta, Grupo, OpcionesCinta } from '../../ui/cinta.jsx'
import { GrupoMostrar, conEtiquetas, textoMostrar, useMostrar } from '../../ui/mostrar.jsx'
import { Grafico } from '../../ui/graficos/grafico.jsx'
import { fx, potenciaEje, rotuloPotencia, sci, fs, parCientifico, textoPar } from '../../comun/utils.js'
import { mediaPorTiempo } from '../../calculo/od/medias.js'
import { SelectorCepas, cepasOcultas } from '../../ui/cepas.jsx'
import { Valor } from '../../fichas/FichaCalculo.jsx'
import { fichaCalibracion, fichaConversion, fichaPar } from '../../fichas/index.js'
import { fichaTiempoUfc } from '../ufc/CurvaUfc.jsx'
import { SeccionComparacion } from '../od/Parametros.jsx'
import { TablaValores } from '../../ui/ecuacion.jsx'
import { EcCalibracion } from '../../ui/ecuacionBonita.jsx'
import { seriesOdCalibracion, calibracionDe } from '../../calculo/calibracion/pares.js'

// Una ecuación de calibración (de una cepa o de todas juntas): la ecuación con formato de ecuación, sus números, y debajo
// la calculadora (OD → UFC/mL y UFC/mL → OD) y la tabla de valores, igual que en «Ecuación del modelo» de las curvas
function BloqueCalib({ f, usados }) {
  const c = f.c
  // valores iniciales dentro del rango calibrado (la mitad del rango de OD y su UFC/mL)
  const odMed = c.ok ? Number(((c.rango[0] + c.rango[1]) / 2).toPrecision(2)) : 0.5
  // lo escrito en la calculadora se guarda con el experimento: no se pierde al cambiar de pantalla ni al guardar
  const [od, setOd] = useOpcion(`calc.cal.${f.id}.od`, odMed, true)
  const [ufc, setUfc] = useOpcion(`calc.cal.${f.id}.ufc`, c.ok && finito(c.pred(odMed)) ? Number(c.pred(odMed).toPrecision(2)) : 1e8, true)
  const [tabla, setTabla] = useState(false)
  const ficha = () => fichaCalibracion(c, usados, { nombre: f.nombre, color: f.color })
  const uOd = c.ok ? c.pred(Number(od)) : NaN
  const eU = c.ok && finito(uOd) ? c.errorPred(Number(od)) : { U: NaN, lo: NaN, hi: NaN }
  const eO = c.ok ? odDesdeUfcConError(c, Number(ufc)) : { od: NaN, lo: NaN, hi: NaN }
  const oU = eO.od
  const chip = (fuera) => <span className={`chip ${fuera ? 'aviso' : 'ok'}`} data-tip={fuera ? `Fuera del rango calibrado (OD ${fx(c.rango[0], 3)} a ${fx(c.rango[1], 3)}): es una extrapolación` : `Dentro del rango calibrado (OD ${fx(c.rango[0], 3)} a ${fx(c.rango[1], 3)})`}>{fuera ? 'extrapolado' : 'interpolado'}</span>
  return (
    <section className="ec-cepa">
      <h3><i className="punto" style={{ background: f.color }} />{f.nombre}</h3>
      {!c.ok ? <p className="ayuda" style={{ margin: 0 }}>{c.motivo}</p> : (<>
        <div className="ecuacion-od">
          <Valor f={ficha}><EcCalibracion c={c} /></Valor>
          <small>R² (log₁₀) = <Valor f={ficha}>{fx(c.R2, 3)}</Valor> · error típico = <Valor f={ficha}>{fx(c.sigma, 2)} log₁₀</Valor> · {c.n} pares · OD de {fx(c.rango[0], 2)} a {fx(c.rango[1], 2)}</small>
        </div>
        {c.aviso && <div className="aviso-texto" style={{ fontSize: 12.5 }}>⚠ {c.aviso}</div>}
        <div className="ec-calc">
          <div className="ec-conv">
            <div className="ec-conv-fila">
              <CampoCinta etiqueta="OD → UFC/mL"><Num value={od} onChange={setOd} ancho={84} /></CampoCinta>
              <span className="ec-flecha">→</span>
              <b className="ec-res"><Valor f={() => fichaConversion(c, 'od', Number(od), uOd, { nombre: f.nombre, fuera: fueraDeRango(c, Number(od)), err: eU })}>{finito(uOd) ? sci(uOd) : '–'}</Valor></b>
              {finito(uOd) && <span className="ayuda">log₁₀ {fx(Math.log10(uOd), 2)}{finito(eU.U) ? ` ± ${fx(eU.U, 2)} (IC 95 %)` : ''}</span>}{finito(uOd) && chip(fueraDeRango(c, Number(od)))}
            </div>
            {finito(eU.U) && <small className="ayuda" data-tip={`Intervalo de predicción 95 % de la calibración: log₁₀ UFC/mL ± t(0,975; ${c.gl}) · σ · √(1 + palanca)\nσ = error típico (${fx(c.sigma, 2)} log₁₀)`}>IC 95 % de {sci(eU.lo)} a {sci(eU.hi)} UFC/mL</small>}
          </div>
          <div className="ec-conv">
            <div className="ec-conv-fila">
              <CampoCinta etiqueta="UFC/mL → OD"><Num value={ufc} onChange={setUfc} ancho={110} /></CampoCinta>
              <span className="ec-flecha">→</span>
              <b className="ec-res"><Valor f={() => fichaConversion(c, 'ufc', Number(ufc), oU, { nombre: f.nombre, fuera: fueraDeRango(c, oU), err: eO })}>{finito(oU) ? fx(oU, 3) : '–'}</Valor></b>
              {finito(oU) && finito(eO.lo) && <span className="ayuda">± {fx((eO.hi - eO.lo) / 2, 3)}</span>}{finito(oU) && chip(fueraDeRango(c, oU))}
            </div>
            {finito(oU) && finito(eO.lo) && <small className="ayuda" data-tip={'El intervalo de predicción 95 % de las UFC de la calibración, llevado a la OD\n(se invierte la ecuación en UFC/mL × 10^−U y × 10^U)'}>IC 95 % de {fx(eO.lo, 3)} a {fx(eO.hi, 3)} OD</small>}
          </div>
          <BotonCinta simbolo="▦" texto="Tabla de valores" onClick={() => setTabla(true)} tip={'Tabla de valores de la calibración\nOD y UFC/mL calculadas en el rango y con el intervalo que elijas, para exportar'} />
        </div>
        {tabla && <TablaValores titulo={`Tabla de la calibración · ${f.nombre}`} nombreArchivo={`calibracion - ${f.nombre}`} xEtq="OD" unidad="OD" decimalesX={3} medido={c.rango}
          desde0={Number(c.rango[0].toFixed(2))} hasta0={Number(c.rango[1].toFixed(2))} paso0={Number((((c.rango[1] - c.rango[0]) || 0.2) / 20).toPrecision(1))} cols={['log₁₀ UFC/mL', 'UFC/mL', 'IC 95 % inf', 'IC 95 % sup']}
          f={(x) => { const u = c.pred(x), e = c.errorPred(x); return [finito(u) && u > 0 ? Math.log10(u) : NaN, u, e.lo, e.hi] }} onClose={() => setTabla(false)} />}
      </>)}
    </section>
  )
}

export function Combinado({ s }) {
  const T = useTema()
  const { pre, ufcRes, exp, res } = s
  const cen = centroUfc(exp?.aj)
  const modelo = 'clasico'   // única ecuación: log₁₀ UFC = m·OD + b
  const [odIn, setOdIn] = useState(0.5)
  const [ufcIn, setUfcIn] = useState(1e8)
  // tipo de error de la OD: el de «Revisión de la OD» (uno solo para todo el programa); valores sobre los puntos: Personalizar
  const [tipoErr, setTipoErr] = useOpcion('curva.error', 'sd')
  // Mostrar (el mismo grupo en todos los gráficos): rige el gráfico OD ↔ UFC y el de calibración
  const [mo, setMo] = useMostrar('combinado', { puntos: true, replicas: true })
  const conErr = !!mo.barras
  // escala del eje de la OD: por defecto log₁₀, igual que las UFC, para que las pendientes (μ) se comparen a simple vista
  const [escalaOd, setEscalaOd] = useOpcion('combinado.escalaOd', 'log10')
  const logOd = escalaOd !== 'lineal'
  const trOd = logOd ? (v) => (v > 0 ? Math.log10(v) : NaN) : (v) => v
  // la misma escala rige las UFC (log₁₀ o UFC/mL ÷ 10^pot) y el eje de la calibración
  const potU = !logOd && ufcRes?.hay ? potenciaEje(s.estiloGrafico('calibracion'), Math.max(...ufcRes.res.map((r) => valorUfc(r, centroUfc(s.exp.aj))).filter(finito))) : 0
  const kU = logOd ? 1 : 10 ** potU
  const uv = (ylog) => (logOd ? ylog : 10 ** ylog / kU)
  const modoU = logOd ? 'log10' : 'lineal'
  const yTxtU = logOd ? 'log₁₀ UFC/mL' : rotuloPotencia('UFC/mL', potU)
  const verRep = !!mo.replicas
  const nomErr = { sd: 'DE', sem: 'EEM', ic95: 'IC 95 %' }[tipoErr] || 'DE'
  // error de las UFC: el tipo elegido (DE, EEM o IC 95 %) de las UFC/mL de las réplicas
  const nomErrU = etiquetaErrorUfc(centroUfc(exp.aj), tipoErr)
  const etqOd = etiquetaOd(s.serie?.aj)
  // por defecto solo los pares de la fase exponencial común a OD y UFC; apagado: todos los pares
  const [soloExp, setSoloExp] = useOpcion('combinado.soloExp', true)
  const cal = useMemo(() => calibracionDe(s, tipoErr), [pre, ufcRes, tipoErr, exp.aj, soloExp, exp.opciones?.['curva.modelo'], exp.opciones?.['curva.lagfijo'], exp.opciones?.['curva.mcurv'], exp.opciones?.['curva.nmax'], s.res]) // eslint-disable-line react-hooks/exhaustive-deps
  const { pares: paresF, usados, calCepa } = cal
  const pares = paresF
  const fases = cal.fases
  const alternar = (clave) => s.upd((e) => {
    const p = paresF.find((x) => x.clave === clave)
    if (!p) return {}
    const incl = { ...(e.aj.calib_incl || {}) }
    if (!p.usado === p.auto) delete incl[clave]; else incl[clave] = !p.usado
    return { aj: { ...e.aj, calib_incl: incl } }
  })
  if (!pre || pre.error || !ufcRes?.hay) return <div className="pagina"><Encabezado titulo="OD ↔ UFC" /><Vacio titulo="Faltan datos">Hacen falta curvas de OD procesadas y recuentos de UFC.</Vacio></div>

  // fichas: par OD–UFC (con las lecturas de OD de ese tiempo, o la interpolación) y calibración con sus pares
  const fPar = (p) => () => {
    const g = seriesOdCalibracion(pre).filter((w) => w.Muestra === p.Muestra)
    const valoresOd = g.flatMap((w) => w.t.map((t, i) => (Math.abs(t / 3600 - p.T_h) < 1e-6 && finito(w.y[i]) ? { etiqueta: `réplica ${w.Replica}${exp.origenOd === 'tecan' ? ` (${w.Pocillo})` : ''}`, x: w.y[i] } : null)).filter(Boolean))
    let vecinos = null
    if (p.OD_interpolada) { const mt = mediaPorTiempo(g, (v) => v, 'sd'); const j = mt.findIndex((q) => q.t / 3600 > p.T_h); if (j > 0) vecinos = { t1: mt[j - 1].t / 3600, y1: mt[j - 1].m, t2: mt[j].t / 3600, y2: mt[j].m } }
    return fichaPar(p, { valoresOd, vecinos })
  }
  const paresDe = (id) => usados.filter((p) => (id === '' ? !cepasOcultas(exp).includes(p.Muestra) : p.Muestra === id)).map((p) => ({ od: p.OD, ufc: p.UFC_mL }))
  const muestras = [...new Set([...seriesOdCalibracion(pre).map((w) => w.Muestra), ...ufcRes.res.map((r) => r.Muestra)])]
  const vis = muestras.filter((m) => !cepasOcultas(exp).includes(m))
  // calibración
  const pv = paresF.filter((p) => vis.includes(p.Muestra))
  const visCal = [...new Set(pares.map((p) => p.Muestra))].filter((m) => vis.includes(m))
  const filasCal = [...vis.filter((m) => calCepa[m]).map((m) => ({ id: m, nombre: m, color: s.colores[m], c: calCepa[m] }))]
  const FASE = { lag: 'lag', exponencial: 'exponencial', estacionaria: 'estacionaria' }
  // ejes de la calibración: y = log₁₀ UFC/mL o UFC/mL según la escala; x = OD, o log₁₀ OD con el modelo de potencia en log₁₀ (así su recta se ve recta)
  const logX = false
  const xv = (od) => (logX ? (od > 0 ? Math.log10(od) : NaN) : od)
  const calSeries = [...new Set(pv.map((p) => p.Muestra))].flatMap((m) => [true, false].map((uso) => ({ id: (uso ? '' : 'x') + m, nombre: uso ? m : '', color: s.colores[m], linea: false, puntos: true, radio: 4, errores: uso && conErr, opacidad: uso ? 1 : 0.3,
    etiqueta: conEtiquetas(mo) ? (d) => d.valor : undefined,
    data: pv.filter((p) => p.Muestra === m && p.usado === uso && finito(xv(p.OD))).map((p) => {
      const e = errorUfc(p._ufc, modoU, tipoErr, cen)
      return { x: xv(p.OD), y: logOd ? p.log10_UFC : p.UFC_mL / kU, lo: e.lo / kU, hi: e.hi / kU, xlo: finito(p.OD_err) ? xv(p.OD - p.OD_err) : NaN, xhi: finito(p.OD_err) ? xv(p.OD + p.OD_err) : NaN,
        valor: (() => { const enEje = !logOd && potU !== 0 && s.estiloGrafico('calibracion').valoresEnEje !== false; if (!logOd && !enEje && !e.rango) return textoPar(parCientifico(p.UFC_mL, e.err), !!mo.valor, !!mo.error); return textoMostrar(mo, logOd ? fx(p.log10_UFC, 2) : enEje ? fs(p.UFC_mL / kU, 3) : sci(p.UFC_mL), errorTextoUfc(e, !logOd, enEje ? kU : null)) })(),
        key: p.clave,
        tip: `${m} · T = ${p.T_h} h${p.fase ? ` · ${FASE[p.fase]}` : ''}\n${uso ? 'Usado' : 'No usado'} en la recta${p.manual ? ' (elegido a mano)' : ''} · clic para ${uso ? 'excluirlo' : 'incluirlo'}\nOD = ${fx(p.OD, 3)}${finito(p.OD_err) ? ` ± ${fx(p.OD_err, 3)} (${nomErr})` : ''}${p.OD_interpolada ? ' (interpolada)' : ''}\n${tipValorUfc(p._ufc, cen, tipoErr).join('\n')}` }
    }) })))
  const trazo = (c) => Array.from({ length: 80 }, (_, i) => c.rango[0] + ((c.rango[1] - c.rango[0]) * i) / 79).map((x) => ({ x: xv(x), y: (() => { const u = c.pred(x); return logOd ? Math.log10(u) : u / kU })() })).filter((d) => finito(d.x) && finito(d.y))
  vis.forEach((m) => { const c = calCepa[m]; if (c?.ok) calSeries.push({ id: 'aj' + m, nombre: '', color: s.colores[m], ancho: 1.8, data: trazo(c) }) })
  return (
    <div className="pagina">
      <Cinta>
        <GrupoMostrar m={mo} set={setMo} notas={{ puntos: 'La media de cada tiempo (OD y UFC)', replicas: 'Cada recuento de UFC como un punto chico', barras: 'Banda de error de la OD y barras de las UFC\nOD: el tipo de error elegido en «Revisión de la OD»; UFC: el de «Revisión de los recuentos»' }} />
        <Grupo titulo="Escala del eje Y">
          <OpcionesCinta valor={escalaOd} onChange={setEscalaOd} opciones={[['lineal', 'Lineal', 'N', null, 'OD y UFC/mL tal cual'], ['log10', 'log₁₀', 'lg', null, 'log₁₀(OD) y log₁₀ UFC/mL: la fase exponencial es una recta en las dos y las pendientes se comparan directamente']]} />
        </Grupo>
        <Grupo titulo="Pares">
          <BotonCinta simbolo="⟋" texto="Fase exponencial" activo={soloExp} onClick={() => setSoloExp(!soloExp)} tip={'Usar solo los pares de la fase exponencial común a OD y UFC\nApagado: todos los pares'} />
          <BotonCinta icono="refrescar" texto="Restablecer pares" deshabilitado={!Object.keys(exp.aj.calib_incl || {}).length} onClick={() => s.setAj('calib_incl', {})} tip={'Volver a la selección por defecto: los pares de la fase exponencial'} />
        </Grupo>
      </Cinta>
      <Encabezado titulo="OD ↔ UFC" sub={`Calibración log₁₀ UFC/mL = m·OD + b por cepa, con ${soloExp ? 'los pares de la fase exponencial común a OD y UFC' : 'todos los pares'}.`} />
      <div className="tarjeta" style={{ minWidth: 0 }}>
        <h2>Calibración: {yTxtU} vs {logX ? 'log₁₀ OD' : 'OD'}</h2>
        <SelectorCepas s={s} muestras={[...new Set(pares.map((p) => p.Muestra))]} />
        {(() => {
          // más de la mitad de las OD netas (corregidas por el blanco) ≤ 0: el blanco probablemente está mal
          const nNeg = pv.filter((p) => finito(p.OD) && p.OD <= 0).length
          return pv.length > 0 && nNeg > pv.length / 2
            ? <p className="aviso-caja"><b>Blanco posiblemente inválido:</b> {nNeg} de {pv.length} OD corregidas por el blanco son ≤ 0. Un blanco con más absorbancia que las muestras (medio distinto, cubeta sucia, burbujas) desplaza toda la recta. Revisá el blanco antes de usar esta calibración.</p>
            : null
        })()}
        {pv.length < 2 ? <p className="aviso-caja">Hacen falta al menos 2 pares OD–UFC (misma cepa y tiempo) dentro del rango de tiempo de la OD; para estimar el error, 3 o más.</p> : (
          <Grafico series={calSeries} xTxt={logX ? 'log₁₀ OD' : 'OD'} yTxt={yTxtU} alto={340} nombre="calibracion" estilo={s.estiloGrafico('calibracion')} idEstilo="calibracion" onPuntoClick={alternar} />
        )}
        <div className="ec-modelo" style={{ marginTop: 14 }}>
          <h2>Ecuación de la calibración</h2>
          <p className="ayuda" style={{ marginTop: 0 }}>{MODELOS_CALIB[modelo]} · una ecuación por cepa.</p>
          <div className="ec-grid">{filasCal.map((f) => <BloqueCalib key={f.id} f={f} usados={paresDe(f.id)} />)}</div>
        </div>
      </div>
      <div className="tarjeta">
        <h2>Pares OD–UFC</h2>
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>Usar</th><th>Cepa</th><th className="num">t (h)</th><th data-tip={'Fase de la OD y de las UFC en ese tiempo\nMarcado por defecto: exponencial en las dos'}>Fase OD</th><th>Fase UFC</th><th className="num" data-tip={'Media de las réplicas de OD en ese tiempo\nCorregida por el blanco, sin suavizar ni normalizar'}>OD media (neta)</th><th className="num">UFC/mL</th><th className="num">log₁₀ UFC</th></tr></thead>
          <tbody>{pv.map((p) => (
            <tr key={p.Muestra + p.T_h} className={p.usado ? '' : 'fuera'}><td><input type="checkbox" checked={p.usado} onChange={() => alternar(p.clave)} data-tip={p.usado ? 'Excluir este par de la recta' : 'Incluir este par en la recta'} />{p.manual && <small className="ayuda"> a mano</small>}</td><td>{p.Muestra}</td><td className="num">{p.T_h}</td><td>{p.faseOd ? FASE[p.faseOd] : '–'}</td><td>{p.fase ? FASE[p.fase] : '–'}</td><td className="num"><Valor f={fPar(p)}>{fx(p.OD, 3)}</Valor>{p.OD_interpolada && <small className="ayuda" data-tip="No había lectura de OD en ese tiempo: se interpoló linealmente entre las lecturas vecinas."> (interp.)</small>}</td>
              <td className="num"><Valor f={() => fichaTiempoUfc(ufcRes, exp.aj, p.Muestra, p.T_h)}>{sci(p.UFC_mL)}</Valor></td><td className="num">{fx(p.log10_UFC, 2)}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      {res?.length > 0 && <SeccionComparacion s={s} />}
    </div>
  )
}
