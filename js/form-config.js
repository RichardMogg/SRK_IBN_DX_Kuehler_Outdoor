var STORAGE_KEY = 'schrack_inbetriebnahme_dx_outdoor_v1';

var APP_VERSION = 'SCHRACK_DX_OUTDOOR_V1.0';

var INBETRIEBNAHME_CHECKS = [
  { key: 'montagecheck', label: 'Montagecheck' },
  { key: 'kaeltetechnischerAnschluss', label: 'Kältetechnischer Anschluss' },
  { key: 'dichtheitsprobe', label: 'Dichtheitsprobe' },
  { key: 'kaeltemittelfuellung', label: 'Kältemittelfüllung' },
  { key: 'parametrierung', label: 'Parametrierung' },
  { key: 'testlauf', label: 'Testlauf' }
];

var KAELTEMITTEL_FALLBACK = [
  'R134a',
  'R404A',
  'R407C',
  'R410A',
  'R32',
  'R290',
  'R448A',
  'R449A',
  'R452A',
  'R513A',
  'R744',
  'R22',
  'R12'
];
