# Ceti Educadores: modelo de datos de cobros

Fuente del ciclo de vida: `functions/src/educadores/dominio/suscripcion.ts`, que es puro.
El servidor (`functions/src/educadores/{plan,suscripciones,wompi,correo,facturacion}.ts`) es el **único** que escribe estas colecciones; la app solo lee lo suyo (`firestore.rules`, bloque `EDUCADORES`) y pide los cambios por callables.

Fechas en **ms epoch** (`number`) y montos en **COP entero**, con IVA incluido. Wompi recibe centavos (×100) y esa conversión ocurre solo en `wompi.ts`.

## Colecciones

| Ruta | Qué guarda | Escribe | Lee el cliente |
|---|---|---|---|
| `suscripciones/{uid}` | `Suscripcion` del dominio + `planVigente`, `vigenteHasta`, `actualizadoAt` | `guardarSuscripcion` (plan.ts), desde `asegurarSuscripcion`, callables de cobro, webhook y ciclo diario | El dueño |
| `suscripciones/{uid}/uso/{YYYY-MM}` | `{ iaGeneraciones }`, el contador mensual de IA (mes en hora de Bogotá) | `limites.ts` (`registrarGeneracionIa`) | El dueño |
| `pagos/{referencia}` | `PagoServidor` (ver abajo). **El id del documento es la referencia de Wompi** | `suscripciones.ts` | El dueño (`resource.data.uid == auth.uid`) |
| `facturas/{pagoId}` | Factura electrónica: base, IVA, estado `pendiente` o `emitida`, id y número de Alegra, error | `facturacion.ts` | Nadie |
| `eventosPago/{txId}_{STATUS}` | Idempotencia del webhook: `{referencia, txId, estado, resultado, recibidoAt}` | `wompiEventos` | Nadie |
| `fundadores/contador` | `{ usados, actualizadoAt }`: cupos tomados de la tarifa fundador (tope `FUNDADOR.cupos` = 1.000) | `aplicarAprobado`, dentro de una transacción | Nadie |
| `mail/{auto}` | `{to, message: {subject, text, html}}`, la cola de la extensión Trigger Email (que añade `delivery`) | `correo.ts` (`encolarCorreo`) | Nadie |
| `bitacoras/{uid}/semanas/{YYYY-Www}` | `Bitacora` del dominio | `bitacoraSemanal.ts` | El dueño |
| `colegios/{cid}.licencia` | `LicenciaColegio` (Nave: `{plan:'nave', hasta, estudiantes, padrino?}`) | `activarLicenciaNave` (admin) | Miembros del colegio (regla existente de `colegios`) |

La catch-all `match /{document=**}` niega todo lo demás.

## `suscripciones/{uid}`

Todos los campos de `Suscripcion` (`dominio/suscripcion.ts`) más:

- `planVigente: PlanId` y `vigenteHasta: number`: salen de `vigencia(sub)`. Las reglas de contenido los usan con `request.time < vigenteHasta` sin reimplementar el ciclo de vida.
- `actualizadoAt`.

Siempre se sobrescribe completo con `guardarSuscripcion`. Nunca se hace un `update` parcial.

Estados: `prueba` → `activa` ↔ `en_mora` / `pausada` / `cancelada` → `gratis`. `gratis` equivale a Cadete. Al bajar de plan no se borra nada.

## `pagos/{referencia}`

| Campo | Tipo | Nota |
|---|---|---|
| `uid` | string | dueño |
| `referencia` | string | igual al id del documento |
| `plan` | `'piloto' \| 'comandante'` | |
| `ciclo` | `'mensual' \| 'anioEscolar'` | |
| `montoCop` | number | precio cobrado, con IVA incluido |
| `estado` | `'pendiente' \| 'aprobado' \| 'rechazado' \| 'reembolso_pendiente' \| 'reembolsado'` | |
| `metodo` | `MetodoPago \| null` | se completa al aprobar, según el `payment_method_type` de Wompi |
| `tipo` | `'checkout' \| 'recurrente' \| 'reembolso'` | |
| `creadoAt` | number | |
| `facturaUrl` | string \| null | PDF de Alegra, si lo devuelve |
| `email` | string \| null | correo del profe al crear el pago |
| `fundador` | bool | se cotizó con tarifa fundador |
| `renovacion` | bool | cobro automático de un periodo nuevo, iniciado por el ciclo diario |
| `fuentePagoId` | string \| null | fuente tokenizada de Wompi (solo en `recurrente`) |
| `wompiTxId` | string \| null | id de la transacción en Wompi |
| `finPeriodo`, `aprobadoAt` | number | al aprobar |
| `motivo` | string | al rechazar: `DECLINED`, `ERROR`, `VOIDED`, `sin_respuesta`, `fuente_rechazada` |
| `alerta` | string \| null | `monto_no_coincide` o `anulada_tras_aprobar`: requiere revisión de operaciones |
| `pagoOriginalId` / `reembolsoId` | string | enlazan el pago con su reembolso |

Prefijos de referencia:

- `ceti_<uid8>_<ms>`: lo inicia el profe (Web Checkout o primer cobro con medio guardado).
- `ren_<uid8>_<ms>`: renovación automática.
- `dev_<referencia original>`: reembolso por retracto.

Los primeros diez campos son el `PagoDoc` que lee la app (`src/features/educadores/data/suscripcionRepository.ts`). El índice compuesto es `uid ASC, creadoAt DESC` (`firestore.indexes.json`).

## Flujos

- **Checkout (pago único).** `crearCheckoutPlan` crea el pago como `pendiente` con tipo `checkout` y devuelve la URL firmada de Wompi. Wompi llama a `wompiEventos`. Con `APPROVED`, una transacción aplica `aplicarPagoAprobado`, toma el cupo fundador si corresponde, marca el pago y registra el evento. Después se emite la factura y se envía el correo de recibo.
- **Cobro automático.** `suscribirConMedio` hace estos pasos en orden:
  1. Pide el token de aceptación a Wompi.
  2. Con Nequi, el profe aprueba en su app, hasta unos 60 s.
  3. Crea la fuente de pago y la guarda en la suscripción (`fuentePagoId`, `metodo`).
  4. Crea el pago con tipo `recurrente` y cobra el primer periodo.

  Si la transacción vuelve `APPROVED` de inmediato, se aplica ahí mismo. Cuando el webhook llega después, ve el pago `aprobado` y no hace nada.
- **Ciclo diario** (`cicloSuscripciones`, 06:00 en Bogotá): recorre por páginas las suscripciones en `prueba`, `activa`, `en_mora`, `pausada` y `cancelada`, corre `cicloDiario`, guarda el resultado y ejecuta las acciones:
  - `cobrar`: un pago `ren_…` con `cobrarConFuente`. No se cobra si ya hay un cobro recurrente `pendiente` de los últimos 3 días.
  - `aviso`: envía el correo de la plantilla.
- **Rechazos.** Solo cambia un pago que está `pendiente`, así que es idempotente. Si era una renovación y la suscripción sigue `activa` o `en_mora` con el mismo plan, se aplica `aplicarPagoRechazado` (mora y reintentos) y se envía el correo `pago_rechazado`. Si Wompi no responde, el pago cuenta como rechazado sin enviar correo. Si el cobro sí ocurrió, el `APPROVED` posterior lo aplica, porque un pago `rechazado` todavía puede aprobarse.
- **Retracto.** Si `gestionarSuscripcion` cancela dentro de los 5 días hábiles, se crea `pagos/dev_…` en `reembolso_pendiente` y se encola un correo a operaciones. La devolución se hace a mano (ver `operacion.md`).
