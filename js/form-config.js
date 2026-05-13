'use strict';

var STORAGE_KEY = 'schrack_inbetriebnahme_dx_kuehler_outdoor_v10';
var APP_VERSION = 'V1.0';

var INBETRIEBNAHME_CHECKS = [
  { key: 'montagecheck', label: 'Montagecheck' },
  { key: 'kaeltetechnischerAnschluss', label: 'Kältetechnischer Anschluss' },
  { key: 'dichtheitsprobe', label: 'Dichtheitsprobe' },
  { key: 'kaeltemittelfuellung', label: 'Kältemittelfüllung' },
  { key: 'parametrierung', label: 'Parametrierung' },
  { key: 'testlauf', label: 'Testlauf' }
];

var FIELD_GROUPS = {
  kaeltekreislauf: [
    {
      key: 'anzahlRueckkuehlgeraete',
      label: 'Anzahl der angeschlossenen Rückkühlgeräte',
      unit: 'Stk.',
      type: 'number'
    },
    {
      key: 'gesamtleistungKw',
      label: 'Gesamtleistung',
      unit: 'kW',
      type: 'decimal'
    },
    {
      key: 'aussengeraetHoeher',
      label: 'Außengerät höher',
      unit: 'm',
      type: 'decimal'
    },
    {
      key: 'aussengeraetTiefer',
      label: 'Außengerät tiefer',
      unit: 'm',
      type: 'decimal'
    },
    {
      key: 'hoehenDifferenz',
      label: 'Höhendifferenz Innen-/Außengerät',
      unit: 'm',
      type: 'decimal'
    },
    {
      key: 'leitungslaenge',
      label: 'Leitungslänge Innen-/Außengerät',
      unit: 'm',
      type: 'decimal'
    },
    {
      key: 'dimensionFluessigkeitsleitung',
      label: "Dimension Flüssigkeitsleitung (mm oder Zoll, z. B. 10 oder 3/8)",
      type: 'text'
    },
    {
      key: 'dimensionGasleitung',
      label: "Dimension Gasleitung (mm oder Zoll, z. B. 12 oder 1 1/2)",
      type: 'text'
    },
    {
      key: 'mitStickstoffGeloetet',
      label: 'Mit Stickstoff gelötet',
      type: 'bool'
    },
    {
      key: 'isolierteLeitungen',
      label: 'Isolierte Saug- und Flüssigkeitsleitung',
      type: 'bool'
    }
  ],

  dichtheit: [
    {
      key: 'dichtheitspruefung',
      label: 'Dichtheitsprüfung mit Druckmanometer',
      type: 'bool'
    },
    {
      key: 'pruefdruck',
      label: 'Prüfdruck',
      unit: 'bar',
      type: 'decimal'
    },
    {
      key: 'pruefzeit',
      label: 'Prüfzeit',
      unit: 'Std',
      type: 'decimal'
    },
    {
      key: 'evakuierungszeit',
      label: 'Evakuierungszeit',
      unit: 'Std',
      type: 'decimal'
    },
    {
      key: 'pruefmedium',
      label: 'Prüfmedium',
      type: 'text'
    }
  ],

  zusatz: [
    {
      key: 'verwendungZusatzplatinen',
      label: 'Verwendung von Zusatzplatinen',
      type: 'bool'
    },
    {
      key: 'bezeichnungVerwendungszweck',
      label: 'Bezeichnung und Verwendungszweck',
      type: 'textarea'
    }
  ],

  spannung: [
    {
      key: 'reparaturschalterAmAg',
      label: 'Reparaturschalter am AG angebracht',
      type: 'bool'
    },
    {
      key: 'absicherung',
      label: 'Absicherung',
      unit: 'Art/A',
      type: 'text'
    },
    {
      key: 'drehfeldPruefen',
      label: 'Drehfeld prüfen',
      type: 'bool'
    },
    {
      key: 'spannungsversorgungAg',
      label: 'Spannungsversorgung AG prüfen',
      type: 'bool'
    },
    {
      key: 'kommunikationsleitungAg',
      label: 'Kommunikationsleitung zum AG geprüft',
      type: 'bool'
    },
    {
      key: 'stromaufnahme',
      label: 'Stromaufnahme',
      unit: 'A',
      type: 'decimal'
    }
  ],

  testbetrieb: [
    {
      key: 'testbetriebKuehlen',
      label: 'Testbetrieb Kühlen',
      type: 'bool'
    },
    {
      key: 'kabelCheck',
      label: 'Kabel-Check',
      type: 'bool'
    },
    {
      key: 'testHochdruckTemp',
      label: 'Testbetrieb Hochdruck Temperatur',
      unit: '°C',
      type: 'decimal'
    },
    {
      key: 'testHochdruckBar',
      label: 'Testbetrieb Hochdruck Druck',
      unit: 'bar',
      type: 'decimal'
    },
    {
      key: 'testNiederdruckTemp',
      label: 'Testbetrieb Niederdruck Temperatur',
      unit: '°C',
      type: 'decimal'
    },
    {
      key: 'testNiederdruckBar',
      label: 'Testbetrieb Niederdruck Druck',
      unit: 'bar',
      type: 'decimal'
    },
    {
      key: 'aussentemperatur',
      label: 'Außentemperatur',
      unit: '°C',
      type: 'decimal'
    },
    {
      key: 'ausblastemperatur',
      label: 'Ausblastemperatur',
      unit: '°C',
      type: 'decimal'
    },
    {
      key: 'erfolgreicherTestbetrieb',
      label: 'Erfolgreicher Testbetrieb',
      type: 'bool'
    },
    {
      key: 'kuehlbetriebHochdruckTemp',
      label: 'Im Kühlbetrieb Hochdruck Temperatur',
      unit: '°C',
      type: 'decimal'
    },
    {
      key: 'kuehlbetriebHochdruckBar',
      label: 'Im Kühlbetrieb Hochdruck Druck',
      unit: 'bar',
      type: 'decimal'
    },
    {
      key: 'kuehlbetriebNiederdruckTemp',
      label: 'Im Kühlbetrieb Niederdruck Temperatur',
      unit: '°C',
      type: 'decimal'
    },
    {
      key: 'kuehlbetriebNiederdruckBar',
      label: 'Im Kühlbetrieb Niederdruck Druck',
      unit: 'bar',
      type: 'decimal'
    }
  ],

  ergebnis: [
    {
      key: 'erfolgreichAbgeschlossen',
      label: 'Erfolgreich abgeschlossen',
      type: 'bool'
    },
    {
      key: 'folgeterminNoetig',
      label: 'Folgetermin nötig',
      type: 'bool'
    },
    {
      key: 'abgebrochen',
      label: 'Abgebrochen',
      type: 'bool'
    }
  ],

  dokumentation: [
    {
      key: 'uebergabeDokumentation',
      label: 'Übergabe und Dokumentation an den Betreiber',
      type: 'bool'
    },
    {
      key: 'einweisungBetreiber',
      label: 'Einweisung Betreiber',
      type: 'bool'
    },
    {
      key: 'nameBetreiber',
      label: 'Name Betreiber',
      type: 'text'
    }
  ]
};
