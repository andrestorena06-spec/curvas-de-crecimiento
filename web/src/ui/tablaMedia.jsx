// ============================================================
// Tabla «valor por cepa y tiempo»: la MISMA para la OD y para las UFC/mL (solo cambia la magnitud).
// Cada fila es la media aritmética de las réplicas de una cepa en un tiempo, con valores LINEALES, su error (DE, EEM o
// IC 95 %) y su rango; en log₁₀: el log₁₀ de esa media y el log₁₀ de los extremos del rango.
// Cada número abre SOLO su cuenta: ficha(fila, foco) con foco 'media' | 'error' | 'rango' | 'log' | 'rangolog'.
// ============================================================
import { finito } from '../motor/analisis.js'
import { fx } from '../utils.js'
import { Valor } from '../fichas/FichaCalculo.jsx'

const L = (x) => (finito(x) && x > 0 ? Math.log10(x) : NaN)
const fl = (x) => (finito(x) ? fx(x, 3) : '–')

// filas: [{ clave, cepa, color, t (h), n, m, e }] con m y e en la magnitud (OD o UFC/mL); fmt: formato de la magnitud
export function TablaMediaTiempo({ titulo, filas, unidad, etqErr, fmt, ficha, nota }) {
  const c = (f, foco, txt) => <Valor f={() => ficha(f, foco)}>{txt}</Valor>
  return (
    <div className="tarjeta">
      <h2>{titulo} <span className="ayuda" style={{ fontWeight: 400 }}>· clic en un valor: cómo se calculó</span></h2>
      <div className="tabla-scroll"><table className="tabla">
        <thead><tr>
          <th>Cepa</th><th className="num">t (h)</th>
          <th className="num" data-tip="Réplicas que entran en la media de ese tiempo">Réplicas</th>
          <th className="num" data-tip={`Media aritmética de ${unidad} de las réplicas`}>Media ({unidad})</th>
          <th className="num" data-tip={`${etqErr} de ${unidad} de las réplicas (se elige en Revisión › Tipo de error)\nEEM e IC 95 % solo con 3 o más réplicas`}>{etqErr} ({unidad})</th>
          <th className="num" data-tip="Media − error a media + error">Rango ({unidad})</th>
          <th className="num" data-tip="log₁₀ de la media (lo que se grafica en escala log₁₀)">log₁₀ media</th>
          <th className="num" data-tip="log₁₀(media − error) a log₁₀(media + error): la misma barra, con el eje en log₁₀">Rango log₁₀</th>
        </tr></thead>
        <tbody>{filas.map((f) => {
          const ok = finito(f.e)
          return (
            <tr key={f.clave}>
              <td><i className="punto" style={{ background: f.color, marginRight: 6 }} />{f.cepa}</td>
              <td className="num">{fx(f.t, 2)}</td>
              <td className="num" data-tip={f.n < 3 ? 'Con menos de 3 réplicas el error tiene poca base' : undefined}>{f.n}</td>
              <td className="num"><b>{c(f, 'media', fmt(f.m))}</b></td>
              <td className="num">{ok ? c(f, 'error', `± ${fmt(f.e)}`) : f.n > 1 ? 'n < 3' : '–'}</td>
              <td className="num">{ok ? c(f, 'rango', `${fmt(f.m - f.e)} – ${fmt(f.m + f.e)}`) : '–'}</td>
              <td className="num">{c(f, 'log', fl(L(f.m)))}</td>
              <td className="num">{ok ? c(f, 'rangolog', `${fl(L(f.m - f.e))} – ${fl(L(f.m + f.e))}`) : '–'}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
      {nota && <p className="ayuda" style={{ marginTop: 8 }}>{nota}</p>}
    </div>
  )
}
