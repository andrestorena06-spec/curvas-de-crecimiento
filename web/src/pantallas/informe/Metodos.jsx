import { useMemo, useRef } from 'react'
import { useOpcion } from '../../ui/opciones.js'
import { finito } from '../../calculo/comun/analisis.js'
import { tablasDe } from './Datos.jsx'
import { mathATexto, O, N, R, T, abs, barra, cor, de_t, ec, en, ex, fr, ln, log10, par, prod, raiz, sep, sub, suma, sup, tilde, v } from '../../ui/mat.jsx'
import { opAnalisis } from '../../calculo/od/pipeline.js'
import { ORIGENES, TIPOS, caminoOptico, replicaOd } from '../../datos/experimento.js'
import { Encabezado, Icono } from '../../ui/base.jsx'
import { BotonCinta, Cinta, Grupo } from '../../ui/cinta.jsx'
import { descargarTexto, fx } from '../../comun/utils.js'
import { cuotaDe, fraccionExp, modeloUfc } from '../../calculo/ufc/index.js'

// ajuste de un paso: encendido muestra sus valores; apagado, su nombre y «desactivado»
const Act = ({ on, txt, et }) => <span className={`estado-ajuste ${on ? '' : 'off'}`}>{on ? txt || 'activo' : `${et || txt}: desactivado`}</span>

// Párrafo de métodos listo para un informe, según lo que está activo
function textoPublicacion(s) {
  const { exp } = s
  const aj = exp.aj, op = opAnalisis(aj), c = exp.cond
  const p = []
  const cond = [c.organismo && `de ${c.organismo}`, c.medio && `en ${c.medio}`, c.temperatura && `a ${c.temperatura} °C`].filter(Boolean).join(' ')
  if (exp.tipo !== 'ufc') {
    if (exp.origenOd === 'tecan') p.push(`El crecimiento ${cond} se siguió por densidad óptica a ${c.lambda} nm en un lector de microplacas, con lecturas cinéticas de cada pocillo.`)
    if (exp.origenOd === 'placas') p.push(`El crecimiento ${cond} se siguió midiendo la densidad óptica a ${c.lambda} nm de una placa de 96 pocillos en cada tiempo de muestreo.`)
    if (exp.origenOd === 'cubeta') p.push(`El crecimiento ${cond} se siguió por densidad óptica a ${c.lambda} nm en un espectrofotómetro con cubeta; las muestras cuya absorbancia superó ${exp.manual.vmax} se diluyeron (factor ${exp.manual.factor}) y la OD se calculó como (lectura − blanco) × factor de dilución con las lecturas dentro del rango lineal del equipo (${exp.manual.vmin}–${exp.manual.vmax}; si había varias, su media)${exp.manual.excluirFuera ? "; los tiempos sin ninguna lectura dentro de ese rango se excluyeron" : "; si ninguna caía dentro, se usó la más cercana al centro del rango"}.`)
    if (exp.origenOd === 'tecan' && aj.corregir_blanco) p.push(`A cada lectura se le restó ${aj.blanco_metodo === 'tiempo' ? 'el promedio de los pocillos con medio sin inocular en el mismo tiempo' : aj.blanco_metodo === 'const_media' ? 'la media de todas las lecturas del blanco' : 'el mínimo de la curva promedio del blanco'}.`)
    if (exp.origenOd !== 'cubeta' && aj.camino_on) { const c = caminoOptico(aj); if (c) p.push(`La OD se llevó a 1 cm de camino óptico: con ${aj.pocillo_vol} µL en pocillos de ${String(aj.pocillo_diam).replace(".", ",")} mm de diámetro el camino es l = V/(π·d²/4) = ${fx(c.l, 3)} cm, y OD₁cm = OD × 1/l.`) }
    if (exp.origenOd === 'placas' && aj.corregir_blanco) p.push('A cada placa se le restó el promedio de sus propios pocillos de medio sin inocular, y las lecturas hechas sobre diluciones se multiplicaron por su factor de dilución.')
    // atípicos: los criterios que realmente se aplicaron (en placas por tiempo, el control de cada placa)
    const out = []
    const nomAtip = (m, conf, cv) => (m === 'cv' ? `la desviación estándar relativa entre réplicas (límite ${cv} %)` : m === 'grubbs' ? `el test de Grubbs entre réplicas (${conf} % de confianza)` : `el test Q de Dixon entre réplicas (${conf} % de confianza; Rorabacher, 1991)`)
    if (exp.origenOd === 'placas') out.push(`${nomAtip(aj.pl_metodo || 'q', aj.pl_conf || 95, aj.pl_cvmax ?? 20)} de cada cepa en cada placa, después de evaluar del mismo modo los pocillos de blanco`)
    else {
      if (aj.hampel_on) out.push(`un filtro de Hampel dentro de cada curva (ventana de ${2 * aj.hampel_k + 1} puntos, umbral ${aj.hampel_sigma} × MAD escalada, diferencia mínima ${aj.hampel_min} OD)`)
      if (aj.dixon_on) out.push(exp.origenOd === 'tecan' ? `${nomAtip(aj.od_atip_metodo || 'q', aj.dixon_conf || 95, aj.od_cvmax ?? 20)} aplicado al área bajo la curva de las réplicas de cada cepa (se evalúa cada réplica completa, no puntos sueltos)` : `${nomAtip(aj.od_atip_metodo || 'q', aj.dixon_conf || 95, aj.od_cvmax ?? 20)} en cada tiempo`)
    }
    const entreRep = exp.origenOd === 'placas' || aj.dixon_on
    const autoAtip = exp.origenOd === 'placas' ? aj.pl_auto === true : aj.od_atip_auto === true
    if (out.length) p.push(`Los valores aberrantes se identificaron con ${out.join(' y ')}${entreRep ? (autoAtip ? '; los sospechosos entre réplicas se excluyeron automáticamente' : '; los sospechosos entre réplicas solo se marcaron y la decisión de excluirlos fue manual') : ''}.`)
    p.push(`La velocidad específica máxima de crecimiento (μmax) se estimó como la pendiente de ln(OD) contra el tiempo en la ventana deslizante de mayor pendiente (ventanas de ${op.ancho} h, mínimo ${op.minpts} puntos, R² ≥ ${op.r2min}, OD ≥ ${op.lnmin})${finito(op.quota) ? `, ampliada con las ventanas contiguas cuya pendiente fue ≥ ${Math.round(op.quota * 100)} % de la máxima y reajustada` : ''}; el tiempo de duplicación como ln 2/μmax, y la fase de latencia como ${op.lag_metodo === 'umbral' ? `el tiempo en que la OD supera ${op.lag_factor} veces la OD₀` : 'la intersección de la tangente en μmax con ln(OD₀)'}${op.od0_metodo === 'auto' ? ', con OD₀ estimada mediante un modelo de tres fases (Buchanan et al., 1997)' : ''}. La OD máxima (K) se tomó sobre la curva suavizada con mediana móvil de 3 puntos y el área bajo la curva se calculó por la regla del trapecio.`)
    const mOd = exp.opciones?.['curva.modelo'] || 'baranyi'
    if (mOd === 'baranyi' || mOd === 'huang') p.push(`Además se ajustó el modelo ${mOd === 'huang' ? 'de Huang' : `de Baranyi y Roberts (m = ${exp.opciones?.['curva.mcurv'] ?? 1})`} por mínimos cuadrados a ln(OD), ${exp.opciones?.['curva.ajusteRep'] && exp.origenOd !== 'placas' ? `una curva por réplica con sus lecturas de OD ≥ ${op.lnmin}` : `una curva por cepa con la media de las réplicas en cada tiempo (medias con OD ≥ ${op.lnmin})`}.`)
    p.push(mOd === 'baranyi' || mOd === 'huang'
      ? `La velocidad específica (μ), el tiempo de duplicación y la fase de latencia que se informan por cepa son los del modelo ${mOd === 'huang' ? 'de Huang' : 'de Baranyi y Roberts'}; los de la ventana de ln(OD) se usan solo si el modelo no ajusta.`
      : 'La velocidad específica (μ), el tiempo de duplicación y la fase de latencia que se informan por cepa son los de la ventana de ln(OD).')
    if (op.spline) p.push('Como control, μmax se comparó con el máximo de la derivada de un spline cúbico de suavizado ajustado a ln(OD).')
    const graf = [aj.suavizado && aj.suavizado !== 'ninguno' && 'el suavizado', aj.normalizar && aj.normalizar !== 'ninguna' && 'la normalización por la OD inicial'].filter(Boolean)
    if (exp.origenOd !== 'placas' && graf.length) { const t = graf.join(' y '); p.push(`${t[0].toUpperCase()}${t.slice(1)} se usaron solo para los gráficos; todos los parámetros se calcularon con la OD corregida, sin suavizar ni normalizar.`) }
    p.push(s.porCepa
      ? `Como cada placa corresponde a un tiempo, para cada cepa se construyó una curva con ${s.modoCurva === 'puntos' ? 'todos sus pocillos de cada tiempo' : 'la media de sus pocillos en cada tiempo'}; μmax se informa ± el error estándar de la pendiente de la regresión.`
      : `Los resultados se expresan como media ± desviación estándar de las réplicas ${replicaOd(exp.origenOd).tipo} (${replicaOd(exp.origenOd).de} de un mismo experimento); los intervalos de confianza del 95 % usan la distribución t de Student con n − 1 grados de libertad (solo con n ≥ 3), y el tiempo de duplicación de cada cepa se calculó con la μmax media.`)
  }
  if (exp.tipo !== 'od') {
    p.push(`Las células viables se cuantificaron por recuento en placa de diluciones seriadas (${exp.ufc.toma} µL transferidos a ${exp.ufc.diluyente} µL de diluyente, factor ${Number(Number(exp.ufc.factor).toPrecision(4))} por paso${Object.keys(exp.ufc.pasos || {}).length ? ', con algunos pasos de volúmenes distintos' : ''}; ${exp.ufc.primero === 'dilucion' ? 'la primera columna ya correspondía a la primera dilución' : 'la primera columna fue la suspensión sin diluir'}; ${exp.ufc.vol} µL sembrados). Se consideraron contables las placas con ${exp.ufc.min} a ${exp.ufc.max} colonias${Number(exp.ufc.min) === 25 && Number(exp.ufc.max) === 250 ? " según el criterio del FDA BAM, cap. 3" : ""}${exp.ufc.estimados !== false ? ' (los recuentos fuera de ese rango se usaron como estimaciones)' : ''}; para cada cepa y tiempo se usó una sola dilución, la misma para todas sus réplicas (la que tenía más réplicas dentro del rango contable, salvo que se eligiera otra a mano) y UFC/mL = C · D / V. La concentración de cada cepa y tiempo se calculó como la media aritmética de las UFC/mL de las réplicas (C · D / V de cada una) y la variabilidad como ${{ sem: 'el error estándar de la media', ic95: 'el intervalo de confianza del 95 % (t de Student con n − 1 grados de libertad)' }[exp.aj.ufc_err] || 'la desviación estándar'} de esas UFC/mL; en escala logarítmica se informó el log₁₀ de la media y de los extremos media ∓ error${exp.aj.ufc_dixon_on !== false ? (exp.aj.ufc_atip_metodo === 'cv' ? `; se marcaron los valores atípicos por la desviación estándar relativa (límite ${exp.aj.ufc_cvmax ?? 20} %)` : exp.aj.ufc_atip_metodo === 'grubbs' ? '; se marcaron los valores atípicos con el test de Grubbs sobre log₁₀ UFC/mL' : '; se marcaron los valores atípicos con el test Q de Dixon sobre log₁₀ UFC/mL') + (exp.aj.ufc_auto === true ? ' y se excluyeron del promedio' : ' sin excluirlos automáticamente') : ''}. ${modeloUfc(exp.aj) === 'lineal' ? 'La velocidad de crecimiento se estimó como la pendiente de la recta de log₁₀ UFC/mL contra el tiempo en la fase exponencial (los puntos del tramo elegido), por mínimos cuadrados.' : `La velocidad de crecimiento se estimó ajustando el modelo ${modeloUfc(exp.aj) === 'huang' ? 'de Huang' : `de Baranyi y Roberts (curvatura m = ${exp.aj.ufc_mcurv ?? 1})`} por mínimos cuadrados a ln(UFC/mL) de todos los puntos, como en DMFit (ComBase).`}`)
  }
  if (exp.tipo === 'odufc') {
    // la calibración con el modelo y la selección de pares elegidos en «OD ↔ UFC»
    const soloExp = exp.opciones?.['combinado.soloExp'] !== false
    const desc = 'una regresión lineal de log₁₀ UFC/mL sobre la OD'
    p.push(`La relación entre OD y UFC/mL se describió con ${desc}, por mínimos cuadrados, emparejando cada recuento con la OD media (corregida por el blanco, sin suavizar) de la misma cepa en el mismo tiempo (interpolación lineal cuando no hubo lectura simultánea)${soloExp ? `; se usaron los pares de la fase exponencial común a la OD y a los recuentos (velocidad del modelo ≥ ${Math.round(fraccionExp(exp.aj) * 100)} % de la máxima)` : ''}. Las velocidades por OD y por recuento se compararon de forma descriptiva (cociente μ OD / μ recuento).`)
  }
  // coma decimal, como el resto del programa (los ajustes se guardan como números: 0.98 → 0,98)
  return p.join(' ').replace(/(\d)\.(\d)/g, '$1,$2')
}

// ============================================================
// Métodos: un paso por cálculo, en el orden del procesamiento. Cada paso tiene su ecuación (MathML), los símbolos,
// los ajustes que están activos y el vínculo a la tabla de Datos con sus resultados (mismos id que tablasDe).
// ============================================================
// Métodos como texto: las ecuaciones pasan a una línea (mathATexto), los símbolos a «símbolo: significado» y el flujo a «A → B»
function textoMetodos(raiz) {
  const c = raiz.cloneNode(true)
  c.querySelectorAll('.no-imprimir, .met-datos').forEach((e) => e.remove())
  c.querySelectorAll('math').forEach((m) => {
    const bloque = m.getAttribute('display') === 'block'
    // ¦ separa dos igualdades escritas en la misma línea de la ecuación: en el texto va una por línea
    const lineal = mathATexto(m).split('¦').map((x) => x.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim()).filter(Boolean)
    if (!bloque) { m.replaceWith(document.createTextNode(lineal.join(' '))); return }
    const d = document.createElement('div')   // en bloque: una igualdad por línea (pre-wrap conserva los saltos)
    d.style.whiteSpace = 'pre-wrap'
    d.textContent = lineal.map((x) => '    ' + x).join('\n')
    m.replaceWith(d)
  })
  c.querySelectorAll('.met-simbolos').forEach((dl) => {
    const p = document.createElement('div')
    p.style.whiteSpace = 'pre-wrap'
    p.textContent = [...dl.children].map((d) => `    ${d.querySelector('dt')?.textContent.trim()}: ${d.querySelector('dd')?.textContent.trim()}`).join('\n')
    dl.replaceWith(p)
  })
  c.querySelectorAll('.met-flujo').forEach((ol) => { const p = document.createElement('p'); p.textContent = [...ol.querySelectorAll('li')].map((li) => li.textContent.trim()).join(' → '); ol.replaceWith(p) })
  const caja = document.createElement('div')
  caja.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px'
  caja.appendChild(c)
  document.body.appendChild(caja)
  const t = c.innerText.replace(/\n{3,}/g, '\n\n').trim()
  caja.remove()
  return t
}
// lista de símbolos de un paso: [[símbolo (MathML en línea), significado]]
const Simbolos = ({ items }) => <dl className="met-simbolos">{items.map(([m, t], i) => <div key={i}><dt>{m}</dt><dd>{t}</dd></div>)}</dl>

export function Metodos({ s }) {
  const { exp, serie } = s
  const aj = exp.aj
  const op = opAnalisis(serie.aj || aj)
  const od = exp.tipo !== 'ufc', ufc = exp.tipo !== 'od', comb = exp.tipo === 'odufc'
  const ori = exp.origenOd
  const texto = useMemo(() => textoPublicacion(s), [exp]) // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef()
  // tablas de Datos (las mismas, con los mismos id): cada paso enlaza a las suyas
  const tablas = useMemo(() => tablasDe(s), [s.pre, s.res, s.ufcRes, s.serie, s.exp]) // eslint-disable-line react-hooks/exhaustive-deps
  const [, setTabla] = useOpcion('datos.tabla', null)
  const irTabla = (id) => { setTabla(id); s.irA('datos') }
  const dc = (x) => String(x).replace('.', ',')
  const o = exp.opciones || {}
  const modOd = o['curva.modelo'] || 'baranyi', modU = modeloUfc(aj)
  const nomMod = { no: 'sin curva', lineal: 'Linealizar log₁₀', baranyi: 'Baranyi y Roberts', huang: 'Huang' }
  const errNom = { sd: 'DE', sem: 'EEM', ic95: 'IC 95 %' }
  const atipTxt = (m, conf, cv, auto) => `${{ q: 'Dixon', grubbs: 'Grubbs', cv: `CV > ${cv ?? 20} %` }[m || 'q']}${(m || 'q') !== 'cv' ? `, ${conf || 95} %` : ''} · ${auto ? 'excluir' : 'solo marcar'}`

  // pasos: [id, título, visible]; el número y el índice salen de esta lista
  const PASOS = [
    ['flujo', 'Procesamiento', true],
    ['correccion', 'OD: lectura, blanco y dilución', od],
    ['hampel', 'OD: puntos aberrantes (Hampel)', od && ori !== 'placas', !!aj.hampel_on],
    ['outliers', 'Outliers entre réplicas', true, (od && ori !== 'placas' && !!aj.dixon_on) || ori === 'placas' || (ufc && aj.ufc_dixon_on !== false)],
    ['replicas', 'Réplicas que no concuerdan', od && ori !== 'placas'],
    ['media', 'Valor de cada tiempo: media ± error', true],
    ['mumax', 'OD: μmax por ventana (Linealizar log₁₀)', od],
    ['modelos', 'Modelos de crecimiento: Baranyi y Roberts, Huang', true, (od && (modOd === 'baranyi' || modOd === 'huang')) || (ufc && modU !== 'lineal')],
    ['resumen', 'Resumen entre réplicas', od],
    ['ufc', 'UFC/mL de cada réplica', ufc],
    ['ufccrec', 'Crecimiento por recuento', ufc],
    ['calib', 'Calibración OD ↔ UFC/mL', comb],
    ['comparacion', 'μ por OD y por recuento', comb],
    ['limites', 'Limitaciones', true],
    ['texto', 'Texto para el informe', true],
    ['refs', 'Referencias', true],
  ].filter((p) => p[2])
  const num = (id) => PASOS.findIndex((p) => p[0] === id) + 1
  // un paso desactivado se muestra atenuado y con «no aplicado»: su ecuación queda como referencia, pero no se usó
  const aplicado = (id) => PASOS.find((p) => p[0] === id)?.[3] !== false
  const ir = (id) => document.getElementById('m-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // un paso: título numerado, ajustes activos y las tablas de Datos con sus resultados
  const Paso = ({ id, activo, datos = [], children }) => {
    const ts = datos.map((d) => tablas.find((t) => t.id === d)).filter(Boolean)
    return (
      <section className={`met-paso ${aplicado(id) ? '' : 'off'}`} id={'m-' + id}>
        <header>
          <h2>{num(id)}. {PASOS.find((p) => p[0] === id)[1]}{!aplicado(id) && <span className="met-no"> · no aplicado</span>}</h2>
          {ts.length > 0 && <div className="met-datos no-imprimir">{ts.map((t) => <button key={t.id} className="chico fantasma" onClick={() => irTabla(t.id)} data-tip="Abrir la tabla en Datos"><Icono n="tabla" size={14} />{t.titulo}</button>)}</div>}
        </header>
        {activo && <div className="met-activo">{activo}</div>}
        {children}
      </section>
    )
  }
  const y = () => v('y')
  const xi = () => sub(v('x'), v('i'))
  const xb = () => barra('x')

  return (
    <div className="pagina">
      <Cinta>
        <Grupo titulo="Exportar">
          <BotonCinta icono="copiar" texto="Copiar métodos" onClick={() => navigator.clipboard?.writeText(textoMetodos(ref.current)).then(() => s.avisar('Métodos copiados como texto.'))} tip="Todo Métodos como texto, con las ecuaciones en una línea" />
          <BotonCinta icono="bajar" texto="Descargar texto" onClick={() => descargarTexto(textoMetodos(ref.current), `Metodos - ${exp.nombre}.txt`)} />
          <BotonCinta icono="copiar" texto="Copiar texto del informe" onClick={() => navigator.clipboard?.writeText(texto).then(() => s.avisar('Texto para el informe copiado.'))} />
          <BotonCinta icono="imprimir" texto="Imprimir / PDF" onClick={() => window.print()} />
        </Grupo>
      </Cinta>
      <Encabezado titulo="Métodos" sub={`«${exp.nombre}» · ${TIPOS[exp.tipo].titulo}${ori ? ' · ' + ORIGENES[ori].titulo : ''} · ajustes activos.`} />
      <div className="tarjeta metodos" ref={ref}>

        <Paso id="flujo">
          <ol className="met-flujo">
            {PASOS.filter((p) => !['flujo', 'limites', 'texto', 'refs'].includes(p[0])).map(([id, t]) => <li key={id} className={aplicado(id) ? '' : 'off'}><button className="fantasma" onClick={() => ir(id)} data-tip={aplicado(id) ? undefined : 'No aplicado con los ajustes actuales'}>{num(id)}. {t}</button></li>)}
          </ol>
          <p className="ayuda">Los datos originales no se modifican; toda exclusión es reversible. Suavizado y normalización solo afectan a los gráficos.</p>
        </Paso>

        {od && (
          <Paso id="correccion" datos={['crudos', 'placas', 'blancos', 'cubeta', 'procesada']}
            activo={<>{ori === 'tecan' && <Act on={aj.corregir_blanco} et="blanco" txt={{ tiempo: 'blanco tiempo a tiempo', const_media: 'blanco constante (media)', const_min: 'blanco constante (mínimo)' }[aj.blanco_metodo]} />}{ori === 'cubeta' && <Act on txt={`ventana lineal ${dc(exp.manual.vmin)}–${dc(exp.manual.vmax)}${exp.manual.excluirFuera ? ', se excluye lo de afuera' : ''}`} />}{ori !== 'cubeta' && <Act on={!!aj.camino_on} et="camino óptico" txt={aj.camino_on ? `camino óptico a 1 cm, ${dc(aj.pocillo_vol)} µL` : undefined} />}</>}>
            {ori === 'tecan' && ec(sub(T('OD'), T('c')), de_t(), O('='), T('OD'), de_t(), O('−'), barra('B'), de_t(), sep(), barra('B'), de_t(), O('='), fr(N('1'), v('m')), suma(R(v('j'), O('='), N('1')), v('m')), sub(v('B'), v('j')), de_t())}
            {ori === 'placas' && ec(sub(T('OD'), T('c')), de_t(), O('='), cor(v('L'), de_t(), O('−'), barra('B'), de_t()), O('·'), v('f'))}
            {ori === 'cubeta' && ec(sub(T('OD'), v('k')), O('='), par(sub(v('L'), v('k')), O('−'), v('B')), O('·'), sup(v('f'), v('k')), sep(), T('OD'), O('='), fr(N('1'), sub(v('n'), v('W'))), suma(R(v('k'), O('∈'), v('W'))), sub(T('OD'), v('k')))}
            {ori !== 'cubeta' && aj.camino_on && ec(v('ℓ'), O('='), fr(v('V'), R(v('π'), sup(v('d'), N('2')), O('/'), N('4'))), sep(), sub(T('OD'), R(N('1'), T('cm'))), O('='), fr(sub(T('OD'), T('c')), v('ℓ')))}
            <Simbolos items={[
              ori === 'tecan' && [en(barra('B'), de_t()), `media de los m pocillos de blanco en el tiempo t (sin los excluidos)`],
              ori === 'placas' && [en(v('L'), O(','), v('f')), 'lectura del pocillo y su factor de dilución; B̄(t): media de los blancos aceptados de la placa'],
              ori === 'cubeta' && [en(v('W')), `lecturas con OD neta dentro de la ventana lineal; f = ${dc(exp.manual.factor)}, B = ${exp.manual.yaCorregido ? '0 (ya restado)' : dc(Number(exp.manual.blanco) || 0)}`],
              ori !== 'cubeta' && aj.camino_on && [en(v('V'), O(','), v('d')), 'volumen y diámetro del pocillo'],
            ].filter(Boolean)} />
          </Paso>
        )}

        {od && ori !== 'placas' && (
          <Paso id="hampel" datos={['excluidos']} activo={<Act on={aj.hampel_on} et="Hampel" txt={`semiventana ${aj.hampel_k}, ${dc(aj.hampel_sigma)} × MAD, mínimo ${dc(aj.hampel_min)} OD, ${aj.hampel_accion === 'interpolar' ? 'interpolar' : 'excluir'}`} />}>
            {ec(T('marcado'), O('⇔'), abs(sub(y(), v('i')), O('−'), sub(tilde('y'), v('i'))), O('>'), T('máx'), par(v('k'), O('·'), N('1,4826'), O('·'), sub(T('MAD'), v('i')), O(','), v('Δ')))}
            <Simbolos items={[[en(sub(tilde('y'), v('i'))), 'mediana de la ventana centrada de 2h + 1 lecturas'], [en(sub(T('MAD'), v('i'))), 'mediana de |y − ỹᵢ| en la ventana'], [en(v('k'), O(','), v('Δ')), 'umbral y diferencia mínima']]} />
          </Paso>
        )}

        <Paso id="outliers" datos={['excluidos', 'qc', 'placas', 'ufc_rep']}
          activo={<>{od && ori !== 'placas' && <Act on={aj.dixon_on} et="OD: outliers" txt={`OD: ${atipTxt(aj.od_atip_metodo, aj.dixon_conf, aj.od_cvmax, aj.od_atip_auto === true)}${ori === 'tecan' ? ' (sobre el AUC de cada réplica)' : ''}`} />}{ori === 'placas' && <Act on txt={`placas: ${atipTxt(aj.pl_metodo, aj.pl_conf, aj.pl_cvmax, aj.pl_auto === true)}`} />}{ufc && <Act on={aj.ufc_dixon_on !== false} et="UFC: outliers" txt={`UFC: ${atipTxt(aj.ufc_atip_metodo, aj.ufc_dixon_conf, aj.ufc_cvmax, aj.ufc_auto === true)}`} />}</>}>
          <p className="met-nota">Entre las réplicas de una cepa en un mismo tiempo; se evalúa el valor más alejado. Dixon y Grubbs sobre log₁₀ en UFC; CV sobre los valores lineales.</p>
          {ec(T('Dixon'), O(':'), v('Q'), O('='), fr(abs(sub(v('x'), T('s')), O('−'), sub(v('x'), T('v'))), R(sub(v('x'), T('máx')), O('−'), sub(v('x'), T('mín')))), O('>'), sub(v('Q'), T('crít')), par(v('n'), O(','), T('conf')))}
          {ec(T('Grubbs'), O(':'), v('G'), O('='), fr(R(T('máx'), abs(xi(), O('−'), xb())), v('s')), O('>'), fr(R(v('n'), O('−'), N('1')), raiz(v('n'))), raiz(fr(sup(v('t'), N('2')), R(v('n'), O('−'), N('2'), O('+'), sup(v('t'), N('2'))))))}
          {ec(T('CV'), O('='), N('100'), O('·'), fr(v('s'), xb()), O('>'), T('límite'))}
          <Simbolos items={[[en(sub(v('x'), T('s')), O(','), sub(v('x'), T('v'))), 'valor sospechoso y su vecino más cercano'], [en(v('t')), 't de Student con n − 2 gl y probabilidad 1 − α/(2n)'], [en(v('s')), 'desviación estándar de las n réplicas']]} />
        </Paso>

        {od && ori !== 'placas' && (
          <Paso id="replicas" datos={['qc']} activo={<Act on txt={`factor ${dc(aj.pocillo_factor)}, mínimo ${dc(aj.pocillo_min)} OD, ΔAUC ${dc(aj.pocillo_div)} %`} />}>
            {ec(sub(v('d'), v('r')), O('='), fr(N('1'), v('T')), suma(v('t')), abs(sub(v('y'), v('r')), de_t(), O('−'), v('M'), de_t()), sep(), T('sospechosa'), O('⇔'), sub(v('d'), v('r')), O('>'), v('k'), O('·'), sub(tilde('d'), T('otras')), O('∧'), sub(v('d'), v('r')), O('>'), sub(v('d'), T('mín')))}
            {ec(T('con 2 réplicas'), O(':'), T('ΔAUC'), O('='), N('100'), O('·'), fr(abs(sub(T('AUC'), N('1')), O('−'), sub(T('AUC'), N('2'))), barra('AUC')))}
            <Simbolos items={[[en(v('M'), de_t()), 'mediana de las réplicas en el tiempo t'], [en(sub(tilde('d'), T('otras'))), 'mediana del desvío de las otras réplicas']]} />
          </Paso>
        )}

        <Paso id="media" datos={['od_tiempo', 'curva_cepa', 'ufc_res']} activo={<>{od && <Act on txt={`OD: ${errNom[o['curva.error'] || 'sd']}`} />}{ufc && <Act on txt={`UFC: ${errNom[aj.ufc_err || 'sd']}`} />}</>}>
          <p className="met-nota">El mismo cálculo para la OD y para las UFC/mL, siempre con los valores lineales de las réplicas.</p>
          {ec(xb(), O('='), fr(N('1'), v('n')), suma(R(v('i'), O('='), N('1')), v('n')), xi(), sep(), T('DE'), O('='), raiz(fr(R(suma(v('i')), sup(par(xi(), O('−'), xb()), N('2'))), R(v('n'), O('−'), N('1')))))}
          {ec(T('EEM'), O('='), fr(T('DE'), raiz(v('n'))), sep(), T('IC 95 %'), O('='), O('±'), sub(v('t'), R(N('0,975'), O(';'), v('n'), O('−'), N('1'))), O('·'), fr(T('DE'), raiz(v('n'))), sep(), T('log'), O(':'), log10(), xb(), sep(), cor(log10(), par(xb(), O('−'), v('e')), O(','), log10(), par(xb(), O('+'), v('e'))))}
          <Simbolos items={[[en(v('n')), 'réplicas en el análisis; EEM e IC 95 % solo con n ≥ 3'], [en(v('e')), 'error elegido (DE, EEM o IC 95 %)']]} />
        </Paso>

        {od && (
          <Paso id="mumax" datos={['parametros']} activo={<Act on txt={`ventana ${dc(op.ancho)} h, ≥ ${op.minpts} puntos, R² ≥ ${dc(op.r2min)}, OD ≥ ${dc(op.lnmin)}, cuota ${Math.round((cuotaDe(aj) || 0) * 100)} %, OD₀ ${op.od0_metodo === 'auto' ? 'tres fases' : `media de ${op.n_od0} puntos`}, lag ${op.lag_metodo === 'umbral' ? `umbral ${dc(op.lag_factor)} × OD₀` : 'tangente'}`} />}>
            {ec(ln(), T('OD'), de_t(), O('='), v('a'), O('+'), v('μ'), O('·'), v('t'), sep(), sub(v('μ'), T('máx')), O('='), T('máx'), sub(v('μ'), T('ventana')), sep(), T('EE'), par(v('μ')), O('='), abs(v('μ')), raiz(fr(R(N('1'), O('−'), sup(v('R'), N('2'))), R(sup(v('R'), N('2')), par(v('n'), O('−'), N('2'))))))}
            {ec(sub(v('t'), v('d')), O('='), fr(R(ln(), N('2')), sub(v('μ'), T('máx'))), sep(), v('λ'), O('='), fr(R(ln(), sub(T('OD'), N('0')), O('−'), v('a')), sub(v('μ'), T('máx'))), sep(), T('generaciones'), O('='), sub(T('log'), N('2')), fr(v('K'), sub(T('OD'), N('0'))))}
            <Simbolos items={[[en(v('a'), O(','), v('μ')), 'recta de ln OD en la ventana de mayor pendiente, ampliada con las vecinas de pendiente ≥ cuota · μmáx'], [en(sub(T('OD'), N('0'))), op.od0_metodo === 'auto' ? 'meseta inicial de un modelo de tres fases sobre ln OD (Buchanan et al., 1997)' : `media de las primeras ${op.n_od0} lecturas`], [en(v('K')), 'OD máxima de la curva suavizada con mediana móvil de 3']]} />
          </Paso>
        )}

        <Paso id="modelos" datos={['od_modelo', 'ufc_crec']} activo={<>{od && <Act on={modOd === 'baranyi' || modOd === 'huang'} et={`OD: ${nomMod[modOd]}`} txt={`OD: ${nomMod[modOd]}${o['curva.ajusteRep'] ? ', por réplica' : ', por cepa'}${o['curva.lagfijo'] !== '' && o['curva.lagfijo'] !== undefined ? `, λ = ${dc(o['curva.lagfijo'])} h` : ''}${Number(o['curva.nmax']) > 0 ? `, OD máx = ${dc(o['curva.nmax'])}` : ''}${modOd === 'baranyi' ? `, m = ${dc(o['curva.mcurv'] ?? 1)}` : ''}`} />}{ufc && <Act on={modU !== 'lineal'} et={`UFC: ${nomMod[modU]}`} txt={`UFC: ${nomMod[modU]}${modU === 'baranyi' ? `, m = ${dc(aj.ufc_mcurv ?? 1)}` : ''}`} />}<Act on txt={`fases: μ ≥ ${Math.round(fraccionExp(aj) * 100)} % de μmáx`} /></>}>
          <p className="met-nota">Ajuste no lineal por mínimos cuadrados (Levenberg–Marquardt, varios puntos de partida) sobre y = ln OD o y = ln N. Por cepa: la media de las réplicas en cada tiempo (en OD, medias ≥ {dc(op.lnmin)}); por réplica (solo OD): sus lecturas. Con todos los tiempos.</p>
          {ec(T('Baranyi'), O(':'), y(), de_t(), O('='), sub(y(), N('0')), O('+'), v('μ'), v('A'), de_t(), O('−'), fr(N('1'), v('m')), ln(), cor(N('1'), O('+'), fr(R(ex(v('m'), v('μ'), v('A'), de_t()), O('−'), N('1')), ex(v('m'), par(sub(y(), T('máx')), O('−'), sub(y(), N('0')))))))}
          {ec(v('A'), de_t(), O('='), v('t'), O('+'), fr(N('1'), v('μ')), ln(), par(ex(O('−'), v('μ'), v('t')), O('+'), ex(O('−'), sub(v('h'), N('0'))), O('−'), ex(O('−'), v('μ'), v('t'), O('−'), sub(v('h'), N('0')))), sep(), v('λ'), O('='), fr(sub(v('h'), N('0')), v('μ')))}
          {ec(T('Huang'), O(':'), y(), de_t(), O('='), sub(y(), N('0')), O('+'), sub(y(), T('máx')), O('−'), ln(), cor(ex(sub(y(), N('0'))), O('+'), par(ex(sub(y(), T('máx'))), O('−'), ex(sub(y(), N('0')))), ex(O('−'), v('μ'), v('B'), de_t())))}
          {ec(v('B'), de_t(), O('='), v('t'), O('+'), fr(N('1'), v('α')), ln(), fr(R(N('1'), O('+'), ex(O('−'), v('α'), par(v('t'), O('−'), v('λ')))), R(N('1'), O('+'), ex(v('α'), v('λ')))), sep(), v('α'), O('='), N('4'))}
          {ec(T('Cov'), O('='), sup(v('s'), N('2')), sup(par(sup(v('J'), T('T')), v('J')), R(O('−'), N('1'))), sep(), sup(sub(v('R'), T('aj')), N('2')), O('='), N('1'), O('−'), par(N('1'), O('−'), sup(v('R'), N('2'))), fr(R(v('n'), O('−'), N('1')), R(v('n'), O('−'), v('p'))), sep(), T('fase exponencial'), O('⇔'), fr(N('1'), v('μ')), fr(R(v('d'), v('y')), R(v('d'), v('t'))), O('≥'), v('f'))}
          <Simbolos items={[[en(v('m')), 'curvatura hacia la meseta (1: forma habitual)'], [en(sup(v('s'), N('2'))), 'SCE / (n − p); EE de λ por el método delta'], [en(v('f')), 'fracción de μmáx que define la fase exponencial'], [en(T('variantes')), 'λ = 0 → sin lag; asíntota sin límite → sin meseta (como DMFit)']]} />
        </Paso>

        {od && (
          <Paso id="resumen" datos={['resumen', 'od_modelo']} activo={<Act on txt={s.porCepa ? 'una curva por cepa (EE de la pendiente)' : `media ± DE de las réplicas ${replicaOd(exp.origenOd).tipo}`} />}>
            {ec(barra('μ'), O('±'), T('DE'), sep(), sub(v('t'), v('d')), O('='), fr(R(ln(), N('2')), barra('μ')), sep(), T('DE'), par(sub(v('t'), v('d'))), O('='), sub(v('t'), v('d')), fr(T('DE'), barra('μ')))}
            <Simbolos items={[[en(T('IC 95 %')), 'como en el paso de la media (n ≥ 3); R²: el mínimo de las réplicas']]} />
          </Paso>
        )}

        {ufc && (
          <Paso id="ufc" datos={['ufc_rep']} activo={<Act on txt={`${exp.ufc.vol} µL sembrados, contable ${exp.ufc.min}–${exp.ufc.max} colonias, factor ${dc(Number(Number(exp.ufc.factor).toPrecision(4)))}${exp.ufc.estimados !== false ? ', con estimados' : ''}`} />}>
            {ec(v('N'), O('='), fr(R(v('C'), O('·'), sub(v('D'), v('k'))), v('V')), sep(), sub(v('D'), v('k')), O('='), prod(R(v('i'), O('='), N('1')), v('k')), sub(v('f'), v('i')), sep(), sub(v('f'), v('i')), O('='), fr(R(sub(v('v'), T('t')), O('+'), sub(v('v'), T('d'))), sub(v('v'), T('t'))))}
            <Simbolos items={[[en(v('C')), 'colonias en la dilución usada (una por cepa y tiempo, la misma para todas las réplicas)'], [en(v('V')), 'volumen sembrado (mL)'], [en(N('0'), T(' colonias')), 'N = 0; límite de detección 3 / V']]} />
          </Paso>
        )}

        {ufc && (
          <Paso id="ufccrec" datos={['ufc_crec', 'ufc_pred']} activo={<Act on txt={nomMod[modU]} />}>
            {ec(T('velocidad'), O('='), fr(v('μ'), R(ln(), N('10'))), sep(), T('aumento'), O('='), log10(), v('N'), par(sub(v('t'), T('fin'))), O('−'), log10(), v('N'), par(sub(v('t'), N('0'))), sep(), T('generaciones'), O('='), fr(T('aumento'), R(log10(), N('2'))))}
            <Simbolos items={[[en(v('μ')), 'del modelo del paso de modelos, ajustado a ln N de la media de cada tiempo (como DMFit)']]} />
          </Paso>
        )}

        {comb && (
          <Paso id="calib" datos={['pares', 'calibracion']} activo={<Act on txt={o['combinado.soloExp'] !== false ? 'pares de la fase exponencial común a OD y UFC' : 'todos los pares'} />}>
            {ec(log10(), v('N'), O('='), v('m'), O('·'), T('OD'), O('+'), v('b'), sep(), v('m'), O('='), fr(sub(v('S'), R(v('x'), v('y'))), sub(v('S'), R(v('x'), v('x')))), sep(), v('b'), O('='), barra('y'), O('−'), v('m'), xb(), sep(), v('σ'), O('='), raiz(fr(T('SCE'), R(v('n'), O('−'), N('2')))))}
            {ec(T('IP 95 %'), O(':'), log10(), sub(v('N'), N('0')), O('±'), sub(v('t'), R(N('0,975'), O(';'), v('n'), O('−'), N('2'))), v('σ'), raiz(N('1'), O('+'), fr(N('1'), v('n')), O('+'), fr(sup(par(sub(v('x'), N('0')), O('−'), xb()), N('2')), sub(v('S'), R(v('x'), v('x'))))), sep(), T('OD'), O('='), fr(R(log10(), v('N'), O('−'), v('b')), v('m')))}
            <Simbolos items={[[en(v('x'), O(','), v('y')), 'OD media de la cepa y log₁₀ UFC/mL en el mismo tiempo (OD interpolada linealmente si no hubo lectura)'], [en(v('σ')), 'error típico en log₁₀'], [en(v('n')), 'pares: mínimo 2 para la recta; el error y el intervalo de predicción necesitan 3 (se recomiendan 5 o más)']]} />
          </Paso>
        )}

        {comb && (
          <Paso id="comparacion" datos={['comparacion']} activo={<Act on txt={`OD: ${modOd === 'baranyi' || modOd === 'huang' ? nomMod[modOd] : 'ventana de ln(OD)'} · UFC: ${nomMod[modU]}`} />}>
            {ec(T('cociente'), O('='), fr(sub(v('μ'), T('OD')), sub(v('μ'), T('UFC'))))}
            <Simbolos items={[[en(sub(v('μ'), T('OD'))), modOd === 'baranyi' || modOd === 'huang' ? `μ del modelo ${nomMod[modOd]} de la OD (paso de modelos); la de la ventana solo si el modelo no ajusta` : 'μmáx de la ventana de ln OD (paso μmax)'], [en(sub(v('μ'), T('UFC'))), `μ de ${nomMod[modU]} sobre los recuentos; cociente descriptivo, sin prueba estadística. Es la misma μ del Resumen, de OD ↔ UFC y de Datos`]]} />
          </Paso>
        )}

        <Paso id="limites">
          <ul className="met-lista">
            <li>Los filtros automáticos no distinguen un error de un fenómeno biológico: revisar cada punto marcado.</li>
            <li>{!od ? 'Réplicas técnicas' : exp.origenOd === 'cubeta' ? 'Réplicas biológicas (cultivos independientes)' : 'Réplicas técnicas (pocillos)'} de un solo experimento; la variabilidad entre experimentos suele ser mayor.</li>
            {od && <li>λ es el parámetro menos robusto (depende de OD₀ y del tramo); K depende del equipo y de la linealidad.</li>}
            {ufc && <li>Los recuentos estimados fuera del rango contable o cerca del límite de detección tienen errores grandes.</li>}
            {comb && <li>La calibración vale dentro del rango de OD de los pares usados; fuera de él es una extrapolación.</li>}
          </ul>
        </Paso>

        <Paso id="texto">
          <p className="met-informe">{texto}</p>
        </Paso>

        <Paso id="refs">
          <ul className="met-refs">
            <li>Baranyi J, Roberts TA (1994). A dynamic approach to predicting bacterial growth in food. Int J Food Microbiol 23:277–294.</li>
            <li>Huang L (2008). Growth kinetics of Listeria monocytogenes in broth and beef frankfurters: determination of lag phase duration and exponential growth rate under isothermal conditions. J Food Sci 73:E235–E242.</li>
            <li>Buchanan RL, Whiting RC, Damert WC (1997). When is simple good enough: a comparison of the Gompertz, Baranyi, and three-phase linear models for fitting bacterial growth curves. Food Microbiol 14:313–326.</li>
            <li>Hall BG, Acar H, Nandipati A, Barlow M (2014). Growth rates made easy. Mol Biol Evol 31:232–238.</li>
            <li>Hampel FR (1974). The influence curve and its role in robust estimation. J Am Stat Assoc 69:383–393.</li>
            <li>Dixon WJ (1950). Analysis of extreme values. Ann Math Stat 21:488–506 · Rorabacher DB (1991). Anal Chem 63:139–146.</li>
            <li>Grubbs FE (1969). Procedures for detecting outlying observations in samples. Technometrics 11:1–21.</li>
            <li>Herigstad B, Hamilton M, Heersink J (2001). How to optimize the drop plate method for enumerating bacteria. J Microbiol Methods 44:121–129.</li>
            <li>Maturin L, Peeler JT (2001). Aerobic plate count. En: Bacteriological Analytical Manual, cap. 3. US Food and Drug Administration (rango contable 25–250 colonias).</li>
            <li>ISO 7218:2007/Amd 1:2013. Microbiology of food and animal feeding stuffs — General requirements and guidance for microbiological examinations.</li>
            <li>Zar JH (2010). Biostatistical Analysis, 5.ª ed. Pearson (regresión lineal, intervalos con t de Student).</li>
          </ul>
        </Paso>
      </div>
    </div>
  )
}
