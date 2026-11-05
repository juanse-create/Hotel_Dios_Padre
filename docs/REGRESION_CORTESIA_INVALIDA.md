# Corrección: cortesía inválida y total negativo — PR #4

## Reproducción y causa

Con máximo 30%, una habitación de 1000 por noche y dos noches, introducir
`44444444` generaba **−888886880.00** y un saldo falso de cero. Se reprodujo en
Chromium con el fixture sintético; la [captura anterior](evidence/cortesia-invalida-antes.png)
conserva la evidencia. La interfaz solo usaba `max` y validación al intentar guardar;
el cálculo convertía la cadena vacía en cero y aplicaba cualquier valor numérico.

## Corrección

- `public/cortesias-ui.js` contiene el validador y cálculo que usa el navegador.
  Se valida en `input`, antes de calcular, sin esperar a perder el foco.
- El límite debe haberse consultado correctamente. Si falta o falla su consulta,
  se bloquean tanto el cálculo de neto como el guardado.
- Se rechazan campos vacíos, valores negativos, no numéricos, mayores al máximo
  autorizado (que nunca supera 100%) y entradas con más de dos decimales.
- El error aparece junto al campo, con `role=alert`, `aria-invalid` y validez HTML
  personalizada. Para el caso informado: «La cortesía no puede superar el máximo
  autorizado del 30%.»
- El botón de guardar se deshabilita y atenúa. El manejador de guardado vuelve a
  validar, incluso si se llama directamente o se manipula el atributo `disabled`.
- Mientras la cortesía sea inválida, descuento, total neto y saldo muestran **—**,
  no un importe falso ni un saldo de cero. El subtotal y los pagos se conservan.
  Al corregir el valor, se recalcula y habilita el guardado sin recargar la página.
- Se muestra el descuento monetario y se calculan importes con centavos y
  centésimas de porcentaje para evitar errores de redondeo binario.
- El mismo formulario y manejadores se utilizan en Reservaciones y Recepción,
  tanto al crear como al editar.
- Las nuevas pruebas detectaron además pagos heredados al cambiar de formulario.
  Cada formulario nuevo limpia su lista; al editar se cargan los pagos guardados
  de esa reserva. No se borran pagos persistidos por limpiar el formulario.
- El backend conserva sus permisos y validación transaccional del límite. Solo se
  amplió su cobertura de pruebas; no se relajó ninguna autorización o límite.
- La política de pago positivo obligatorio continúa incluso con cortesía de 100%.

Se actualizaron las versiones de los recursos en `admin.html`. Para probar una
pestaña abierta antes del cambio, hacer una recarga completa (Ctrl+Shift+R).

## Escenarios obligatorios

Base de comprobación: subtotal 2000, pago registrado 100.

| Máximo | Entrada | Resultado antes de blur | Descuento | Total | Saldo |
| ---: | --- | --- | ---: | ---: | ---: |
| 30% | 20% | Válida, guardado habilitado | 400 | 1600 | 1500 |
| 30% | 30% | Válida, guardado habilitado | 600 | 1400 | 1300 |
| 30% | 31% | Error y guardado bloqueado | — | — | — |
| 30% | 44444444% | Error y guardado bloqueado | — | — | — |
| 30% | −1% | Error y guardado bloqueado | — | — | — |
| 30% | Vacía | Error y guardado bloqueado | — | — | — |
| 30% | 101%, 20.123%, entrada numérica incompleta `e` | Error y guardado bloqueado | — | — | — |
| 100% | 100% | Válida, con pago obligatorio | 2000 | 0 | 0 |

La matriz de entradas válidas/erróneas se ejecutó en cuatro contextos:
Reservaciones nueva, Recepción nueva, editor de Reservaciones y editor de Recepción.
Las afirmaciones se hacen inmediatamente después de escribir, antes de `blur`.
En cada entrada inválida también se invoca el manejador de guardado y se comprueba
que no se envía ninguna petición POST/PATCH de reserva. Al recuperar 30%, el error
se limpia y el botón vuelve a habilitarse.

Para 100%, se elimina el pago mediante el control real de la tabla y se comprueba
que aparece la exigencia de pago y no se envía una reserva. Las peticiones directas
al backend también prueban ausencia de pagos y valores fuera del rango, incluido
`44444444`, sin depender de las validaciones visuales.

## Pruebas y resultados finales

- `npm run build`: aprobado.
- `npm test -- --runInBand`: **79 pruebas aprobadas, 8 suites, 0 fallidas**.
- Suite e2e con arranque real: **2 aprobadas, 0 fallidas**.
- Integración completa HTTP/JWT, MariaDB y Chromium: **468 comprobaciones
  aprobadas**, incluidas **326** de navegador; no son 468 tests Jest independientes.
- `node --check public/admin.js`, `node --check public/cortesias-ui.js` y
  `git diff --check`: aprobados.
- Node 24.22.1, MariaDB 11.8.6, Chromium 155; únicamente filas sintéticas y BD local.

Comandos desde la raíz del repositorio, con MariaDB local activo:

```sh
npm run build
npm test -- --runInBand
BROWSER_TEST=1 EVIDENCE_DIR=docs/evidence/regresion-cortesias RESULTS_FILE=docs/evidence/regresion-cortesias-resultados.json TEST_APP_PORT=3100 DB_PORT=3307 node test/cortesias.integration.cjs
node test/start-cortesias-local.cjs /workspace/.hotel-dev/functional-test.json --e2e
```

El último comando usa el archivo privado del fixture conservado del entorno;
en otra instalación debe indicarse la ruta de su propio fixture. La integración
crea y elimina una base sintética nueva. No usa la base de demostración existente,
producción ni Railway. No se cambian esquema ni migraciones en esta corrección.

Registro estructurado: [regresion-cortesias-resultados.json](evidence/regresion-cortesias-resultados.json).
Este informe amplía y actualiza la validación anterior de 159 comprobaciones,
conservada en `VALIDACION_FUNCIONAL_SUPERADMIN.md` como antecedente.

## Capturas de Chromium

Todas muestran datos ficticios y no contienen contraseñas ni tokens.

- [Reservaciones: 44444444 rechazado](evidence/regresion-cortesias/cortesia-invalida-reservaciones.png)
- [Recepción: 44444444 rechazado](evidence/regresion-cortesias/cortesia-invalida-recepcion.png)
- [Edición de Reservaciones](evidence/regresion-cortesias/cortesia-invalida-edicion-reservaciones.png)
- [Edición de Recepción](evidence/regresion-cortesias/cortesia-invalida-edicion-recepcion.png)
- [20% válido con máximo 30%](evidence/regresion-cortesias/cortesia-valida-20.png)
- [30% válido con máximo 30%](evidence/regresion-cortesias/cortesia-valida-30.png)
- [100% válido con máximo 100% y pago registrado](evidence/regresion-cortesias/cortesia-valida-100.png)

No se accedió a producción ni se modificaron datos reales. No se hizo merge ni
se desplegó en Railway. Falta únicamente la revisión del PR y, como en la validación
anterior, un ensayo independiente en MySQL equivalente al esquema real.
