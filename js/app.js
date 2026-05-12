'use strict';
  if (data) fillIndoorCard(card, data);
  updateIndoorPhotoList(unitId);
  renumberIndoorCards();
  updateSummaries();
}

function fillIndoorCard(card, data) {
  setInputValue(card.querySelector('[data-rk-field="modell"]'), data.modell || data.type || '');
  setInputValue(card.querySelector('[data-rk-field="seriennummer"]'), data.seriennummer || '');
  setInputValue(card.querySelector('[data-rk-field="bezeichnung"]'), data.bezeichnung || '');
  setInputValue(card.querySelector('[data-rk-field="bemerkung"]'), data.bemerkung || '');
}

function renumberIndoorCards() {
  document.querySelectorAll('.indoor-card').forEach(function (card, index) {
    var bezeichnung = getInputValue(card.querySelector('[data-rk-field="bezeichnung"]'));
    card.querySelector('summary').textContent = 'Rückkühlgerät ' + (index + 1) + (bezeichnung ? ' – ' + bezeichnung : '');
  });
}

function getInputValue(el) { return el ? String(el.value || '').trim() : ''; }
function setInputValue(el, value) { if (el) el.value = value || ''; }

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
      ortDatum: getInputValue(document.getElementById('ortDatumInput')),
      vorhanden: signatureDirty,
      dataUrl: signatureDirty ? document.getElementById('signatureCanvas').toDataURL('image/png') : ''
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
    var row = container.querySelector('[data-check-key="' + cssEscape(item.key) + '"]');
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
    var row = container.querySelector('[data-field-key="' + cssEscape(item.key) + '"]');
    if