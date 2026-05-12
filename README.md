# Inbetriebnahmeprotokoll DX Kühler Outdoor

Lokale browserbasierte Web-App zur Erstellung von Inbetriebnahmeprotokollen für DX Kühler Outdoor.

## Projektstruktur

```text
/
├─ index.html
├─ assets/
│  └─ Schrack-Technik_LOGO.svg
├─ css/
│  └─ app.css
├─ data/
│  └─ kaeltemittel.txt
├─ js/
│  ├─ form-config.js
│  └─ app.js
└─ vendor/
   └─ html2pdf.bundle.min.js


function addCollapseButtonToDetails(detailsSelector, bodySelector, buttonText, targetName) {
  document.querySelectorAll(detailsSelector).forEach(function (section) {
    var body = section.querySelector(bodySelector);

    if (!body || hasDirectCollapseButton(body)) {
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-light collapse-section-button';
    button.setAttribute('data-collapse-button', 'true');
    button.setAttribute('data-collapse-target', targetName);
    button.textContent = buttonText;

    button.addEventListener('click', function () {
      section.open = false;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    body.appendChild(button);
  });
}