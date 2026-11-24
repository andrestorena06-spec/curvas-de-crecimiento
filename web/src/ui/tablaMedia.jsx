// ============================================================
// Tabla «valor por cepa y tiempo»: la MISMA para la OD y para las UFC/mL (solo cambia la magnitud).
// Cada fila es la media aritmética de las réplicas de una cepa en un tiempo, con valores LINEALES, su error (DE, EEM o
// IC 95 %) y su rango; en log₁₀: el log₁₀ de esa media y el log₁₀ de los extremos del rango.
// Cada número abre SOLO su cuenta: ficha(fila, foco) con foco 'media' | 'error' | 'rango' | 'log' | 'rangolog'.
// ============================================================
import { finito } from '../calculo/comun/analisis.js'
import { fx, parCientifico, porPotencia } from '../comun/utils.js'
import { Valor } from '../fichas/FichaCalculo.jsx'

const L = (x) => (finito(x) && x > 0 ? Math.log10(x) : NaN)
const fl = (x) => (finito(x) ? fx(x, 3) : '–')

// filas: [{ clave, cepa, color, t (h), n, m, e }] con m y e en la magnitud (OD o UFC/mL); fmt: formato del valor sin error.
// cientifico: valor, error y rango con la potencia de 10 del valor (UFC/mL); sin él, sin potencia (OD). En los dos casos
// el valor y el error llevan los mismos decimales: los que dejan el error con 2 cifras significativas.
export function TablaMediaTiempo({ titulo, filas, unidad, etqErr, fmt, ficha, nota, cientifico = false }) {
  const par = (f) => {
    if (cientifico) return parCientifico(f.m, f.e)
    const p = parCientifico(f.m, f.e)   // mismos decimales, sin potencia
    return finito(p.d) ? { v: fx(f.m, p.d + Math.max(0, -p.pot)), e: fx(f.e, p.d + Math.max(0, -p.pot)), pot: 0, d: p.d + Math.max(0, -p.pot) } : { v: fmt(f.m), e: '', pot: 0, d: NaN }
  }
  const enPar = (p, x) => fx(x / 10 ** p.pot, p.d)
  const c = (f, foco, txt) => <Valor f={() => ficha(f, foco)}>{txt}</Valor>
  return (
    <div className="tarjeta">
      <h2>{titulo}</h2>
      <div className="tabla-scroll"><table className="tabla">
        <thead><tr>
          <th>Cepa</th><th className="num">t (h)</th>
          <th className="num" data-tip="Réplicas que entran en la media de ese tiempo">Réplicas</th>
          <th className="num" data-tip={`Media aritmética de ${unidad} de las réplicas`}>Media ({unidad})</th>
          <th className="num" data-tip={`${etqErr} de ${unidad} de las réplicas (se elige en Revisión › Tipo de error)\nEEM e IC 95 % solo con 3 o más réplicas`}>{etqErr} ({unidad})</th>
          <th className="num" data-tip="Media − error a media + error">Rango ({unidad})</th>
          <th className="num" data-tip="log₁₀ de la media (lo que se grafica en escala log₁₀)">log₁₀ media</th>
          <th className="num" data-tip={'log₁₀(media − error) a log₁₀(media + error): la misma barra, con el eje en log₁₀\n«≤»: media − error ≤ 0, sin límite inferior en log₁₀'}>Rango log₁₀</th>
        </tr></thead>
        <tbody>{filas.map((f) => {
          const ok = finito(f.e)
          const p = par(f)
          return (
            <tr key={f.clave}>
              <td><i className="punto" style={{ background: f.color, marginRight: 6 }} />{f.cepa}</td>
              <td className="num">{fx(f.t, 2)}</td>
              <td className="num" data-tip={f.n < 3 ? 'Con menos de 3 réplicas el error tiene poca base' : undefined}>{f.n}</td>
              <td className="num"><b>{c(f, 'media', ok && p.e ? porPotencia(p.v, p.pot) : fmt(f.m))}</b></td>
              <td className="num">{ok && p.e ? c(f, 'error', porPotencia(`± ${p.e}`, p.pot)) : f.n > 1 ? 'n < 3' : '–'}</td>
              <td className="num">{ok && p.e ? c(f, 'rango', porPotencia(p.pot ? `(${enPar(p, f.m - f.e)} – ${enPar(p, f.m + f.e)})` : `${enPar(p, f.m - f.e)} – ${enPar(p, f.m + f.e)}`, p.pot)) : '–'}</td>
              <td className="num">{c(f, 'log', fl(L(f.m)))}</td>
              <td className="num">{ok ? c(f, 'rangolog', finito(L(f.m - f.e)) ? `${fl(L(f.m - f.e))} – ${fl(L(f.m + f.e))}` : finito(L(f.m + f.e)) ? `≤ ${fl(L(f.m + f.e))}` : '–') : '–'}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
      {nota && <p className="ayuda" style={{ marginTop: 8 }}>{nota}</p>}
    </div>
  )
}
