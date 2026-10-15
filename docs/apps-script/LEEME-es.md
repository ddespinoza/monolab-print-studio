# Apps Script de la planilla de pedidos

Esta carpeta tiene todo lo que hay que pegar. Se instala **una sola vez** (unos 5 minutos) en la planilla de **pedidos**, no en la planilla prototipo. Después de cualquier actualización del archivo, hay que volver a pegarlo (el menú **Monolab > Versión del script** dice qué copia está instalada; la actual es `2026-10-15 (pagos)`).

| Archivo           | Qué es                                                                               | Dónde va                                                          |
| ----------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `Monolab.gs`      | Todo el código: menú Monolab, casilla «Enviar», pagos, eliminar archivos.            | Reemplaza el contenido de `Código.gs`                             |
| `appsscript.json` | Permisos mínimos y zona horaria (opcional, pero recomendado: evita permisos de más). | _Configuración del proyecto_ > «Mostrar el archivo de manifiesto» |

## Instalación

1. Abra la planilla de **pedidos** y vaya a _Extensiones > Apps Script_.
2. En `Código.gs`, borre todo y pegue el contenido de `Monolab.gs`. Guarde (icono de disco).
3. Opcional: en _Configuración del proyecto_ (engranaje) active «Mostrar el archivo de manifiesto "appsscript.json" en el editor», abra `appsscript.json`, reemplace su contenido por el de esta carpeta y guarde.
4. Vuelva a la planilla y **recargue la página**. Aparece el menú **Monolab**, junto a «Ayuda».
5. _Monolab > Configurar conexión_: deje la dirección en blanco y pegue la **clave de envío** (`SHEET_SECRET`; se la entrega el administrador del sitio, no está en ninguna celda). Google pedirá autorizar el script: elija su cuenta y, si aparece «Google no ha verificado esta aplicación», use _Configuración avanzada > Ir a (proyecto)_ y _Permitir_. Es su propio script.
6. _Monolab > Activar casilla «Enviar»_ (autoriza una vez más).
7. Pruebe: elija un pedido con Estado distinto de `Nuevo` y use _Monolab > Enviar prueba a mi correo_. Llega solo a usted, con «[PRUEBA]» en el asunto.

## Qué hace cada opción del menú

- **Enviar correo de esta fila**: el correo que corresponde al Estado actual del pedido seleccionado.
- **Enviar correos pendientes**: a todos los pedidos cuyo Estado cambió y aún no tienen su correo.
- **Enviar prueba a mi correo**: vista previa solo para usted; no marca nada como enviado.
- **Enviar datos de transferencia**: la cotización y la cuenta para pagar (pedido confirmado o posterior). Se puede repetir.
- **Marcar pagado**: pide el monto en pesos; anota una fila en **Ingresos** y deja `Pagado` en la columna **Pago**.
- **Eliminar archivos del pedido**: borra de forma definitiva la carpeta de Drive (solo `Entregado` o `Cancelado`).
- **Casilla «Enviar» (columna U)**: marcarla envía el correo de esa fila; el script la desmarca y deja una nota con el resultado.

El script no guarda textos de correo ni datos bancarios: todo lo decide el sitio. Si algo falla, el mensaje aparece en pantalla o como nota en la casilla.
