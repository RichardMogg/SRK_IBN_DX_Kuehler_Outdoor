# :copyright RMO

# Inbetriebnahmeprotokoll DX Kühler Outdoor

Lokale, browserbasierte Web-App zur Erstellung von Inbetriebnahmeprotokollen für DX Kühler Outdoor.

## Überblick

Die Anwendung läuft ohne Backend direkt im Browser und bietet:

- Erfassung aller Protokollabschnitte in einer strukturierten Formularoberfläche
- Verwaltung mehrerer Protokolle in einer lokalen Liste
- JSON-Import / JSON-Export
- CSV-Export
- ZIP-Export inkl. Druckansicht/PDF und Dateianhängen
- Signaturfelder für Techniker und (optional) Betreiber

## Projektstruktur

```text
/
├─ index.html
├─ assets/
│  ├─ logo.svg
│  └─ datacenter_background.svg
├─ css/
│  └─ app.css
├─ data/
│  └─ kaeltemittel.txt
├─ js/
│  ├─ form-config.js
│  └─ app.js
└─ vendor/
   └─ html2pdf.bundle.min.js
```

## Lokale Nutzung

Da es eine statische Web-App ist, reicht ein lokaler Webserver, z. B.:

```bash
python -m http.server 8000
```

Dann im Browser öffnen:

- `http://localhost:8000`

## Hinweise

- Daten werden lokal im Browser gespeichert (Local Storage).
- Für PDF/ZIP-Export müssen die eingebundenen Browser-Bibliotheken geladen werden.
- Bei Änderungen an CSS/JS kann ein Hard-Reload (`Strg+F5`) nötig sein.
