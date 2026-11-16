// Íconos propios (24 × 24): trazo de tinta, puntos azules con borde oscuro y un acento violeta o naranja.
// Cada ícono: { t: trazo de tinta, a: trazo violeta, o: trazo naranja, r: relleno violeta suave, p: puntos [[x, y]], h: puntos huecos, txt }
// Los colores salen de variables CSS (--ico-*), así siguen el tema claro u oscuro.
const D = {
  // generales
  x: { t: 'M6 6l12 12M18 6L6 18' },
  subir: { t: 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3', a: 'M12 15V4M7 9l5-5 5 5' },
  bajar: { t: 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3', a: 'M12 4v11M7 10l5 5 5-5' },
  mas: { a: 'M12 5v14M5 12h14' },
  menos: { a: 'M5 12h14' },
  deshacer: { t: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' },
  rehacer: { t: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13' },
  hamburguesa: { t: 'M4 6h16M4 12h16M4 18h16' },
  check: { t: 'M5 12.5l4.5 4.5L19 7' },
  flecha: { t: 'M9 6l6 6-6 6' },
  abajo: { t: 'M6 9l6 6 6-6' },
  sol: { t: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' },
  luna: { t: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z' },
  info: { t: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6', p: [[12, 7.5]] },
  ojo: { t: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', p: [[12, 12]] },
  editar: { t: 'M4 20h4L19 9l-4-4L4 16z', a: 'M14 6l4 4' },
  borrar: { t: 'M5 7l1 13h12l1-13M9 7V4h6v3', a: 'M4 7h16' },
  copiar: { t: 'M4 16V4h12', r: 'M8 8h12v12H8z' },
  refrescar: { t: 'M20 11a8 8 0 1 0-2.3 5.7', a: 'M20 4v7h-7' },
  imprimir: { t: 'M6 9V3h12v6M6 18H4v-7h16v7h-2', r: 'M6 14h12v7H6z' },
  personalizar: { t: 'M4 20h4L19 9l-4-4L4 16z', p: [[18, 18]] },
  // archivo
  archivo: { t: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5' },
  carpeta: { t: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', a: 'M3 10h18' },
  guardar: { t: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 21v-7h10v7', a: 'M7 3v5h8V3' },
  guardarComo: { t: 'M13 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l3 3v6M7 3v5h8V3M7 21v-7h6', a: 'M18 15v6M15 18h6' },
  nuevo: { t: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', a: 'M12 8v8M8 12h8' },
  // datos
  placa: { t: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', p: [[8, 9], [12, 9], [16, 9], [8, 14], [12, 14]], h: [[16, 14]] },
  tecan: { t: 'M3 7h18v12H3zM6 7V5h12v2', r: 'M7 11h10v4H7z', p: [[17.5, 9]] },
  cubeta: { t: 'M8 3h8M9 3v15a3 3 0 0 0 6 0V3', r: 'M9 12h6v6a3 3 0 0 1-6 0z' },
  tiempo: { t: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', a: 'M12 7v5l3 3' },
  colonia: { t: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', p: [[9, 9], [14.5, 8], [15.5, 13.5], [9.5, 14.5], [12, 11.5]] },
  tabla: { t: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14' },
  // revisión
  escudo: { t: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z', a: 'M9 12l2 2 4-4' },
  marcar: { t: 'M4 19h16', h: [[12, 11]], p: [[6, 15], [18, 15]], a: 'M12 11m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0' },
  excluir: { t: 'M4 19h16', p: [[6, 15], [18, 15]], o: 'M8.5 7.5l7 7M15.5 7.5l-7 7' },
  dixon: { t: 'M4 20h16', p: [[6, 16], [9, 16], [12, 16]], h: [[18, 7]], txt: 'Q' },
  grubbs: { t: 'M4 20h16', p: [[6, 16], [9, 16], [12, 16]], h: [[18, 7]], txt: 'G' },
  cv: { t: 'M4 20h16', p: [[7, 13], [12, 11], [17, 14]], a: 'M4 9h16M4 16h16', txt: '%' },
  blanco: { t: 'M8 3h8M9 3v15a3 3 0 0 0 6 0V3', h: [[12, 15]] },
  restarBlanco: { t: 'M8 3h8M9 3v15a3 3 0 0 0 6 0V3', o: 'M17 8h5' },
  blancoOk: { t: 'M8 3h8M9 3v15a3 3 0 0 0 6 0V3', a: 'M16 10l2 2 4-4' },
  odmax: { t: 'M3 21h18M4 21V3', a: 'M4 7h17', o: 'M6 17c4 0 6-6 9-10', p: [[9, 14]], h: [[17, 4]] },
  suavizar: { t: 'M3 21h18M4 21V3', p: [[7, 15], [10, 10], [13, 12], [16, 6], [19, 8]], a: 'M6 15c4-2 7-5 13-7' },
  normalizar: { t: 'M3 21h18M4 21V3', a: 'M4 15h17', p: [[8, 15], [13, 10], [18, 6]] },
  desplazar: { t: 'M4 12h16', a: 'M7 9l-3 3 3 3M17 9l3 3-3 3', p: [[12, 12]] },
  camino: { t: 'M6 3v18M18 3v18', a: 'M6 12h12M9 9l-3 3 3 3M15 9l3 3-3 3' },
  // curvas y modelos
  curva: { t: 'M3 21h18M4 21V3', a: 'M6 17c4 0 5-1 7-5s3-6 8-7', p: [[7, 17], [13, 12], [19, 5.5]] },
  combinar: { t: 'M3 21h18M4 21V3', a: 'M6 17c4 0 6-6 9-10', o: 'M6 14c5 0 8-3 13-8', p: [[11, 12]] },
  sigma: { t: 'M18 5H7l6 7-6 7h11' },
  libro: { t: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 0 6.5 24H20', a: 'M9 7h7M9 11h5' },
  puntos: { t: 'M3 21h18M4 21V3', p: [[7, 17], [11, 13], [15, 9], [19, 6]] },
  replicas: { t: 'M3 21h18M4 21V3', p: [[8, 16], [8, 13], [14, 10], [14, 7]], h: [[19, 5]] },
  barras: { t: 'M3 21h18M4 21V3', a: 'M9 9v8M7 9h4M7 17h4M16 4v8M14 4h4M14 12h4', p: [[9, 13], [16, 8]] },
  valor: { t: 'M3 21h18M4 21V3', p: [[12, 15]], txt: '12', tx: 14, ty: 9 },
  error: { t: 'M3 21h18M4 21V3', a: 'M12 11v8M10 11h4M10 19h4', p: [[12, 15]], txt: '±', tx: 18, ty: 9 },
  escalaLin: { t: 'M3 21h18M4 21V3', a: 'M5 19c7 0 10-3 15-16', txt: 'N', tx: 13, ty: 11 },
  escalaLog: { t: 'M3 21h18M4 21V3', a: 'M5 18L20 5', txt: 'lg', tx: 15, ty: 17 },
  sinCurva: { t: 'M3 21h18M4 21V3', p: [[8, 16], [13, 11], [18, 7]] },
  recta: { t: 'M3 21h18M4 21V3', a: 'M5 19L20 4', p: [[8, 16], [12, 12], [16, 8.5]] },
  baranyi: { t: 'M3 21h18M4 21V3', a: 'M5 17c6 0 6-11 15-11', o: 'M7 21L16 4', p: [[11.5, 12]] },
  huang: { t: 'M3 21h18M4 21V3', a: 'M5 17c7 1 5-12 15-12', o: 'M4 5h17', p: [[8, 16.5], [16, 6.5]] },
  media: { t: 'M3 21h18M4 21V3', o: 'M5 12h15', h: [[8, 9], [12, 15], [17, 10]] },
  fases: { t: 'M3 21h18M4 21V3', r: 'M10 3h6v18h-6z', a: 'M5 17c5 0 6-10 15-11' },
  de: { t: 'M4 18h16', a: 'M12 6v10M9 6h6M9 16h6', p: [[12, 11]], txt: 's', tx: 19, ty: 8 },
  eem: { t: 'M4 18h16', a: 'M12 8v6M9 8h6M9 14h6', p: [[12, 11]], txt: '√n', tx: 18.5, ty: 7 },
  ic: { t: 'M4 18h16', a: 'M12 5v12M9 5h6M9 17h6', p: [[12, 11]], txt: '95', tx: 19, ty: 8 },
  conf: { t: 'M3 19h18', a: 'M5 19c3 0 4-12 7-12s4 12 7 12', o: 'M16 19v-6' },
  hampel: { t: 'M3 21h18M4 21V3', a: 'M5 16l4-3 4-1 4-3 4-2', p: [[5, 16], [9, 13], [17, 9], [21, 7]], h: [[13, 5]] },
  od0: { t: 'M3 21h18M4 21V3', o: 'M4 17h17', a: 'M5 17c6 0 7-1 9-5s3-6 7-7', p: [[6, 17]] },
  mcurv: { t: 'M3 21h18M4 21V3', a: 'M5 17c6 0 6-11 15-11', o: 'M5 17c4 0 6-9 15-11' },
}

// símbolo de texto de la cinta → ícono
export const ICONO_DE_SIMBOLO = {
  '·': 'puntos', '⋮': 'replicas', '±': 'barras', '12': 'valor', '±12': 'error', OD: 'escalaLin', UFC: 'escalaLin', N: 'escalaLin', lg: 'escalaLog',
  '⟋': 'recta', '∫': 'baranyi', H: 'huang', Hm: 'hampel', 'x̄': 'media', '◯': 'marcar', '⛔': 'excluir', Q: 'dixon', G: 'grubbs', CV: 'cv',
  '▦': 'fases', '▥': 'fases', B: 'blanco', '−B': 'restarBlanco', '✓B': 'blancoOk', '≤': 'odmax', '≈': 'suavizar', '⇢': 'normalizar', 't↔': 'desplazar',
  '1 cm': 'camino', '•': 'puntos', '⋮⋮': 'replicas', s: 'de', 's/√n': 'eem', IC: 'ic', 'm₁': 'mcurv', 'OD₀': 'od0',
}

export function Icono({ n, size = 18, ancho = 1.7, style }) {
  const d = D[n] || D.info
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style} className="icono-svg">
      {d.r && <path d={d.r} fill="var(--ico-relleno)" stroke="var(--ico-acento)" strokeWidth={ancho * 0.8} />}
      {d.t && <path d={d.t} stroke="currentColor" />}
      {d.a && <path d={d.a} stroke="var(--ico-acento)" />}
      {d.o && <path d={d.o} stroke="var(--ico-naranja)" />}
      {(d.h || []).map(([x, y], i) => <circle key={'h' + i} cx={x} cy={y} r="2.3" fill="var(--ico-fondo)" stroke="var(--ico-punto-borde)" strokeWidth="1.3" />)}
      {(d.p || []).map(([x, y], i) => <circle key={'p' + i} cx={x} cy={y} r="2.3" fill="var(--ico-punto)" stroke="var(--ico-punto-borde)" strokeWidth="1.2" />)}
      {d.txt && <text x={d.tx ?? 18} y={d.ty ?? 9} fontSize="8.5" fontWeight="600" textAnchor="middle" fill="var(--ico-acento)" stroke="none" fontStyle="italic" fontFamily="Georgia, 'Times New Roman', serif">{d.txt}</text>}
    </svg>
  )
}
