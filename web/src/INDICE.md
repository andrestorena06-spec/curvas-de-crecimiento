# Índice del código · Curvas de crecimiento v2

El código está ordenado por tema. Cada carpeta de cálculo tiene un `index.js` (o un único archivo) que es su punto de entrada: las pantallas importan desde ahí y no desde los archivos internos.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `main.jsx` | Arranque: monta `app/App.jsx` y carga los estilos. |
| `app/` | `App.jsx` (estado del experimento, deshacer, guardado, menú lateral), `menu.js` (**índice de pantallas**), `archivoLocal.js`, `nativo.js` (Android), `ayuda.js` (textos de los globos), `version.js`. |
| `datos/` | `experimento.js` (modelo del experimento, importación de archivos, series de OD y resultados de UFC), `excel.js`, `libro.js` (lectura y escritura de Excel). |
| `calculo/comun/` | `estadistica.js` (**media ± error de réplicas: la única implementación**; DE con n ≥ 2, EEM e IC 95 % con n ≥ 3), `analisis.js` (estadística básica, Hampel, suavizado, ventanas de ln OD, parámetros de una curva), `atipicos.js` (Dixon, Grubbs, CV), `modelos.js` (Baranyi, Huang, Levenberg–Marquardt). |
| `calculo/od/` | `lectura.js` (archivos del lector), `placas.js` (placas por tiempo), `odmanual.js` (cubeta), `pipeline.js` (procesamiento de la OD), `medias.js` (media ± error por tiempo), `parametros.js` (resumen por cepa, ajuste del modelo a ln OD con caché, tramo exponencial que rige). |
| `calculo/ufc/` | `index.js` → `conteo.js` (UFC/mL por réplica y por tiempo, error) y `ajuste.js` (recta, Baranyi, Huang y variantes de DMFit). |
| `calculo/calibracion/` | `calibracion.js` (OD ↔ UFC/mL e intervalos de predicción), `pares.js` (pares OD–UFC, recta de calibración y comparación de μ por OD y por recuento). |
| `fichas/` | `index.js` → `comun.js`, `od.js`, `atipicos.js`, `ufc.js`, `calibracion.js` (fichas «Cómo se calculó»); `FichaCalculo.jsx` y `esquemas.jsx` (cómo se dibujan). |
| `pantallas/` | Una carpeta por grupo del menú: `inicio/` (`Inicio.jsx`, `Asistente.jsx`, `EditarExperimento.jsx`, `Resumen.jsx`), `od/`, `ufc/`, `calibracion/`, `informe/`. Las pantallas no contienen cálculos: los importan de `calculo/`. |
| `ui/` | Componentes comunes: `base.jsx`, `iconos.jsx` (juego de íconos propio), `ilustraciones.jsx`, `cinta.jsx`, `mostrar.jsx`, `modeloCinta.jsx`, `outliers.jsx`, `cepas.jsx` (selector de cepas), `camino.jsx` (camino óptico), `tablaMedia.jsx`, `ecuacion.jsx`, `ecuacionBonita.jsx`, `mat.jsx`, `placa.jsx`, `planilla.js` (pegar y moverse por tablas), `revision.jsx`, `opciones.js` (opciones de pantalla guardadas con el experimento); `graficos/` (`grafico.jsx`, `guardarImagen.jsx`, `personalizar.jsx`). |
| `estilo/` | `tema.js` (colores de los gráficos y de las cepas), `base.css` (variables y controles), `estructura.css` (barra, menú, cinta). |
| `comun/` | `utils.js` (**formato de números: la única implementación**, cuantiles t, pocillos de la placa, exportación). |

## Pantallas (menú) → vista → cálculo → ficha

El registro está en `app/menu.js` (`PANTALLAS`, `GRUPOS`, `pasosDe`). Para agregar una pantalla: crear la vista en `pantallas/<grupo>/`, registrarla en `PANTALLAS` y ubicarla en `GRUPOS` y `pasosDe`.

| Grupo | Pantalla | Vista | Cálculo | Fichas |
|---|---|---|---|---|
| — | Resumen | `pantallas/inicio/Resumen.jsx` | resultados ya calculados en `App.jsx` | — |
| OD | Cargar datos | `pantallas/od/Tecan.jsx`, `Placas.jsx`, `Cubeta.jsx` | `calculo/od/lectura.js`, `placas.js`, `odmanual.js` | `fichas/od.js` (cubeta, blanco de placa) |
| OD | Pocillos (Tecan) | `pantallas/od/Tecan.jsx` (`PlacaTecan`) | — | — |
| OD | Revisión | `pantallas/od/Calidad.jsx`, `CalidadPlacas.jsx`, `FasesCepa.jsx` | `calculo/od/pipeline.js`, `calculo/comun/atipicos.js` | `fichas/atipicos.js` |
| OD | Curva | `pantallas/od/Curva.jsx`, `Parametros.jsx` | `calculo/comun/analisis.js` (`analizarCurva`), `calculo/od/parametros.js` y `calculo/ufc/ajuste.js` (modelos sobre ln OD), `calculo/od/medias.js` | `fichas/od.js`, `fichas/ufc.js` (modelo) |
| UFC | Cargar datos | `pantallas/ufc/Conteo.jsx` | `calculo/ufc/conteo.js` | `fichas/ufc.js` (réplica) |
| UFC | Revisión | `pantallas/ufc/CalidadUfc.jsx` | `datos/experimento.js` (`resultadosUfc`), `calculo/comun/atipicos.js` | `fichas/atipicos.js`, `fichas/ufc.js` |
| UFC | Curva | `pantallas/ufc/CurvaUfc.jsx`, `ParamUfc.jsx` | `calculo/ufc/ajuste.js` | `fichas/ufc.js` |
| — | OD ↔ UFC | `pantallas/calibracion/Combinado.jsx` | `calculo/calibracion/pares.js`, `calibracion.js` | `fichas/calibracion.js` |
| Informe | Métodos | `pantallas/informe/Metodos.jsx` | un paso por cálculo: ecuación (`ui/mat.jsx`), ajustes activos y vínculo a su tabla de Datos (mismo `id` que `tablasDe`) | — |
|  |  | **Métodos describe el algoritmo con sus constantes** (ventanas, cuota, límites, valores iniciales, criterios de convergencia, variantes). Si cambia algo en `calculo/comun/analisis.js` (`analizarCurva`, `ventanasLn`, `od0TresFases`), `calculo/ufc/ajuste.js` (`ajusteDmfit`, `ajusteClasico`) o `calculo/comun/modelos.js` (`levenbergMarquardt`, `erroresAjuste`), hay que actualizar los pasos «mumax» y «modelos» de `pantallas/informe/Metodos.jsx`. |  |  |
| Informe | Datos | `pantallas/informe/Datos.jsx` → `tablasDe` (una tabla por cálculo; la tabla abierta es la opción `datos.tabla`) | todas las tablas; `datos/excel.js` | — |

## Grupos comunes de la cinta

Cada grupo está escrito una sola vez; cambiarlo ahí lo cambia en todas las pantallas.

| Grupo | Archivo | Dónde aparece |
|---|---|---|
| Ver (botón «Mostrar») | `ui/mostrar.jsx` → `GrupoMostrar` | todos los gráficos con datos |
| Incertidumbre (DE, EEM, IC 95 %) | `ui/mostrar.jsx` → `GrupoTipoError` | revisiones de OD, de placas y de recuentos |
| Modelo, Baranyi/Huang (m, N máx), Fases, Predicción | `ui/modeloCinta.jsx` → `GrupoModelo`; claves de la OD en `pantallas/od/ModeloOd.jsx` y de las UFC en `pantallas/ufc/ParamUfc.jsx` → `GrupoModeloUfc` | Curva OD, Curva UFC y las dos Revisiones |
| Outliers (método, confianza, sospechosos) | `ui/outliers.jsx` → `GrupoOutliers` | revisiones de OD, de placas y de recuentos |
| Menú desplegable y cierre con clic afuera | `ui/cinta.jsx` → `MenuCinta`, `useCerrarAfuera`, `Cajon` | toda la cinta |
| Guardar imagen | `ui/graficos/guardarImagen.jsx` | todos los gráficos |
| Íconos | `ui/iconos.jsx` (`ICONO_DE_SIMBOLO` traduce los símbolos de la cinta) | toda la app |

## Orden del procesamiento

**OD** (`calculo/od/pipeline.js`, `preprocesar`):
1. Lectura (`lectura.js`, `placas.js` u `odmanual.js`); camino óptico si corresponde.
2. Resta del blanco (por tiempo o constante) y factor de dilución.
3. Marcado de puntos: Hampel dentro de la curva y outliers entre réplicas (Dixon / Grubbs / CV). En cubeta, la ventana lineal del equipo se aplica al cargar (con «Excluir fuera», las lecturas sin dilución dentro de la ventana no entran).
4. Control de calidad por pocillo y exclusiones (automáticas solo si se pidieron, y manuales).
5. Parámetros sobre la OD corregida sin suavizar ni normalizar (`analizarCurva`, modelos).
6. Suavizado y normalización: solo para los gráficos.

**UFC** (`datos/experimento.js` → `calculo/ufc/conteo.js`):
1. Una dilución por cepa y tiempo (elegida o sugerida).
2. UFC/mL de cada réplica = C · D / V.
3. Atípicos entre réplicas (Dixon / Grubbs sobre log₁₀, CV sobre UFC/mL) y exclusiones.
4. Valor de cada tiempo = media aritmética de las réplicas; error DE, EEM o IC 95 % en escala lineal.
5. Ajuste del modelo (`calculo/ufc/ajuste.js`) sobre ln(UFC/mL).

**Calibración**: pares OD–UFC de la fase exponencial común → regresión (`calculo/calibracion/calibracion.js`).

## Funciones compartidas (no duplicar)

- Media ± error de réplicas: `calculo/comun/estadistica.js` (`resumenReplicas`, `errorElegido`).
- Pares y recta de calibración: `calibracionDe` en `calculo/calibracion/pares.js` (pantalla, Datos y Métodos).
- **μ por OD de cada cepa: `muOdPorCepa` en `calculo/od/parametros.js`.** Sale del método elegido en «Modelo» de Curva OD (Baranyi y Roberts o Huang → μ del modelo; «Linealizar» o sin curva → ventana de ln OD) y cada fila dice su método (`etq`, `textoMetodoOd`). La usan el Resumen, OD ↔ UFC, Datos y Métodos: no leer `mu_max` directo para informar la μ de una cepa.
- μ por OD y por recuento: `comparacionMu` en `calculo/calibracion/pares.js` (columnas `Metodo_OD` y `Metodo_UFC`).
- Ampliación de la ventana exponencial por cuota: `cuotaDe` y `vecinasPorCuota` en `calculo/comun/analisis.js` (OD y recuentos).
- Mínimo de pares de la calibración y su aviso: `PARES_MIN` (2), `PARES_ERROR` (3), `avisoPares` en `calculo/calibracion/calibracion.js`.
- Ajuste del modelo de la OD (por cepa o por réplica, caché por cepa): `ajustesOd` en `calculo/od/parametros.js`; resumen por cepa: `resumenPorCepa` (mismo archivo).
- Media ± error de la OD por tiempo: `mediaPorTiempo` en `calculo/od/medias.js`.
- Ajuste de cada cepa con recuentos: `crecimientoPorCepa` en `calculo/ufc/ajuste.js`.
- Las fichas no recalculan: `pasosMedia` (`fichas/comun.js`) toma los números de `resumenReplicas`.
- Fórmulas simbólicas: `ui/mat.jsx`; fórmulas con números de un ajuste: `ui/ecuacionBonita.jsx`.

## Formato de números (una sola función para cada caso, en `comun/utils.js`)

| Caso | Función | Ejemplo |
|---|---|---|
| Decimales fijos | `fx(x, d)` | `0,125` |
| Cifras significativas | `fs(x, d)` | `1,234` |
| Notación científica (UFC/mL y números muy grandes o chicos) | `sci(x, d)` | `2,76 × 10⁵` |
| Superíndices | `superindice(t)` | `10⁻³` |
| Valor ± error (mismos decimales, error con 2 cifras) | `conError(v, e)` | `1,59 ± 0,30` |

Siempre coma decimal y «–» cuando no hay valor. No usar `toFixed` ni `toExponential` en textos que ve el usuario. Las fichas usan los alias `g` (= `fs`) y `f2` (= `fx`) de `fichas/comun.js`.

## Formato y estilo

- Escala de letra (6 tamaños): 11 px rótulos y títulos de grupo · 12,5 px texto chico, tablas y notas · 14,5 px texto · 18 px subtítulos · 26 px títulos · 30 px portada y cifras. `small` sin clase = 12,5 px. No usar otros tamaños (los exponentes `<sup>` y las fórmulas MathML son relativos).
- Gris secundario `--tenue`: #6F6E86 en tema claro (contraste 4,9 sobre blanco). Botones de la cinta: alto mínimo 53 px; la cinta muestra una sombra en el borde si hay más grupos fuera de la vista.

- Paleta e íconos: variables en `estilo/base.css` y `estilo/estructura.css`; íconos en `ui/iconos.jsx` (los símbolos de la cinta se traducen a íconos con `ICONO_DE_SIMBOLO`).
- Gráficos: en pantalla, cuadrícula completa y ejes con flecha (`CuadriculaPantalla` en `ui/graficos/grafico.jsx`); al guardar la imagen, formato de publicación (grilla horizontal, sin flechas).
- Textos bajo tablas y gráficos: leyenda breve y formal; las explicaciones van en Métodos y en las fichas.
