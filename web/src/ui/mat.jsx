// ============================================================
// Piezas de MathML para escribir fórmulas SIMBÓLICAS (Métodos): fracciones, sumas, raíces, subíndices y exponentes
// con formato de ecuación. Las ecuaciones con los números de un ajuste usan ecuacionBonita.jsx (mismo estilo .ec-math).
// Uso: ec(sub(T('OD'), T('c')), O('='), ...). Son funciones (no componentes) para escribir las fórmulas en una línea.
// ============================================================
import { createElement as h } from 'react'

export const R = (...xs) => h('mrow', null, ...xs)
export const v = (c) => h('mi', null, c)                              // variable (cursiva)
export const T = (c) => h('mi', { mathvariant: 'normal' }, c)         // palabra o función (OD, ln, med)
export const N = (c) => h('mn', null, c)                              // número
export const O = (c) => h('mo', null, c)                              // operador
export const sub = (b, s) => h('msub', null, R(b), R(s))
export const sup = (b, s) => h('msup', null, R(b), R(s))
export const subsup = (b, s, p) => h('msubsup', null, R(b), R(s), R(p))
export const fr = (a, b) => h('mfrac', null, R(a), R(b))
export const raiz = (...x) => h('msqrt', null, ...x)
const delim = (a, z) => (...x) => R(h('mo', { stretchy: 'true' }, a), ...x, h('mo', { stretchy: 'true' }, z))
export const par = delim('(', ')')
export const cor = delim('[', ']')
export const abs = delim('|', '|')
// media x̄ y mediana x̃: una letra lleva el signo combinado (se ve igual en todos los navegadores); una palabra, una raya encima
const acento = (marca, raya) => (c, normal = c.length > 1) => (c.length === 1 ? h('mi', { style: { fontStyle: 'italic' } }, c + marca) : h('mover', { accent: 'true' }, h('mi', normal ? { mathvariant: 'normal' } : null, c), h('mo', { stretchy: 'true' }, raya)))
export const barra = acento('̄', '‾')
export const tilde = acento('̃', '~')
export const suma = (de, a) => (a ? h('munderover', null, h('mo', null, '∑'), R(de), R(a)) : h('munder', null, h('mo', null, '∑'), R(de)))
export const prod = (de, a) => h('munderover', null, h('mo', null, '∏'), R(de), R(a))
export const ln = () => R(T('ln'), h('mspace', { width: '0.17em' }))
export const log10 = () => R(sub(T('log'), N('10')), h('mspace', { width: '0.17em' }))
export const ex = (...x) => sup(v('e'), R(...x))                      // e^(…)
export const de_t = () => R(O('('), v('t'), O(')'))                   // (t)
export const sep = () => h('mspace', { width: '1.4em' })               // separación entre dos igualdades en la misma línea
// ecuación en bloque y en línea (para la lista de símbolos)
export const ec = (...xs) => h('math', { display: 'block', className: 'ec-math' }, R(...xs))
export const en = (...xs) => h('math', { display: 'inline', className: 'ec-math en-linea' }, R(...xs))

// ---------- MathML → texto lineal (para copiar o descargar Métodos como texto) ----------
// x_i, x^2, (a)/(b), √(x), Σ_(i=1)^n; las fracciones y raíces se escriben en una línea con paréntesis solo si hacen falta
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '−': '⁻', '-': '⁻' }
const envolver = (s) => (/^[\p{L}\p{N}.,̄̃′]+$/u.test(s) ? s : `(${s})`)
// exponente: un solo carácter sin paréntesis; si no, entre paréntesis (e^(αλ), no e^αλ)
const envolverSup = (s) => (/^[\p{L}\p{N}]$/u.test(s) ? s : `(${s})`)
const sup2 = (s) => ([...s].every((c) => SUP[c]) ? [...s].map((c) => SUP[c]).join('') : `^${envolverSup(s)}`)
const FUNCIONES = ['ln', 'log', 'máx', 'mín', 'Dixon', 'Grubbs', 'Baranyi', 'Huang', 'marcado', 'sospechosa', 'generaciones', 'velocidad', 'aumento', 'cociente']
export function mathATexto(nodo) {
  if (nodo.nodeType === 3) return nodo.textContent
  const hijos = [...nodo.childNodes].map(mathATexto)
  const tag = nodo.localName
  if (tag === 'msub') return `${hijos[0].trim()}_${envolver(hijos[1].trim())}`
  if (tag === 'msup') return `${hijos[0]}${sup2(hijos[1])}`
  if (tag === 'msubsup') return `${hijos[0].trim()}_${envolver(hijos[1].trim())}${sup2(hijos[2].trim())}`
  if (tag === 'mfrac') return `${envolver(hijos[0])}/${envolver(hijos[1])}`
  if (tag === 'msqrt') return `√${envolver(hijos.join(''))}`
  if (tag === 'munder') return `${hijos[0]}_${envolver(hijos[1])} `
  if (tag === 'munderover') return `${hijos[0]}_${envolver(hijos[1])}^${envolver(hijos[2])} `
  if (tag === 'mover') return hijos[1] === '‾' ? `${hijos[0]}̄` : `${hijos[0]}̃`
  if (tag === 'mspace') return nodo.getAttribute('width') === '1.4em' ? '¦' : ' '   // ¦: separa dos igualdades (una por línea)
  if (tag === 'mi' && FUNCIONES.includes(nodo.textContent)) return ` ${nodo.textContent} `
  if (tag === 'mo') { const t = nodo.textContent; return ['=', '+', '−', '>', '<', '≥', '⇔', '∧', '±', '∈'].includes(t) ? ` ${t} ` : t === ',' || t === ':' ? `${t} ` : t }
  return hijos.join('')
}
