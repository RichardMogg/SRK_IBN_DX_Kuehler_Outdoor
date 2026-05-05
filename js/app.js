var lineBreak = String.fromCharCode(10);
var csvLineBreak = String.fromCharCode(13, 10);

var signatureDirty = false;
var signatureDrawing = false;
var editingIndex = null;
var crcTable = null;

var appState = {
  version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'SCHRACK_DX_OUTDOOR_V1.0',
  protocols: [],
  draft: null
};

var photoStore = {};
var currentPhotos = [];
var logoSvgCache = '';

window.addEventListener('load', function () {
  setDefaultDate();
  renderInbetriebnahmeChecks();
  loadRefrigerantOptions();
  bindEvents();
  initSignatureCanvas();
  loadState();
  restoreDraft();
  renderProtocolList();
  updateSummaries();
  updateEditModeUI();
  setStatus('Inbetriebnahmeprotokoll DX Kühler Outdoor geladen.', 'ok');
  startAtTop();
});

function startAtTop() {
  document.querySelectorAll('details.section').forEach(function (section) {
    section.open = section.id === 'sectionStammdaten';
  });

  setTimeout(function () {
    window.scrollTo(0, 0);
  }, 0);
}

function setDefaultDate() {
  var field = document.querySelector('[data-field="datum"]');

  if (field && !field.value) {
    field.value = new Date().toISOString().slice(0, 10);
  }
}

function renderInbetriebnahmeChecks() {
  var body = document.getElementById('inbetriebnahmeBody');

  if (!body) {
    return;
  }

  body.innerHTML = '';

  for (var i = 0; i < INBETRIEBNAHME_CHECKS.length; i++) {
    var row = INBETRIEBNAHME_CHECKS[i];
    var tr = document.createElement('tr');

    tr.innerHTML =
      '<td><strong>' + escapeHtml(row.label) + '</strong></td>' +
      '<td><input type="radio" name="check_' + escapeHtml(row.key) + '" value="Ja"></td>' +
      '<td><input type="radio" name="check_' + escapeHtml(row.key) + '" value="Nein"></td>' +
      '<td><input class="table-input" data-check-note="' + escapeHtml(row.key) + '" autocomplete="off"></td>';

    body.appendChild(tr);
  }
}

function loadRefrigerantOptions() {
  var select = document.getElementById('kaeltemittelSelect');

  if (!select) {
    return;
  }

  fetch('data/kaeltemittel.txt')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Kältemittelliste konnte nicht geladen werden: HTTP ' + response.status);
      }

      return response.text();
    })
    .then(function (text) {
      var selectedValue = select.value;

      var items = text
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(function (line) {
          return line && line.charAt(0) !== '#';
        });

      fillRefrigerantSelect(select, items, selectedValue);
    })
    .catch(function (err) {
      console.warn(getErrorText(err));
      fillRefrigerantSelect(select, KAELTEMITTEL_FALLBACK, select.value);
      setStatus('Hinweis: Kältemittelliste konnte nicht geladen werden. Fallback-Liste wurde verwendet.', 'error');
    });
}

function fillRefrigerantSelect(select, items, selectedValue) {
  select.innerHTML = '<option value="">Kältemittel auswählen</option>';

  for (var i = 0; i < items.length; i++) {
    var option = document.createElement('option');
    option.value = items[i];
    option.textContent = items[i];
    select.appendChild(option);
  }

  if (selectedValue) {
    select.value = selectedValue;
  }
}

function bindEvents() {
  document.getElementById('saveStammdatenButton').addEventListener('click', function () {
    saveDraft();
    openSection('sectionKopfdaten', true);
    setStatus('Stammdaten gespeichert.', 'ok');
  });

  document.getElementById('fotoInput').addEventListener('change', updatePhotoListFromInput);
  document.getElementById('clearSignatureButton').addEventListener('click', clearSignature);
  document.getElementById('takeProtocolButton').addEventListener('click', takeProtocolIntoList);
  document.getElementById('bottomTakeButton').addEventListener('click', takeProtocolIntoList);
  document.getElementById('bottomTopButton').addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('clearFormButton').addEventListener('click', function () {
    resetCurrentForm(true);
  });
  document.getElementById('exportZipButton').addEventListener('click', exportZip);
  document.getElementById('saveDraftButton').addEventListener('click', function () {
    saveDraft();
  });
  document.getElementById('clearAllButton').addEventListener('click', clearAll);

  document.getElementById('importJsonButton').addEventListener('click', function () {
    document.getElementById('importJsonInput').click();
  });

  document.getElementById('importJsonInput').addEventListener('change', importJsonFromFile);

  document.getElementById('protocolForm').addEventListener('input', throttledDraftSave);
  document.getElementById('protocolForm').addEventListener('change', function () {
    throttledDraftSave();
    updateSummaries();
  });

  document.getElementById('kundeInput').addEventListener('input', throttledDraftSave);
  document.getElementById('objektInput').addEventListener('input', throttledDraftSave);
  document.getElementById('bemerkungenText').addEventListener('input', throttledDraftSave);
}

var draftTimer = null;

function throttledDraftSave() {
  clearTimeout(draftTimer);

  draftTimer = setTimeout(function () {
    saveDraft(false);
    updateSummaries();
  }, 450);
}

function openSection(id, closeOthers) {
  document.querySelectorAll('details.section').forEach(function (section) {
    if (closeOthers) {
      section.open = false;
    }

    if (section.id === id) {
      section.open = true;
    }
  });

  var target = document.getElementById(id);

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function collectProtocol() {
  return {
    stammdaten: {
      kunde: document.getElementById('kundeInput').value || '',
      objektanschrift: document.getElementById('objektInput').value || ''
    },
    kopfdaten: collectFields(document.getElementById('kopfdatenFields')),
    geraete: collectFields(document.getElementById('geraeteFields')),
    inbetriebnahmeinhalt: collectInbetriebnahmeChecks(),
    spannungsversorgung: collectSectionData('spannungFields', [
      'reparaturschalterAg',
      'kommunikationsleitungAg'
    ]),
    kaeltekreislauf: collectSectionData('kaeltekreislaufFields', [
      'mitStickstoffGeloetet',
      'isolierteSaugFluessigkeitsleitung'
    ]),
    testbetrieb: collectSectionData('testbetriebFields', [
      'kabelCheck',
      'erfolgreicherTestbetrieb'
    ]),
    dichtheitspruefung: collectSectionData('dichtheitFields', [
      'dichtheitspruefungDruckmanometer'
    ]),
    kuehlbetrieb: collectFields(document.getElementById('kuehlbetriebFields')),
    kaeltemittelFuellmenge: collectFields(document.getElementById('kaeltemittelFields')),
    inbetriebnahmeergebnis: collectSectionData('ergebnisFields', [
      'erfolgreichAbgeschlossen',
      'folgeterminNoetig',
      'abgebrochen'
    ]),
    zusatzplatinen: collectSectionData('zusatzFields', [
      'zusatzplatinenVerwendung'
    ]),
    dokumentation: collectSectionData('dokumentationFields', [
      'uebergabeDokumentationBetreiber',
      'einweisungBetreiber'
    ]),
    bemerkungen: document.getElementById('bemerkungenText').value || '',
    fotos: getPhotoMetaForCurrent(),
    unterschrift: {
      name: document.getElementById('signTechnikerInput').value || '',
      vorhanden: signatureDirty,
      pngDataUrl: signatureDirty ? document.getElementById('signatureCanvas').toDataURL('image/png') : '',
      jpegDataUrl: signatureDirty ? getSignatureJpegDataUrl() : ''
    }
  };
}

function collectFields(container) {
  var result = {};

  if (!container) {
    return result;
  }

  container.querySelectorAll('[data-field]').forEach(function (field) {
    result[field.getAttribute('data-field')] = field.value || '';
  });

  return result;
}

function collectSectionData(containerId, radioNames) {
  var result = collectFields(document.getElementById(containerId));

  for (var i = 0; i < radioNames.length; i++) {
    result[radioNames[i]] = getRadioValue(radioNames[i]);
  }

  return result;
}

function collectInbetriebnahmeChecks() {
  var result = [];

  for (var i = 0; i < INBETRIEBNAHME_CHECKS.length; i++) {
    var row = INBETRIEBNAHME_CHECKS[i];

    result.push({
      key: row.key,
      label: row.label,
      status: getRadioValue('check_' + row.key),
      wertHinweis: getCheckNote(row.key)
    });
  }

  return result;
}

function getCheckNote(key) {
  var field = document.querySelector('[data-check-note="' + cssEscape(key) + '"]');
  return field ? field.value || '' : '';
}

function setCheckNote(key, value) {
  var field = document.querySelector('[data-check-note="' + cssEscape(key) + '"]');

  if (field) {
    field.value = value || '';
  }
}

function fillFormFromProtocol(data) {
  data = data || {};

  document.getElementById('kundeInput').value = data.stammdaten && data.stammdaten.kunde || '';
  document.getElementById('objektInput').value = data.stammdaten && data.stammdaten.objektanschrift || '';

  setFields(document.getElementById('kopfdatenFields'), data.kopfdaten || {});
  setFields(document.getElementById('geraeteFields'), data.geraete || {});
  setFields(document.getElementById('spannungFields'), data.spannungsversorgung || {});
  setFields(document.getElementById('kaeltekreislaufFields'), data.kaeltekreislauf || {});
  setFields(document.getElementById('testbetriebFields'), data.testbetrieb || {});
  setFields(document.getElementById('dichtheitFields'), data.dichtheitspruefung || {});
  setFields(document.getElementById('kuehlbetriebFields'), data.kuehlbetrieb || {});
  setFields(document.getElementById('kaeltemittelFields'), data.kaeltemittelFuellmenge || {});
  setFields(document.getElementById('ergebnisFields'), data.inbetriebnahmeergebnis || {});
  setFields(document.getElementById('zusatzFields'), data.zusatzplatinen || {});
  setFields(document.getElementById('dokumentationFields'), data.dokumentation || {});

  var radioGroups = [
    ['reparaturschalterAg', data.spannungsversorgung],
    ['kommunikationsleitungAg', data.spannungsversorgung],
    ['mitStickstoffGeloetet', data.kaeltekreislauf],
    ['isolierteSaugFluessigkeitsleitung', data.kaeltekreislauf],
    ['kabelCheck', data.testbetrieb],
    ['erfolgreicherTestbetrieb', data.testbetrieb],
    ['dichtheitspruefungDruckmanometer', data.dichtheitspruefung],
    ['erfolgreichAbgeschlossen', data.inbetriebnahmeergebnis],
    ['folgeterminNoetig', data.inbetriebnahmeergebnis],
    ['abgebrochen', data.inbetriebnahmeergebnis],
    ['zusatzplatinenVerwendung', data.zusatzplatinen],
    ['uebergabeDokumentationBetreiber', data.dokumentation],
    ['einweisungBetreiber', data.dokumentation]
  ];

  for (var i = 0; i < radioGroups.length; i++) {
    var name = radioGroups[i][0];
    var source = radioGroups[i][1] || {};
    setRadioValue(name, source[name] || '');
  }

  var checks = data.inbetriebnahmeinhalt || [];

  for (var j = 0; j < checks.length; j++) {
    setRadioValue('check_' + checks[j].key, checks[j].status || '');
    setCheckNote(checks[j].key, checks[j].wertHinweis || '');
  }

  document.getElementById('bemerkungenText').value = data.bemerkungen || '';
  document.getElementById('signTechnikerInput').value = data.unterschrift && data.unterschrift.name || '';

  clearSignature(false);

  if (data.unterschrift && data.unterschrift.pngDataUrl) {
    loadSignature(data.unterschrift.pngDataUrl);
  }

  updateSummaries();
}

function setFields(container, values) {
  if (!container) {
    return;
  }

  container.querySelectorAll('[data-field]').forEach(function (field) {
    var key = field.getAttribute('data-field');
    field.value = values[key] || '';
  });
}

function getPhotoMetaForCurrent() {
  var meta = [];

  for (var i = 0; i < currentPhotos.length; i++) {
    meta.push({
      name: currentPhotos[i].name,
      type: currentPhotos[i].type,
      size: currentPhotos[i].data.length
    });
  }

  return meta;
}

function getSignatureJpegDataUrl() {
  var source = document.getElementById('signatureCanvas');
  var temp = document.createElement('canvas');

  temp.width = source.width;
  temp.height = source.height;

  var ctx = temp.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, temp.width, temp.height);
  ctx.drawImage(source, 0, 0);

  return temp.toDataURL('image/jpeg', 0.92);
}

function getProtocolValidationIssues(data, label) {
  var issues = [];

  if (!data) {
    issues.push(label + ': keine Protokolldaten vorhanden.');
    return issues;
  }

  var stammdaten = data.stammdaten || {};
  var kopfdaten = data.kopfdaten || {};
  var unterschrift = data.unterschrift || {};

  if (!safeText(stammdaten.kunde)) {
    issues.push(label + ': Kunde fehlt.');
  }

  if (!safeText(stammdaten.objektanschrift)) {
    issues.push(label + ': Objektanschrift fehlt.');
  }

  if (!safeText(kopfdaten.anlagentyp)) {
    issues.push(label + ': Anlagentyp fehlt.');
  }

  if (!safeText(kopfdaten.datum)) {
    issues.push(label + ': Datum fehlt.');
  }

  if (!safeText(kopfdaten.techniker)) {
    issues.push(label + ': Techniker fehlt.');
  }

  if (!safeText(unterschrift.name)) {
    issues.push(label + ': Name / Signaturgeber fehlt.');
  }

  if (
    unterschrift.vorhanden !== true &&
    !safeText(unterschrift.pngDataUrl) &&
    !safeText(unterschrift.jpegDataUrl)
  ) {
    issues.push(label + ': Unterschrift fehlt.');
  }

  return issues;
}

function getCurrentProtocolIssuesForSave() {
  try {
    var data = collectProtocol();
    return getProtocolValidationIssues(data, 'aktuelles Protokoll');
  } catch (err) {
    return ['aktuelles Protokoll: Prüfung konnte nicht ausgeführt werden: ' + getErrorText(err)];
  }
}

function getAllProtocolValidationIssuesForExport() {
  var allIssues = [];

  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i];
    var label = 'Protokoll ' + (i + 1) + ' / ' + (record.recordId || 'ohne ID');
    var data = record.data || {};
    var issues = getProtocolValidationIssues(data, label);

    for (var j = 0; j < issues.length; j++) {
      allIssues.push(issues[j]);
    }
  }

  return allIssues;
}

function getPhotoExportIssues() {
  var issues = [];

  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i] || {};
    var data = record.data || {};
    var expectedPhotos = Array.isArray(data.fotos) ? data.fotos.length : 0;
    var availablePhotos = record.recordId && photoStore[record.recordId]
      ? photoStore[record.recordId].length
      : 0;

    if (expectedPhotos > availablePhotos) {
      issues.push(
        'Protokoll ' +
        (i + 1) +
        ' / ' +
        (record.recordId || 'ohne ID') +
        ': ' +
        expectedPhotos +
        ' Foto(s) im Protokoll vermerkt, aber nur ' +
        availablePhotos +
        ' Fotodatei(en) geladen. Fotos erneut auswählen und Protokoll erneut übernehmen.'
      );
    }
  }

  return issues;
}

function safeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function saveDraft(showStatus) {
  try {
    appState.draft = {
      editingIndex: editingIndex,
      data: collectProtocol()
    };

    saveState(false);

    if (showStatus !== false) {
      setStatus('Entwurf gespeichert. Fotos werden nicht dauerhaft im Entwurf gespeichert.', 'ok');
    }
  } catch (err) {
    setStatus('Entwurf konnte nicht gespeichert werden: ' + getErrorText(err), 'error');
  }
}

function saveState(showError) {
  try {
    var stateForStorage = {
      version: appState.version,
      protocols: appState.protocols,
      draft: appState.draft
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForStorage));
  } catch (err) {
    if (showError !== false) {
      setStatus('Lokales Speichern fehlgeschlagen: ' + getErrorText(err), 'error');
    }
  }
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    var parsed = JSON.parse(raw);

    if (parsed) {
      appState.protocols = Array.isArray(parsed.protocols) ? parsed.protocols : [];
      appState.draft = parsed.draft || null;
    }
  } catch (err) {
    setStatus('Lokale Daten konnten nicht geladen werden: ' + getErrorText(err), 'error');
  }
}

function restoreDraft() {
  if (!appState.draft || !appState.draft.data) {
    return;
  }

  editingIndex = typeof appState.draft.editingIndex === 'number' ? appState.draft.editingIndex : null;
  fillFormFromProtocol(appState.draft.data);
}

function resetCurrentForm(showMessage) {
  var keepKunde = document.getElementById('kundeInput').value;
  var keepObjekt = document.getElementById('objektInput').value;

  document.getElementById('protocolForm').reset();
  document.getElementById('kundeInput').value = keepKunde;
  document.getElementById('objektInput').value = keepObjekt;
  document.getElementById('fotoInput').value = '';

  currentPhotos = [];
  updatePhotoListFromCurrentPhotos();

  clearSignature(false);
  signatureDirty = false;
  editingIndex = null;
  appState.draft = null;

  setDefaultDate();
  saveState(false);
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  openSection('sectionKopfdaten', true);

  if (showMessage !== false) {
    setStatus('Formular geleert. Bereits übernommene Protokolle bleiben in der Liste.', 'ok');
  }
}

function clearAll() {
  if (!confirm('Wirklich alle lokalen Protokolldaten löschen?')) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

async function updatePhotoListFromInput() {
  var input = document.getElementById('fotoInput');
  var files = input.files;

  if (!files.length) {
    updatePhotoListFromCurrentPhotos();
    updateSummaries();
    return;
  }

  var addedCount = 0;

  for (var i = 0; i < files.length; i++) {
    currentPhotos.push({
      name: files[i].name,
      type: files[i].type || 'application/octet-stream',
      data: new Uint8Array(await files[i].arrayBuffer())
    });

    addedCount++;
  }

  input.value = '';

  updatePhotoListFromCurrentPhotos();
  updateSummaries();
  saveDraft(false);

  setStatus(
    addedCount + ' Foto(s) hinzugefügt. Insgesamt geladen: ' + currentPhotos.length,
    'ok'
  );
}

function updatePhotoListFromCurrentPhotos() {
  var box = document.getElementById('photoList');
  box.innerHTML = '';

  if (!currentPhotos.length) {
    box.textContent = 'Keine Fotos ausgewählt.';
    updateSummaries();
    return;
  }

  for (var i = 0; i < currentPhotos.length; i++) {
    var row = document.createElement('div');
    row.className = 'photo-row';

    var info = document.createElement('div');
    info.innerHTML =
      '<div class="photo-name">' + escapeHtml(String(i + 1) + '. ' + currentPhotos[i].name) + '</div>' +
      '<div class="photo-meta">' + escapeHtml(formatBytes(currentPhotos[i].data.length)) + '</div>';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-danger photo-delete';
    button.textContent = 'Löschen';
    button.setAttribute('data-photo-index', i);

    button.addEventListener('click', function () {
      deleteCurrentPhoto(Number(this.getAttribute('data-photo-index')));
    });

    row.appendChild(info);
    row.appendChild(button);
    box.appendChild(row);
  }

  updateSummaries();
}

function deleteCurrentPhoto(index) {
  if (index < 0 || index >= currentPhotos.length) {
    return;
  }

  var deleted = currentPhotos[index].name;
  currentPhotos.splice(index, 1);
  document.getElementById('fotoInput').value = '';
  updatePhotoListFromCurrentPhotos();
  saveDraft(false);
  setStatus('Foto gelöscht: ' + deleted, 'ok');
}

function initSignatureCanvas() {
  var canvas = document.getElementById('signatureCanvas');
  var ctx = canvas.getContext('2d');

  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';

  function pos(evt) {
    var rect = canvas.getBoundingClientRect();
    var p = evt.touches && evt.touches[0] ? evt.touches[0] : evt;

    return {
      x: (p.clientX - rect.left) * (canvas.width / rect.width),
      y: (p.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function start(evt) {
    evt.preventDefault();
    signatureDrawing = true;
    var p = pos(evt);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(evt) {
    if (!signatureDrawing) {
      return;
    }

    evt.preventDefault();
    var p = pos(evt);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    signatureDirty = true;
    updateSummaries();
  }

  function end(evt) {
    if (!signatureDrawing) {
      return;
    }

    evt.preventDefault();
    signatureDrawing = false;
    saveDraft(false);
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
}

function clearSignature(save) {
  var canvas = document.getElementById('signatureCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  signatureDirty = false;
  updateSummaries();

  if (save !== false) {
    saveDraft(false);
  }
}

function loadSignature(dataUrl) {
  var img = new Image();

  img.onload = function () {
    var canvas = document.getElementById('signatureCanvas');
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    signatureDirty = true;
    updateSummaries();
  };

  img.src = dataUrl;
}

async function takeProtocolIntoList() {
  var issues = getCurrentProtocolIssuesForSave();
  var wasEditing = editingIndex !== null;
  var targetIndex = editingIndex;

  if (issues.length) {
    var message =
      (wasEditing ? 'Änderungen speichern?' : 'Protokoll übernehmen?') +
      lineBreak + lineBreak +
      'Das Protokoll ist noch nicht vollständig:' +
      lineBreak + '- ' +
      issues.join(lineBreak + '- ') +
      lineBreak + lineBreak +
      'Trotzdem übernehmen?';

    if (!confirm(message)) {
      setStatus(
        wasEditing
          ? 'Änderungen wurden nicht gespeichert. Protokoll ist noch unvollständig.'
          : 'Protokoll wurde nicht übernommen. Protokoll ist noch unvollständig.',
        'error'
      );
      return;
    }
  }

  try {
    setStatus(wasEditing ? 'Änderungen werden gespeichert ...' : 'Protokoll wird übernommen ...', 'ok');

    var data = collectProtocol();
    var now = new Date().toISOString();
    var existing = wasEditing ? appState.protocols[targetIndex] : null;

    if (wasEditing && !existing) {
      editingIndex = null;
      appState.draft = null;
      saveState(false);
      renderProtocolList();
      updateEditModeUI();
      updateSummaries();
      setStatus('Bearbeitung konnte nicht gespeichert werden: Der Datensatz ist nicht mehr vorhanden.', 'error');
      return;
    }

    var recordId = existing ? existing.recordId : createId('DX');
    var photos = await getCurrentPhotoFilesForRecord(recordId);

    data.fotos = photos.map(function (p) {
      return {
        name: p.name,
        type: p.type,
        size: p.data.length
      };
    });

    var record = {
      recordId: recordId,
      erstelltAm: existing ? existing.erstelltAm : now,
      bearbeitetAm: now,
      data: data,
      vollstaendig: issues.length === 0,
      unvollstaendigHinweise: issues
    };

    if (wasEditing) {
      appState.protocols[targetIndex] = record;
      photoStore[recordId] = photos;

      editingIndex = null;
      appState.draft = null;

      saveState(false);
      renderProtocolList();
      updateEditModeUI();
      updateSummaries();
      openSection('sectionListe', true);

      setStatus(
        issues.length
          ? 'Änderungen gespeichert. Hinweis: Protokoll ist noch nicht vollständig.'
          : 'Änderungen gespeichert. Bearbeitungsmodus wurde beendet.',
        issues.length ? 'error' : 'ok'
      );
      return;
    }

    appState.protocols.push(record);
    photoStore[recordId] = photos;

    editingIndex = null;
    appState.draft = null;

    saveState(false);
    resetCurrentForm(false);
    renderProtocolList();
    updateEditModeUI();
    updateSummaries();
    openSection('sectionListe', true);

    setStatus(
      issues.length
        ? 'Protokoll in Liste übernommen. Hinweis: Protokoll ist noch nicht vollständig.'
        : 'Protokoll in Liste übernommen. Protokolle: ' + appState.protocols.length,
      issues.length ? 'error' : 'ok'
    );
  } catch (err) {
    setStatus('Speichern fehlgeschlagen: ' + getErrorText(err), 'error');
  }
}

async function getCurrentPhotoFilesForRecord(recordId) {
  return currentPhotos.slice();
}

function loadProtocolForEdit(index) {
  if (index < 0 || index >= appState.protocols.length) {
    return;
  }

  var record = appState.protocols[index];

  editingIndex = index;
  fillFormFromProtocol(record.data);
  currentPhotos = (photoStore[record.recordId] || []).slice();
  document.getElementById('fotoInput').value = '';
  updatePhotoListFromCurrentPhotos();

  appState.draft = {
    editingIndex: editingIndex,
    data: collectProtocol()
  };

  saveState(false);
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  openSection('sectionKopfdaten', true);
  setStatus('Bearbeitungsmodus aktiv. Änderungen mit „Änderungen speichern“ übernehmen.', 'ok');
}

function deleteProtocol(index) {
  if (!confirm('Dieses Protokoll aus der Liste löschen?')) {
    return;
  }

  var record = appState.protocols[index];

  if (record && record.recordId) {
    delete photoStore[record.recordId];
  }

  appState.protocols.splice(index, 1);

  if (editingIndex === index) {
    editingIndex = null;
  } else if (editingIndex !== null && editingIndex > index) {
    editingIndex--;
  }

  saveState(false);
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  setStatus('Protokoll gelöscht.', 'ok');
}

function renderProtocolList() {
  var list = document.getElementById('protocolList');
  var summary = document.getElementById('summaryListe');

  list.innerHTML = '';
  summary.textContent = appState.protocols.length === 0
    ? 'Noch kein Protokoll übernommen'
    : appState.protocols.length + ' Protokoll(e) in der Liste';

  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i];
    var data = record.data || {};
    var kopf = data.kopfdaten || {};
    var stammdaten = data.stammdaten || {};
    var geraete = data.geraete || {};
    var isEditing = editingIndex === i;
    var photos = photoStore[record.recordId] || [];
    var name = geraete.modellAussengeraet || kopf.anlagentyp || 'ohne Anlagentyp';
    var div = document.createElement('div');

    div.className = isEditing ? 'protocol-list-item editing' : 'protocol-list-item';
    div.innerHTML =
      '<strong>' + escapeHtml(name) + '</strong>' +
      'Protokoll-ID: ' + escapeHtml(record.recordId || '-') + '<br>' +
      'Kunde: ' + escapeHtml(stammdaten.kunde || '-') + '<br>' +
      'Objektanschrift: ' + escapeHtml(stammdaten.objektanschrift || '-') + '<br>' +
      'Datum: ' + escapeHtml(kopf.datum || '-') + '<br>' +
      '<span class="badge">Fotodateien geladen: ' + photos.length + '</span>' +
      (record.vollstaendig === false ? ' <span class="badge badge-edit">unvollständig</span>' : '') +
      (isEditing ? ' <span class="badge badge-edit">in Bearbeitung</span>' : '') +
      '<div class="button-grid">' +
        '<button type="button" class="btn-warning" data-edit-index="' + i + '">Bearbeiten</button>' +
        '<button type="button" class="btn-danger" data-delete-index="' + i + '">Löschen</button>' +
      '</div>';

    list.appendChild(div);
  }

  list.querySelectorAll('[data-edit-index]').forEach(function (button) {
    button.addEventListener('click', function () {
      loadProtocolForEdit(Number(this.getAttribute('data-edit-index')));
    });
  });

  list.querySelectorAll('[data-delete-index]').forEach(function (button) {
    button.addEventListener('click', function () {
      deleteProtocol(Number(this.getAttribute('data-delete-index')));
    });
  });
}

function updateEditModeUI() {
  var banner = document.getElementById('editBanner');

  if (editingIndex === null) {
    banner.className = 'edit-banner';
    banner.textContent = '';
    return;
  }

  banner.className = 'edit-banner active';
  banner.textContent = 'Bearbeitungsmodus aktiv: Protokoll ' + (editingIndex + 1) + ' wird beim Übernehmen überschrieben.';
}

function updateSummaries() {
  var kunde = document.getElementById('kundeInput').value || '';
  var objekt = document.getElementById('objektInput').value || '';

  document.getElementById('summaryStammdaten').textContent =
    kunde || objekt ? [kunde, objekt].filter(Boolean).join(' / ') : 'Kunde und Objektanschrift';

  var anlagentyp = getFieldValue('kopfdatenFields', 'anlagentyp');
  var datum = getFieldValue('kopfdatenFields', 'datum');

  document.getElementById('summaryKopfdaten').textContent =
    anlagentyp || datum ? [anlagentyp, datum].filter(Boolean).join(' / ') : 'Anlagenerrichter, Anlagentyp, Datum, Techniker';

  var modellAg = getFieldValue('geraeteFields', 'modellAussengeraet');
  var modellRack = getFieldValue('geraeteFields', 'modellRackkuehlgeraet');

  document.getElementById('summaryGeraete').textContent =
    modellAg || modellRack ? [modellAg, modellRack].filter(Boolean).join(' / ') : 'Außengerät und Rackkühlgerät(e)';

  var kaeltemittel = getFieldValue('kaeltemittelFields', 'kaeltemittel');
  var gesamtfuellmenge = getFieldValue('kaeltemittelFields', 'gesamtfuellmengeKg');

  document.getElementById('summaryKaeltemittel').textContent =
    kaeltemittel || gesamtfuellmenge ? [kaeltemittel, gesamtfuellmenge ? gesamtfuellmenge + ' kg' : ''].filter(Boolean).join(' / ') : 'Kältemittel, Nachfüllmenge, Gesamtfüllmenge';

  var erfolgreich = getRadioValue('erfolgreichAbgeschlossen');
  var abgebrochen = getRadioValue('abgebrochen');

  document.getElementById('summaryErgebnis').textContent =
    erfolgreich || abgebrochen ? 'Erfolgreich: ' + (erfolgreich || '-') + ' / Abgebrochen: ' + (abgebrochen || '-') : 'Erfolgreich, Folgetermin, Abbruch';

  var bemerkungen = document.getElementById('bemerkungenText').value || '';
  document.getElementById('summaryBemerkungen').textContent = bemerkungen ? 'Bemerkung vorhanden' : 'keine Bemerkung';
  document.getElementById('summaryFotos').textContent = currentPhotos.length ? currentPhotos.length + ' Foto(s)' : 'Allgemeiner Fotobereich';
  document.getElementById('summaryUnterschrift').textContent = signatureDirty ? 'Unterschrift vorhanden' : 'Name und Finger-Unterschrift';
}

function getFieldValue(containerId, fieldName) {
  var container = document.getElementById(containerId);

  if (!container) {
    return '';
  }

  var field = container.querySelector('[data-field="' + cssEscape(fieldName) + '"]');
  return field ? field.value || '' : '';
}

async function importJsonFromFile(event) {
  var input = event.target;
  var file = input.files && input.files[0];

  if (!file) {
    return;
  }

  try {
    var text = await file.text();
    var parsed = JSON.parse(text);
    var importedProtocols = normalizeImportedProtocols(parsed);

    if (!importedProtocols.length) {
      setStatus('JSON-Import fehlgeschlagen: keine gültigen Protokolle gefunden.', 'error');
      return;
    }

    var appendMode = appState.protocols.length > 0
      ? confirm('Importierte Protokolle an bestehende Liste anhängen? OK = anhängen, Abbrechen = vorhandene Liste ersetzen.')
      : false;

    if (appendMode) {
      importedProtocols = ensureUniqueImportedRecordIds(importedProtocols, appState.protocols);
      appState.protocols = appState.protocols.concat(importedProtocols);
    } else {
      appState.protocols = importedProtocols;
      photoStore = {};
    }

    editingIndex = null;
    appState.draft = null;

    updateImportedProtocolCompleteness();
    saveState(false);
    renderProtocolList();
    updateEditModeUI();
    updateSummaries();
    openSection('sectionListe', true);

    setStatus(
      'JSON-Import abgeschlossen.' +
      lineBreak +
      'Importierte Protokolle: ' + importedProtocols.length +
      lineBreak +
      'Hinweis: Fotodateien wurden nicht wiederhergestellt.',
      'ok'
    );
  } catch (err) {
    setStatus('JSON-Import fehlgeschlagen: ' + getErrorText(err), 'error');
  } finally {
    input.value = '';
  }
}

function normalizeImportedProtocols(parsed) {
  var source = [];

  if (Array.isArray(parsed)) {
    source = parsed;
  } else if (parsed && Array.isArray(parsed.protokolle)) {
    source = parsed.protokolle;
  } else if (parsed && Array.isArray(parsed.protocols)) {
    source = parsed.protocols;
  }

  var result = [];

  for (var i = 0; i < source.length; i++) {
    var item = source[i] || {};
    var data = item.data || item;

    if (!looksLikeProtocolData(data)) {
      continue;
    }

    var recordId = safeText(item.recordId);

    if (!recordId) {
      recordId = createId('DX');
    }

    var issues = [];

    if (typeof getProtocolValidationIssues === 'function') {
      issues = getProtocolValidationIssues(data, 'Import ' + (i + 1));
    }

    result.push({
      recordId: recordId,
      erstelltAm: item.erstelltAm || new Date().toISOString(),
      bearbeitetAm: item.bearbeitetAm || new Date().toISOString(),
      data: data,
      vollstaendig: issues.length === 0,
      unvollstaendigHinweise: issues,
      importiertAm: new Date().toISOString()
    });
  }

  return result;
}

function looksLikeProtocolData(data) {
  if (!data) {
    return false;
  }

  return !!(
    data.stammdaten ||
    data.kopfdaten ||
    data.geraete ||
    data.inbetriebnahmeinhalt ||
    data.spannungsversorgung ||
    data.kaeltekreislauf ||
    data.unterschrift
  );
}

function ensureUniqueImportedRecordIds(importedProtocols, existingProtocols) {
  var used = {};

  for (var i = 0; i < existingProtocols.length; i++) {
    if (existingProtocols[i] && existingProtocols[i].recordId) {
      used[existingProtocols[i].recordId] = true;
    }
  }

  for (var j = 0; j < importedProtocols.length; j++) {
    var id = importedProtocols[j].recordId;

    if (!id || used[id]) {
      importedProtocols[j].recordId = createId('DX-IMP');
    }

    used[importedProtocols[j].recordId] = true;
  }

  return importedProtocols;
}

function updateImportedProtocolCompleteness() {
  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i];

    if (!record || !record.data) {
      continue;
    }

    var label = 'Protokoll ' + (i + 1) + ' / ' + (record.recordId || 'ohne ID');
    var issues = getProtocolValidationIssues(record.data, label);

    record.vollstaendig = issues.length === 0;
    record.unvollstaendigHinweise = issues;
  }
}

async function exportZip() {
  if (editingIndex !== null) {
    setStatus('Es ist noch ein Protokoll im Bearbeitungsmodus. Erst Änderungen speichern oder Formular leeren.', 'error');
    openSection('sectionListe', true);
    return;
  }

  if (!appState.protocols.length) {
    setStatus('Noch keine Protokolle in der Liste. Erst „Protokoll in Liste übernehmen“ drücken.', 'error');
    openSection('sectionListe', true);
    return;
  }

  var exportIssues = getAllProtocolValidationIssuesForExport();

  if (exportIssues.length > 0) {
    var message =
      'Export nicht möglich. Es sind unvollständige Protokolle in der Liste:' +
      lineBreak + lineBreak +
      '- ' + exportIssues.slice(0, 40).join(lineBreak + '- ');

    if (exportIssues.length > 40) {
      message += lineBreak + '- ... weitere ' + (exportIssues.length - 40) + ' Punkt(e)';
    }

    setStatus(message, 'error');
    openSection('sectionListe', true);
    return;
  }

  var photoIssues = getPhotoExportIssues();

  if (photoIssues.length > 0) {
    var photoMessage =
      'Export nicht möglich. Es fehlen Fotodateien für den ZIP-Export:' +
      lineBreak + lineBreak +
      '- ' + photoIssues.slice(0, 20).join(lineBreak + '- ');

    if (photoIssues.length > 20) {
      photoMessage += lineBreak + '- ... weitere ' + (photoIssues.length - 20) + ' Punkt(e)';
    }

    setStatus(photoMessage, 'error');
    openSection('sectionListe', true);
    return;
  }

  await loadSharedLogoSvg();
  await loadPrintGearSvg();

  setStatus('ZIP mit Druckansicht-PDFs wird erstellt ...', 'ok');

  try {
    var files = [];
    var exportData = buildExportData();

    files.push({ name: 'protokolle.json', data: utf8(JSON.stringify(exportData, null, 2)) });
    files.push({ name: 'protokolle.csv', data: utf8(String.fromCharCode(65279) + buildCsvForProtocols(appState.protocols)) });

    for (var i = 0; i < appState.protocols.length; i++) {
      var record = appState.protocols[i];
      var folder = 'protokoll_' + pad3(i + 1) + '/';

      files.push({ name: folder + 'druckansicht.html', data: utf8(buildPrintHtml(record.data)) });
      files.push({ name: folder + 'protokoll.pdf', data: await generatePrintPdfBytes(record.data) });

      var photos = photoStore[record.recordId] || [];

      for (var p = 0; p < photos.length; p++) {
        files.push({
          name: folder + 'fotos/foto_' + pad3(p + 1) + '_' + sanitizeFileName(photos[p].name),
          data: photos[p].data
        });
      }
    }

    var zip = buildZip(files);
    var filename = 'inbetriebnahmeprotokolle_dx_outdoor_' + formatDateFile(new Date()) + '.zip';

    downloadFile(filename, zip, 'application/zip');

    setStatus('ZIP exportiert. Warte auf Auswahl: Leeren oder Daten behalten.', 'ok');

    var clearNow = await askExportCleanupChoice();

    if (clearNow) {
      clearCompletelyAfterExport();
    } else {
      setStatus('ZIP exportiert. Daten wurden behalten und können später manuell geleert werden.', 'ok');
    }
  } catch (err) {
    setStatus('ZIP konnte nicht erstellt werden: ' + getErrorText(err), 'error');
  }
}

function askExportCleanupChoice() {
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(17, 17, 17, 0.68)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '18px';

    var box = document.createElement('div');
    box.style.width = '100%';
    box.style.maxWidth = '420px';
    box.style.background = '#ffffff';
    box.style.borderRadius = '16px';
    box.style.padding = '18px';
    box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.color = '#111111';
    box.style.borderTop = '8px solid #003cff';

    box.innerHTML =
      '<div style="font-size:20px;font-weight:900;margin-bottom:8px;color:#111111;">Export abgeschlossen</div>' +
      '<div style="font-size:15px;line-height:1.4;margin-bottom:16px;color:#1f2933;">Soll das Formular jetzt komplett geleert werden oder sollen die Daten erhalten bleiben?</div>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:10px;">' +
        '<button type="button" id="exportClearButton" style="min-height:52px;border:0;border-radius:12px;background:#111111;color:#ffd200;font-size:16px;font-weight:900;">Leeren</button>' +
        '<button type="button" id="exportKeepButton" style="min-height:52px;border:1px solid #006fd6;border-radius:12px;background:#ffd200;color:#111111;font-size:16px;font-weight:900;">Daten behalten</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('exportClearButton').addEventListener('click', function () {
      document.body.removeChild(overlay);
      resolve(true);
    });

    document.getElementById('exportKeepButton').addEventListener('click', function () {
      document.body.removeChild(overlay);
      resolve(false);
    });
  });
}

function clearCompletelyAfterExport() {
  appState = {
    version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'SCHRACK_DX_OUTDOOR_V1.0',
    protocols: [],
    draft: null
  };

  photoStore = {};
  currentPhotos = [];
  editingIndex = null;

  localStorage.removeItem(STORAGE_KEY);

  document.getElementById('kundeInput').value = '';
  document.getElementById('objektInput').value = '';
  document.getElementById('protocolForm').reset();
  document.getElementById('fotoInput').value = '';
  document.getElementById('importJsonInput').value = '';

  currentPhotos = [];
  updatePhotoListFromCurrentPhotos();

  clearSignature(false);
  signatureDirty = false;

  setDefaultDate();
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();

  document.querySelectorAll('details.section').forEach(function (section) {
    section.open = section.id === 'sectionStammdaten';
  });

  window.scrollTo(0, 0);

  setStatus('Export abgeschlossen. Formular und lokale Protokolldaten wurden geleert.', 'ok');
}

function buildExportData() {
  return {
    exportFormat: 'SCHRACK_Inbetriebnahmeprotokolle_DX_Outdoor_JSON_V1_0',
    exportiertAm: new Date().toISOString(),
    protokolle: appState.protocols.map(function (record) {
      return {
        recordId: record.recordId,
        erstelltAm: record.erstelltAm,
        bearbeitetAm: record.bearbeitetAm,
        vollstaendig: record.vollstaendig,
        unvollstaendigHinweise: record.unvollstaendigHinweise || [],
        data: record.data
      };
    })
  };
}

function buildCsvForProtocols(records) {
  var rows = [];

  rows.push(['Protokoll_ID', 'Bereich', 'Prüfpunkt', 'Status/Wert', 'Einheit/Hinweis']);

  records.forEach(function (record) {
    var data = record.data || {};

    addObjectToCsvRows(rows, record.recordId, 'Stammdaten', data.stammdaten || {});
    addObjectToCsvRows(rows, record.recordId, 'Kopfdaten', data.kopfdaten || {});
    addObjectToCsvRows(rows, record.recordId, 'Gerätedaten', data.geraete || {});

    (data.inbetriebnahmeinhalt || []).forEach(function (row) {
      rows.push([
        record.recordId,
        'Inbetriebnahmeinhalt',
        row.label,
        row.status,
        row.wertHinweis
      ]);
    });

    addObjectToCsvRows(rows, record.recordId, 'Spannungsversorgung', data.spannungsversorgung || {});
    addObjectToCsvRows(rows, record.recordId, 'Kältekreislauf', data.kaeltekreislauf || {});
    addObjectToCsvRows(rows, record.recordId, 'Testbetrieb Manometerdruck nach 15 Minuten', data.testbetrieb || {});
    addObjectToCsvRows(rows, record.recordId, 'Dichtheitsprüfung', data.dichtheitspruefung || {});
    addObjectToCsvRows(rows, record.recordId, 'Im Kühlbetrieb nach 15 Minuten', data.kuehlbetrieb || {});
    addObjectToCsvRows(rows, record.recordId, 'Kältemittel und Füllmenge', data.kaeltemittelFuellmenge || {});
    addObjectToCsvRows(rows, record.recordId, 'Inbetriebnahmeergebnis', data.inbetriebnahmeergebnis || {});
    addObjectToCsvRows(rows, record.recordId, 'Zusatzplatinen / Komponenten', data.zusatzplatinen || {});
    addObjectToCsvRows(rows, record.recordId, 'Anlagendokumentation / Einweisung', data.dokumentation || {});

    rows.push([record.recordId, 'Bemerkungen', 'Bemerkungen', data.bemerkungen || '', '']);
    rows.push([record.recordId, 'Signatur', 'Name / Signaturgeber', data.unterschrift && data.unterschrift.name || '', '']);
  });

  return rows.map(function (row) {
    return row.map(csvCell).join(';');
  }).join(csvLineBreak);
}

function addObjectToCsvRows(rows, recordId, bereich, obj) {
  Object.keys(obj || {}).forEach(function (key) {
    rows.push([recordId, bereich, key, obj[key], '']);
  });
}

function loadSharedLogoSvg() {
  return fetch('assets/Schrack-Technik_LOGO.svg')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Schrack-Technik_LOGO.svg konnte nicht geladen werden: HTTP ' + response.status);
      }

      return response.text();
    })
    .then(function (text) {
      logoSvgCache = normalizeSvgForInline(text);
      return logoSvgCache;
    })
    .catch(function (err) {
      console.warn(getErrorText(err));
      logoSvgCache = '';
      return '';
    });
}

function loadPrintGearSvg() {
  return Promise.resolve('');
}

function normalizeSvgForInline(svgText) {
  var text = String(svgText || '');

  text = text.replace(/<\?xml[^>]*>\s*/i, '');
  text = text.replace(/<!DOCTYPE[^>]*>\s*/i, '');

  text = text.replace(/<svg\b([^>]*)>/i, function (match, attrs) {
    if (/aria-hidden=/.test(match)) {
      return match;
    }

    return '<svg' + attrs + ' aria-hidden="true" focusable="false">';
  });

  return text;
}

function buildPrintHtml(data) {
  data = data || {};

    var css = [
    'html,body{margin:0;padding:0;background:#ffffff}',
    'body{font-family:Arial,sans-serif;font-size:12px;color:#111111;background:#ffffff}',
    '.print-page{position:relative;width:210mm;min-height:297mm;margin:0 auto;padding:10mm;box-sizing:border-box;background:#ffffff;overflow:visible}',
    '.print-content{position:relative;z-index:1;width:100%;box-sizing:border-box}',
    '.logo{text-align:center;margin-bottom:8px;padding-bottom:6px;border-bottom:5px solid #00d9ff}',
    '.logo svg{max-width:220px;height:auto;display:inline-block}',
    '.logo img{max-width:220px;height:auto;display:inline-block}',
    'h1{text-align:center;font-size:20px;margin:0 0 14px 0;color:#111111;font-weight:900}',
    '.box{border:1px solid #cbd5e1;border-left:5px solid #0084ff;padding:8px;margin-bottom:10px;break-inside:avoid;background:#ffffff}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.sec{font-weight:bold;background:#dbeafe;color:#111111;border:1px solid #93c5fd;border-left:7px solid #1e3a8a;padding:5px;margin:10px 0 0 0}',
    'table{width:100%;border-collapse:collapse;margin-bottom:10px;break-inside:auto}',
    'th,td{border:1px solid #cbd5e1;padding:5px;vertical-align:top}',
    'th{background:#dbeafe;color:#111111;text-align:left;font-weight:900}',
    'tr:nth-child(even) td{background:#fff9dc}',
    '.sig{height:95px;border:1px solid #0004d6;margin-top:8px;display:flex;align-items:center;justify-content:center;background:#fff9dc}',
    '.sig img{max-height:90px;max-width:100%}',
    '.foot{font-size:10px;text-align:center;margin-top:14px;color:#6b7280;border-top:3px solid #0059ff;padding-top:6px}',
    '@media print{.print-page{margin:0}}'
  ].join('');

  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Inbetriebnahmeprotokoll DX Kühler Outdoor</title>' +
    '<style>' + css + '</style></head><body>' +
    '<div class="print-page"><div class="print-content">';

  html +=
    '<div class="logo">' +
    (logoSvgCache || '<img src="assets/Schrack-Technik_LOGO.svg" alt="Schrack Technik Logo">') +
    '</div>' +
    '<h1>Inbetriebnahmeprotokoll DX Kühler Outdoor</h1>';

  html += printObjectBox('Stammdaten', data.stammdaten || {});
  html += printObjectBox('Kopfdaten', data.kopfdaten || {});
  html += printObjectBox('Gerätedaten', data.geraete || {});

  html += '<div class="sec">Inbetriebnahmeinhalt</div>';
  html += '<table><tr><th>Inhalt</th><th>Status</th><th>Wert / Hinweis</th></tr>';

  (data.inbetriebnahmeinhalt || []).forEach(function (row) {
    html +=
      '<tr>' +
        '<td>' + escapeHtml(row.label || '') + '</td>' +
        '<td>' + escapeHtml(row.status || '') + '</td>' +
        '<td>' + escapeHtml(row.wertHinweis || '') + '</td>' +
      '</tr>';
  });

  html += '</table>';

  html += printObjectBox('Spannungsversorgung', data.spannungsversorgung || {});
  html += printObjectBox('Kältekreislauf', data.kaeltekreislauf || {});
  html += printObjectBox('Testbetrieb Manometerdruck nach 15 Minuten', data.testbetrieb || {});
  html += printObjectBox('Dichtheitsprüfung', data.dichtheitspruefung || {});
  html += printObjectBox('Im Kühlbetrieb nach 15 Minuten Betrieb', data.kuehlbetrieb || {});
  html += printObjectBox('Kältemittel und Füllmenge', data.kaeltemittelFuellmenge || {});
  html += printObjectBox('Inbetriebnahmeergebnis', data.inbetriebnahmeergebnis || {});
  html += printObjectBox('Zusatzplatinen / Komponenten', data.zusatzplatinen || {});
  html += printObjectBox('Anlagendokumentation / Einweisung', data.dokumentation || {});

  html +=
    '<div class="sec">Stempel / Signatur</div>' +
    '<div class="box"><b>Name / Signaturgeber:</b> ' + escapeHtml(data.unterschrift && data.unterschrift.name || '') +
    '<div class="sig">' +
    (data.unterschrift && data.unterschrift.pngDataUrl ? '<img src="' + data.unterschrift.pngDataUrl + '">' : '') +
    '</div></div>';

  html +=
    '<div class="sec">Bemerkungen</div>' +
    '<div class="box">' + escapeHtml(data.bemerkungen || '').replace(/\n/g, '<br>') + '</div>';

  html += '<div class="foot">Inbetriebnahmeprotokoll DX Kühler Outdoor</div></div></div></body></html>';

  return html;
}

function printObjectBox(title, obj) {
  var keys = Object.keys(obj || {});
  var html = '<div class="sec">' + escapeHtml(title) + '</div><div class="box grid">';

  if (!keys.length) {
    html += '<div>-</div>';
  }

  for (var i = 0; i < keys.length; i++) {
    html +=
      '<div><b>' + escapeHtml(labelFromKey(keys[i])) + ':</b><br>' +
      escapeHtml(obj[keys[i]] || '').replace(/\n/g, '<br>') +
      '</div>';
  }

  html += '</div>';

  return html;
}

function labelFromKey(key) {
  var labels = {
    kunde: 'Kunde',
    objektanschrift: 'Objektanschrift',
    anlagenerrichter: 'Anlagenerrichter',
    anlagentyp: 'Anlagentyp',
    datum: 'Datum',
    uhrzeit: 'Uhrzeit',
    techniker: 'Techniker',
    erstinbetriebnahme: 'Erstinbetriebnahme',
    wiederholteInbetriebnahme: 'Wiederholte Inbetriebnahme',
    modellAussengeraet: 'Modelbezeichnung Außengerät',
    seriennummerAussengeraet: 'Seriennummer Außengerät',
    modellRackkuehlgeraet: 'Modelbezeichnung Rackkühlgerät(-e)',
    seriennummerRackkuehlgeraet: 'Seriennummer Rackkühlgerät(-e)',
    reparaturschalterAg: 'Reparaturschalter am AG angebracht',
    absicherungArtA: 'Absicherung Art/A',
    drehfeldPruefen: 'Drehfeld prüfen',
    spannungsversorgungAgPruefen: 'Spannungsversorgung AG prüfen',
    kommunikationsleitungAg: 'Kommunikationsleitung zum AG geprüft',
    stromaufnahmeA: 'Stromaufnahme [A]',
    anzahlRackkuehlgeraete: 'Anzahl der angeschlossenen Rackkühlgeräte [Stk.]',
    gesamtleistungKw: 'Gesamtleistung [kW]',
    aussengeraetPosition: 'Außengerät höher/tiefer als Innengerät',
    positionsdifferenzM: 'Positionsdifferenz [m]',
    hoehendifferenzM: 'Höhendifferenz Innen-/Außengerät [m]',
    leitungslaengeUndDimension: 'Leitungslänge u. Dim. Innen-/Außengerät',
    mitStickstoffGeloetet: 'Mit Stickstoff gelötet',
    isolierteSaugFluessigkeitsleitung: 'Isolierte Saug- und Flüssigkeitsleitung',
    testbetrieb: 'Testbetrieb',
    kabelCheck: 'Kabel-Check',
    testHochdruckTempC: 'Hochdruck Temperatur [°C]',
    testHochdruckDruckBar: 'Hochdruck Druck [bar]',
    testNiederdruckTempC: 'Niederdruck Temperatur [°C]',
    testNiederdruckDruckBar: 'Niederdruck Druck [bar]',
    aussentemperaturC: 'Außentemperatur [°C]',
    ausblastemperaturC: 'Ausblastemperatur [°C]',
    erfolgreicherTestbetrieb: 'Erfolgreicher Testbetrieb',
    dichtheitspruefungDruckmanometer: 'Dichtheitsprüfung mit Druckmanometer',
    pruefdruckBar: 'Prüfdruck [bar]',
    pruefzeitStd: 'Prüfzeit [Std]',
    evakuierungszeitStd: 'Evakuierungszeit [Std]',
    pruefmedium: 'Prüfmedium',
    kuehlHochdruckTempC: 'Hochdruck Temperatur [°C]',
    kuehlHochdruckDruckBar: 'Hochdruck Druck [bar]',
    kuehlNiederdruckTempC: 'Niederdruck Temperatur [°C]',
    kuehlNiederdruckDruckBar: 'Niederdruck Druck [bar]',
    kaeltemittel: 'Kältemittel',
    kaeltemittelNachfuellmengeKg: 'Kältemittelnachfüllmenge [kg]',
    gesamtfuellmengeKg: 'Gesamtfüllmenge [kg]',
    erfolgreichAbgeschlossen: 'Erfolgreich abgeschlossen',
    folgeterminNoetig: 'Folgetermin nötig',
    folgeterminHinweis: 'Folgetermin / Hinweis',
    abgebrochen: 'Abgebrochen',
    zusatzplatinenVerwendung: 'Verwendung von Zusatzplatinen',
    zusatzplatinenBeschreibung: 'Bezeichnung und Verwendungszweck',
    uebergabeDokumentationBetreiber: 'Übergabe und Dokumentation an den Betreiber',
    einweisungBetreiber: 'Einweisung Betreiber',
    nameBetreiber: 'Name Betreiber',
    ort: 'Ort',
    ortDatumText: 'Ort / Datum Text'
  };

  return labels[key] || key;
}

async function generatePrintPdfBytes(data) {
  if (typeof html2canvas !== 'function') {
    throw new Error('PDF-Bibliothek unvollständig: html2canvas wurde nicht geladen.');
  }

  var JsPDF = getJsPdfConstructor();

  var iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  iframe.style.background = '#ffffff';
  iframe.style.zIndex = '-1';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  try {
    var doc = iframe.contentDocument || iframe.contentWindow.document;

    var html = buildPrintHtml(data);
    html = html.replace('</head>', buildPdfExportCssOverrides() + '</head>');

    doc.open();
    doc.write(html);
    doc.close();

    await waitForPrintDocumentReady(iframe);
    await waitForImagesInDocument(doc);

    if (iframe.contentWindow && iframe.contentWindow.scrollTo) {
      iframe.contentWindow.scrollTo(0, 0);
    }

    var source = doc.querySelector('.print-page');

    if (!source) {
      throw new Error('PDF-Export fehlgeschlagen: Druckseite .print-page wurde nicht gefunden.');
    }

    source.style.width = '794px';
    source.style.margin = '0';
    source.style.background = '#ffffff';
    source.style.overflow = 'visible';

    var contentWidthPx = 794;
    var contentHeightPx = Math.max(
      1123,
      Math.ceil(source.scrollHeight),
      Math.ceil(source.offsetHeight),
      Math.ceil(doc.body.scrollHeight),
      Math.ceil(doc.documentElement.scrollHeight)
    );

    var canvas = await html2canvas(source, {
      backgroundColor: '#ffffff',
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 0,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: contentWidthPx,
      height: contentHeightPx,
      windowWidth: contentWidthPx,
      windowHeight: contentHeightPx
    });

    var pdf = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    var pdfWidthMm = 210;
    var pdfHeightMm = 297;
    var pageHeightPx = Math.floor(canvas.width * pdfHeightMm / pdfWidthMm);

    var pageCanvas = document.createElement('canvas');
    var pageCtx = pageCanvas.getContext('2d');

    pageCanvas.width = canvas.width;
    pageCanvas.height = pageHeightPx;

    var pageCount = Math.ceil(canvas.height / pageHeightPx);

    for (var page = 0; page < pageCount; page++) {
      if (page > 0) {
        pdf.addPage('a4', 'portrait');
      }

      pageCtx.fillStyle = '#ffffff';
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      pageCtx.drawImage(
        canvas,
        0,
        page * pageHeightPx,
        canvas.width,
        pageHeightPx,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      var imageData = pageCanvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imageData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
    }

    return new Uint8Array(pdf.output('arraybuffer'));
  } finally {
    document.body.removeChild(iframe);
  }
}

function getJsPdfConstructor() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }

  if (window.jsPDF) {
    return window.jsPDF;
  }

  throw new Error('PDF-Bibliothek unvollständig: jsPDF wurde nicht geladen.');
}

function buildPdfExportCssOverrides() {
  return [
    '<style id="pdf-export-overrides">',
    'html,body{width:794px!important;margin:0!important;padding:0!important;overflow:visible!important;background:#ffffff!important;}',
    'body{font-family:Arial,sans-serif!important;font-size:12px!important;color:#111111!important;}',
    '.print-page{width:794px!important;min-height:1123px!important;margin:0!important;padding:38px!important;box-sizing:border-box!important;background:#ffffff!important;overflow:visible!important;}',
    '.print-content{width:100%!important;box-sizing:border-box!important;}',
    '.logo{border-bottom:5px solid #00d9ff!important;}',
    '.sec{background:#fff4bf!important;color:#111111!important;border:1px solid #00cfd6!important;border-left:7px solid #111111!important;}',
    '.box{border:1px solid #cbd5e1!important;border-left:5px solid #006eff!important;background:#ffffff!important;}',
    'th{background:#ffd200!important;color:#111111!important;}',
    'tr:nth-child(even) td{background:#fff9dc!important;}',
    '.sig{background:#fff9dc!important;border:1px solid #000ed6!important;}',
    '.foot{border-top:3px solid #002fff!important;color:#6b7280!important;}',
    'table{page-break-inside:auto!important;}',
    'tr{page-break-inside:avoid!important;}',
    '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '</style>'
  ].join('');
}

function waitForPrintDocumentReady(iframe) {
  return new Promise(function (resolve) {
    var done = false;

    function finish() {
      if (done) {
        return;
      }

      done = true;

      setTimeout(function () {
        resolve();
      }, 150);
    }

    var doc = iframe.contentDocument || iframe.contentWindow.document;

    if (doc && (doc.readyState === 'complete' || doc.readyState === 'interactive')) {
      finish();
      return;
    }

    iframe.onload = finish;

    setTimeout(finish, 800);
  });
}

function waitForImagesInDocument(doc) {
  var images = Array.prototype.slice.call(doc.images || []);

  if (!images.length) {
    return Promise.resolve();
  }

  return Promise.all(images.map(function (img) {
    if (img.complete) {
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

function buildZip(files) {
  var localParts = [];
  var centralParts = [];
  var offset = 0;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var nameBytes = utf8(file.name);
    var data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    var crc = crc32(data);
    var timeDate = dosDateTime(new Date());

    var localHeader = concatBytes(
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(timeDate.time),
      u16(timeDate.date),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes
    );

    localParts.push(localHeader, data);

    var centralHeader = concatBytes(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(timeDate.time),
      u16(timeDate.date),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    );

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  var centralSize = sumLength(centralParts);
  var centralOffset = offset;

  var end = concatBytes(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(centralOffset),
    u16(0)
  );

  return concatBytes.apply(null, localParts.concat(centralParts, [end]));
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function crc32(bytes) {
  if (!crcTable) {
    crcTable = [];

    for (var n = 0; n < 256; n++) {
      var c = n;

      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }

      crcTable[n] = c >>> 0;
    }
  }

  var crc = 0 ^ -1;

  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

function concatBytes() {
  var total = 0;

  for (var i = 0; i < arguments.length; i++) {
    total += arguments[i].length;
  }

  var output = new Uint8Array(total);
  var offset = 0;

  for (var j = 0; j < arguments.length; j++) {
    output.set(arguments[j], offset);
    offset += arguments[j].length;
  }

  return output;
}

function sumLength(parts) {
  var total = 0;

  for (var i = 0; i < parts.length; i++) {
    total += parts[i].length;
  }

  return total;
}

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function utf8(value) {
  return new TextEncoder().encode(String(value));
}

function downloadFile(filename, data, mimeType) {
  var blob = new Blob([data], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function formatDateFile(date) {
  return date.getFullYear() +
    '-' + pad2(date.getMonth() + 1) +
    '-' + pad2(date.getDate()) +
    '_' + pad2(date.getHours()) +
    '-' + pad2(date.getMinutes());
}

function createId(prefix) {
  var d = new Date();
  var stamp =
    d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    '-' +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds());

  var rnd = Math.random().toString(16).slice(2, 8).toUpperCase();

  return prefix + '-' + stamp + '-' + rnd;
}

function pad2(number) {
  number = String(number);
  return number.length < 2 ? '0' + number : number;
}

function pad3(number) {
  number = String(number);

  while (number.length < 3) {
    number = '0' + number;
  }

  return number;
}

function csvCell(value) {
  value = value === null || value === undefined ? '' : String(value);
  return '"' + value.replace(/"/g, '""') + '"';
}

function sanitizeFileName(name) {
  return String(name)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

function cssEscape(value) {
  if (window.CSS && CSS.escape) {
    return CSS.escape(value);
  }

  return String(value).replace(/"/g, '\\"');
}

function setRadioValue(name, value) {
  document.querySelectorAll('[name="' + cssEscape(name) + '"]').forEach(function (radio) {
    radio.checked = radio.value === value;
  });
}

function getRadioValue(name) {
  var checked = document.querySelector('[name="' + cssEscape(name) + '"]:checked');
  return checked ? checked.value : '';
}

function formatBytes(bytes) {
  bytes = Number(bytes) || 0;

  if (bytes < 1024) {
    return bytes + ' B';
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setStatus(message, type) {
  var status = document.getElementById('status');

  status.className = 'status';

  if (!message) {
    status.textContent = '';
    return;
  }

  status.textContent = message;
  status.className = 'status ' + type;
}

function getErrorText(error) {
  if (!error) {
    return 'Unbekannter Fehler';
  }

  return error.message || String(error);
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
