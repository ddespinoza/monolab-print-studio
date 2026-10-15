/**
 * Monolab Print Studio: botones de la planilla de pedidos.
 * Pegar en la planilla de PEDIDOS: Extensiones > Apps Script. No va en la planilla prototipo.
 * El script no guarda textos de correo ni claves en celdas: pide al sitio que envíe (POST /api/send).
 */
var HOJA_PEDIDOS = 'Pedidos';
var COL_ENVIAR = 21; // U
var SITIO_POR_DEFECTO = 'https://monolabprintstudio.cl';
var AVISO_REENVIO = 'Ya se envió este correo. Marque la casilla otra vez para reenviarlo.';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Monolab')
    .addItem('Enviar correo de esta fila', 'enviarFilaSeleccionada')
    .addItem('Enviar correos pendientes', 'enviarPendientes')
    .addItem('Enviar prueba a mi correo', 'enviarPrueba')
    .addSeparator()
    .addItem('Activar casilla «Enviar»', 'instalarCasilla')
    .addItem('Configurar conexión', 'configurarConexion')
    .addToUi();
}

/** Llama a POST /api/send. Devuelve { ok, data, error } con el error ya en español. */
function llamarSitio_(cuerpo) {
  var props = PropertiesService.getScriptProperties();
  var clave = props.getProperty('SHEET_SECRET');
  if (!clave) return { ok: false, error: 'Falta la clave. Use Monolab > Configurar conexión.' };
  var sitio = (props.getProperty('SITE_URL') || SITIO_POR_DEFECTO).replace(/\/+$/, '');
  var resp;
  try {
    resp = UrlFetchApp.fetch(sitio + '/api/send', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + clave },
      payload: JSON.stringify(cuerpo),
      muteHttpExceptions: true,
    });
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar con el sitio. Inténtelo de nuevo.' };
  }
  var codigo = resp.getResponseCode();
  if (codigo === 200) {
    try {
      return { ok: true, data: JSON.parse(resp.getContentText()) };
    } catch (e) {
      return { ok: false, error: 'Respuesta inesperada del sitio.' };
    }
  }
  var errores = {
    401: 'Clave incorrecta. Use Monolab > Configurar conexión.',
    503: 'El envío desde la planilla está desactivado en el sitio.',
    409: 'Hay otro envío en curso. Espere un minuto e inténtelo de nuevo.',
    400: 'Solicitud no válida.',
  };
  return { ok: false, error: errores[codigo] || 'El sitio respondió con error (' + codigo + ').' };
}

function idDeFila_(hoja, fila) {
  var id = String(hoja.getRange(fila, 1).getValue()).trim();
  return /^ML-\d{4,}$/.test(id) ? id : '';
}

/** Pedido de la fila seleccionada, o '' tras avisar al operador. */
function pedidoSeleccionado_() {
  var ui = SpreadsheetApp.getUi();
  var hoja = SpreadsheetApp.getActiveSheet();
  var fila = hoja.getActiveCell().getRow();
  var id = hoja.getName() === HOJA_PEDIDOS && fila >= 2 ? idDeFila_(hoja, fila) : '';
  if (!id) ui.alert('Seleccione una fila de pedido en la hoja «' + HOJA_PEDIDOS + '».');
  return id;
}

function enviarFilaSeleccionada() {
  var ui = SpreadsheetApp.getUi();
  var id = pedidoSeleccionado_();
  if (!id) return;
  var r = llamarSitio_({ action: 'row', orderId: id });
  if (!r.ok) return void ui.alert(r.error);
  var res = r.data.results[0];
  if (res.status === 'already_sent') {
    var otra = ui.alert('Correo ya enviado', res.message + '\n\n¿Desea reenviarlo?', ui.ButtonSet.YES_NO);
    if (otra !== ui.Button.YES) return;
    r = llamarSitio_({ action: 'row', orderId: id, force: true });
    if (!r.ok) return void ui.alert(r.error);
    res = r.data.results[0];
  }
  ui.alert(res.message);
}

function enviarPrueba() {
  var ui = SpreadsheetApp.getUi();
  var id = pedidoSeleccionado_();
  if (!id) return;
  var r = llamarSitio_({ action: 'test', orderId: id });
  ui.alert(r.ok ? r.data.results[0].message : r.error);
}

function enviarPendientes() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert(
    'Enviar correos pendientes',
    'Se enviará a cada cliente el correo que corresponde al Estado de su pedido, si aún no se envió. ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (ok !== ui.Button.YES) return;
  var r = llamarSitio_({ action: 'pending' });
  if (!r.ok) return void ui.alert(r.error);
  var resultados = r.data.results;
  if (resultados.length === 0) return void ui.alert('No hay correos pendientes.');
  var enviados = resultados.filter(function (x) { return x.status === 'sent'; }).length;
  var detalle = resultados
    .filter(function (x) { return x.status !== 'sent'; })
    .slice(0, 10)
    .map(function (x) { return x.orderId + ': ' + x.message; });
  ui.alert(
    'Enviados: ' + enviados + ' de ' + resultados.length +
      (detalle.length ? '\n\nRevisar:\n' + detalle.join('\n') : '')
  );
}

/** Casilla «Enviar» (columna U). Trigger instalable: marcar la casilla envía el correo de esa fila. */
function onEnviarEdit(e) {
  if (!e || !e.range) return;
  var celda = e.range;
  var hoja = celda.getSheet();
  if (hoja.getName() !== HOJA_PEDIDOS || celda.getColumn() !== COL_ENVIAR) return;
  if (celda.getNumRows() !== 1 || celda.getNumColumns() !== 1 || celda.getRow() < 2) return;
  if (celda.getValue() !== true) return;
  var bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(30000)) {
    celda.setValue(false);
    celda.setNote('Hay otro envío en curso. Marque la casilla de nuevo en un minuto.');
    return;
  }
  try {
    var id = idDeFila_(hoja, celda.getRow());
    if (!id) {
      celda.setNote('Esta fila no tiene un ID de pedido válido.');
      return;
    }
    var reenvio = celda.getNote() === AVISO_REENVIO;
    var cuerpo = { action: 'row', orderId: id };
    if (reenvio) cuerpo.force = true;
    var r = llamarSitio_(cuerpo);
    if (!r.ok) {
      celda.setNote(r.error);
    } else {
      var res = r.data.results[0];
      celda.setNote(res.status === 'already_sent' ? AVISO_REENVIO : res.message);
    }
  } finally {
    celda.setValue(false);
    bloqueo.releaseLock();
  }
}

function instalarCasilla() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existe = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'onEnviarEdit';
  });
  if (!existe) ScriptApp.newTrigger('onEnviarEdit').forSpreadsheet(ss).onEdit().create();
  ui.alert('Listo. Marque la casilla «Enviar» (columna U) de un pedido para enviar su correo.');
}

function configurarConexion() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var sitio = ui.prompt('Dirección del sitio', 'Deje en blanco para usar ' + SITIO_POR_DEFECTO, ui.ButtonSet.OK_CANCEL);
  if (sitio.getSelectedButton() !== ui.Button.OK) return;
  var clave = ui.prompt('Clave de envío', 'Pegue la clave (SHEET_SECRET) entregada por el administrador del sitio.', ui.ButtonSet.OK_CANCEL);
  if (clave.getSelectedButton() !== ui.Button.OK || !clave.getResponseText().trim()) return;
  props.setProperty('SITE_URL', sitio.getResponseText().trim() || SITIO_POR_DEFECTO);
  props.setProperty('SHEET_SECRET', clave.getResponseText().trim());
  ui.alert('Conexión guardada.');
}
