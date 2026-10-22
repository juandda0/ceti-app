# Ceti Educadores: operación de cobros

Runbook para poner en marcha y operar los cobros de los profes: Wompi, correo y facturación electrónica. Código en `functions/src/educadores/` y modelo en [modelo-datos.md](modelo-datos.md).

## 1. Llaves de Wompi

En el panel de comercios de Wompi (comercios.wompi.co), entra a **Desarrolladores → Llaves**. Hay un juego de llaves para sandbox y otro para producción; no se mezclan.

| Parámetro | Tipo | Valor |
|---|---|---|
| `WOMPI_ENV` | string (`functions/.env`) | `sandbox` o `production` |
| `WOMPI_PUBLIC_KEY` | string (`functions/.env`) | `pub_test_…` o `pub_prod_…` |
| `WOMPI_PRIVATE_KEY` | secreto | `prv_test_…` o `prv_prod_…` |
| `WOMPI_INTEGRITY_SECRET` | secreto | Secreto de **integridad** (`test_integrity_…`) |
| `WOMPI_EVENTS_SECRET` | secreto | Secreto de **eventos** (`test_events_…`) |

Ejemplo de `functions/.env`:

```bash
WOMPI_ENV=sandbox
WOMPI_PUBLIC_KEY=pub_test_xxxxx
CETI_OPS_EMAIL=operaciones@ceti.co
URL_RETORNO_PAGO=https://ceti-d3769.web.app/pago
```

Para crear los secretos, corre cada comando y pega el valor cuando lo pida:

```bash
firebase functions:secrets:set WOMPI_PRIVATE_KEY
```

```bash
firebase functions:secrets:set WOMPI_INTEGRITY_SECRET
```

```bash
firebase functions:secrets:set WOMPI_EVENTS_SECRET
```

Las funciones de cobro también declaran `ALEGRA_USER` y `ALEGRA_TOKEN` (sección 4). El deploy exige que todos estos secretos existan. Mientras no haya cuenta de Alegra, créalos con el valor `pendiente`: el código toma `pendiente` como "sin configurar" y deja las facturas pendientes para hacerlas a mano.

Nunca se registran en logs tokens, datos de tarjeta, celulares ni secretos. Los datos de la tarjeta no pasan por Ceti: la app los tokeniza directamente con Wompi usando la llave pública.

## 2. URL del webhook

En Wompi, entra a **Desarrolladores → URL de eventos** y configura una URL para cada entorno:

```
https://us-central1-ceti-d3769.cloudfunctions.net/wompiEventos
```

Pasos de verificación:

- `wompiEventos` comprueba la firma (`signature.checksum`) con `WOMPI_EVENTS_SECRET`. Si no coincide, responde **401**.
- Con una firma válida responde 200, también para eventos que ignora. Si algo falla por dentro, responde 500 y Wompi reintenta. El procesamiento es idempotente (`eventosPago/{txId}_{status}`).
- Si cambias de sandbox a producción, cambia **las cuatro** llaves y la URL de eventos del entorno de producción.

## 3. Pruebas en sandbox

1. `WOMPI_ENV=sandbox` con llaves `pub_test` y `prv_test`, y despliega.
2. **Checkout:** en la app, Planes → Piloto mensual → pagar. Wompi abre su checkout. Con tarjeta, usa los datos de prueba de la documentación de Wompi:
   - `4242 4242 4242 4242` → APPROVED.
   - `4111 1111 1111 1111` → DECLINED.
   - Cualquier CVC y una fecha futura.
3. Revisa en Firestore:
   - `pagos/ceti_…` → `aprobado`.
   - `suscripciones/{uid}` → `activa`, con `planVigente: 'piloto'`.
   - `fundadores/contador.usados` → +1.
   - `mail/…` → recibo.
   - `facturas/ceti_…` → `pendiente` si Alegra no está configurado.
4. **Nequi:** en sandbox, `3991111111` aprueba y `3992222222` rechaza (según la documentación de Wompi; confírmalo en la versión vigente). La función espera hasta unos 60 s la aprobación.
5. **Reenvío del webhook:** desde el panel, reenvía el evento. Debe responder `duplicado` y no sumar otro cupo fundador.
6. **Ciclo diario:** para probar sin esperar, en Cloud Scheduler entra a `firebase-schedule-cicloSuscripciones-…` y elige **Forzar ejecución**. Para probar una renovación, en sandbox pon `finPeriodo` en el pasado en una suscripción activa con `fuentePagoId`.

No se probó contra el Wompi real en esta pasada: los tests usan un `fetch` falso. La primera prueba en sandbox es el paso pendiente.

## 4. Facturación electrónica (Alegra + DIAN)

Ceti factura cada pago aprobado. `facturas/{pagoId}` siempre se crea, y si Alegra está configurado se emite ahí.

1. Crea la cuenta de Alegra y habilita la **facturación electrónica DIAN**: resolución de numeración, set de pruebas y habilitación en el portal DIAN. Alegra guía el proceso.
2. En Alegra crea:
   - Un contacto **consumidor final** con identificación `222222222222`. Su id va en `ALEGRA_CLIENTE_ID`.
   - Un producto o servicio "Suscripción Ceti". Su id va en `ALEGRA_ITEM_ID`.
   - El impuesto **IVA 19 %**. Su id va en `ALEGRA_IVA_ID`.
3. En `functions/.env` van `ALEGRA_CLIENTE_ID`, `ALEGRA_ITEM_ID` y `ALEGRA_IVA_ID`. Los secretos son `ALEGRA_USER` (correo de la cuenta) y `ALEGRA_TOKEN` (en Configuración → Integraciones → API):

```bash
firebase functions:secrets:set ALEGRA_TOKEN
```

4. Cada factura lleva el ítem "Ceti {Plan} {ciclo}" con precio base = total / 1,19 y el IVA del 19 %, y la marca `stamp.generateStamp` para que Alegra la transmita a la DIAN.
5. **Si falla** (Alegra caído, ids mal puestos, cuenta sin habilitar), la factura queda `pendiente` con `error`. Revisa la consulta `facturas where estado == 'pendiente'`, emite esas facturas a mano en Alegra y marca el documento como `emitida` con su `numero`.

> El cuerpo exacto de la API de Alegra (`client`, `items[].id`, `stamp`) se escribió según su documentación pública y **no se probó contra una cuenta real**. Verifícalo con una factura de prueba antes de producción.

**IVA del 19 %: pendiente de confirmar con un tributarista.** Los precios se anuncian con IVA incluido porque la exclusión del art. 476 E.T. para plataformas educativas es dudosa (Oficio DIAN 362 de 2018). Si un tributarista concluye que el servicio está excluido, ajusta `IVA` en `dominio/precios.ts` y el impuesto en Alegra.

## 5. Correo (extensión Trigger Email)

1. Instala la extensión desde Firebase Console → Extensions → **Trigger Email from Firestore** (`firebase/firestore-send-email`).
2. Configúrala así:
   - Colección `mail`.
   - SMTP: por ejemplo, SendGrid, Brevo o Google Workspace con contraseña de aplicación.
   - Remitente `Ceti <hola@ceti.co>`.
3. Para probarla, crea a mano un documento en `mail` con `{to, message: {subject, text}}` y revisa que la extensión escriba `delivery.state = SUCCESS`.

Plantillas (`correo.ts`):

- Avisos del ciclo: `fin_prueba_pronto`, `renovacion_anual_pronto`, `renovacion_manual_pronto`, `pausa_termina_pronto` y `bajo_a_cadete`.
- Cobros: `recibo` y `pago_rechazado`.
- Operaciones y retención: `reembolso_ops` y `nave_cupo_ops` (van a `CETI_OPS_EMAIL`) y `bitacora`.
- Estudiantes: `invitacion_clase` (ver abajo).

Las del profe dicen dónde gestionar el plan: **Perfil → Tu plan**. Las de operaciones y la del estudiante llevan su propio pie.

### Invitación a la clase (`invitacion_clase`)

Cuando `invitarLista` invita a un estudiante, le encola un correo con el nombre de la clase, el del profe (`token.name`), el enlace de la app (`URL_APP`) y la instrucción de iniciar sesión con **ese mismo correo**. Así queda unido a la clase sin código.

- **Una sola vez por invitación.** La misma transacción escribe el correo y `correoEnviadoAt` en `colegios/{cid}/cursos/{cursoId}/invitados/{correo}`. Si el profe vuelve a pegar la lista, no sale otro. Un invitado `pendiente` sin `correoEnviadoAt` (invitado antes de que existiera el correo, o con un envío fallido) lo recibe al volver a aparecer en una lista.
- **Escrito para un menor.** Le habla al estudiante, no le pide ningún dato ni pago y no lleva su nombre ni el de nadie más: solo su propio correo, la clase y el profe.
- **Reenviar a mano** (por ejemplo, si el correo rebotó y el profe corrigió la dirección): borra `correoEnviadoAt` del invitado y pide al profe que pegue esa fila otra vez.
- Si el envío falla, la invitación igual queda hecha y se ve en el log como `invitarLista: no se pudo encolar la invitación`.

## 6. Retractos y devoluciones

El profe cancela en un toque desde Perfil → Tu plan. Dentro de los **5 días hábiles** desde el primer pago del contrato (Ley 1480, art. 47, sin contar festivos colombianos), el servidor:

- Deja la suscripción en `gratis` (Cadete) de inmediato.
- Crea `pagos/dev_<referencia>` en `reembolso_pendiente` y enlaza el original con `reembolsoId`.
- Envía el correo "Retracto: devolver $X (referencia)" a `CETI_OPS_EMAIL`.

**Wompi no devuelve automáticamente:** la devolución se hace a mano.

1. Panel de Wompi → **Transacciones** → busca la referencia o el id de transacción del correo.
2. Pide la **devolución total**:
   - Tarjeta: la anulación o reverso sale del panel.
   - Nequi o PSE: según lo que permita Wompi para ese medio. Si no hay devolución en el panel, haz una transferencia al profe y pídele los datos por soporte.
3. En Firestore, cambia `pagos/dev_…` a `estado: 'reembolsado'` y añade `reembolsadoAt` (ms) y `nota`.
4. Anula la factura en Alegra con una nota crédito.

Plazo legal: hasta **30 días calendario** desde la solicitud.

Las alertas de pago también se revisan a mano:

- `monto_no_coincide`: llegó un `APPROVED` por un monto distinto al cotizado y no se aplicó.
- `anulada_tras_aprobar`: Wompi anuló (`VOIDED`) una transacción ya aplicada y el plan no se retiró solo.

Ambas se encuentran con la consulta `pagos where alerta != null`.

## 7. Licencia Nave (colegio)

Nave se contrata como colegio: se cotiza con `cotizarNave` (dominio) y se cobra por fuera de la app, con factura en Alegra. Después de firmar el contrato y recibir el pago, un **admin** de Ceti llama al callable `activarLicenciaNave` desde el panel admin:

```json
{ "colegioId": "colegio-x", "estudiantes": 320, "hastaMs": 1798761600000, "padrino": "Fundación Y" }
```

Escribe `colegios/{cid}.licencia = {plan:'nave', hasta, estudiantes, padrino}`. Todos los profes de ese colegio quedan con Nave hasta `hasta` (lo calcula `planDeProfe` con `mejorPlan`). Para renovar, se vuelve a llamar con un `hastaMs` nuevo. Al vencer, cada profe vuelve a su plan individual sin que se borre nada.

### Cupo de estudiantes de la licencia

Mientras la licencia está vigente, el servidor cuenta los estudiantes de **todo el colegio** frente a `licencia.estudiantes` (`limites.ts`: `cupoNave`, puro). Cuenta el roster de cada clase sin los `suprimido` (los `pendiente_atestacion` sí ocupan cupo). Aplica en `joinByCode`, en la unión por invitación de `resolveMyAccess` (ambas pasan por `asegurarCupoEstudiante`) y en `invitarLista`, que además cuenta las invitaciones pendientes del colegio.

- **Hasta el número de la licencia:** todo normal.
- **Margen del 10 %** (al menos 1; con 320 licenciados, hasta 352): nadie queda por fuera. Al entrar el primero por encima del número de la licencia se encola el correo `nave_cupo_ops` a `CETI_OPS_EMAIL` ("Nave: <colegio> llegó a su cupo"), con el colegio, los números, el fin de la licencia y el padrino. Sale **una vez por licencia**: la marca es `colegios/{cid}.avisoCupoNave.clave = "{hasta}_{estudiantes}"`.
- **Pasado el margen:** un estudiante nuevo recibe `limite_estudiantes` (`resource-exhausted`, `details = {codigo, plan: 'nave', limite: <licenciados>}`) con un mensaje amable: "Tu colegio ya llenó sus cupos en Ceti por ahora…". En `invitarLista` los que no caben vuelven en `sinCupo` con `sinCupoPor: 'colegio'`. Nadie que ya esté en una clase pierde su lugar.

Qué hacer al recibir el aviso: habla con el colegio para ampliar o renovar y vuelve a llamar `activarLicenciaNave` con el nuevo `estudiantes` (y `hastaMs`). La nueva licencia cambia la clave, así que si se vuelve a llenar llega otro aviso.

El tope por clase de cada plan (60 en Nave) sigue aplicando aparte.

## 8. Parámetros, en resumen

| Nombre | Tipo | Por defecto |
|---|---|---|
| `WOMPI_ENV` | string | `sandbox` |
| `WOMPI_PUBLIC_KEY` | string | (vacío = pagos apagados) |
| `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | secreto | — |
| `ALEGRA_USER`, `ALEGRA_TOKEN` | secreto | `pendiente` = sin Alegra |
| `ALEGRA_CLIENTE_ID`, `ALEGRA_ITEM_ID`, `ALEGRA_IVA_ID` | string | vacío |
| `CETI_OPS_EMAIL` | string | correo del admin raíz |
| `URL_RETORNO_PAGO` | string | `https://ceti-d3769.web.app/pago` |
| `URL_APP` | string | `https://ceti-d3769.web.app` (enlace del correo de invitación) |
