// ============================================================
// Curva UFC vs t: el gráfico de los recuentos con la curva del modelo, la predicción y la tabla de UFC/mL por tiempo.
// Debajo, los parámetros de crecimiento del mismo ajuste (μ, λ, y₀, …). Clic en un punto o en un número:
// cómo se calculó.
// ============================================================
import { useMemo, useState } from 'react'
import { useOpcion } from '../ui/opciones.js'
import { finito } from '../motor/analisis.js'
import { ERRORES_UFC, MODELOS_UFC, sinReplicasUfc, fraccionExp, tramoUfcRige, estadisticaUfc, tipValorUfc, curvaUfc, errorTextoUfc, errorUfc, etiquetaErrorUfc, modeloUfc, nmaxFijado, prediccionUfc, predDe } from '../motor/ufc.js'
import { TablaMediaTiempo } from '../ui/tablaMedia.jsx'
import { curvaUfcDe, verUfc } from './CalidadUfc.jsx'
import { zonasVentana } from './FasesCepa.jsx'
import { useTema } from '../tema.js'
import { Encabezado, Icono, Num, Vacio } from '../ui/base.jsx'
import { BotonCinta, Cajon, CampoCinta, Cinta, Grupo, OpcionesCinta } from '../ui/cinta.jsx'
import { PanelPersonalizar } from '../ui/personalizar.jsx'
import { GrupoMostrar, conEtiquetas, textoMostrar, useMostrar } from '../ui/mostrar.jsx'
import { SelectorCepas, cepasOcultas } from '../ui/cepas.jsx'
import { Grafico } from '../ui/grafico.jsx'
import { Valor } from '../fichas/FichaCalculo.jsx'
import { fichaPrediccionUfc, fichaUfcTiempo } from '../fichas/definiciones.js'
import { fs, fx, sciCorto } from '../utils.js'
import { GrupoModeloUfc, GruposOpcionesModeloUfc, SeccionUfc } from './ParamUfc.jsx'

// ficha del valor de una cepa en un tiempo, con las réplicas que no entran y las estimadas
export function fichaTiempoUfc(ufcRes, aj, m, t, foco) {
  const r = ufcRes.res.find((x) => x.Muestra === m && x.T_h === t)
  if (!r) return null
  const reps = ufcRes.reps.filter((x) => x.Muestra === m && x.T_h === t && x.Conteos > 0)
  const enPool = new Set((r._pool || []).map((q) => q.Replica))
  const excl = reps.filter((x) => !enPool.has(x.Replica)).map((x) => `réplica ${x.Replica} (${ufcRes.fuera.has(`${x.Muestra}|${x.T_h}|${x.Replica}`) ? 'excluida' : String(x.Estado || '').toLowerCase()})`)
  const est = reps.filter((x) => enPool.has(x.Replica) && ['bajo', 'alto'].includes(x._estado)).map((x) => `réplica ${x.Replica}`)
  return fichaUfcTiempo(r, { foco, error: ERRORES_UFC[aj.ufc_err] ? aj.ufc_err : 'sd', excluidas: excl.join(', '), estimadas: est.join(', ') })
}

export function CurvaUfc({ s }) {
  const T = useTema()
  const { exp } = s
  // réplicas ocultas en el gráfico (botones junto a cada cepa, como en Curva OD): salen del gráfico, de la media y de la tabla
  const [ocultasRep, setOcultasRep] = useState([])
  const ufcTodo = s.ufcRes
  const ufcRes = useMemo(() => sinReplicasUfc(ufcTodo, ocultasRep), [ufcTodo, ocultasRep])
  const [escala, setEscala] = useOpcion('curvaUfc.escala', 'log10')
  const [fases, setFases] = useOpcion('curvaUfc.fases', false)   // sombrea lag / exponencial / estacionaria (con una sola cepa visible)
  const tipoErr = verUfc(exp.aj).error
  // Mostrar (el mismo grupo en todos los gráficos): puntos = valor de cada tiempo, réplicas = cada conteo
  const [mo, setMo] = useMostrar('curvaUfc', { puntos: true, replicas: false })
  const conCurva = curvaUfcDe(exp.aj) !== 'no'
  const [pers, setPers] = useState(null)
  const modelo = modeloUfc(exp.aj)
  const nmaxF = nmaxFijado(exp.aj)
  const etqErr = etiquetaErrorUfc(null, tipoErr)
  if (!ufcRes?.hay) return <div className="pagina"><Encabezado titulo="Curva UFC vs t" /><Vacio titulo="Todavía no hay conteos">Cargá las colonias en «Conteo › Cargar datos».</Vacio></div>
  const res = ufcRes.res.filter((r) => finito(r.log10))
  const todas = [...new Set(res.map((r) => r.Muestra))]
  const muestras = todas.filter((m) => !cepasOcultas(exp).includes(m))
  const lin = escala === 'lineal'
  const pot = lin ? Math.floor(Math.log10(Math.max(...res.map((r) => r.UFC_mL)))) : 0
  const mostrarMedias = mo.puntos || mo.barras || conEtiquetas(mo)
  const series = (mostrarMedias ? muestras : []).map((m) => ({
    id: m, cepa: m, nombre: m, color: s.colores[m], linea: false, puntos: !!mo.puntos, forma: 'cuadrado', radio: 4, ancho: 2, errores: !!mo.barras,
    etiqueta: conEtiquetas(mo) ? (d) => d.valor : undefined,
    data: res.filter((r) => r.Muestra === m).sort((a, b) => a.T_h - b.T_h).map((r) => {
      const e = errorUfc(r, lin ? 'lineal' : 'log10', tipoErr)
      const k = lin ? 10 ** pot : 1
      const valor = textoMostrar(mo, lin ? sciCorto(e.m) : fx(e.m, 2), errorTextoUfc(e, lin))
      return { x: r.T_h, y: e.m / k, lo: e.lo / k, hi: e.hi / k, valor, key: `${m}|${r.T_h}`,
        tip: [`${m} · T = ${r.T_h} h`, ...tipValorUfc(r, null, tipoErr), 'Clic: cómo se calculó'].join('\n') }
    }),
  }))
  // réplicas: cada conteo como un punto chico, para ver cuánto se aparta del valor del tiempo
  if (mo.replicas) muestras.forEach((m) => {
    series.push({ id: 'rep' + m, cepa: m, nombre: '', color: s.colores[m], linea: false, puntos: true, radio: 3, opacidad: 0.75,
      data: ufcRes.reps.filter((r) => r.Muestra === m && finito(r.log10) && !ufcRes.fuera.has(`${r.Muestra}|${r.T_h}|${r.Replica}`)).map((r) => ({ x: r.T_h, y: lin ? r.UFC_mL / 10 ** pot : r.log10, tip: `${m} · réplica ${r.Replica} · T = ${r.T_h} h\nUFC/mL = ${sciCorto(r.UFC_mL)} (log₁₀ ${fx(r.log10, 2)})` })) })
  })
  // curva del modelo elegido
  const avisosSuave = []
  // modo predictivo: Baranyi y Roberts extendido en el tiempo (reemplaza la curva del modelo)
  const pred = predDe(exp.aj)
  const setPred = (k, x) => s.upd((e) => ({ aj: { ...e.aj, ufc_pred: { ...predDe(e.aj), [k]: x } } }))
  const preds = pred.on ? muestras.map((m) => ({ m, p: prediccionUfc(ufcTodo, m, exp.aj) })) : []
  const yv = (y) => (lin ? 10 ** y / 10 ** pot : y)
  preds.forEach(({ m, p }) => {
    if (!p.ok || !conCurva) return
    const tramo = (a, b) => p.puntos.filter((q) => q.x >= a - 1e-9 && q.x <= b + 1e-9).map((q) => ({ x: q.x, y: yv(q.y), tip: `${m} · ${MODELOS_UFC[modelo]}\nt = ${fx(q.x, 2)} h\n${q.x > p.c.t1 ? 'predicción: ' : ''}log₁₀ UFC/mL = ${fx(q.y, 2)} (${sciCorto(10 ** q.y)})` }))
    series.push({ id: 'pa' + m, cepa: m, nombre: `${m}: ${MODELOS_UFC[modelo]}`, color: s.colores[m], ancho: 2, data: tramo(p.c.t0, p.c.t1) })
    series.push({ id: 'pp' + m, cepa: m, nombre: `${m}: predicción`, color: s.colores[m], ancho: 2, dash: '7 5', data: tramo(p.c.t1, p.hasta) })
  })
  if (pred.on && finito(Number(pred.objetivo)) && pred.objetivo !== '' && preds.some((x) => x.p.ok)) {
    const ok = preds.filter((x) => x.p.ok)
    series.push({ id: 'objetivo', nombre: `Objetivo ${fx(Number(pred.objetivo), 2)} log₁₀`, color: T.sec, ancho: 1, dash: '2 4', data: [Math.min(...ok.map((x) => x.p.c.t0)), Math.max(...ok.map((x) => x.p.hasta))].map((x) => ({ x, y: yv(Number(pred.objetivo)) })) })
  }
  // con «Predecir», las cepas sin predicción posible (p. ej. sin meseta y sin N máx) igual muestran la curva ajustada sobre sus datos
  const conPrediccion = new Set(preds.filter((x) => x.p.ok).map((x) => x.m))
  if (conCurva) preds.filter((x) => !x.p.ok).forEach(({ m, p }) => avisosSuave.push(`${m}: no se puede predecir más allá del último recuento (${p.motivo})`))
  if (conCurva) muestras.forEach((m) => {
    if (conPrediccion.has(m)) return
    const cs = curvaUfc(ufcTodo, m, exp.aj)
    if (!cs?.ok) { if (cs) avisosSuave.push(`${m}: ${cs.motivo}`); return }
    series.push({ id: 'sv' + m, cepa: m, nombre: `${m}: ${MODELOS_UFC[modelo]}`, color: s.colores[m], ancho: 2, data: cs.puntos.map((q) => ({ x: q.x, y: lin ? 10 ** q.y / 10 ** pot : q.y })) })
  })
  // fases de la cepa visible (el tramo que rige: el del modelo, o el elegido con Linealizar log₁₀)
  const unaCepa = muestras.length === 1
  const trF = unaCepa ? tramoUfcRige(ufcTodo, muestras[0], exp.aj) : null
  const tsF = unaCepa ? res.filter((r) => r.Muestra === muestras[0]).map((r) => r.T_h) : []
  const zonas = fases && trF?.ventana && tsF.length ? zonasVentana(trF.ventana, Math.min(...tsF), Math.max(...tsF), true) : []
  const abrir = (k) => { const [m, t] = [k.slice(0, k.lastIndexOf('|')), Number(k.slice(k.lastIndexOf('|') + 1))]; const f = fichaTiempoUfc(ufcRes, exp.aj, m, t); if (f) s.abrirFicha(f) }
  return (
    <div className="pagina">
      <Encabezado titulo="Curva UFC vs t" sub={`Cuadrados: media de las UFC/mL de las réplicas de cada tiempo ± ${etqErr} (en log₁₀: log₁₀ de la media y de los extremos de la barra).${conCurva ? ` Línea continua: modelo ${MODELOS_UFC[modelo]} ajustado a todos los puntos.` : ''} Clic en un punto: cómo se calculó.`}>
      </Encabezado>
      <SelectorCepas s={s} muestras={todas} hayMas={ocultasRep.length > 0} onMostrarTodas={() => setOcultasRep([])}
        extra={(m, on) => {
          const reps = [...new Set(ufcTodo.reps.filter((x) => x.Muestra === m && x.Conteos > 0).map((x) => x.Replica))].sort((a, b) => a - b)
          return on && reps.length > 1 && reps.map((k) => {
            const id = `${m}|${k}`, vis = !ocultasRep.includes(id)
            return <button key={id} className={`rep ${vis ? 'on' : ''}`} style={vis ? { background: s.colores[m] } : undefined}
              onClick={() => setOcultasRep(vis ? [...ocultasRep, id] : ocultasRep.filter((x) => x !== id))}
              data-tip={`${m} · réplica ${k}\n${vis ? 'Clic para ocultarla del gráfico, de la media y de la tabla' : 'Clic para mostrarla'}\n(el ajuste del modelo no cambia; para sacarla del análisis, excluila en la Revisión)`}>{k}</button>
          })
        }} />
      <Cinta>
        <GrupoMostrar m={mo} set={setMo} notas={{ barras: `Barras de error: ${etqErr} de las UFC/mL de las réplicas (en log₁₀: log₁₀ de media − error a media + error)` }} />
        <Grupo titulo="Escala del eje Y"><OpcionesCinta valor={escala} onChange={setEscala} opciones={[['lineal', 'Lineal', 'UFC', null, 'UFC/mL tal cual (media ± error de las réplicas)'], ['log10', 'log₁₀', 'lg', null, 'log₁₀ de la media, con la barra de log₁₀(media − error) a log₁₀(media + error)']]} /></Grupo>
        <GrupoModeloUfc s={s} />
        <Grupo titulo="Fases">
          {modelo !== 'lineal' && <CampoCinta etiqueta="Fracción de μ máx" tip={'Con Baranyi y Roberts o Huang las fases las fija el modelo: un tiempo es exponencial cuando su velocidad es al menos esta fracción de μ máx (entre 0 y 1; por defecto 0,5)'}><Num value={exp.aj.ufc_frac_exp ?? 0.5} onChange={(x) => s.setAj('ufc_frac_exp', x)} ancho={52} /></CampoCinta>}
          <BotonCinta simbolo="▥" texto="Fases" activo={fases && unaCepa} deshabilitado={!unaCepa} onClick={() => setFases(!fases)} tip={unaCepa ? 'Mostrar u ocultar las fases (lag, exponencial, estacionaria) de la cepa' : 'Las fases son distintas en cada cepa: dejá una sola cepa visible para verlas'} />
        </Grupo>
        <GruposOpcionesModeloUfc s={s} />
        <Grupo titulo="Predicción">
          <BotonCinta simbolo="⇢" texto="Predecir" activo={pred.on} onClick={() => setPred('on', !pred.on)} tip={`Extiende el ajuste de ${MODELOS_UFC[modelo]} de cada cepa${'\n'}más allá del último tiempo (línea a trazos)`} />
          {pred.on && <>
            <CampoCinta etiqueta="Hasta (h)" tip="Horizonte de la predicción en horas (vacío = 24 h)"><Num value={pred.hasta} placeholder="24" onChange={(x) => setPred('hasta', x)} ancho={52} /></CampoCinta>
            <CampoCinta etiqueta="Objetivo (log₁₀)" tip="Nivel para calcular en cuánto tiempo se alcanza"><Num value={pred.objetivo} onChange={(x) => setPred('objetivo', x)} ancho={58} placeholder="–" /></CampoCinta>
          </>}
        </Grupo>
        <Grupo titulo="Gráfico">
          <BotonCinta icono="editar" texto="Personalizar" activo={pers === 'curvaUfc'} onClick={() => setPers(pers === 'curvaUfc' ? null : 'curvaUfc')} tip="Títulos, valores sobre los puntos, tamaños de letra, grosores, ejes, leyenda, fondo y colores de las cepas" />
        </Grupo>
      </Cinta>
      <Cajon titulo="Personalizar gráfico" abierto={pers === 'curvaUfc'} onClose={() => setPers(null)}><PanelPersonalizar s={s} id="curvaUfc" /></Cajon>
      {pred.on && preds.some((x) => x.p.ok && x.p.sinMeseta) && <p className="aviso-caja"><b>Predicción sin meseta:</b> {preds.filter((x) => x.p.ok && x.p.sinMeseta).map((x) => x.m).join(', ')}: los recuentos no llegan a la fase estacionaria, así que el nivel máximo no se puede estimar y la curva extiende el crecimiento hasta un tope arbitrario (2,2 log₁₀ sobre el máximo medido). Indicá «N máx» en la cinta para una predicción realista.</p>}
      {avisosSuave.length > 0 && <p className="ayuda">{avisosSuave.join(' · ')}.</p>}
      <div className="tarjeta">
        <Grafico series={series} yTxt={lin ? `UFC/mL${pot ? ` (× 10^${pot})` : ''}` : 'log₁₀ UFC/mL'} alto={420} nombre={`ufc_${exp.nombre}`} titulo={exp.nombre} ceroY={lin} estilo={s.estiloGrafico('curvaUfc')} idEstilo="curvaUfc" onPuntoClick={abrir} zonas={zonas} />
        {fases && unaCepa && (trF?.ventana ? <p className="ayuda" style={{ marginTop: 6 }}><b>{muestras[0]}</b>: lag hasta {fx(trF.ventana[0], 2)} h · fase exponencial de {fx(trF.ventana[0], 2)} a {fx(trF.ventana[1], 2)} h ({trF.origen === 'modelo' ? `la fija el modelo ${MODELOS_UFC[modelo]}: velocidad ≥ ${fx(100 * fraccionExp(exp.aj), 0)} % de μ máx` : trF.origen === 'manual' ? 'tramo elegido a mano' : trF.origen === 'respaldo' ? 'el modelo no ajustó: tramo automático de la recta' : 'automático'}) · estacionaria desde {fx(trF.ventana[1], 2)} h.</p> : <p className="ayuda" style={{ marginTop: 6 }}>{trF?.aviso || `${muestras[0]}: sin fase exponencial detectada.`}</p>)}
      </div>
      <SeccionUfc s={s} />
      {pred.on && (
        <div className="tarjeta">
          <h2>Predicción con {MODELOS_UFC[modelo]} <span className="ayuda" style={{ fontWeight: 400 }}>· hasta {fx((Number(pred.hasta) > 0 ? Number(pred.hasta) : 24), 1)} h{finito(nmaxF) ? `, con N máx fijado en ${fx(nmaxF, 2)} log₁₀` : ', N máx estimado por el ajuste'} · mismo ajuste que los parámetros</span></h2>
          <div className="tabla-scroll"><table className="tabla">
            <thead><tr><th>Cepa</th><th className="num" data-tip="Valor predicho al final del horizonte">log₁₀ UFC/mL a {fx((Number(pred.hasta) > 0 ? Number(pred.hasta) : 24), 1)} h</th><th className="num" data-tip="Tiempo en que la curva queda a 0,1 log₁₀ de N máx">Llega a la meseta (h)</th>{pred.objetivo !== '' && <th className="num">Llega a {fx(Number(pred.objetivo), 2)} log₁₀ (h)</th>}<th className="num">N máx (log₁₀)</th></tr></thead>
            <tbody>{preds.map(({ m, p }) => (
              <tr key={m}><td><i className="punto" style={{ background: s.colores[m], marginRight: 6 }} /><b>{m}</b></td>
                {p.ok ? <>
                  <td className="num"><Valor f={() => fichaPrediccionUfc(p, { nombre: m })}><b>{fx(p.yHasta, 2)}</b> <small className="ayuda">({sciCorto(10 ** p.yHasta)})</small></Valor></td>
                  <td className="num"><Valor f={() => fichaPrediccionUfc(p, { nombre: m })}>{finito(p.tMeseta) ? fx(p.tMeseta, 1) : '–'}</Valor></td>
                  {pred.objetivo !== '' && <td className="num"><Valor f={() => fichaPrediccionUfc(p, { nombre: m })}>{finito(p.tObjetivo) ? fx(p.tObjetivo, 1) : 'no llega'}</Valor></td>}
                  <td className="num">{fx(p.c.yEnd, 2)}{p.c.ymaxFijo ? <small className="ayuda"> (fijado)</small> : null}</td>
                </> : <td colSpan={pred.objetivo !== '' ? 4 : 3} className="ayuda">{p.motivo}</td>}
              </tr>
            ))}</tbody>
          </table></div>
          <p className="ayuda" style={{ marginTop: 6 }}>Línea continua: ajuste dentro del rango medido; a trazos: comportamiento esperado según el modelo. Más allá del último recuento es una extrapolación: la meseta depende de N máx, y si los datos no llegan a la fase estacionaria conviene fijarlo con el valor de otros ensayos en el mismo medio.</p>
        </div>
      )}
      <TablaMediaTiempo titulo="UFC/mL por cepa y tiempo" unidad="UFC/mL" etqErr={etqErr} fmt={(x) => sciCorto(x)}
        filas={res.filter((r) => muestras.includes(r.Muestra)).map((r) => { const est = estadisticaUfc(r), e = errorUfc(r, 'lineal', tipoErr); return { clave: `${r.Muestra}|${r.T_h}`, cepa: r.Muestra, color: s.colores[r.Muestra], t: r.T_h, n: est.n, m: est.m, e: e.err } })}
        ficha={(f, foco) => fichaTiempoUfc(ufcRes, exp.aj, f.cepa, f.t, foco)}
        nota="Para cada réplica UFC/mL = C · D / V; el valor de cada tiempo es la media aritmética de las réplicas, con su error y su rango; en log₁₀, el log₁₀ de esa media y de los extremos del rango (la escala del gráfico no cambia las cuentas). Las réplicas con 0 colonias cuentan como 0. Con menos de 3 réplicas no hay EEM ni IC 95 %." />
    </div>
  )
}
