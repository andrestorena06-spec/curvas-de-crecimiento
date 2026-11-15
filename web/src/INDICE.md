# Índice del código · Curvas de crecimiento v2

El código está ordenado por tema. Cada carpeta de cálculo tiene un `index.js` (o un único archivo) que es su punto de entrada: las pantallas importan desde ahí y no desde los archivos internos.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `main.jsx` | Arranque: monta `app/App.jsx` y carga los estilos. |
| `app/` | `App.jsx` (estado del experimento, deshacer, guardado, menú lateral), `menu.js` (**índice de pantallas**), `archivoLocal.js`, `nativo.js` (Android), `ayuda.js` (textos de los globos), `version.js`. |
| `datos/` | `experimento.js` (modelo del experimento, importación de archivos, series de OD y resultados de UFC), `excel.js`, `libro.js` (lectura y escritura de Excel). |
| `calculo/comun/` | `estadistica.js` (**media ± error de réplicas: la única implementación**; DE con n ≥ 2, EEM e IC 95 % con n ≥ 3), `analisis.js` (estadística básica, Hampel, suavizado, ventanas de ln OD, parámetros de una curva), `atipicos.js` (Dixon, Grubbs, CV), `modelos.js` (Baranyi, Huang, Levenberg–Marquardt). |
| `calculo/od/` | `lectura.js` (archivos del lector), `placas.js` (placas por tiempo), `odmanual.js` (cubeta), `pipeline.js` (procesamiento de la OD). |
| `calculo/ufc/` | `index.js` → `conteo.js` (UFC/mL por réplica y por tiempo, error) y `ajuste.js` (recta, Baranyi, Huang y variantes de DMFit). |
| `calculo/calibracion/` | `calibracion.js` (OD ↔ UFC/mL e intervalos de predicción). |
| `fichas/` | `index.js` → `comun.js`, `od.js`, `atipicos.js`, `ufc.js`, `calibracion.js` (fichas «Cómo se calculó»); `FichaCalculo.jsx` y `esquemas.jsx` (cómo se dibujan). |
| `pantallas/` | Una carpeta por grupo del menú: `inicio/`, `od/`, `ufc/`, `calibracion/`, `informe/`. |
| `ui/` | Componentes comunes: `base.jsx`, `iconos.jsx` (juego de íconos propio), `cinta.jsx`, `mostrar.jsx`, `tablaMedia.jsx`, `ecuacion.jsx`, `placa.jsx`, `revision.jsx`; `graficos/` (gráfico de líneas, dispersión, guardar imagen, personalizar). |
| `estilo/` | `tema.js` (colores de los gráficos y de las cepas), `base.css` (variables y controles), `estructura.css` (barra, menú, cinta). |
| `comun/` | `utils.js` (formato de números, cuantiles t, exportación). |

## Pantallas (menú) → vista → cálculo → ficha

El registro está en `app/menu.js` (`PANTALLAS`, `GRUPOS`, `pasosDe`). Para agregar una pantalla: crear la vista en `pantallas/<grupo>/`, registrarla en `PANTALLAS` y ubicarla en `GRUPOS` y `pasosDe`.

| Grupo | Pantalla | Vista | Cálculo | Fichas |
|---|---|---|---|---|
| — | Resumen | `pantallas/inicio/Resumen.jsx` | resultados ya calculados en `App.jsx` | — |
| OD | Cargar datos | `pantallas/od/Tecan.jsx`, `Placas.jsx`, `Cubeta.jsx` | `calculo/od/lectura.js`, `placas.js`, `odmanual.js` | `fichas/od.js` (cubeta, blanco de placa) |
| OD | Pocillos (Tecan) | `pantallas/od/Tecan.jsx` (`PlacaTecan`) | — | — |
| OD | Revisión | `pantallas/od/Calidad.jsx`, `CalidadPlacas.jsx`, `FasesCepa.jsx` | `calculo/od/pipeline.js`, `calculo/comun/atipicos.js` | `fichas/atipicos.js` |
| OD | Curva | `pantallas/od/Curva.jsx`, `Parametros.jsx` | `calculo/comun/analisis.js` (`analizarCurva`), `calculo/ufc/ajuste.js` (modelos sobre ln OD) | `fichas/od.js`, `fichas/ufc.js` (modelo) |
| UFC | Cargar datos | `pantallas/ufc/Conteo.jsx` | `calculo/ufc/conteo.js` | `fichas/ufc.js` (réplica) |
| UFC | Revisión | `pantallas/ufc/CalidadUfc.jsx` | `datos/experimento.js` (`resultadosUfc`), `calculo/comun/atipicos.js` | `fichas/atipicos.js`, `fichas/ufc.js` |
| UFC | Curva | `pantallas/ufc/CurvaUfc.jsx`, `ParamUfc.jsx` | `calculo/ufc/ajuste.js` | `fichas/ufc.js` |
| — | OD ↔ UFC | `pantallas/calibracion/Combinado.jsx` | `calculo/calibracion/calibracion.js` | `fichas/calibracion.js` |
| Informe | Métodos | `pantallas/informe/Metodos.jsx` | un paso por cálculo: ecuación (`ui/mat.jsx`), ajustes activos y vínculo a su tabla de Datos (mismo `id` que `tablasDe`) | — |
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
- Pares y recta de calibración: `calibracionDe` en `pantallas/calibracion/Combinado.jsx` (pantalla, Datos y Métodos).
- μ por OD y por recuento: `comparacionMu` en `pantallas/od/Parametros.jsx`.
- Ajuste del modelo de la OD (por cepa o por réplica, caché por cepa): `ajustesOd` en `pantallas/od/Parametros.jsx`.
- Fórmulas simbólicas: `ui/mat.jsx`; fórmulas con números de un ajuste: `ui/ecuacionBonita.jsx`.

## Formato y estilo

- Paleta e íconos: variables en `estilo/base.css` y `estilo/estructura.css`; íconos en `ui/iconos.jsx` (los símbolos de la cinta se traducen a íconos con `ICONO_DE_SIMBOLO`).
- Gráficos: en pantalla, cuadrícula completa y ejes con flecha (`CuadriculaPantalla` en `ui/graficos/grafico.jsx`); al guardar la imagen, formato de publicación (grilla horizontal, sin flechas).
- Textos bajo tablas y gráficos: leyenda breve y formal; las explicaciones van en Métodos y en las fichas.
