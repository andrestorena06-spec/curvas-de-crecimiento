// «Modelo» de la OD: el componente común (ui/modeloCinta.jsx) con las claves de la OD, guardadas en las opciones del experimento
// (curva.modelo, curva.lagfijo, curva.mcurv, curva.nmax, curva.pred). Va en Curva OD y en la Revisión de la OD (como en las UFC).
import { useOpcion } from '../../ui/opciones.js'
import { GrupoModelo } from '../../ui/modeloCinta.jsx'

export function useModeloOd() {
  const [modelo, setModelo] = useOpcion('curva.modelo', 'baranyi')
  const [lag, setLag] = useOpcion('curva.lagfijo', '')       // lag fijo (h) de Baranyi y Roberts / Huang
  const [mcurv, setMcurv] = useOpcion('curva.mcurv', 1)      // curvatura m de Baranyi y Roberts
  const [nmax, setNmax] = useOpcion('curva.nmax', '')        // OD máx fijada (vacío: la estima el ajuste)
  const [pred, setPred] = useOpcion('curva.pred', { on: false, hasta: '' })
  return { modelo, setModelo, lag, setLag, mcurv, setMcurv, nmax, setNmax, pred, setPred }
}

// sinCurva: en la Revisión no se ofrece «Sin curva» (como en la Revisión de los recuentos); botonFases: el botón «Fases» de la curva
export function GrupoModeloOd({ s, sinCurva = true, prediccion = true, botonFases = null }) {
  const o = useModeloOd()
  return (
    <GrupoModelo etqNmax="OD máx" etqObjetivo="OD objetivo" sinCurva={sinCurva} prediccion={prediccion} botonFases={botonFases}
      v={{ modelo: !sinCurva && o.modelo === 'no' ? 'baranyi' : o.modelo, lag: o.lag, mcurv: o.mcurv, nmax: o.nmax, frac: s.exp.aj.ufc_frac_exp ?? 0.5, pred: o.pred }}
      set={{ modelo: o.setModelo, lag: (x) => o.setLag(x === '' ? '' : x), mcurv: o.setMcurv, nmax: o.setNmax, frac: (x) => s.setAj('ufc_frac_exp', x), pred: (k, x) => o.setPred({ ...o.pred, [k]: x }) }} />
  )
}
