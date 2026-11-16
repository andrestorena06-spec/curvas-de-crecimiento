// ============================================================
// Índice de pantallas: UNA sola fuente para el menú lateral, la barra de ubicación, «anterior / siguiente» y los íconos.
// Cada pantalla: { titulo (en el menú), largo (en anterior / siguiente), icono, vista (componente) }.
// Orden del procesamiento: datos → revisión → curva de cada medición (OD y UFC); después la calibración OD ↔ UFC
// (usa los dos ajustes) y el informe (Métodos y Datos).
// ============================================================
import { Resumen } from '../pantallas/inicio/Resumen.jsx'
import { ArchivoTecan, PlacaTecan } from '../pantallas/od/Tecan.jsx'
import { PlacasTiempo } from '../pantallas/od/Placas.jsx'
import { Cubeta } from '../pantallas/od/Cubeta.jsx'
import { Calidad } from '../pantallas/od/Calidad.jsx'
import { Curva } from '../pantallas/od/Curva.jsx'
import { Recuento } from '../pantallas/ufc/Conteo.jsx'
import { CalidadUfc } from '../pantallas/ufc/CalidadUfc.jsx'
import { CurvaUfc } from '../pantallas/ufc/CurvaUfc.jsx'
import { Combinado } from '../pantallas/calibracion/Combinado.jsx'
import { Metodos } from '../pantallas/informe/Metodos.jsx'
import { Datos } from '../pantallas/informe/Datos.jsx'

export const PANTALLAS = {
  resumen: { titulo: 'Resumen', largo: 'Resumen', icono: 'nuevo', vista: Resumen },
  archivo: { titulo: 'Cargar datos', largo: 'Cargar datos de OD', icono: 'tecan', vista: ArchivoTecan },
  placa: { titulo: 'Pocillos', largo: 'Pocillos', icono: 'placa', vista: PlacaTecan },
  placas: { titulo: 'Cargar datos', largo: 'Cargar datos de OD', icono: 'tiempo', vista: PlacasTiempo },
  lecturas: { titulo: 'Cargar datos', largo: 'Cargar datos de OD', icono: 'cubeta', vista: Cubeta },
  calidad: { titulo: 'Revisión', largo: 'Revisión de la OD', icono: 'escudo', vista: Calidad },
  curva: { titulo: 'Curva', largo: 'Curva OD vs t', icono: 'curva', vista: Curva },
  conteo: { titulo: 'Cargar datos', largo: 'Cargar recuentos', icono: 'colonia', vista: Recuento },
  calidadUfc: { titulo: 'Revisión', largo: 'Revisión de los recuentos', icono: 'escudo', vista: CalidadUfc },
  curvaUfc: { titulo: 'Curva', largo: 'Curva UFC vs t', icono: 'curva', vista: CurvaUfc },
  combinado: { titulo: 'OD ↔ UFC', largo: 'Calibración OD ↔ UFC', icono: 'combinar', vista: Combinado },
  metodos: { titulo: 'Métodos', largo: 'Métodos', icono: 'libro', vista: Metodos },
  datos: { titulo: 'Datos', largo: 'Datos', icono: 'tabla', vista: Datos },
}

// Grupos del menú (todos con la misma forma): Cargar datos → Revisión → Curva; Informe: Métodos y Datos
export const GRUPOS = {
  od: { titulo: 'OD', icono: 'placa', hijos: ['archivo', 'placa', 'placas', 'lecturas', 'calidad', 'curva'] },
  ufc: { titulo: 'UFC', icono: 'colonia', hijos: ['conteo', 'calidadUfc', 'curvaUfc'] },
  informe: { titulo: 'Informe', icono: 'libro', hijos: ['metodos', 'datos'] },
}
export const grupoDe = (id) => Object.keys(GRUPOS).find((g) => GRUPOS[g].hijos.includes(id))
export const NOMBRE_LARGO = Object.fromEntries(Object.entries(PANTALLAS).map(([k, v]) => [k, v.largo]))

// Pantallas de un experimento, en el orden del procesamiento
export function pasosDe(e) {
  if (!e) return []
  const od = { tecan: ['archivo', 'placa'], placas: ['placas'], cubeta: ['lecturas'] }[e.origenOd] || []
  if (e.tipo === 'od') return ['resumen', ...od, 'calidad', 'curva', 'metodos', 'datos']
  if (e.tipo === 'ufc') return ['resumen', 'conteo', 'calidadUfc', 'curvaUfc', 'metodos', 'datos']
  return ['resumen', ...od, 'calidad', 'curva', 'conteo', 'calidadUfc', 'curvaUfc', 'combinado', 'metodos', 'datos']
}
