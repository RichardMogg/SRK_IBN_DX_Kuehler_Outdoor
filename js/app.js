'use strict';

var lineBreak = String.fromCharCode(10);
var csvLineBreak = String.fromCharCode(13, 10);
var SIGNATURE_SUMMARY_DEFAULT = 'Techniker, Unterschrift, Ort';
var SIGNATURE_DATE_MISSING = 'Signatur-Tag fehlt';
var SIGNATURE_SUMMARY_DEFAULT = 'Techniker, Unterschrift, Ort';
var SIGNATURE_DATE_MISSING = 'Signatur-Tag fehlt';

var indoorCounter = 0;
var signatureDirty = false;
var signatureDrawing = false;
var betreiberSignatureDirty = false;
var betreiberSignatureDrawing = false;
var betreiberSignatureDirty = false;
var betreiberSignatureDrawing = false;
var editingIndex = null;
var crcTable = null;
var logoSvgCache = '';

var appState = {
  version: APP_VERSION,
  protocols: [],
  draft: null
};

var photoStore = {};
var currentPhotos = [];
var currentAussenPhotos = [];
var currentIndoorPhotos = {};

window.addEventListener('load', function () {
  renderStaticFields();
  setDefaultDateTime();
  loadRefrigerantOptions();
  bindEvents();
  addCollapseButtons();
  initSignatureCanvas();
  initBetreiberSignatureCanvas();
  loadSharedLogoSvg();
  loadState();
  restoreDraft();

  if (!document.querySelector('.indoor-card')) {
    addIndoorUnit(false);
  }

  renderProtocolList();
  updateSummaries();
  updateEditModeUI();
  startAtTop();
  setStatus('Inbetriebnahmeprotokoll geladen. JSON-Import und ZIP-Export aktiv.', 'ok');
});

function renderStaticFields() {
  renderChecklist(document.getElementById('checkInbetriebnahme'), 'inbetriebnahme', INBETRIEBNAHME_CHECKS);
  renderFieldGroup(document.getElementById('fieldsKaeltekreislauf'), 'kaeltekreislauf', FIELD_GROUPS.kaeltekreislauf);
  renderFieldGroup(document.getElementById('fieldsDichtheit'), 'dichtheit', FIELD_GROUPS.dichtheit);
  renderFieldGroup(document.getElementById('fieldsZusatz'), 'zusatz', FIELD_GROUPS.zusatz);
  renderFieldGroup(document.getElementById('fieldsSpannung'), 'spannung', FIELD_GROUPS.spannung);
  renderFieldGroup(document.getElementById('fieldsTestbetrieb'), 'testbetrieb', FIELD_GROUPS.testbetrieb);
  renderFieldGroup(document.getElementById('fieldsErgebnis'), 'ergebnis', FIELD_GROUPS.ergebnis);
  renderFieldGroup(document.getElementById('fieldsDokumentation'), 'dokumentation', FIELD_GROUPS.dokumentation);
}

function renderChecklist(container, prefix, items) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'check-row';
    row.setAttribute('data-key', item.key);

    row.innerHTML =
      '<div class="check-title">' + escapeHtml(item.label) + '</div>' +
      '<div class="check-options">' +
        '<label class="pill-option"><input type="radio" name="' + prefix + '_' + item.key + '" value="Ja"> Ja</label>' +
        '<label class="pill-option"><input type="radio" name="' + prefix + '_' + item.key + '" value="Nein"> Nein</label>' +
      '</div>' +
      '<div class="field"><label>Bemerkung</label><textarea data-check-note="true" placeholder="Optional"></textarea></div>';

    container.appendChild(row);
  });
}

function renderFieldGroup(container, prefix, items) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'form-row';
    row.setAttribute('data-key', item.key);
    row.setAttribute('data-type', item.type || 'text');

    if (item.type === 'bool') {
      row.innerHTML =
        '<div class="form-title">' + escapeHtml(item.label) + '</div>' +
        '<div class="bool-options">' +
          '<label class="pill-option"><input type="radio" name="' + prefix + '_' + item.key + '" value="Ja"> Ja</label>' +
          '<label class="pill-option"><input type="radio" name="' + prefix + '_' + item.key + '" value="Nein"> Nein</label>' +
        '</div>';
    } else if (item.type === 'textarea') {
      row.innerHTML =
        '<label>' + escapeHtml(item.label) + '</label>' +
        '<textarea data-value="true"></textarea>';
    } else {
      var numberAttributes = '';

      if (item.type === 'decimal') {
        numberAttributes = ' type="number" inputmode="decimal" step="any"';
      } else if (item.type === 'number') {
        numberAttributes = ' type="number" inputmode="numeric" step="1" min="0"';
      }

      if (item.unit) {
        row.innerHTML =
          '<label>' + escapeHtml(item.label) + '</label>' +
          '<div class="input-unit"><input data-value="true"' + numberAttributes + '><span>' + escapeHtml(item.unit) + '</span></div>';
      } else {
        row.innerHTML =
          '<label>' + escapeHtml(item.label) + '</label>' +
          '<input data-value="true"' + numberAttributes + '>';
      }
    }

    container.appendChild(row);
  });
}

function bindEvents() {
  document.getElementById('saveStammdatenButton').addEventListener('click', function () {
    saveDraft(false);
    openSection('sectionKopfdaten', true);
    setStatus('Stammdaten gespeichert.', 'ok');
  });

  bindCommissioningDateFields();

  document.getElementById('addInnenButton').addEventListener('click', function () {
    addIndoorUnit(true);
  });

  document.getElementById('bottomInnenButton').addEventListener('click', function () {
    addIndoorUnit(true);
  });

  document.getElementById('fotoInput').addEventListener('change', function () {
    updateAttachmentListFromInput('allgemein', this);
  });

  document.getElementById('aussenFotoInput').addEventListener('change', function () {
    updateAttachmentListFromInput('aussengeraet', this);
  });

  document.getElementById('clearSignatureButton').addEventListener('click', function () {
    clearSignature(true);
  });
  document.getElementById('clearBetreiberSignatureButton').addEventListener('click', function () {
    clearBetreiberSignature(true);
  });
  document.getElementById('clearBetreiberSignatureButton').addEventListener('click', function () {
    clearBetreiberSignature(true);
  });

  document.getElementById('takeProtocolButton').addEventListener('click', takeProtocolIntoList);
  document.getElementById('bottomTakeButton').addEventListener('click', takeProtocolIntoList);

  document.getElementById('clearFormButton').addEventListener('click', function () {
    resetCurrentForm(true);
  });

  document.getElementById('exportZipButton').addEventListener('click', exportZip);

  document.getElementById('importJsonButton').addEventListener('click', function () {
    document.getElementById('importJsonInput').click();
  });

  document.getElementById('importJsonInput').addEventListener('change', importJsonFromFile);

  document.getElementById('saveDraftButton').addEventListener('click', function () {
    saveDraft(true);
  });

  document.getElementById('clearAllButton').addEventListener('click', clearAll);

  document.getElementById('protocolForm').addEventListener('input', throttledDraftSave);
  document.getElementById('protocolForm').addEventListener('change', throttledDraftSave);

  document.getElementById('kundeInput').addEventListener('input', throttledDraftSave);
  document.getElementById('objektInput').addEventListener('input', throttledDraftSave);
  document.getElementById('bemerkungenText').addEventListener('input', throttledDraftSave);
  document.getElementById('fieldsDokumentation').addEventListener('change', function () {
    updateBetreiberSignatureVisibility();
  });
  updateBetreiberSignatureVisibility();
  document.getElementById('fieldsDokumentation').addEventListener('change', function () {
    updateBetreiberSignatureVisibility();
  });
  updateBetreiberSignatureVisibility();
}

function bindCommissioningDateFields() {
  var firstDate = document.querySelector('[data-field="erstinbetriebnahme"]');
  var repeatDate = document.querySelector('[data-field="wiederholteInbetriebnahme"]');

  if (!firstDate || !repeatDate) {
    return;
  }

  firstDate.addEventListener('change', function () {
    if (firstDate.value) {
      repeatDate.value = '';
    }

    saveDraft(false);
    updateSummaries();
  });

  repeatDate.addEventListener('change', function () {
    if (repeatDate.value) {
      firstDate.value = '';
    }

    saveDraft(false);
    updateSummaries();
  });
}

var draftTimer = null;

function throttledDraftSave() {
  clearTimeout(draftTimer);

  draftTimer = setTimeout(function () {
    saveDraft(false);
    updateSummaries();
  }, 450);
}

function startAtTop() {
  document.querySelectorAll('details.section').forEach(function (section) {
    section.open = section.id === 'sectionStammdaten';
  });

  setTimeout(function () {
    window.scrollTo(0, 0);
  }, 0);
}

function addCollapseButtons() {
  addCollapseButtonToDetails(
    'details.section',
    '.section-body',
    'Abschnitt einklappen',
    'section'
  );

  addCollapseButtonToDetails(
    'details.indoor-card',
    '.indoor-body',
    'Rackkühlgerät einklappen',
    'indoor'
  );
}



function hasDirectCollapseButton(body) {
  return Array.prototype.some.call(body.children, function (child) {
    return child.getAttribute('data-collapse-button') === 'true' ||
      child.getAttribute('data-collapse-section') === 'true' ||
      child.getAttribute('data-collapse-rk') === 'true' ||
      child.getAttribute('data-collapse-indoor') === 'true';
  });
}

function addCollapseButtonToDetails(detailsSelector, bodySelector, buttonText) {
  document.querySelectorAll(detailsSelector).forEach(function (section) {
    var body = section.querySelector(bodySelector);

    if (!body || hasDirectCollapseButton(body)) {
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-light collapse-section-button';
    button.setAttribute('data-collapse-section', 'true');
    button.textContent = buttonText;

    button.addEventListener('click', function () {
      section.open = false;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    body.appendChild(button);
  });
}

function hasDirectCollapseButton(body) {
  return Array.prototype.some.call(body.children, function (child) {
    return child.getAttribute('data-collapse-section') === 'true';
  });
}

function setDefaultDateTime() {
  var field = document.querySelector('[data-field="datumUhrzeit"]');
  var signDateField = document.getElementById('signDatumInput');
  var signDateField = document.getElementById('signDatumInput');

  if (field && !field.value) {
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    field.value = now.toISOString().slice(0, 16);
  }

  if (signDateField && !signDateField.value) {
    var today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    signDateField.value = today.toISOString().slice(0, 10);
  }

  if (signDateField && !signDateField.value) {
    var today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    signDateField.value = today.toISOString().slice(0, 10);
  }
}

function openSection(id, closeOthers) {
  document.querySelectorAll('details.section').forEach(function (section) {
    if (section.id === id) {
      section.open = true;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (closeOthers) {
      section.open = false;
    }
  });
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
        .replace(/\r/g, '')
        .split('\n')
        .map(function (line) {
          return line.trim();
        })
        .filter(function (line) {
          return line && line.charAt(0) !== '#';
        });

      select.innerHTML = '<option value="">Kältemittel auswählen</option>';

      items.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
      });

      if (selectedValue) {
        select.value = selectedValue;
      }
    })
    .catch(function (err) {
      console.warn(getErrorText(err));
      setStatus('Hinweis: Kältemittelliste konnte nicht geladen werden.', 'error');
    });
}

function loadSharedLogoSvg() {
  return fetch('assets/logo.svg')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Logo konnte nicht geladen werden: HTTP ' + response.status);
      }

      return response.text();
    })
    .then(function (text) {
      logoSvgCache = text;
      return text;
    })
    .catch(function () {
      logoSvgCache = '';
      return '';
    });
}

function addIndoorUnit(openAfterAdd, data) {
  indoorCounter += 1;

  var unitId = data && data.id ? String(data.id) : 'rk_' + Date.now() + '_' + indoorCounter;
  var number = document.querySelectorAll('.indoor-card').length + 1;

  var card = document.createElement('details');
  card.className = 'indoor-card';
  card.open = openAfterAdd !== false;
  card.setAttribute('data-unit-id', unitId);

  card.innerHTML =
    '<summary>Rackkühlgerät ' + number + '</summary>' +
    '<div class="indoor-body">' +
      '<div class="grid">' +
        '<div class="field"><label>Hersteller <span class="required-hint">*</span></label><input data-rk-field="hersteller" required autocomplete="off"></div>' +
        '<div class="field"><label>Modellbezeichnung Rackkühlgerät <span class="required-hint">*</span></label><input data-rk-field="modell" required autocomplete="off"></div>' +
        '<div class="field"><label>Seriennummer <span class="required-hint">*</span></label><input data-rk-field="seriennummer" required autocomplete="off"></div>' +
        '<div class="field"><label>Bezeichnung / Standort</label><input data-rk-field="bezeichnung" autocomplete="off"></div>' +
        '<div class="field"><label>Bemerkung</label><input data-rk-field="bemerkung" autocomplete="off"></div>' +
      '</div>' +
      '<div class="field"><label>Fotos Rackkühlgerät</label><input data-rk-photo="true" type="file" accept="image/*" multiple><div class="small-text">Fotos werden beim Übernehmen für den ZIP-Export zwischengespeichert.</div></div>' +
      '<div class="photo-list" data-rk-photo-list="true">Keine Fotos ausgewählt.</div>' +
'<button type="button" class="btn-danger" data-remove-rk="true">Rackkühlgerät entfernen</button>' +
'</div>';

  document.getElementById('innenContainer').appendChild(card);

  if (!currentIndoorPhotos[unitId]) {
    currentIndoorPhotos[unitId] = [];
  }

  var photoInput = card.querySelector('[data-rk-photo="true"]');

  photoInput.addEventListener('change', function () {
    updateAttachmentListFromInput('rueckkuehlgeraet', photoInput, unitId);
  });

  card.querySelector('[data-remove-rk="true"]').addEventListener('click', function () {
    if (document.querySelectorAll('.indoor-card').length <= 1) {
      setStatus('Mindestens ein Rackkühlgerät bleibt im Formular erhalten.', 'error');
      return;
    }

    delete currentIndoorPhotos[unitId];
    card.parentNode.removeChild(card);
    renumberIndoorCards();
    updateSummaries();
    throttledDraftSave();
  });

  if (data) {
    fillIndoorCard(card, data);
  }

updateIndoorPhotoList(unitId);
renumberIndoorCards();
updateSummaries();
addCollapseButtons();
}

function fillIndoorCard(card, data) {
  setInputValue(card.querySelector('[data-rk-field="hersteller"]'), data.hersteller || '');
  setInputValue(card.querySelector('[data-rk-field="modell"]'), data.modell || data.type || '');
  setInputValue(card.querySelector('[data-rk-field="seriennummer"]'), data.seriennummer || '');
  setInputValue(card.querySelector('[data-rk-field="bezeichnung"]'), data.bezeichnung || '');
  setInputValue(card.querySelector('[data-rk-field="bemerkung"]'), data.bemerkung || '');
}

function renumberIndoorCards() {
  document.querySelectorAll('.indoor-card').forEach(function (card, index) {
    var bezeichnung = getInputValue(card.querySelector('[data-rk-field="bezeichnung"]'));
    card.querySelector('summary').textContent = 'Rackkühlgerät ' + (index + 1) + (bezeichnung ? ' – ' + bezeichnung : '');
  });
}

function collectProtocol() {
  var data = {
    exportFormat: 'SCHRACK_Inbetriebnahmeprotokoll_DX_Kuehler_Outdoor_JSON_V1',
    exportiertAm: new Date().toISOString(),
    stammdaten: {
      kunde: getInputValue(document.getElementById('kundeInput')),
      objektanschrift: getInputValue(document.getElementById('objektInput'))
    },
    kopfdaten: collectKopfdaten(),
    pruefung: {
      aussengeraetMeta: {
        hersteller: getInputValue(document.getElementById('aussenHerstellerInput')),
        hersteller: getInputValue(document.getElementById('aussenHerstellerInput')),
        modell: getInputValue(document.getElementById('aussenTypeInput')),
        seriennummer: getInputValue(document.getElementById('aussenSeriennummerInput'))
      },
      inbetriebnahmeinhalt: collectChecklist(document.getElementById('checkInbetriebnahme'), INBETRIEBNAHME_CHECKS),
      rueckkuehlgeraete: collectIndoorUnits(),
      kaeltekreislauf: collectFieldGroup(document.getElementById('fieldsKaeltekreislauf'), FIELD_GROUPS.kaeltekreislauf),
      dichtheitspruefung: collectFieldGroup(document.getElementById('fieldsDichtheit'), FIELD_GROUPS.dichtheit),
      kaeltemittel: {
        kaeltemittel: getInputValue(document.querySelector('[data-special="kaeltemittel"]')),
        kaeltemittelNachfuellmenge: getInputValue(document.querySelector('[data-special="kaeltemittelNachfuellmenge"]')),
        gesamtfuellmenge: getInputValue(document.querySelector('[data-special="gesamtfuellmenge"]'))
      },
      zusatzplatinen: collectFieldGroup(document.getElementById('fieldsZusatz'), FIELD_GROUPS.zusatz),
      spannungsversorgung: collectFieldGroup(document.getElementById('fieldsSpannung'), FIELD_GROUPS.spannung),
      testbetrieb: collectFieldGroup(document.getElementById('fieldsTestbetrieb'), FIELD_GROUPS.testbetrieb),
      inbetriebnahmeergebnis: collectFieldGroup(document.getElementById('fieldsErgebnis'), FIELD_GROUPS.ergebnis),
      dokumentation: collectFieldGroup(document.getElementById('fieldsDokumentation'), FIELD_GROUPS.dokumentation)
    },
    bemerkungen: getInputValue(document.getElementById('bemerkungenText')),
    fotos: collectPhotoMeta(),
unterschrift: {
  techniker: getInputValue(document.getElementById('signTechnikerInput')),
  ort: getInputValue(document.getElementById('signOrtInput')),
  datum: getInputValue(document.getElementById('signDatumInput')),
  ortDatum: [
    getInputValue(document.getElementById('signOrtInput')),
    getInputValue(document.getElementById('signDatumInput'))
  ].filter(Boolean).join(', '),
  vorhanden: signatureDirty,
  dataUrl: signatureDirty ? document.getElementById('signatureCanvas').toDataURL('image/png') : '',
  betreiberVorhanden: betreiberSignatureDirty,
  betreiberDataUrl: betreiberSignatureDirty ? document.getElementById('betreiberSignatureCanvas').toDataURL('image/png') : ''
}
  };

  data.pruefung.inneneinheiten = data.pruefung.rueckkuehlgeraete;

  return data;
}

function collectKopfdaten() {
  var obj = {};

  document.querySelectorAll('#kopfdatenFields [data-field]').forEach(function (field) {
    obj[field.getAttribute('data-field')] = getInputValue(field);
  });

  return obj;
}

function collectChecklist(container, items) {
  return items.map(function (item) {
    var row = findRowByKey(container, item.key);
    var checked = row ? row.querySelector('input[type="radio"]:checked') : null;
    var note = row ? row.querySelector('[data-check-note="true"]') : null;

    return {
      key: item.key,
      pruefpunkt: item.label,
      status: checked ? checked.value : '',
      bemerkung: getInputValue(note)
    };
  });
}

function collectFieldGroup(container, items) {
  var obj = {};

  items.forEach(function (item) {
    var row = findRowByKey(container, item.key);

    if (!row) {
      obj[item.key] = '';
      return;
    }

    if (item.type === 'bool') {
      var checked = row.querySelector('input[type="radio"]:checked');
      obj[item.key] = checked ? checked.value : '';
    } else {
      obj[item.key] = getInputValue(row.querySelector('[data-value="true"]'));
    }
  });

  return obj;
}

function collectIndoorUnits() {
  var units = [];

  document.querySelectorAll('.indoor-card').forEach(function (card, index) {
    var unitId = card.getAttribute('data-unit-id');

    units.push({
      id: unitId,
      nummer: index + 1,
      hersteller: getInputValue(card.querySelector('[data-rk-field="hersteller"]')),
      hersteller: getInputValue(card.querySelector('[data-rk-field="hersteller"]')),
      modell: getInputValue(card.querySelector('[data-rk-field="modell"]')),
      type: getInputValue(card.querySelector('[data-rk-field="modell"]')),
      seriennummer: getInputValue(card.querySelector('[data-rk-field="seriennummer"]')),
      bezeichnung: getInputValue(card.querySelector('[data-rk-field="bezeichnung"]')),
      bemerkung: getInputValue(card.querySelector('[data-rk-field="bemerkung"]')),
      fotos: makeAttachmentMeta(currentIndoorPhotos[unitId] || [])
    });
  });

  return units;
}

function collectPhotoMeta() {
  var rueckkuehlgeraete = [];

  document.querySelectorAll('.indoor-card').forEach(function (card, index) {
    var unitId = card.getAttribute('data-unit-id');

    rueckkuehlgeraete.push({
      id: unitId,
      nummer: index + 1,
      bezeichnung: getInputValue(card.querySelector('[data-rk-field="bezeichnung"]')),
      fotos: makeAttachmentMeta(currentIndoorPhotos[unitId] || [])
    });
  });

  return {
    allgemein: makeAttachmentMeta(currentPhotos),
    aussengeraet: makeAttachmentMeta(currentAussenPhotos),
    rueckkuehlgeraete: rueckkuehlgeraete
  };
}

function makeAttachmentMeta(files) {
  return (files || []).map(function (file) {
    return {
      name: file.name,
      type: file.type || '',
      size: file.size || 0
    };
  });
}

function buildCurrentAttachmentBundle() {
  var rueckkuehlgeraete = [];

  document.querySelectorAll('.indoor-card').forEach(function (card, index) {
    var unitId = card.getAttribute('data-unit-id');

    rueckkuehlgeraete.push({
      id: unitId,
      nummer: index + 1,
      bezeichnung: getInputValue(card.querySelector('[data-rk-field="bezeichnung"]')),
      files: (currentIndoorPhotos[unitId] || []).slice()
    });
  });

  return {
    allgemein: currentPhotos.slice(),
    aussengeraet: currentAussenPhotos.slice(),
    rueckkuehlgeraete: rueckkuehlgeraete
  };
}

function fillFormFromProtocol(data) {
  if (!data) {
    return;
  }

  setInputValue(document.getElementById('kundeInput'), data.stammdaten && data.stammdaten.kunde || '');
  setInputValue(document.getElementById('objektInput'), data.stammdaten && (data.stammdaten.objektanschrift || data.stammdaten.objekt) || '');

  var kopfdaten = data.kopfdaten || {};

  document.querySelectorAll('#kopfdatenFields [data-field]').forEach(function (field) {
    field.value = kopfdaten[field.getAttribute('data-field')] || '';
  });

  var pruefung = data.pruefung || {};
  var aussen = pruefung.aussengeraetMeta || pruefung.ausseneinheitMeta || {};

  setInputValue(document.getElementById('aussenHerstellerInput'), aussen.hersteller || '');
  setInputValue(document.getElementById('aussenHerstellerInput'), aussen.hersteller || '');
  setInputValue(document.getElementById('aussenTypeInput'), aussen.modell || aussen.type || '');
  setInputValue(document.getElementById('aussenSeriennummerInput'), aussen.seriennummer || '');

  setChecklist(document.getElementById('checkInbetriebnahme'), pruefung.inbetriebnahmeinhalt || []);
  setFieldGroup(document.getElementById('fieldsKaeltekreislauf'), FIELD_GROUPS.kaeltekreislauf, pruefung.kaeltekreislauf || {});
  setFieldGroup(document.getElementById('fieldsDichtheit'), FIELD_GROUPS.dichtheit, pruefung.dichtheitspruefung || {});

  setInputValue(document.querySelector('[data-special="kaeltemittel"]'), pruefung.kaeltemittel && pruefung.kaeltemittel.kaeltemittel || '');
  setInputValue(document.querySelector('[data-special="kaeltemittelNachfuellmenge"]'), pruefung.kaeltemittel && pruefung.kaeltemittel.kaeltemittelNachfuellmenge || '');
  setInputValue(document.querySelector('[data-special="gesamtfuellmenge"]'), pruefung.kaeltemittel && pruefung.kaeltemittel.gesamtfuellmenge || '');

  setFieldGroup(document.getElementById('fieldsZusatz'), FIELD_GROUPS.zusatz, pruefung.zusatzplatinen || {});
  setFieldGroup(document.getElementById('fieldsSpannung'), FIELD_GROUPS.spannung, pruefung.spannungsversorgung || {});
  setFieldGroup(document.getElementById('fieldsTestbetrieb'), FIELD_GROUPS.testbetrieb, pruefung.testbetrieb || {});
  setFieldGroup(document.getElementById('fieldsErgebnis'), FIELD_GROUPS.ergebnis, pruefung.inbetriebnahmeergebnis || {});
  setFieldGroup(document.getElementById('fieldsDokumentation'), FIELD_GROUPS.dokumentation, pruefung.dokumentation || {});
  updateBetreiberSignatureVisibility();
  updateBetreiberSignatureVisibility();

  setInputValue(document.getElementById('bemerkungenText'), data.bemerkungen || '');
  setInputValue(document.getElementById('signTechnikerInput'), data.unterschrift && data.unterschrift.techniker || '');
  setInputValue(document.getElementById('signOrtInput'), data.unterschrift && (data.unterschrift.ort || data.unterschrift.ortDatum) || '');
  setInputValue(document.getElementById('signDatumInput'), data.unterschrift && data.unterschrift.datum || '');
  setInputValue(document.getElementById('signOrtInput'), data.unterschrift && (data.unterschrift.ort || data.unterschrift.ortDatum) || '');
  setInputValue(document.getElementById('signDatumInput'), data.unterschrift && data.unterschrift.datum || '');

  document.getElementById('innenContainer').innerHTML = '';
  indoorCounter = 0;

  var units = pruefung.rueckkuehlgeraete || pruefung.inneneinheiten || [];

  if (!units.length) {
    units = [{}];
  }

  units.forEach(function (unit) {
    addIndoorUnit(false, unit);
  });

  if (data.unterschrift && data.unterschrift.dataUrl) {
    drawSignatureFromDataUrl(data.unterschrift.dataUrl);
  } else {
    clearSignature(false);
  }
  if (data.unterschrift && data.unterschrift.betreiberDataUrl) {
    drawBetreiberSignatureFromDataUrl(data.unterschrift.betreiberDataUrl);
  } else {
    clearBetreiberSignature(false);
  }
  if (data.unterschrift && data.unterschrift.betreiberDataUrl) {
    drawBetreiberSignatureFromDataUrl(data.unterschrift.betreiberDataUrl);
  } else {
    clearBetreiberSignature(false);
  }

  updateAllAttachmentLists();
  updateSummaries();
}

function setChecklist(container, list) {
  (list || []).forEach(function (item) {
    var row = findRowByKey(container, item.key);

    if (!row) {
      return;
    }

    row.querySelectorAll('input[type="radio"]').forEach(function (radio) {
      radio.checked = radio.value === item.status;
    });

    setInputValue(row.querySelector('[data-check-note="true"]'), item.bemerkung || '');
  });
}

function setFieldGroup(container, items, data) {
  items.forEach(function (item) {
    var row = findRowByKey(container, item.key);

    if (!row) {
      return;
    }

    if (item.type === 'bool') {
      row.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.checked = radio.value === data[item.key];
      });
    } else {
      setInputValue(row.querySelector('[data-value="true"]'), data[item.key] || '');
    }
  });
}

function takeProtocolIntoList() {
  var data = collectProtocol();
  var issues = getProtocolValidationIssues(data, 'Aktuelles Protokoll');

  if (issues.length > 0) {
    var proceed = window.confirm(
      'Das Protokoll ist noch unvollständig:' +
      lineBreak + lineBreak +
      '- ' + issues.slice(0, 25).join(lineBreak + '- ') +
      lineBreak + lineBreak +
      'Trotzdem in die Liste übernehmen?'
    );

    if (!proceed) {
      setStatus('Übernahme abgebrochen. Fehlende Angaben ergänzen.', 'error');
      return;
    }
  }

  if (editingIndex !== null && appState.protocols[editingIndex]) {
    var oldRecord = appState.protocols[editingIndex];

    oldRecord.data = data;
    oldRecord.bearbeitetAm = new Date().toISOString();
    oldRecord.vollstaendig = issues.length === 0;
    oldRecord.unvollstaendigHinweise = issues;
    photoStore[oldRecord.recordId] = buildCurrentAttachmentBundle();

    editingIndex = null;
    setStatus('Protokoll aktualisiert.', 'ok');
  } else {
    var recordId = createRecordId();

    appState.protocols.push({
      recordId: recordId,
      erstelltAm: new Date().toISOString(),
      bearbeitetAm: new Date().toISOString(),
      data: data,
      vollstaendig: issues.length === 0,
      unvollstaendigHinweise: issues
    });

    photoStore[recordId] = buildCurrentAttachmentBundle();
    setStatus('Protokoll in Liste übernommen.', 'ok');
  }

  saveState();
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  openSection('sectionListe', true);
}

function getProtocolValidationIssues(data, label) {
  var issues = [];
  var prefix = label ? label + ': ' : '';

  var stammdaten = data.stammdaten || {};
  var kopfdaten = data.kopfdaten || {};
  var pruefung = data.pruefung || {};
  var aussen = pruefung.aussengeraetMeta || {};
  var unterschrift = data.unterschrift || {};

  requireValue(issues, prefix, stammdaten.kunde, 'Kunde fehlt');
  requireValue(issues, prefix, stammdaten.objektanschrift, 'Objektanschrift fehlt');
  requireValue(issues, prefix, kopfdaten.anlagentyp, 'Anlagentyp fehlt');
  requireValue(issues, prefix, kopfdaten.datumUhrzeit, 'Datum/Uhrzeit fehlt');
  requireValue(issues, prefix, kopfdaten.techniker, 'Techniker fehlt');
  validateCommissioningDateChoice(issues, prefix, kopfdaten);

  requireValue(issues, prefix, aussen.modell || aussen.type, 'Modellbezeichnung Außengerät fehlt');
  requireValue(issues, prefix, aussen.hersteller, 'Hersteller Außengerät fehlt');
  requireValue(issues, prefix, aussen.hersteller, 'Hersteller Außengerät fehlt');
  requireValue(issues, prefix, aussen.seriennummer, 'Seriennummer Außengerät fehlt');

  (pruefung.rueckkuehlgeraete || []).forEach(function (unit, index) {
    requireValue(issues, prefix, unit.hersteller, 'Hersteller Rackkühlgerät ' + (index + 1) + ' fehlt');
    requireValue(issues, prefix, unit.hersteller, 'Hersteller Rackkühlgerät ' + (index + 1) + ' fehlt');
    requireValue(issues, prefix, unit.modell || unit.type, 'Modellbezeichnung Rackkühlgerät ' + (index + 1) + ' fehlt');
    requireValue(issues, prefix, unit.seriennummer, 'Seriennummer Rackkühlgerät ' + (index + 1) + ' fehlt');
  });

  validateChecklist(issues, prefix, pruefung.inbetriebnahmeinhalt || [], 'Inbetriebnahmeinhalt');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.kaeltekreislauf, pruefung.kaeltekreislauf || {}, 'Kältekreislauf');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.dichtheit, pruefung.dichtheitspruefung || {}, 'Dichtheitsprüfung');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.zusatz, pruefung.zusatzplatinen || {}, 'Zusatzplatinen');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.spannung, pruefung.spannungsversorgung || {}, 'Spannungsversorgung');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.testbetrieb, pruefung.testbetrieb || {}, 'Testbetrieb');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.ergebnis, pruefung.inbetriebnahmeergebnis || {}, 'Inbetriebnahmeergebnis');
  validateBoolGroup(issues, prefix, FIELD_GROUPS.dokumentation, pruefung.dokumentation || {}, 'Dokumentation');

  requireValue(issues, prefix, unterschrift.techniker, 'Technikername bei Signatur fehlt');
  requireValue(issues, prefix, unterschrift.datum, SIGNATURE_DATE_MISSING);

  if (!unterschrift.vorhanden) {
    issues.push(prefix + 'Unterschrift fehlt');
  }

  if (pruefung.dokumentation && pruefung.dokumentation.einweisungBetreiber === 'Ja' && !unterschrift.betreiberVorhanden) {
    issues.push(prefix + 'Betreiber-Unterschrift fehlt (Einweisung Betreiber = Ja)');
  }

  if (pruefung.dokumentation && pruefung.dokumentation.einweisungBetreiber === 'Ja' && !unterschrift.betreiberVorhanden) {
    issues.push(prefix + 'Betreiber-Unterschrift fehlt (Einweisung Betreiber = Ja)');
  }

  return issues;
}

function validateCommissioningDateChoice(issues, prefix, kopfdaten) {
  var firstDate = String(kopfdaten.erstinbetriebnahme || '').trim();
  var repeatDate = String(kopfdaten.wiederholteInbetriebnahme || '').trim();

  if (!firstDate && !repeatDate) {
    issues.push(prefix + 'Datum Erstinbetriebnahme oder Datum wiederholte Inbetriebnahme fehlt');
    return;
  }

  if (firstDate && repeatDate) {
    issues.push(prefix + 'Nur ein Datum auswählen: Erstinbetriebnahme oder wiederholte Inbetriebnahme');
    return;
  }

  if (firstDate && !isIsoDate(firstDate)) {
    issues.push(prefix + 'Datum Erstinbetriebnahme ist ungültig');
  }

  if (repeatDate && !isIsoDate(repeatDate)) {
    issues.push(prefix + 'Datum wiederholte Inbetriebnahme ist ungültig');
  }
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function requireValue(issues, prefix, value, message) {
  if (!String(value || '').trim()) {
    issues.push(prefix + message);
  }
}

function validateChecklist(issues, prefix, list, sectionName) {
  list.forEach(function (item) {
    if (!item.status) {
      issues.push(prefix + sectionName + ': ' + item.pruefpunkt + ' nicht ausgewählt');
    }
  });
}

function validateBoolGroup(issues, prefix, config, data, sectionName) {
  config.forEach(function (item) {
    if (item.type === 'bool' && !data[item.key]) {
      issues.push(prefix + sectionName + ': ' + item.label + ' nicht ausgewählt');
    }
  });
}

function renderProtocolList() {
  var container = document.getElementById('protocolList');
  container.innerHTML = '';

  if (!appState.protocols.length) {
    container.innerHTML = '<div class="small-text">Noch kein Protokoll übernommen.</div>';
  }

  appState.protocols.forEach(function (record, index) {
    var item = document.createElement('div');
    item.className = 'protocol-list-item' + (editingIndex === index ? ' editing' : '');

    item.innerHTML =
      '<strong>' + escapeHtml(buildRecordLabel(record.data, index)) + '</strong>' +
      '<span class="badge">' + (record.vollstaendig ? 'vollständig' : 'unvollständig') + '</span>' +
      (editingIndex === index ? ' <span class="badge badge-edit">Bearbeitung</span>' : '') +
      '<div class="small-text">ID: ' + escapeHtml(record.recordId) + '</div>' +
      '<div class="button-grid">' +
        '<button type="button" class="btn-secondary" data-edit-record="' + index + '">Bearbeiten</button>' +
        '<button type="button" class="btn-danger" data-delete-record="' + index + '">Löschen</button>' +
      '</div>';

    container.appendChild(item);
  });

  container.querySelectorAll('[data-edit-record]').forEach(function (button) {
    button.addEventListener('click', function () {
      editProtocol(Number(button.getAttribute('data-edit-record')));
    });
  });

  container.querySelectorAll('[data-delete-record]').forEach(function (button) {
    button.addEventListener('click', function () {
      deleteProtocol(Number(button.getAttribute('data-delete-record')));
    });
  });

  document.getElementById('summaryListe').textContent = appState.protocols.length
    ? appState.protocols.length + ' Protokoll(e) übernommen'
    : 'Noch kein Protokoll übernommen';
}

function buildRecordLabel(data, index) {
  data = data || {};

  var s = data.stammdaten || {};
  var p = data.pruefung || {};
  var a = p.aussengeraetMeta || {};

  return 'Protokoll ' + (index + 1) + ' – ' + (s.kunde || 'ohne Kunde') + ' – ' + (a.modell || 'ohne Außengerät');
}

function editProtocol(index) {
  var record = appState.protocols[index];

  if (!record) {
    return;
  }

  resetCurrentForm(false);
  editingIndex = index;

  var bundle = photoStore[record.recordId];

  if (bundle) {
    currentPhotos = (bundle.allgemein || []).slice();
    currentAussenPhotos = (bundle.aussengeraet || []).slice();
    currentIndoorPhotos = {};

    (bundle.rueckkuehlgeraete || []).forEach(function (unit) {
      currentIndoorPhotos[unit.id] = (unit.files || []).slice();
    });
  }

  fillFormFromProtocol(record.data);
  updateAllAttachmentLists();
  updateEditModeUI();
  renderProtocolList();
  openSection('sectionStammdaten', true);
  setStatus('Protokoll im Bearbeitungsmodus geladen.', 'ok');
}

function deleteProtocol(index) {
  var record = appState.protocols[index];

  if (!record) {
    return;
  }

  if (!window.confirm('Dieses Protokoll wirklich löschen?')) {
    return;
  }

  delete photoStore[record.recordId];
  appState.protocols.splice(index, 1);

  if (editingIndex === index) {
    editingIndex = null;
  }

  saveState();
  renderProtocolList();
  updateEditModeUI();
  setStatus('Protokoll gelöscht.', 'ok');
}

function updateEditModeUI() {
  var banner = document.getElementById('editBanner');
  var bottomButton = document.getElementById('bottomTakeButton');
  var bottomButton = document.getElementById('bottomTakeButton');

  if (editingIndex !== null) {
    banner.className = 'edit-banner active';
    banner.textContent = 'Bearbeitungsmodus aktiv: Beim Übernehmen wird das geladene Protokoll aktualisiert.';
    bottomButton.textContent = 'Änderung speichern';
    bottomButton.className = 'btn-edit-save';
    bottomButton.textContent = 'Änderung speichern';
    bottomButton.className = 'btn-edit-save';
  } else {
    banner.className = 'edit-banner';
    banner.textContent = '';
    bottomButton.textContent = 'Übernehmen';
    bottomButton.className = 'btn-brand';
    bottomButton.textContent = 'Übernehmen';
    bottomButton.className = 'btn-brand';
  }
}

function updateSummaries() {
  var kunde = getInputValue(document.getElementById('kundeInput'));
  var objekt = getInputValue(document.getElementById('objektInput'));

  document.getElementById('summaryStammdaten').textContent = [kunde, objekt].filter(Boolean).join(' / ') || 'Kunde und Objektanschrift';

  var typ = getInputValue(document.querySelector('[data-field="anlagentyp"]'));
  var datum = formatDateTimeDisplay(getInputValue(document.querySelector('[data-field="datumUhrzeit"]')));
  var datum = formatDateTimeDisplay(getInputValue(document.querySelector('[data-field="datumUhrzeit"]')));

  document.getElementById('summaryKopfdaten').textContent = [typ, datum].filter(Boolean).join(' / ') || 'Anlagendaten, Datum, Techniker';

  var aussenHersteller = getInputValue(document.getElementById('aussenHerstellerInput'));
  var aussenModell = getInputValue(document.getElementById('aussenTypeInput'));
  var aussenSeriennummer = getInputValue(document.getElementById('aussenSeriennummerInput'));
  var aussenHersteller = getInputValue(document.getElementById('aussenHerstellerInput'));
  var aussenModell = getInputValue(document.getElementById('aussenTypeInput'));
  var aussenSeriennummer = getInputValue(document.getElementById('aussenSeriennummerInput'));

  document.getElementById('summaryAussen').textContent = [aussenHersteller, aussenModell, aussenSeriennummer].filter(Boolean).join(' / ') || 'Hersteller / Modell/Type / Seriennummer';
  document.getElementById('summaryAussen').textContent = [aussenHersteller, aussenModell, aussenSeriennummer].filter(Boolean).join(' / ') || 'Hersteller / Modell/Type / Seriennummer';
  document.getElementById('summaryInnen').textContent = document.querySelectorAll('.indoor-card').length + ' Rackkühlgerät(e)';
  document.getElementById('summaryBemerkungen').textContent = getInputValue(document.getElementById('bemerkungenText')) ? 'Bemerkung vorhanden' : 'keine Bemerkung';
  document.getElementById('summaryFotos').textContent = (currentPhotos.length + currentAussenPhotos.length + countIndoorFiles()) + ' Datei(en) ausgewählt';
  document.getElementById('summaryUnterschrift').textContent = signatureDirty ? 'Unterschrift vorhanden' : SIGNATURE_SUMMARY_DEFAULT;
}

function countIndoorFiles() {
  var count = 0;

  Object.keys(currentIndoorPhotos).forEach(function (key) {
    count += (currentIndoorPhotos[key] || []).length;
  });

  return count;
}

function resetCurrentForm(showStatus) {
  document.getElementById('kundeInput').value = '';
  document.getElementById('objektInput').value = '';
  document.getElementById('protocolForm').reset();
  document.getElementById('innenContainer').innerHTML = '';

  indoorCounter = 0;
  currentPhotos = [];
  currentAussenPhotos = [];
  currentIndoorPhotos = {};
  editingIndex = null;

  document.getElementById('fotoInput').value = '';
  document.getElementById('aussenFotoInput').value = '';

  clearSignature(false);
  setDefaultDateTime();
  addIndoorUnit(false);
  updateAllAttachmentLists();
  updateEditModeUI();
  updateSummaries();

  if (showStatus) {
    setStatus('Formular geleert.', 'ok');
  }
}

function clearAll() {
  if (!window.confirm('Alle lokalen Daten, Protokolle und Entwürfe löschen?')) {
    return;
  }

  appState = {
    version: APP_VERSION,
    protocols: [],
    draft: null
  };

  photoStore = {};
  localStorage.removeItem(STORAGE_KEY);
  resetCurrentForm(false);
  renderProtocolList();
  setStatus('Alle lokalen Daten wurden gelöscht.', 'ok');
}

function saveDraft(showStatus) {
  try {
    appState.draft = collectProtocol();
    saveState();

    if (showStatus) {
      setStatus('Entwurf lokal gespeichert. Fotos/Dateien werden nicht dauerhaft im Entwurf gespeichert.', 'ok');
    }
  } catch (err) {
    console.warn(getErrorText(err));
  }
}

function restoreDraft() {
  if (appState.draft) {
    fillFormFromProtocol(appState.draft);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: APP_VERSION,
    protocols: appState.protocols,
    draft: appState.draft
  }));
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    var data = JSON.parse(raw);

    appState.version = data.version || APP_VERSION;
    appState.protocols = Array.isArray(data.protocols) ? data.protocols : [];
    appState.draft = data.draft || null;
  } catch (err) {
    console.warn(getErrorText(err));
  }
}

async function updateAttachmentListFromInput(scope, input, unitId) {
  var files = Array.prototype.slice.call(input.files || []);
  var converted = [];

  for (var i = 0; i < files.length; i++) {
    converted.push(await readFileAsStoredAttachment(files[i]));
  }

  if (!converted.length) {
    input.value = '';
    return;
  }

  if (scope === 'allgemein') {
    currentPhotos = currentPhotos.concat(converted);
  }

  if (scope === 'aussengeraet') {
    currentAussenPhotos = currentAussenPhotos.concat(converted);
  }

  if (scope === 'rueckkuehlgeraet') {
    if (!currentIndoorPhotos[unitId]) {
      currentIndoorPhotos[unitId] = [];
    }

    currentIndoorPhotos[unitId] = currentIndoorPhotos[unitId].concat(converted);
  }

  input.value = '';

  updateAllAttachmentLists();
  throttledDraftSave();
}

function readFileAsStoredAttachment(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();

    reader.onload = function () {
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size || 0,
        data: new Uint8Array(reader.result)
      });
    };

    reader.onerror = function () {
      reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function updateAllAttachmentLists() {
  renderAttachmentList(document.getElementById('photoList'), currentPhotos, function (index) {
    currentPhotos.splice(index, 1);
    updateAllAttachmentLists();
  });

  renderAttachmentList(document.getElementById('aussenPhotoList'), currentAussenPhotos, function (index) {
    currentAussenPhotos.splice(index, 1);
    updateAllAttachmentLists();
  });

  document.querySelectorAll('.indoor-card').forEach(function (card) {
    updateIndoorPhotoList(card.getAttribute('data-unit-id'));
  });

  updateSummaries();
}

function updateIndoorPhotoList(unitId) {
  var card = findIndoorCardById(unitId);

  if (!card) {
    return;
  }

  renderAttachmentList(card.querySelector('[data-rk-photo-list="true"]'), currentIndoorPhotos[unitId] || [], function (index) {
    currentIndoorPhotos[unitId].splice(index, 1);
    updateAllAttachmentLists();
  });
}

function renderAttachmentList(container, files, onDelete) {
  if (!container) {
    return;
  }

  files = files || [];

  if (!files.length) {
    container.textContent = 'Keine Fotos/Dateien ausgewählt.';
    return;
  }

  container.innerHTML = '';

  files.forEach(function (file, index) {
    var row = document.createElement('div');
    row.className = 'photo-row';

    row.innerHTML =
      '<div><div class="photo-name">' + escapeHtml(file.name) + '</div><div class="photo-meta">' + escapeHtml(file.type || 'Datei') + ' · ' + formatBytes(file.size || 0) + '</div></div>' +
      '<button type="button" class="btn-danger photo-delete">Löschen</button>';

    row.querySelector('button').addEventListener('click', function () {
      onDelete(index);
    });

    container.appendChild(row);
  });
}

function getAllProtocolValidationIssuesForExport() {
  var issues = [];

  appState.protocols.forEach(function (record, index) {
    var recordIssues = getProtocolValidationIssues(record.data, 'Protokoll ' + (index + 1));

    record.vollstaendig = recordIssues.length === 0;
    record.unvollstaendigHinweise = recordIssues;

    issues = issues.concat(recordIssues);
  });

  return issues;
}

function getPhotoExportIssues() {
  var issues = [];

  appState.protocols.forEach(function (record, index) {
    var meta = record.data && record.data.fotos || {};
    var bundle = photoStore[record.recordId];
    var prefix = 'Protokoll ' + (index + 1) + ': ';

    if ((meta.allgemein || []).length && (!bundle || (bundle.allgemein || []).length < meta.allgemein.length)) {
      issues.push(prefix + 'allgemeine Fotos/Dateien fehlen');
    }

    if ((meta.aussengeraet || []).length && (!bundle || (bundle.aussengeraet || []).length < meta.aussengeraet.length)) {
      issues.push(prefix + 'Fotos Außengerät fehlen');
    }

    (meta.rueckkuehlgeraete || []).forEach(function (unit) {
      var found = null;

      if (bundle) {
        (bundle.rueckkuehlgeraete || []).forEach(function (b) {
          if (b.id === unit.id) {
            found = b;
          }
        });
      }

      if ((unit.fotos || []).length && (!found || (found.files || []).length < unit.fotos.length)) {
        issues.push(prefix + 'Fotos Rackkühlgerät ' + unit.nummer + ' fehlen');
      }
    });
  });

  return issues;
}

async function exportZip() {
  if (editingIndex !== null) {
    setStatus('Es ist noch ein Protokoll im Bearbeitungsmodus. Erst übernehmen oder Formular leeren.', 'error');
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
    setStatus(
      'Export nicht möglich. Es sind unvollständige Protokolle in der Liste:' +
      lineBreak + lineBreak +
      '- ' + exportIssues.slice(0, 40).join(lineBreak + '- '),
      'error'
    );
    openSection('sectionListe', true);
    renderProtocolList();
    return;
  }

  var photoIssues = getPhotoExportIssues();

  if (photoIssues.length > 0) {
    setStatus(
      'Export nicht möglich. Es fehlen Fotodateien für den ZIP-Export:' +
      lineBreak + lineBreak +
      '- ' + photoIssues.slice(0, 20).join(lineBreak + '- '),
      'error'
    );
    openSection('sectionListe', true);
    return;
  }

  await loadSharedLogoSvg();
  setStatus('ZIP mit Druckansicht-PDFs wird erstellt ...', 'ok');

  try {
    var files = [];
    var exportData = buildExportData();

    files.push({
      name: 'protokolle.json',
      data: utf8(JSON.stringify(exportData, null, 2))
    });

    files.push({
      name: 'protokolle.csv',
      data: utf8(String.fromCharCode(65279) + buildCsvForProtocols(appState.protocols))
    });

    for (var i = 0; i < appState.protocols.length; i++) {
      var record = appState.protocols[i];
      var folder = buildProtocolFolderName(record, i) + '/';

      files.push({
        name: folder + 'druckansicht.html',
        data: utf8(buildPrintHtml(record.data))
      });

      files.push({
        name: folder + 'protokoll.pdf',
        data: await generatePrintPdfBytes(record.data)
      });

      addAttachmentBundleToZip(files, folder, photoStore[record.recordId]);
    }

    var zip = buildZip(files);

    downloadFile(buildZipFileName(), zip, 'application/zip');
    saveState();

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

function buildExportData() {
  return {
    exportFormat: 'SCHRACK_Inbetriebnahmeprotokolle_DX_Kuehler_Outdoor_JSON_V1',
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

function buildZipFileName() {
  var first = appState.protocols[0] || {};
  var data = first.data || {};
  var stammdaten = data.stammdaten || {};

  return sanitizePathPart(stammdaten.kunde, 'kein_kunde') +
    '_' +
    sanitizePathPart(stammdaten.objektanschrift, 'kein_objekt') +
    '_inbetriebnahmeprotokolle_dx_kuehler_' +
    formatDateCompact(new Date()) +
    '.zip';
}

function buildProtocolFolderName(record, index) {
  var data = record && record.data ? record.data : {};
  var pruefung = data.pruefung || {};
  var aussen = pruefung.aussengeraetMeta || {};

  return 'protokoll_' + pad3(index + 1) + '_' + sanitizePathPart(aussen.modell, 'ohne_aussengeraet');
}

function addAttachmentBundleToZip(files, folder, bundle) {
  if (!bundle) {
    return;
  }

  (bundle.allgemein || []).forEach(function (file, index) {
    files.push({
      name: folder + 'fotos-dateien/allgemein/' + pad3(index + 1) + '_' + sanitizeFileName(file.name),
      data: file.data
    });
  });

  (bundle.aussengeraet || []).forEach(function (file, index) {
    files.push({
      name: folder + 'fotos-dateien/aussengeraet/' + pad3(index + 1) + '_' + sanitizeFileName(file.name),
      data: file.data
    });
  });

  (bundle.rueckkuehlgeraete || []).forEach(function (unit, unitIndex) {
    var unitFolder = folder +
      'fotos-dateien/rueckkuehlgeraete/rueckkuehlgeraet_' +
      pad3(unitIndex + 1) +
      '_' +
      sanitizePathPart(unit.bezeichnung, 'ohne_bezeichnung') +
      '/';

    (unit.files || []).forEach(function (file, index) {
      files.push({
        name: unitFolder + pad3(index + 1) + '_' + sanitizeFileName(file.name),
        data: file.data
      });
    });
  });
}

function buildCsvForProtocols(records) {
  var rows = [];

  rows.push(['Protokoll_ID', 'Bereich', 'Einheit', 'Prüfpunkt/Feld', 'Wert/Status', 'Bemerkung', 'Einheit']);

  records.forEach(function (record) {
    var data = record.data || {};
    var s = data.stammdaten || {};
    var k = data.kopfdaten || {};
    var p = data.pruefung || {};

    rows.push([record.recordId, 'Stammdaten', '', 'Kunde', s.kunde || '', '', '']);
    rows.push([record.recordId, 'Stammdaten', '', 'Objektanschrift', s.objektanschrift || '', '', '']);

    Object.keys(k).forEach(function (key) {
      rows.push([record.recordId, 'Kopfdaten', '', key, k[key], '', '']);
    });

    var aussen = p.aussengeraetMeta || {};

    rows.push([record.recordId, 'Außengerät', '', 'Hersteller', aussen.hersteller || '', '', '']);
    rows.push([record.recordId, 'Außengerät', '', 'Hersteller', aussen.hersteller || '', '', '']);
    rows.push([record.recordId, 'Außengerät', '', 'Modellbezeichnung Außengerät', aussen.modell || '', '', '']);
    rows.push([record.recordId, 'Außengerät', '', 'Seriennummer', aussen.seriennummer || '', '', '']);

    addCsvChecklist(rows, record.recordId, p.inbetriebnahmeinhalt || [], 'Inbetriebnahmeinhalt', '');

    (p.rueckkuehlgeraete || []).forEach(function (unit, index) {
      var name = 'Rackkühlgerät ' + (index + 1);

      rows.push([record.recordId, 'Rackkühlgerät', name, 'Hersteller', unit.hersteller || '', '', '']);
      rows.push([record.recordId, 'Rackkühlgerät', name, 'Hersteller', unit.hersteller || '', '', '']);
      rows.push([record.recordId, 'Rackkühlgerät', name, 'Modellbezeichnung', unit.modell || '', '', '']);
      rows.push([record.recordId, 'Rackkühlgerät', name, 'Seriennummer', unit.seriennummer || '', '', '']);
      rows.push([record.recordId, 'Rackkühlgerät', name, 'Bezeichnung / Standort', unit.bezeichnung || '', '', '']);
      rows.push([record.recordId, 'Rackkühlgerät', name, 'Bemerkung', unit.bemerkung || '', '', '']);
    });

    addCsvFieldGroup(rows, record.recordId, 'Kältekreislauf', p.kaeltekreislauf || {}, FIELD_GROUPS.kaeltekreislauf);
    addCsvFieldGroup(rows, record.recordId, 'Dichtheitsprüfung', p.dichtheitspruefung || {}, FIELD_GROUPS.dichtheit);
    addCsvObject(rows, record.recordId, 'Kältemittel und Füllmenge', p.kaeltemittel || {});
    addCsvFieldGroup(rows, record.recordId, 'Zusatzplatinen / Komponenten', p.zusatzplatinen || {}, FIELD_GROUPS.zusatz);
    addCsvFieldGroup(rows, record.recordId, 'Spannungsversorgung', p.spannungsversorgung || {}, FIELD_GROUPS.spannung);
    addCsvFieldGroup(rows, record.recordId, 'Testbetrieb / Manometerdruck', p.testbetrieb || {}, FIELD_GROUPS.testbetrieb);
    addCsvFieldGroup(rows, record.recordId, 'Inbetriebnahmeergebnis', p.inbetriebnahmeergebnis || {}, FIELD_GROUPS.ergebnis);
    addCsvFieldGroup(rows, record.recordId, 'Anlagendokumentation / Einweisung', p.dokumentation || {}, FIELD_GROUPS.dokumentation);

    rows.push([record.recordId, 'Bemerkungen', '', 'Bemerkungen', data.bemerkungen || '', '', '']);
    rows.push([record.recordId, 'Unterschrift', '', 'Techniker', data.unterschrift && data.unterschrift.techniker || '', data.unterschrift && data.unterschrift.vorhanden ? 'Unterschrift eingebettet' : 'keine Unterschrift', '']);
    rows.push([record.recordId, 'Unterschrift', '', 'Ort', data.unterschrift && (data.unterschrift.ort || '') || '', '', '']);
    rows.push([record.recordId, 'Unterschrift', '', 'Datum', data.unterschrift && (data.unterschrift.datum || '') || '', '', '']);
    rows.push([record.recordId, 'Unterschrift', '', 'Ort', data.unterschrift && (data.unterschrift.ort || '') || '', '', '']);
    rows.push([record.recordId, 'Unterschrift', '', 'Datum', data.unterschrift && (data.unterschrift.datum || '') || '', '', '']);

    addCsvAttachmentMetaRows(rows, record.recordId, data.fotos || {});
  });

  return rows.map(function (row) {
    return row.map(csvCell).join(';');
  }).join(csvLineBreak);
}

function addCsvChecklist(rows, recordId, list, bereich, einheit) {
  (list || []).forEach(function (r) {
    rows.push([recordId, bereich, einheit, r.pruefpunkt, r.status, r.bemerkung || '', '']);
  });
}

function addCsvFieldGroup(rows, recordId, bereich, data, config) {
  config.forEach(function (item) {
    rows.push([recordId, bereich, '', item.label, data[item.key] || '', '', item.unit || '']);
  });
}

function addCsvObject(rows, recordId, bereich, data) {
  Object.keys(data || {}).forEach(function (key) {
    rows.push([recordId, bereich, '', key, data[key], '', '']);
  });
}

function addCsvAttachmentMetaRows(rows, recordId, fotos) {
  (fotos.allgemein || []).forEach(function (f) {
    rows.push([recordId, 'Fotos/Dateien', 'Allgemein', f.name, f.type || '', formatBytes(f.size || 0), '']);
  });

  (fotos.aussengeraet || []).forEach(function (f) {
    rows.push([recordId, 'Fotos/Dateien', 'Außengerät', f.name, f.type || '', formatBytes(f.size || 0), '']);
  });

  (fotos.rueckkuehlgeraete || []).forEach(function (u) {
    (u.fotos || []).forEach(function (f) {
      rows.push([recordId, 'Fotos/Dateien', 'Rackkühlgerät ' + u.nummer, f.name, f.type || '', formatBytes(f.size || 0), '']);
    });
  });
}

function csvCell(value) {
  var text = String(value == null ? '' : value);

  if (/[";\r\n]/.test(text)) {
    text = '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

function buildPrintHtml(data) {
  return '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Inbetriebnahmeprotokoll DX Kühler Outdoor</title><style>' +
    buildPrintCss() +
    '</style></head><body>' +
    buildPrintContent(data) +
    '</body></html>';
}

function buildPrintContent(data) {
  var s = data.stammdaten || {};
  var k = data.kopfdaten || {};
  var p = data.pruefung || {};
  var aussen = p.aussengeraetMeta || {};
  var u = data.unterschrift || {};

  var html = '';

  html += '<div class="print-page">';
  html += '<div class="print-logo">' + getPrintLogoHtml() + '</div>';
  html += '<h1>Inbetriebnahmeprotokoll DX Kühler Outdoor</h1>';

  html += '<div class="top-grid">';
  html += '<div><b>Kunde:</b> ' + e(s.kunde) + '<br><b>Objektanschrift:</b> ' + e(s.objektanschrift) + '<br><b>Anlagenerrichter:</b> ' + e(k.anlagenerrichter) + '<br><b>Anlagentyp:</b> ' + e(k.anlagentyp) + '</div>';
  html += '<div><b>Datum/Uhrzeit:</b> ' + e(formatDateTimeDisplay(k.datumUhrzeit)) + '<br><b>Techniker:</b> ' + e(k.techniker) + '<br><b>Erstinbetriebnahme:</b> ' + e(k.erstinbetriebnahme) + '<br><b>Wiederholte Inbetriebnahme:</b> ' + e(k.wiederholteInbetriebnahme) + '</div>';
  html += '<div><b>Datum/Uhrzeit:</b> ' + e(formatDateTimeDisplay(k.datumUhrzeit)) + '<br><b>Techniker:</b> ' + e(k.techniker) + '<br><b>Erstinbetriebnahme:</b> ' + e(k.erstinbetriebnahme) + '<br><b>Wiederholte Inbetriebnahme:</b> ' + e(k.wiederholteInbetriebnahme) + '</div>';
  html += '</div>';

var rackUnits = p.rueckkuehlgeraete || p.inneneinheiten || [];

html += sectionTitle('Geräte');
html += '<div class="top-grid">';

html += '<div><b>Hersteller / Modellbezeichnung Außengerät / Seriennummer</b><br>' +
  e(aussen.hersteller || '') + '<br>' +
  e(aussen.modell || aussen.type || '') + '<br>' +
  e(aussen.seriennummer || '') +
  '</div>';

html += '<div><b>Modellbezeichnung Rackkühlgerät(e) / Seriennummer</b><br>' +
  rackUnits.map(function (unit, index) {
    return e((index + 1) + '. ' +
      (unit.hersteller || '') + ' / ' +
      (unit.modell || unit.type || '') + ' / ' +
      (unit.seriennummer || ''));
  }).join('<br>') +
  '</div>';

html += '</div>';
  html += printFieldTable('Kältekreislauf', p.kaeltekreislauf || {}, FIELD_GROUPS.kaeltekreislauf);
  html += printFieldTable('Dichtheitsprüfung', p.dichtheitspruefung || {}, FIELD_GROUPS.dichtheit);

  html += printKeyValueTable('Kältemittel und Füllmenge', [
    ['Kältemittel', p.kaeltemittel && p.kaeltemittel.kaeltemittel || '', ''],
    ['Kältemittelnachfüllmenge', p.kaeltemittel && p.kaeltemittel.kaeltemittelNachfuellmenge || '', 'kg'],
    ['Gesamtfüllmenge', p.kaeltemittel && p.kaeltemittel.gesamtfuellmenge || '', 'kg']
  ]);

  html += printFieldTable('Zusatzplatinen / Komponenten', p.zusatzplatinen || {}, FIELD_GROUPS.zusatz, false);
  html += printFieldTable('Zusatzplatinen / Komponenten', p.zusatzplatinen || {}, FIELD_GROUPS.zusatz, false);
  html += printFieldTable('Spannungsversorgung', p.spannungsversorgung || {}, FIELD_GROUPS.spannung);
  html += printFieldTable('Testbetrieb / Manometerdruck', p.testbetrieb || {}, FIELD_GROUPS.testbetrieb);
  html += printFieldTable('Inbetriebnahmeergebnis', p.inbetriebnahmeergebnis || {}, FIELD_GROUPS.ergebnis, false);
  html += printFieldTable('Inbetriebnahmeergebnis', p.inbetriebnahmeergebnis || {}, FIELD_GROUPS.ergebnis, false);
  html += printFieldTable('Anlagendokumentation / Einweisung', p.dokumentation || {}, FIELD_GROUPS.dokumentation);

  html += sectionTitle('Bemerkungen');
  html += '<div class="box">' + e(data.bemerkungen || '') + '</div>';

  html += '<div class="sign-grid">';
  html += '<div><b>Stempel/Signatur</b><div class="sig">' + (u.dataUrl ? '<img src="' + e(u.dataUrl) + '">' : '') + '</div><div>' + e(u.techniker || '') + '</div></div>';
  if (u.betreiberDataUrl) {
    html += '<div><b>Unterschrift Betreiber</b><div class="sig"><img src="' + e(u.betreiberDataUrl) + '"></div></div>';
  }
  var signOrt = String(u.ort || '').trim();
var signDatum = String(u.datum || '').trim();

if (signOrt === signDatum) {
  signOrt = '';
}

html += '<div class="ort"><b>Ort / Datum</b><br>' +
  e(signOrt) +
  (signOrt && signDatum ? '<br>' : '') +
  e(signDatum) +
  '</div>';
  html += '</div>';

  html += '</div>';

  return html;
}

function sectionTitle(title) {
  return '<div class="print-sec">' + e(title) + '</div>';
}

function printChecklistTable(title, list) {
  var html = sectionTitle(title);

  html += '<table><tr><th>Prüfpunkt</th><th>Ja</th><th>Nein</th><th>Bemerkung</th></tr>';

  (list || []).forEach(function (r) {
    html += '<tr><td>' + e(r.pruefpunkt) + '</td><td>' + (r.status === 'Ja' ? 'X' : '') + '</td><td>' + (r.status === 'Nein' ? 'X' : '') + '</td><td>' + e(r.bemerkung || '') + '</td></tr>';
  });

  html += '</table>';

  return html;
}


function printFieldTable(title, data, config, showUnitColumn) {
  var rows = config.map(function (item) {
    return [item.label, data[item.key] || '', item.unit || ''];
  });

  return printKeyValueTable(title, rows, showUnitColumn !== false);
}

function printKeyValueTable(title, rows, showUnitColumn) {
  var html = sectionTitle(title);
  var withUnit = showUnitColumn !== false;

  html += withUnit
    ? '<table><tr><th>Feld</th><th>Wert</th><th>Einheit</th></tr>'
    : '<table><tr><th>Feld</th><th>Wert</th></tr>';

  rows.forEach(function (r) {
    html += withUnit
      ? '<tr><td>' + e(r[0]) + '</td><td>' + e(r[1]) + '</td><td>' + e(r[2]) + '</td></tr>'
      : '<tr><td>' + e(r[0]) + '</td><td>' + e(r[1]) + '</td></tr>';
  });

  html += '</table>';

  return html;
}

function getPrintLogoHtml() {
  if (logoSvgCache) {
    return logoSvgCache;
  }

  return '<div class="logo-fallback">SCHRACK TECHNIK</div>';
}

function buildPrintCss() {
  return [
    'html,body{margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111}',
    '.print-page{width:210mm;min-height:297mm;margin:0 auto;padding:8mm;box-sizing:border-box;background:#fff}',
    '.print-logo{text-align:center;margin-bottom:4mm}',
    '.print-logo svg,.print-logo img{max-width:52mm;max-height:18mm}',
    '.logo-fallback{text-align:center;font-weight:900;color:#005ca9;font-size:18px}',
    'h1{text-align:center;font-size:18px;margin:0 0 4mm 0}',
    '.top-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111;margin-bottom:5mm}',
    '.top-grid>div{padding:2.5mm;border-right:1px solid #111}',
    '.top-grid>div:last-child{border-right:0}',
    '.print-sec{font-weight:bold;background:#e6f1fb;border:1px solid #111;padding:1.5mm;margin:3mm 0 0 0}',
    '.box{border:1px solid #111;min-height:18mm;padding:2mm}',
    'table{width:100%;border-collapse:collapse;margin:0 0 3mm 0}',
    'th,td{border:1px solid #111;padding:1.3mm;vertical-align:top}',
    'th{background:#eee}',
    '.sign-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111;margin-top:6mm}',
    '.sign-grid>div{min-height:24mm;padding:2mm;border-right:1px solid #111}',
    '.sign-grid>div{min-height:24mm;padding:2mm;border-right:1px solid #111}',
    '.sign-grid>div:last-child{border-right:0}',
    '.sig{height:17.6mm;margin-top:2mm}',
    '.sig img{max-height:17.6mm;max-width:100%}',
    '.sig{height:17.6mm;margin-top:2mm}',
    '.sig img{max-height:17.6mm;max-width:100%}',
    '.ort{text-align:center;font-size:13px}',
    '@media print{.print-page{margin:0;page-break-after:always}}'
  ].join('');
}

async function generatePrintPdfBytes(data) {
  if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('PDF-Bibliotheken html2canvas/jsPDF sind nicht geladen.');
  }

  var holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-10000px';
  holder.style.top = '0';
  holder.style.width = '210mm';
  holder.innerHTML = '<style>' + buildPrintCss() + '</style>' + buildPrintContent(data);

  document.body.appendChild(holder);

  try {
    var pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
    var page = holder.querySelector('.print-page');
    var canvas = await window.html2canvas(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });

    var pageWidthMm = 210;
    var pageHeightMm = 297;
    var sliceHeightPx = Math.floor(canvas.width * pageHeightMm / pageWidthMm);
    var y = 0;
    var pageIndex = 0;

    while (y < canvas.height) {
      var currentSliceHeight = Math.min(sliceHeightPx, canvas.height - y);
      var sliceCanvas = document.createElement('canvas');
      var ctx = sliceCanvas.getContext('2d');

      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, y, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

      var img = sliceCanvas.toDataURL('image/jpeg', 0.95);
      var imgHeightMm = currentSliceHeight * pageWidthMm / canvas.width;

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(img, 'JPEG', 0, 0, pageWidthMm, imgHeightMm);

      y += currentSliceHeight;
      pageIndex += 1;
    }

    return new Uint8Array(pdf.output('arraybuffer'));
  } finally {
    document.body.removeChild(holder);
  }
}

function importJsonFromFile(event) {
  var file = event.target.files && event.target.files[0];

  if (!file) {
    return;
  }

  var reader = new FileReader();

  reader.onload = function () {
    try {
      var parsed = JSON.parse(String(reader.result || ''));
      var imported = normalizeImportedRecords(parsed);

      if (!imported.length) {
        throw new Error('Keine Protokolle in der JSON-Datei gefunden.');
      }

      var mode = 'H';

      if (appState.protocols.length) {
        mode = window.prompt('Import-Modus: H = hinzufügen, E = bestehende Liste ersetzen', 'H') || 'H';
        mode = mode.toUpperCase();
      } else {
        mode = 'E';
      }

      if (mode === 'E') {
        appState.protocols = imported;
        photoStore = {};
      } else {
        appState.protocols = appState.protocols.concat(imported);
      }

      ensureUniqueRecordIds();

      appState.protocols.forEach(function (record, index) {
        var issues = getProtocolValidationIssues(record.data, 'Protokoll ' + (index + 1));
        record.vollstaendig = issues.length === 0;
        record.unvollstaendigHinweise = issues;
      });

      saveState();
      renderProtocolList();
      setStatus(imported.length + ' Protokoll(e) importiert. Fotodateien werden durch JSON nicht wiederhergestellt.', 'ok');
      openSection('sectionListe', true);
    } catch (err) {
      setStatus('JSON-Import fehlgeschlagen: ' + getErrorText(err), 'error');
    } finally {
      event.target.value = '';
    }
  };

  reader.onerror = function () {
    setStatus('JSON-Datei konnte nicht gelesen werden.', 'error');
  };

  reader.readAsText(file, 'utf-8');
}

function normalizeImportedRecords(parsed) {
  var source = [];

  if (Array.isArray(parsed)) {
    source = parsed;
  } else if (Array.isArray(parsed.protokolle)) {
    source = parsed.protokolle;
  } else if (Array.isArray(parsed.protocols)) {
    source = parsed.protocols;
  } else if (looksLikeProtocolData(parsed)) {
    source = [parsed];
  }

  return source.map(function (item) {
    var data = item.data || item;

    return {
      recordId: item.recordId || createRecordId(),
      erstelltAm: item.erstelltAm || new Date().toISOString(),
      bearbeitetAm: item.bearbeitetAm || new Date().toISOString(),
      data: data,
      vollstaendig: false,
      unvollstaendigHinweise: []
    };
  }).filter(function (record) {
    return looksLikeProtocolData(record.data);
  });
}

function looksLikeProtocolData(data) {
  return !!(data && (data.stammdaten || data.kopfdaten || data.pruefung || data.unterschrift));
}

function ensureUniqueRecordIds() {
  var used = {};

  appState.protocols.forEach(function (record) {
    if (!record.recordId || used[record.recordId]) {
      record.recordId = createRecordId();
    }

    used[record.recordId] = true;
  });
}

function askExportCleanupChoice() {
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');

    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(15, 23, 42, 0.55)';
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

    box.innerHTML =
      '<div style="font-size:20px;font-weight:900;margin-bottom:8px;">Export abgeschlossen</div>' +
      '<div style="font-size:15px;line-height:1.4;margin-bottom:16px;">Soll das Formular jetzt komplett geleert werden oder sollen die Daten erhalten bleiben?</div>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:10px;">' +
        '<button type="button" id="exportClearButton" style="min-height:52px;border:0;border-radius:12px;background:#dc2626;color:#fff;font-size:16px;font-weight:900;">Leeren</button>' +
        '<button type="button" id="exportKeepButton" style="min-height:52px;border:0;border-radius:12px;background:#ffd200;color:#111;font-size:16px;font-weight:900;">Daten behalten</button>' +
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
    version: APP_VERSION,
    protocols: [],
    draft: null
  };

  photoStore = {};
  localStorage.removeItem(STORAGE_KEY);
  resetCurrentForm(false);
  renderProtocolList();
  setStatus('Export abgeschlossen. Formular und lokale Protokolldaten wurden geleert.', 'ok');
}

function buildZip(files) {
  var localParts = [];
  var centralParts = [];
  var offset = 0;
  var now = new Date();
  var dt = dosDateTime(now);

  files.forEach(function (file) {
    var nameBytes = utf8(file.name);
    var dataBytes = file.data instanceof Uint8Array ? file.data : utf8(String(file.data || ''));
    var crc = crc32(dataBytes);

    var local = new Uint8Array(30 + nameBytes.length);

    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, 0x0800);
    writeU16(local, 8, 0);
    writeU16(local, 10, dt.time);
    writeU16(local, 12, dt.date);
    writeU32(local, 14, crc);
    writeU32(local, 18, dataBytes.length);
    writeU32(local, 22, dataBytes.length);
    writeU16(local, 26, nameBytes.length);
    writeU16(local, 28, 0);
    local.set(nameBytes, 30);

    localParts.push(local, dataBytes);

    var central = new Uint8Array(46 + nameBytes.length);

    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0x0800);
    writeU16(central, 10, 0);
    writeU16(central, 12, dt.time);
    writeU16(central, 14, dt.date);
    writeU32(central, 16, crc);
    writeU32(central, 20, dataBytes.length);
    writeU32(central, 24, dataBytes.length);
    writeU16(central, 28, nameBytes.length);
    writeU16(central, 30, 0);
    writeU16(central, 32, 0);
    writeU16(central, 34, 0);
    writeU16(central, 36, 0);
    writeU32(central, 38, 0);
    writeU32(central, 42, offset);
    central.set(nameBytes, 46);

    centralParts.push(central);

    offset += local.length + dataBytes.length;
  });

  var centralSize = centralParts.reduce(function (sum, part) {
    return sum + part.length;
  }, 0);

  var end = new Uint8Array(22);

  writeU32(end, 0, 0x06054b50);
  writeU16(end, 4, 0);
  writeU16(end, 6, 0);
  writeU16(end, 8, files.length);
  writeU16(end, 10, files.length);
  writeU32(end, 12, centralSize);
  writeU32(end, 16, offset);
  writeU16(end, 20, 0);

  return concatUint8Arrays(localParts.concat(centralParts).concat([end]));
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

function writeU16(arr, offset, value) {
  arr[offset] = value & 255;
  arr[offset + 1] = (value >>> 8) & 255;
}

function writeU32(arr, offset, value) {
  arr[offset] = value & 255;
  arr[offset + 1] = (value >>> 8) & 255;
  arr[offset + 2] = (value >>> 16) & 255;
  arr[offset + 3] = (value >>> 24) & 255;
}

function concatUint8Arrays(parts) {
  var total = parts.reduce(function (sum, part) {
    return sum + part.length;
  }, 0);

  var out = new Uint8Array(total);
  var offset = 0;

  parts.forEach(function (part) {
    out.set(part, offset);
    offset += part.length;
  });

  return out;
}

function initSignatureCanvas() {
  var canvas = document.getElementById('signatureCanvas');
  var ctx = canvas.getContext('2d');

  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';

  function pos(evt) {
    var rect = canvas.getBoundingClientRect();
    var touch = evt.touches && evt.touches[0] ? evt.touches[0] : evt;

    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
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
    if (signatureDrawing) {
      evt.preventDefault();
    }

    signatureDrawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
}

function initBetreiberSignatureCanvas() {
  var canvas = document.getElementById('betreiberSignatureCanvas');
  var ctx = canvas.getContext('2d');

  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';

  function pos(evt) {
    var rect = canvas.getBoundingClientRect();
    var touch = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function start(evt) {
    evt.preventDefault();
    betreiberSignatureDrawing = true;
    var p = pos(evt);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(evt) {
    if (!betreiberSignatureDrawing) return;
    evt.preventDefault();
    var p = pos(evt);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    betreiberSignatureDirty = true;
  }

  function end(evt) {
    if (betreiberSignatureDrawing) evt.preventDefault();
    betreiberSignatureDrawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
}


function clearSignature(showStatus) {
  var canvas = document.getElementById('signatureCanvas');
  var ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  signatureDirty = false;
  updateSummaries();

  if (showStatus) {
    setStatus('Unterschrift gelöscht.', 'ok');
  }
}


function clearBetreiberSignature(showStatus) {
  var canvas = document.getElementById('betreiberSignatureCanvas');
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  betreiberSignatureDirty = false;
  if (showStatus) {
    setStatus('Betreiber-Unterschrift gelöscht.', 'ok');
  }
}

function drawSignatureFromDataUrl(dataUrl) {
  clearSignature(false);

  var canvas = document.getElementById('signatureCanvas');
  var ctx = canvas.getContext('2d');
  var img = new Image();

  img.onload = function () {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    signatureDirty = true;
    updateSummaries();
  };

  img.src = dataUrl;
}


function updateBetreiberSignatureVisibility() {
  var wrap = document.getElementById('betreiberSignatureWrap');
  var checked = document.querySelector('input[name="dokumentation_einweisungBetreiber"]:checked');
  var isJa = checked && checked.value === 'Ja';
  wrap.classList.toggle('hidden', !isJa);
  if (!isJa) {
    clearBetreiberSignature(false);
  }
}

function drawBetreiberSignatureFromDataUrl(dataUrl) {
  clearBetreiberSignature(false);
  var canvas = document.getElementById('betreiberSignatureCanvas');
  var ctx = canvas.getContext('2d');
  var img = new Image();
  img.onload = function () {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    betreiberSignatureDirty = true;
  };
  img.src = dataUrl;
}


function setStatus(message, type) {
  var el = document.getElementById('status');

  el.textContent = message || '';
  el.className = 'status ' + (type === 'error' ? 'error' : 'ok');
}


function formatDateTimeDisplay(value) {
  return (value || '').replace('T', ' ');
}

function downloadFile(filename, data, type) {
  var blob = new Blob([data], { type: type || 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function findRowByKey(container, key) {
  var rows = container ? container.querySelectorAll('[data-key]') : [];

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].getAttribute('data-key') === key) {
      return rows[i];
    }
  }

  return null;
}

function findIndoorCardById(unitId) {
  var cards = document.querySelectorAll('.indoor-card');

  for (var i = 0; i < cards.length; i++) {
    if (cards[i].getAttribute('data-unit-id') === unitId) {
      return cards[i];
    }
  }

  return null;
}

function getInputValue(el) {
  return el ? String(el.value || '').trim() : '';
}

function setInputValue(el, value) {
  if (el) {
    el.value = value || '';
  }
}

function createRecordId() {
  return 'ibn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function formatDateCompact(date) {
  return String(date.getFullYear()) + pad2(date.getMonth() + 1) + pad2(date.getDate());
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B';
  }

  if (bytes < 1024) {
    return bytes + ' B';
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function sanitizeFileName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'datei';
}

function sanitizePathPart(value, fallback) {
  var text = sanitizeFileName(value || '').replace(/^_+|_+$/g, '');

  return text || fallback;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function e(value) {
  return escapeHtml(value);
}

function getErrorText(err) {
  if (!err) {
    return 'Unbekannter Fehler';
  }

  return err.message || String(err);
}

