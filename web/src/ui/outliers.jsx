// «Outliers»: el MISMO grupo de la cinta en las tres revisiones (OD, placas por tiempo y recuentos).
// Un botón abre el menú con: método (Ninguno, Dixon, Grubbs, CV %) · confianza o límite de CV · sospechosos (solo marcar o excluir),
// lo que la pantalla agregue (children) y, si se pasa, «Restablecer» las decisiones manuales. Cada pantalla le pasa sus valores y cómo guardarlos.
import { METODOS_ATIPICOS } from '../calculo/comun/atipicos.js'
import { Campo, Num } from './base.jsx'
import { BotonCinta, Grupo, MenuCinta, OpcionesCinta, SeccionMenu } from './cinta.jsx'

const NOMBRE = { no: 'Ninguno', q: 'Dixon', grubbs: 'Grubbs', cv: 'CV %' }
const ICONO = { no: 'puntos', q: 'dixon', grubbs: 'grubbs', cv: 'cv' }

// v: { metodo ('no' | 'q' | 'grubbs' | 'cv'), conf, cvmax, auto }; set: { metodo, conf, cvmax, auto } (funciones)
// sobre: texto que se agrega al globo de cada método (sobre qué valores se aplica); restablecer: borra las decisiones manuales
export function GrupoOutliers({ v, set, sobre = '', restablecer, children }) {
  const m = NOMBRE[v.metodo] ? v.metodo : 'q'
  return (
    <Grupo titulo="Outliers">
      <MenuCinta icono={ICONO[m]} texto={NOMBRE[m]} activo={m !== 'no'} ancho={470} tip={'Outliers entre réplicas\nMétodo, confianza y qué hacer con los sospechosos'}>
        <SeccionMenu titulo="Método">
          <OpcionesCinta valor={m} onChange={set.metodo} opciones={[
            ['no', 'Ninguno', '·', null, 'No comparar las réplicas entre sí'],
            ['q', 'Dixon', 'Q', null, METODOS_ATIPICOS.q + sobre],
            ['grubbs', 'Grubbs', 'G', null, METODOS_ATIPICOS.grubbs + sobre],
            ['cv', 'CV %', 'CV', null, METODOS_ATIPICOS.cv + sobre],
          ]} />
        </SeccionMenu>
        {m !== 'no' && (
          <div className="menu-cinta-columnas">
            {m === 'cv'
              ? <SeccionMenu titulo="Límite"><Campo label="CV máximo (%)"><Num value={v.cvmax ?? 20} onChange={set.cvmax} ancho={70} /></Campo></SeccionMenu>
              : <SeccionMenu titulo="Confianza"><OpcionesCinta valor={String(v.conf || 95)} onChange={(x) => set.conf(Number(x))} opciones={[['90', '90 %', '90', null, 'Confianza 90 %'], ['95', '95 %', '95', null, 'Confianza 95 %'], ['99', '99 %', '99', null, 'Confianza 99 %']]} /></SeccionMenu>}
            <SeccionMenu titulo="Sospechosos">
              <OpcionesCinta valor={v.auto ? 'si' : 'no'} onChange={(x) => set.auto(x === 'si')} opciones={[['no', 'Solo marcar', '◯', null, 'Marcar con un anillo; siguen en el análisis'], ['si', 'Excluir', '⛔', null, 'Excluir los sospechosos']]} />
            </SeccionMenu>
          </div>
        )}
        {children}
        {restablecer && <SeccionMenu titulo="Decisiones manuales"><BotonCinta icono="refrescar" texto="Restablecer" onClick={restablecer} tip="Borra las exclusiones y reincorporaciones hechas a mano" /></SeccionMenu>}
      </MenuCinta>
    </Grupo>
  )
}
