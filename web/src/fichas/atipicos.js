// Ficha de atípicos entre réplicas (Dixon, Grubbs o CV), para OD y UFC.
import { desvio, finito, media } from '../calculo/comun/analisis.js'
import { Q_TABLA, criticoGrubbs, detectar } from '../calculo/comun/atipicos.js'
import { g } from './comun.js'

// ==== Atípicos entre réplicas (Dixon, Grubbs o CV), para UFC y OD
// valores: [{ etiqueta, x }]; o: { metodo, conf, cvMax, escala, sospechoso (índice marcado), sujeto, auto }
export function fichaAtipico(valores, o) {
  const xs = valores.map((q) => q.x)
  const d = detectar(xs, { metodo: o.metodo, conf: o.conf, cvMax: o.cvMax })
  const metodo = o.metodo === 'q' && xs.length > 10 ? 'grubbs' : o.metodo
  const n = xs.length
  const orden = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b])
  const pasos = [{ titulo: `Las ${n} réplicas, ordenadas`, texto: orden.map((i) => `${valores[i].etiqueta}: ${g(xs[i])}`).join(' · '),
    esquema: { tipo: 'tira', valores: valores.map((q, i) => ({ ...q, sospechoso: i === d.idx })), unidad: o.escala, media: metodo !== 'q' ? media(xs) : NaN } }]
  if (metodo === 'q') {
    const s = orden.map((i) => xs[i]), rango = s[n - 1] - s[0]
    pasos.push({ titulo: 'Test Q de Dixon', texto: 'Compara el salto entre el valor extremo y su vecino con el rango de todas las réplicas.',
      formula: ['Q = salto / rango = (x₍ₙ₎ − x₍ₙ₋₁₎) / (x₍ₙ₎ − x₍₁₎)   (o el extremo de abajo)'],
      cuenta: [`Q arriba = (${g(s[n - 1])} − ${g(s[n - 2])}) / ${g(rango)} = ${g((s[n - 1] - s[n - 2]) / rango, 3)}   ;   Q abajo = (${g(s[1])} − ${g(s[0])}) / ${g(rango)} = ${g((s[1] - s[0]) / rango, 3)}`] })
    pasos.push({ titulo: 'Comparación con el valor crítico', texto: `Valor crítico de Q para n = ${n} al ${o.conf} % (Rorabacher 1991): ${g((Q_TABLA[o.conf] || Q_TABLA[95])[n - 3], 3)}.`,
      cuenta: [finito(d.stat) ? `Q = ${g(d.stat, 3)} ${d.idx !== null ? '>' : '≤'} ${g(d.crit, 3)} → ${d.idx !== null ? `${valores[d.idx].etiqueta} es sospechosa` : 'ninguna es sospechosa'}` : 'Hacen falta 3 a 10 réplicas para el test.'] })
  } else if (metodo === 'grubbs') {
    const m = media(xs), s = desvio(xs)
    pasos.push({ titulo: 'Test de Grubbs', texto: 'Mide cuántas desviaciones estándar se aparta de la media el valor más alejado.',
      formula: ['G = máx |xᵢ − x̄| / s   ;   G crítico = (n − 1)/√n · √[ t² / (n − 2 + t²) ],  t = t(1 − α/(2n); n − 2)'],
      cuenta: [`x̄ = ${g(m)}, s = ${g(s)} → G = ${g(d.stat, 3)} ${d.idx !== null ? '>' : '≤'} G crítico = ${g(criticoGrubbs(n, o.conf), 3)} → ${d.idx !== null ? `sospechosa: ${valores[d.idx].etiqueta}` : 'ninguna es sospechosa'}`] })
  } else {
    pasos.push({ titulo: 'Coeficiente de variación del grupo', texto: 'Es un criterio práctico, no un test de hipótesis: si el CV supera el límite, se señala la réplica más alejada de la media.',
      formula: ['CV = 100 · s / |x̄|'], cuenta: [`CV = ${g(d.stat, 3)} % ${d.idx !== null ? '>' : '≤'} ${o.cvMax} %${d.idx !== null ? ` → sospechosa: ${valores[d.idx].etiqueta} (sin ella, CV = ${g(d.cvSin, 3)} %)` : ''}`] })
  }
  return { titulo: `Atípicos entre réplicas (${{ q: 'Dixon', grubbs: 'Grubbs', cv: 'CV %' }[metodo]})`, sujeto: o.sujeto, valor: d.idx !== null ? 'sospechosa' : 'sin atípicos', metodos: o.ancla || 'ufcqc',
    pasos, avisos: [...(n === 3 && metodo === 'q' ? ['Con 3 réplicas el test tiene muy poca potencia: solo marca valores muy extremos.'] : []),
      ...(d.idx !== null ? [o.auto ? 'Se excluye automáticamente («Excluir» activado).' : 'Solo se marca: sigue en el promedio. Decidí vos con un clic si la excluís.'] : [])],
    ajustes: [metodo === 'cv' ? `CV máx. ${o.cvMax} %` : `confianza ${o.conf} %`, o.auto ? 'excluir solos' : 'solo marcar'] }
}
