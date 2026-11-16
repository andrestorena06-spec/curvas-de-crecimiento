// ============================================================
// «Mostrar»: el MISMO botón de la cinta en todos los gráficos con datos (siempre el primero); abre un menú con:
//   Puntos          el valor de cada tiempo (media de las réplicas)
//   Réplicas        cada réplica (pocillo, serie o recuento) como un punto
//   Barras de error la barra o banda de error
//   Valor           el valor numérico escrito sobre cada punto
//   Error           el error escrito sobre cada punto (solo, o junto al valor si «Valor» está prendido)
// (más «Blanco» donde hay curva de blanco). Lo elegido se guarda en el experimento, por gráfico.
// ============================================================
import { BotonCinta, Grupo, MenuCinta, OpcionesCinta, SeccionMenu } from './cinta.jsx'
import { ERRORES_UFC } from '../calculo/ufc/index.js'
import { useOpcion } from './opciones.js'

export const MOSTRAR_DEF = { puntos: true, replicas: false, barras: true, valor: false, error: false, blanco: false }

export function useMostrar(id, def = {}) {
  const base = { ...MOSTRAR_DEF, ...def }
  const [guardado, guardar] = useOpcion('mostrar.' + id, base)
  const m = { ...base, ...(guardado || {}) }
  return [m, (k, v) => guardar({ ...m, [k]: v })]
}

// texto sobre un punto según lo prendido: valor, error, o los dos juntos (valorTxt y errTxt ya formateados; errTxt sin «±»)
export function textoMostrar(m, valorTxt, errTxt) {
  const e = errTxt ? String(errTxt) : ''
  if (m.valor && m.error && e) return `${valorTxt} ${e}`
  if (m.valor) return valorTxt
  if (m.error && e) return e
  return ''
}
export const conEtiquetas = (m) => !!(m.valor || m.error)

export function GrupoMostrar({ m, set, blanco = false, sinReplicas = false, notas = {} }) {
  const B = (k, simbolo, texto, tip) => <BotonCinta key={k} simbolo={simbolo} texto={texto} activo={!!m[k]} onClick={() => set(k, !m[k])} tip={notas[k] || tip} />
  return (
    <Grupo titulo="Ver"><MenuCinta icono="ojo" texto="Mostrar" tip="Elementos del gráfico" ancho={430}><SeccionMenu titulo="Mostrar">
      {B('puntos', '•', 'Puntos', 'El valor de cada tiempo (media de las réplicas)')}
      {!sinReplicas && B('replicas', '⋮⋮', 'Réplicas', 'Cada réplica (pocillo, serie o recuento) como un punto')}
      {B('barras', '±', 'Barras de error', 'Barra o banda de error de cada punto')}
      {B('valor', '12', 'Valor', 'Escribir el valor sobre cada punto')}
      {B('error', '±12', 'Error', 'Escribir el error sobre cada punto (junto al valor si «Valor» está prendido)')}
      {blanco && B('blanco', 'B', 'Blanco', 'La curva del blanco: la OD leída del medio sin inocular, antes de restarla')}
    </SeccionMenu></MenuCinta></Grupo>
  )
}

// «Incertidumbre»: el MISMO botón en todos los gráficos de OD y de UFC; abre la elección del tipo de error (DE, EEM o IC 95 %).
// Es un solo valor por magnitud: el de la OD se guarda en 'curva.error' y el de las UFC en aj.ufc_err; se puede cambiar desde cualquier pantalla.
export function GrupoTipoError({ valor, onChange, nota = '' }) {
  const t = ERRORES_UFC[valor] ? valor : 'sd'
  return (
    <Grupo titulo="Incertidumbre"><MenuCinta icono={{ sd: 'de', sem: 'eem', ic95: 'ic' }[t]} texto={ERRORES_UFC[t]} ancho={300} tip={'Incertidumbre\nTipo de error de las barras'}><SeccionMenu titulo="Tipo de error">
      <OpcionesCinta valor={valor} onChange={onChange} opciones={[
        ['sd', 'DE', 's', null, 'Desviación estándar\nCuánto se dispersan las réplicas entre sí' + nota],
        ['sem', 'EEM', 's/√n', null, 'Error estándar de la media = DE / √n\nIncertidumbre de la media' + nota],
        ['ic95', 'IC 95 %', 'IC', null, 'Intervalo de confianza del 95 %\nmedia ± t(0,975; n − 1) × DE / √n' + nota],
      ]} />
    </SeccionMenu></MenuCinta></Grupo>
  )
}
