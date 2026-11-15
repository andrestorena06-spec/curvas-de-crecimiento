// «Modelo»: los MISMOS grupos de la cinta para la OD y para las UFC (Curva OD, Curva UFC y las dos Revisiones), desplegados:
//   Modelo (un botón que abre la elección: Sin curva · Linealizar log₁₀ · Baranyi y Roberts · Huang; al lado, el lag fijo) · Baranyi y Roberts / Huang (m y N máx)
//   · Fases (fracción de μ máx y, en las curvas, el botón que las muestra) · Predicción.
// Cada pantalla pasa sus valores y cómo guardarlos (la OD y las UFC se guardan aparte).
import { Num } from './base.jsx'
import { BotonCinta, CampoCinta, Grupo, MenuCinta, OpcionesCinta, SeccionMenu } from './cinta.jsx'

export const OPCIONES_MODELO = [
  ['no', 'Sin curva', '·', null, 'Solo los puntos, sin la curva del modelo'],
  ['lineal', 'Linealizar log₁₀', '⟋', null, 'Recta de ln N contra t en la fase exponencial (la ventana de mayor pendiente)'],
  ['baranyi', 'Baranyi y Roberts', '∫', null, 'Lag, fase exponencial y asíntota, ajustado a todos los tiempos (4 o más)'],
  ['huang', 'Huang', 'H', null, 'Lag, fase exponencial y asíntota; el lag λ es un parámetro directo (4 o más tiempos)'],
]
const NOMBRE = Object.fromEntries(OPCIONES_MODELO.map(([v, t]) => [v, t]))
const ICONO = { no: 'sinCurva', lineal: 'recta', baranyi: 'baranyi', huang: 'huang' }

// v: { modelo, lag, mcurv, nmax, frac, pred: { on, hasta, objetivo } }; set: { modelo, lag, mcurv, nmax, frac, pred(k, valor) }
// sinCurva: ofrecer «Sin curva»; botonFases: el botón «Fases» de la pantalla (va en el grupo Fases); etqNmax / etqObjetivo: unidades
export function GrupoModelo({ v, set, sinCurva = true, botonFases = null, etqNmax = 'N máx (log₁₀)', etqObjetivo = 'Objetivo (log₁₀)', prediccion = true }) {
  const m = NOMBRE[v.modelo] ? v.modelo : 'baranyi'
  const conModelo = m === 'baranyi' || m === 'huang'
  const mc = Number(v.mcurv) > 0 ? Number(v.mcurv) : 1
  const pred = v.pred || {}
  return (<>
    <Grupo titulo="Modelo">
      <MenuCinta icono={ICONO[m]} texto={NOMBRE[m]} activo={m !== 'no'} ancho={520} tip={'Modelo de ajuste\nElegí el modelo; sus opciones aparecen al lado'}>
        <SeccionMenu titulo="Modelo de ajuste"><OpcionesCinta valor={m} onChange={set.modelo} opciones={sinCurva ? OPCIONES_MODELO : OPCIONES_MODELO.filter(([x]) => x !== 'no')} /></SeccionMenu>
      </MenuCinta>
      {conModelo && <CampoCinta etiqueta="Lag fijo (h)" tip={'Fijar el lag λ (horas) en el ajuste: estabiliza μ cuando hay pocos puntos\nVacío: lo estima el ajuste'}><Num value={v.lag ?? ''} onChange={(x) => set.lag(x === '' ? '' : x)} ancho={52} /></CampoCinta>}
    </Grupo>
    {conModelo && (
      <Grupo titulo={NOMBRE[m]}>
        {m === 'baranyi' && <OpcionesCinta valor={mc === 1 ? '1' : mc === 10 ? '10' : ''} onChange={(x) => set.mcurv(Number(x))} opciones={[
          ['1', 'm = 1', 'm₁', null, 'Curvatura hacia la meseta m = 1 (forma habitual; por defecto)'],
          ['10', 'm = 10', 'm₁₀', null, 'Curvatura m = 10: transición más brusca a la fase estacionaria'],
        ]} />}
        {m === 'baranyi' && <CampoCinta etiqueta="m" tip="Curvatura hacia la meseta (otro valor, > 0)"><Num value={mc} onChange={(x) => { if (x === '' || x > 0) set.mcurv(x === '' ? 1 : x) }} ancho={52} /></CampoCinta>}
        <CampoCinta etiqueta={etqNmax} tip={'Nivel de la fase estacionaria fijado (por ejemplo, el de otros ensayos en el mismo medio)\nVacío: lo estima el ajuste'}><Num value={v.nmax ?? ''} onChange={set.nmax} ancho={64} placeholder="auto" /></CampoCinta>
      </Grupo>
    )}
    {(conModelo || botonFases) && (
      <Grupo titulo="Fases">
        {conModelo && <CampoCinta etiqueta="Fracción de μ máx" tip={'Con Baranyi y Roberts o Huang las fases las fija el modelo:\nexponencial = velocidad ≥ esta fracción de μ máx (0 a 1; por defecto 0,5)'}><Num value={v.frac ?? 0.5} onChange={set.frac} ancho={52} /></CampoCinta>}
        {botonFases}
      </Grupo>
    )}
    {conModelo && prediccion && (
      <Grupo titulo="Predicción">
        <BotonCinta simbolo="⇢" texto="Predecir" activo={!!pred.on} onClick={() => set.pred('on', !pred.on)} tip={`Extiende el ajuste de ${NOMBRE[m]} de cada cepa\nmás allá del último tiempo (línea a trazos)`} />
        {pred.on && <CampoCinta etiqueta="Hasta (h)" tip="Horizonte de la predicción en horas (vacío = 24 h)"><Num value={pred.hasta ?? ''} placeholder="24" onChange={(x) => set.pred('hasta', x)} ancho={52} /></CampoCinta>}
        {pred.on && 'objetivo' in pred && <CampoCinta etiqueta={etqObjetivo} tip="Nivel para calcular en cuánto tiempo se alcanza"><Num value={pred.objetivo} onChange={(x) => set.pred('objetivo', x)} ancho={58} placeholder="–" /></CampoCinta>}
      </Grupo>
    )}
  </>)
}
