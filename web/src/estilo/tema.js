// Temas claro y oscuro (estilo GeoGebra: blanco, violeta y puntos azules).
// Los colores están también en styles.css como variables; acá se repiten para los gráficos SVG,
// que usan colores explícitos para poder exportarse igual que se ven.
import { createContext, useContext } from 'react'

export const TEMAS = {
  oscuro: {
    nombre: 'Oscuro', fondo: '#16151C', panel: '#1F1E27', panel2: '#282732', texto: '#ECEBF4', sec: '#B5B3C8', borde: '#33313F',
    grilla: '#2B2A35', grillaFina: '#23222C', eje: '#ECEBF4', acento: '#9B8EF2', acento2: '#F0997B', peligro: '#F09595', ok: '#97C459', aviso: '#FAC775',
    pocilloVacio: '#1B1A22', mezcla: 0.55,
  },
  claro: {
    nombre: 'Claro', fondo: '#FFFFFF', panel: '#FFFFFF', panel2: '#F6F5FA', texto: '#1F1E29', sec: '#55546A', borde: '#E2E1EA',
    grilla: '#DCDBE4', grillaFina: '#EFEEF4', eje: '#1F1E29', acento: '#6557D2', acento2: '#D85A30', peligro: '#C62828', ok: '#2E7D32', aviso: '#D2600E',
    pocilloVacio: '#FFFFFF', mezcla: 0.68,
  },
}

export const TemaCtx = createContext(TEMAS.claro)
export const useTema = () => useContext(TemaCtx)

// Paleta de cepas: tonos sobrios, distinguibles entre sí y legibles en los dos temas
const BASE = ['#2F6FC4', '#D86A3A', '#3F8A4A', '#6E5FD6', '#C2457A', '#1E8E96', '#B8961F', '#66748C', '#A8678F', '#6E8B3D', '#946B52', '#4A58B8']

// Color sin definir o mal escrito (cepa sin color asignado): gris neutro, para no romper la pantalla
const aRgb = (h) => { const c = typeof h === 'string' && /^#[0-9a-f]{6}/i.test(h) ? h : '#8C9BB0'; return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) }
const aHex = (v) => '#' + v.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('')
export const mezclar = (a, b, f) => { const x = aRgb(a), y = aRgb(b); return aHex(x.map((v, i) => v + (y[i] - v) * f)) }

export function coloresCepas(muestras) {
  const out = {}
  muestras.forEach((m, i) => { out[m] = BASE[i % BASE.length] })
  return out
}
// Réplicas: el tono de la cepa, de más oscuro a más claro
export function colorReplica(base, i, n) {
  if (n <= 1) return base
  const f = -0.25 + (0.6 * i) / (n - 1)
  return f < 0 ? mezclar(base, '#000000', -f) : mezclar(base, '#ffffff', f)
}
// Relleno suave de un pocillo de la placa según el tema
export const rellenoPocillo = (color, tema) => mezclar(color, tema.fondo, tema.mezcla)

export const DASH = [null, '7 4', '2 3', '9 3 2 3', '12 4', '3 3 9 3']

// Estilo de cada serie del motor (pocillo real o virtual): { [Pocillo]: { color, dash } }
export function estilosSeries(config, colores) {
  const out = {}
  const muestras = [...new Set(config.map((c) => c.Muestra))]
  muestras.forEach((m) => {
    const reps = config.filter((c) => c.Muestra === m && !c.EsBlanco).sort((a, b) => a.Replica - b.Replica)
    reps.forEach((c, i) => { out[c.Pocillo] = { color: colorReplica(colores[m] || '#8C9BB0', i, reps.length), dash: DASH[i % DASH.length], base: colores[m] } })
    config.filter((c) => c.Muestra === m && c.EsBlanco).forEach((c) => { out[c.Pocillo] = { color: '#8C9BB0', dash: '2 2', base: '#8C9BB0' } })
  })
  return out
}
