# Guía del operador

Todo se maneja desde la planilla de Google. No hay otro panel. Pestañas: **Pedidos**, **Plantillas**, **Config**, **Envíos** (registro de correos), **Ingresos** (pagos recibidos), **Panel** (resumen) y **Stock resinas**.

## Qué pasa cuando llega una solicitud

1. El cliente sube sus archivos (STL, OBJ o PLY) y completa el formulario.
2. Se crea una carpeta en Drive con el nombre `ML-0001 - A.P.` (número de pedido e iniciales del paciente) y una fila nueva en **Pedidos** con Estado `Nuevo`.
3. El cliente recibe un correo de recepción y usted recibe un aviso con los enlaces a la carpeta y a la fila.

## Rutina diaria

1. Abra **Pedidos** y revise las filas nuevas (puede abrir la carpeta de Drive desde la columna _Archivos (Drive)_).
2. Para cotizar: escriba el valor en la columna **Cotización** (por ejemplo `$45.000 CLP por 2 piezas. Plazo: 3 días hábiles.`) y cambie **Estado** a `Cotizado`. En unos 5 minutos el cliente recibe el correo con su cotización y un enlace para confirmar.
3. Cuando el cliente confirma, la planilla cambia sola a `Confirmado` (columna _Confirmado_ con la fecha) y usted recibe un correo. El cliente recibe un correo de confirmación.
4. Pase el pedido a `En cola`, luego `Imprimiendo`, `Listo` (el correo indica la dirección de retiro) y `Entregado`. Use `Cancelado` si corresponde.
5. **Eliminación de archivos:** los archivos de un pedido `Entregado` o `Cancelado` se eliminan solos a los **30 días** de enviado ese correo (ver `ELIMINAR_ARCHIVOS_DIAS` en **Config**). Si prefiere hacerlo antes, seleccione la fila y use _Monolab > Eliminar archivos del pedido_. El sitio informa a los clientes (preguntas frecuentes y correo «Entregado») que los archivos se destruyen una vez finalizado el pedido.

Los correos se envían según el modo de `ENVIO_AUTOMATICO` en **Config** (ver «Envío con botones»). Con `SI`, cada cambio de **Estado** envía automáticamente el correo de ese estado en unos 5 minutos. Con `NO` (modo inicial), solo se envían al usar los botones. Excepción: `Cotizado` no se envía si la columna **Cotización** está vacía.

## Columnas de Pedidos

A ID Pedido · B Fecha · C **Estado** · D Odontólogo · E Email · F Teléfono · G Iniciales paciente · H Entrega (Flash 2 días / Normal 7 días) · I Tarifa entrega (CLP) · J Archivos (Drive) · K Nº archivos · L Volumen total (cm³) · M Detalle archivos · N Resina · O Copias · P Notas · Q **Cotización** · R Confirmado · S Estado notificado · T Última notificación · U **Enviar** (casilla; ver «Envío con botones») · V **Pago** (`Pagado` cuando se registra el pago; vacío = pendiente) · W **Fecha compromiso** (la escribe usted).

Puede corregir cualquier celda (por ejemplo un correo mal escrito): el siguiente aviso usará el dato corregido.

## Correos

| Estado                      | Correo que recibe el cliente                       |
| --------------------------- | -------------------------------------------------- |
| (al enviar la solicitud)    | Recibido                                           |
| Cotizado                    | Cotización y enlace para confirmar                 |
| Confirmado                  | Cotización confirmada                              |
| En cola                     | En cola de impresión                               |
| Imprimiendo                 | En producción                                      |
| Listo                       | Listo para retiro, con la dirección                |
| Entregado                   | Entregado, gracias                                 |
| Cancelado                   | Cancelado                                          |
| (a pedido, no es un Estado) | Datos de pago: cotización y cuenta para transferir |

**Reenviar un correo:** marque de nuevo la casilla **Enviar** (o use el menú y responda que sí). En modo automático también sirve borrar **Estado notificado** (columna S) de esa fila.

**Cambiar un correo:** edite la fila del estado en **Plantillas** (columnas _Asunto_ y _Mensaje_). Se aplica en el siguiente ciclo. Si deja un campo vacío o escribe un estado que no existe, el sistema usa el texto original, así que no se puede romper el envío.

Variables que puede usar: `{{datosPago}}` (el bloque «Datos para transferir» con la cuenta de **Config**; queda vacío si faltan datos) · `{{nombre}}` `{{orderId}}` `{{resumen}}` `{{whatsappLink}}` `{{sitio}}` `{{retiro}}` y, en el correo de cotización, `{{cotizacion}}` `{{confirmLink}}`. Si escribe una variable que no existe queda tal cual. La firma («Atentamente, Equipo Monolab Print Studio») se agrega siempre.

## Envío con botones

Con `ENVIO_AUTOMATICO` = `NO` en **Config**, el sitio no envía nada por sí solo: usted decide cuándo sale cada correo. Se envía siempre el correo que corresponde al **Estado** actual del pedido (Cotizado = cotización, Listo = listo para retiro, etc.).

**Casilla Enviar (columna U):** marque la casilla de la fila. En unos segundos el correo sale, la casilla se desmarca sola y una nota en la celda indica el resultado. Si ese correo ya se envió, la nota lo avisa y no lo repite; marque la casilla otra vez para reenviarlo.

**Menú Monolab** (arriba, junto a «Ayuda»):

- _Enviar correo de esta fila_: igual que la casilla, para la fila seleccionada; si ya se envió, pregunta si desea reenviarlo.
- _Enviar correos pendientes_: envía a todos los pedidos cuyo Estado cambió y aún no tienen su correo (hasta 50 por vez).
- _Enviar prueba a mi correo_: envía el correo de esa fila solo a usted, con «[PRUEBA]» en el asunto. No marca el pedido como enviado.
- _Enviar datos de transferencia_: envía al cliente del pedido seleccionado su cotización y la cuenta para pagar (ver «Pagos»).
- _Marcar pagado_: pide el monto recibido en pesos, lo confirma y lo registra (ver «Pagos»).
- _Versión del script_: muestra qué copia del script está instalada.
- _Eliminar archivos del pedido_: borra de forma definitiva la carpeta de Drive con los archivos 3D de la fila seleccionada. Solo funciona con pedidos `Entregado` o `Cancelado`, pide confirmación y no se puede deshacer. Anota «Eliminado» y la fecha en la columna **Archivos (Drive)** y deja el registro en **Envíos**.

Cada intento queda registrado en la hoja **Envíos** (fecha, pedido, estado, destinatario, resultado). No se envía si el Estado es `Nuevo`, si la fila no tiene correo, o si es `Cotizado` sin valor en **Cotización**.

**Instalación (una sola vez, unos 5 minutos):**

1. Abra la planilla de **pedidos** (no la planilla prototipo) y vaya a _Extensiones > Apps Script_.
2. Borre el contenido de `Código.gs` y pegue el archivo `docs/apps-script/Monolab.gs`. Guarde. (Las instrucciones paso a paso están también en `docs/apps-script/LEEME-es.md`.)
3. Opcional: en _Configuración del proyecto_ active «Mostrar el archivo de manifiesto» y pegue `docs/apps-script/appsscript.json`.
4. Vuelva a la planilla y recargue la página. Aparece el menú **Monolab**.
5. _Monolab > Configurar conexión_: deje la dirección en blanco y pegue la clave de envío (`SHEET_SECRET`). Google pedirá autorizar el script la primera vez.
6. _Monolab > Activar casilla «Enviar»_ (autoriza de nuevo una vez).
7. Pruebe con _Enviar prueba a mi correo_ en una fila con Estado distinto de `Nuevo`.

**Después de una actualización del archivo**, pegue de nuevo `Monolab.gs` completo en el mismo lugar y recargue la planilla; no hace falta repetir la conexión ni la casilla.

Para volver al envío automático, cambie `ENVIO_AUTOMATICO` a `SI` en **Config** (se aplica en menos de 5 minutos).

## Config

`RETIRO_DIRECCION` y `RETIRO_HORARIO`: aparecen en el sitio y en el correo «Listo». Los cambios se ven en el sitio en menos de 5 minutos.

`STOCK_MINIMO_ML`: ml bajo los cuales un lote de resina figura como `Bajo` (por defecto `200`).

`BANCO_*`: cuenta para recibir transferencias (ver «Pagos»).

`ELIMINAR_ARCHIVOS_DIAS`: días entre el correo «Entregado» o «Cancelado» y la eliminación automática de la carpeta de Drive (por defecto `30`). `0` o `NO` la desactiva; un valor ilegible también la desactiva. El plazo parte cuando se envía ese correo: si no lo envía, los archivos no se eliminan solos. Cada eliminación queda en **Envíos** con origen «Eliminación automática» y se anota en **Archivos (Drive)**.

`ENVIO_AUTOMATICO`: `NO` (por defecto) = los correos de estado solo salen con los botones; `SI` = salen solos cada 5 minutos.

## Pagos

- El correo **Confirmado** incluye los datos para transferir (bloque «Datos para transferir»), de modo que el cliente sabe cómo pagar apenas confirma.
- El correo **Pago** (pestaña **Plantillas**, fila `Pago`) reenvía esos datos junto con la cotización; no cambia el Estado ni se registra como «ya enviado», así que puede repetirlo. Solo se envía si el pedido ya está confirmado (Confirmado a Entregado), tiene Cotización y **Config** tiene todos los `BANCO_*`.
- **Registrar un pago:** cuando llegue la transferencia, use _Monolab > Marcar pagado_ en la fila del pedido: se anota el monto en pesos (número entero); eso agrega una fila en la pestaña **Ingresos** (fecha, pedido, monto, método) y deja `Pagado` en la columna **Pago**. Un pedido ya pagado no se puede registrar dos veces. El monto lo escribe usted: el sistema no lo deduce del texto de la cotización.
- Los datos de la cuenta se escriben solo en **Config**: `BANCO_TITULAR`, `BANCO_RUT`, `BANCO_BANCO`, `BANCO_TIPO_CUENTA`, `BANCO_CUENTA` y, opcional, `BANCO_CORREO`. Si falta alguno (salvo el correo) no se envía ningún dato bancario.

## Panel y stock de resina

- **Panel** es de solo lectura: se calcula solo con fórmulas. Muestra los pedidos por estado, el total, y lo que requiere atención: correos pendientes de enviar, cotizaciones esperando confirmación, pedidos por pagar (confirmados sin `Pagado`), entregas vencidas y para hoy, lotes de resina bajos o agotados, e ingresos del mes y totales. No escriba en esa pestaña.
- **Fecha compromiso** (columna W de Pedidos) debe ser una **fecha de verdad** (por ejemplo `20/10/2026`) para que el Panel cuente las entregas vencidas y las de hoy; el texto libre no se cuenta. Los pedidos `Entregado` o `Cancelado` nunca figuran como vencidos.
- **Stock resinas:** una fila por lote. Escriba **Lote**, **Resina**, **ml iniciales** y **ml usados** (usted suma a mano lo que consume cada pedido; no hay cálculo automático). Las columnas **ml restantes** y **Estado** se calculan: `OK`, `Bajo` (menos que `STOCK_MINIMO_ML` de **Config**, 200 ml por defecto) o `Agotado`.
- Si el Panel o Stock resinas muestran un error o se borraron por accidente, avise para regenerarlos.

## Importante

- No borre filas del medio de **Pedidos**: el siguiente número de pedido se calcula con el mayor `ML-` de la columna A.
- Los pacientes se identifican solo con iniciales. No escriba nombres completos de pacientes en **Notas**.
- Si un cliente dice que el enlace no funciona: el enlace sirve solo mientras el Estado sea `Cotizado` y la **Cotización** no haya cambiado. Si cambió el valor, el sistema envía un enlace nuevo al volver a poner `Cotizado` (borre antes _Estado notificado_).
