# geoline.ol.js
Eine API auf Basis von OpenLayers zur einfachen
Einbindung der Kartendienste des Stadtmessungsamtes Stuttgart.

Aktuell basiert dieses Modul auf _OpenLayers v10_.

## Zweck

Dieses Modul verfolgt das Ziel, die Kartendienste des Stadtmessungsamtes Stuttgart (z. B. WMS/WMTS) schnell und konsistent in OpenLayers-Anwendungen einzubinden. Es stellt dafür vordefinierte Konfigurationen, Hilfsfunktionen und sinnvolle Defaults bereit, etwa für:
- Quellen und Layer (inkl. Attribution, TileGrid, TileLoad-Strategien)
- gängige Projektionen (insbesondere EPSG:25832 sowie WebMercator/EPSG:3857) und deren Registrierung
- Styling/CSS der vom Modul bereitgestellten Komponenten
- einfache Integration in moderne Build-Umgebungen (ESM), Beispiele und Tests

Die Bibliothek richtet sich an Entwicklerinnen und Entwickler, die bereits mit OpenLayers arbeiten und einen schlanken, wiederverwendbaren Zugang zu den städtischen Geodiensten benötigen, ohne ein eigenes Karten-Framework pflegen zu müssen.

## URLs

* [GitHub](https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js)
* [npm](https://www.npmjs.com/package/@stadtmessungsamt-stuttgart/geoline.ol.js)


## Installation

OpenLayers ist eine Peer-Dependency: Ihre Anwendung installiert `ol` selbst, geoline.ol.js nutzt dieselbe Installation.

```
npm install ol @stadtmessungsamt-stuttgart/geoline.ol.js
```

Unterstützt wird OpenLayers 10 ab Version 10.11 (`ol@^10.11.0`).

```js
import 'ol/ol.css';
import StmaOpenLayers from '@stadtmessungsamt-stuttgart/geoline.ol.js';
import '@stadtmessungsamt-stuttgart/geoline.ol.js/geoline.ol.css';

const geoline = new StmaOpenLayers();
const map = geoline.initMap(25832, {target: 'map'});
```

- **CSS:** Die Anwendung importiert die CSS von OpenLayers (`ol/ol.css`) und die von geoline.ol.js (`…/geoline.ol.css`). geoline.ol.js bringt keine Kopie der OpenLayers-CSS mit.
- **Einstiegspunkte:** Das Paket legt seine Pfade über eine `exports`-Map fest: `.` (JavaScript und Typen) und `./geoline.ol.css`. Die bisherigen Pfade `…/dist/geoline.ol.js` und `…/dist/geoline.ol.css` funktionieren weiter; andere Pfade im Paket sind nicht erreichbar.
- **proj4** ist eingebettet und muss nicht installiert werden.

### Zielumgebung

- Browser: aktuelle Evergreen-Browser (ES2020, natives ESM). Der Build transpiliert nicht. Automatisch getestet in Chrome und Firefox; Safari wird vor jedem Release manuell geprüft.
- Bundler: Webpack 5 und Vite.
- TypeScript: ab 5.7 (getestet 5.7 und 7.0), `moduleResolution` `bundler` oder `nodenext`, ohne `skipLibCheck`. Die Untergrenze kommt von OpenLayers und dessen Abhängigkeiten; mit `skipLibCheck` genügt TypeScript 5.0. Für CSS-Importe braucht das Projekt eine Deklaration, z. B. `declare module '*.css';` oder die Typen des Bundlers (`vite/client`). Wer selbst `ol/format/GeoJSON` importiert, braucht `@types/geojson`.
- CDN als ESM nur mit einer Import-Map für `ol`, weil geoline.ol.js OpenLayers als `ol/…` importiert. Immer mit fester Hauptversion einbinden.

### Eine OpenLayers-Installation für alle Pakete

geoline.ol.js und Ihre Anwendung müssen dieselben OpenLayers-Klassen verwenden, sonst scheitern z. B. `instanceof`-Prüfungen oder Projektionen sind nur in einer Kopie registriert.

- Mit `npm ls ol` prüfen, dass genau eine Version installiert ist. Verlangen mehrere Pakete unterschiedliche Bereiche, die Versionen angleichen oder über `overrides` in der `package.json` der Anwendung eine Version festlegen.
- Microfrontends mit getrennten Bundles teilen `ol` nicht automatisch. Dort `ol` ausdrücklich gemeinsam bereitstellen (z. B. Module Federation mit `singleton: true` oder eine gemeinsame Import-Map).

Das Beispiel „mit eigenen OpenLayers-Layern, -Controls und -Overlays“ zeigt die gemeinsame Nutzung.

## Ergebnisse, Fehler und Lebenszyklus

Methoden liefern ihr Ergebnis als Rückgabewert; asynchrone Methoden als Promise. Es gibt drei Arten von Fehlern:

- **Programmierfehler** (falscher Parameter, Aufruf vor `initMap` oder nach `dispose()`): Die Methode wirft sofort einen `TypeError` bzw. `Error`.
- **Dienst- und Datenfehler** (Dienst nicht erreichbar, ungültige Daten, unpassende Projektion): Rückgabe `{ok: false, error: {code, message}}`. Die Promise wird nicht abgelehnt.
- **Interne Fehler** der Bibliothek: Exception bzw. abgelehnte Promise. Bitte als Fehler melden.

```js
const r = await geoline.addStmaEsriLayer('1_Base/Stadtkarte_Internet_c_EPSG25832');
if (r.ok) {
    const layer = r.value;
} else if (r.error.code !== 'ABORTED') {
    console.warn(r.error.code, r.error.message);
}
```

Neue Fehlercodes können in Minor-Versionen hinzukommen; Auswertungen brauchen einen Default-Zweig. Ein fehlgeschlagener Abruf wird nicht zwischengespeichert, ein erneuter Aufruf fragt neu an. Codes und Rückgaben je Methode: [Migrationsleitfaden, Result-Objekt](MIGRATION_3-4.md#result-objekt).

**Lebenszyklus:** Eine Instanz gehört zu genau einer Karte. Ein zweites `initMap` auf derselben Instanz wirft. `dispose()` bricht laufende Anfragen ab (offene Promises liefern `ABORTED`), entfernt Listener, Overlays und Caches und löst die Karte vom Element; danach ist ein neues `initMap` möglich. Details: [Lebenszyklus](MIGRATION_3-4.md#lebenszyklus-dispose).

**Mehrere Karten:** Je Karte eine eigene Instanz. Jede Instanz spricht nur ihre eigenen Elemente an; jede weitere Karte braucht eine eigene `popupId` (siehe [Popups](#popups-und-quellenangaben)).

**Konfigurationsdienst:** Mit `initMap` lädt geoline.ol.js die Konfiguration der Dienste des Stadtmessungsamts per POST, außer sie wird über `initMap(…, {config})` manuell gesetzt. `loadConfig()` liefert sie als Result. Gesendet werden nur `v` (Paketversion), `epsg` (Projektion der Karte) und `url` (Origin und Pfad der Seite, ohne Query und Fragment); der Betreiber wertet sie für eine Nutzungsstatistik aus. Vertrauliche Daten gehören deshalb nicht in den Pfad der Seite.

## Popups und Quellenangaben

`addOverlayForLayer(layer, fn)` zeigt beim Klick auf ein Objekt des Layers ein Popup. Ein String als Rückgabewert von `fn(feature)` wird **ungefiltert als HTML** eingesetzt, ein DOM-Knoten unverändert. Werte aus Kartendiensten, Daten oder Benutzereingaben muss die Anwendung vorher escapen; DOM-Inhalte, die aus solchen Werten entstehen, sind ebenso wenig automatisch sicher. Bei leerem Rückgabewert (`''`, `null`, `undefined`) bleibt das Popup geschlossen.

Tastatur: Die Karte erhält `tabindex="0"`, falls ihr Element keinen hat; das gilt auch für ein Element, das erst später per `setTarget` gesetzt wird. Mit den Pfeiltasten wird die Karte verschoben, Enter öffnet das Popup für das Objekt in der Kartenmitte, Escape oder die Schaltfläche „Schließen“ schließt es. Der Fokus springt ins Popup und danach zurück auf die Karte.

Das Popup-Element gehört zum Vertrag und kann per CSS gestaltet werden:

```html
<div id="geoline_ol_js_popup" class="geoline-ol-js-popup" role="dialog" aria-label="Informationen zum Kartenobjekt" tabindex="-1">
  <div class="arrow"></div>
  <button type="button" class="close" aria-label="Schließen">×</button>
  <div class="content"><!-- Rückgabewert von fn(feature) --></div>
</div>
```

- Die Klasse `geoline-ol-js-popup` ist immer gesetzt; eigenes CSS sollte sie statt der ID verwenden.
- Die ID ist über `initMap(…, {popupId})` wählbar, Standard `geoline_ol_js_popup`. Jede weitere Karte auf der Seite braucht eine eigene ID.

Quellenangaben (`copyrightText`) aus ArcGIS-Diensten zeigt geoline.ol.js als reinen Text an; HTML darin wird nicht ausgewertet.

## Darstellung und Bedienung

- **CSS nur in der Karte:** `geoline.ol.css` gilt nur innerhalb der Klasse `geoline-ol-js-map` (am Viewport jeder Karte) und für das Popup. Seitenstyles bleiben unberührt.
- **Anpassen über CSS-Variablen** an `.geoline-ol-js-map`: `--geoline-font-family`, `--geoline-accent` und `--geoline-accent-text` (Schaltflächen), `--geoline-focus`, `--geoline-attribution-font-size`, `--geoline-popup-background`, `--geoline-popup-text`, `--geoline-popup-border`. Die Standardfarben erreichen mindestens 4,5:1 Kontrast.

  ```css
  .geoline-ol-js-map { --geoline-accent: #005a9c; --geoline-accent-text: #fff; }
  ```
- **Kontextmenü:** Ein Rechtsklick auf die Karte öffnet standardmäßig kein Menü. `initMap(…, {contextMenu: true})` lässt das Browsermenü zu.
- **`pixelRatio`** ist 1, weil die Kartendienste Kacheln für einen Bildpunkt je Pixel liefern; höhere Werte laden mehr Kacheln und verkleinern Beschriftungen. Über `initMap(epsg, {pixelRatio: 2})` überschreibbar.
- **Kartenbild exportieren (Canvas):** Der Browser gibt Canvas-Inhalte nur frei, wenn alle Kacheln mit CORS geladen wurden. Die Dienste des Stadtmessungsamts senden die nötigen Header (`gis5.stuttgart.de` und `geoserver.stuttgart.de`, geprüft 2026-11-12). WMTS-Layer laden standardmäßig mit `crossOrigin: 'anonymous'`; ArcGIS- und WMS-Layer nur, wenn `_sourceParams` `crossOrigin: 'anonymous'` setzt. Für fremde Dienste ohne CORS-Header bei WMTS `crossOrigin: null` setzen, sonst laden die Kacheln nicht; ein Export ist dann nicht möglich.

## Beispiele

Das Repository enthält verschiedene Beispiele im Ordner
"[examples](https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js/tree/master/examples)".

Die Beispiele können auch direkt über [GitHub Pages](https://stadtmessungsamt-stuttgart.github.io/geoline.ol.js/) aufgerufen werden.


## Migration zwischen Hauptversionen

- [Migrationsleitfaden 3.x → 4.0](MIGRATION_3-4.md): Breaking Changes von Version 4.0. Übersicht im [CHANGELOG](CHANGELOG.md).
- [Migrationsleitfaden 2.x → 3.0](MIGRATION_2-3.md): Änderungen und Breaking Changes von Version 3.0.


## Lizenz API
Copyright © Stadtmessungsamt, LHS Stuttgart

Lizenziert unter: Creative Commons Attribution Non-commercial Share Alike (by-nc-sa) License.

Das Werk darf heruntergeladen, verändert und als Grundlage für eigene Werke verwendet werden. Es
darf in veränderter Form weitergegeben werden unter der Bedingung, dass der Urheber genannt wird
und die neue Version unter denselben Bedingungen lizenziert wird. Weder das Original noch die
veränderte Version darf kommerziell verwendet werden.

Eine Kopie der Lizenz ist in diesem Repository unter [LICENCE](https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js/blob/master/LICENSE) verfügbar.

In `dist/geoline.ol.js` sind `proj4` und dessen Abhängigkeiten eingebettet. Ihre Lizenzen liegen im npm-Paket unter `dist/THIRD_PARTY_LICENSES.txt`.


## Lizenz Kartendienste und -inhalte
Copyright © Stadtmessungsamt, LHS Stuttgart

Lizenziert unter: Creative Commons Attribution Non-commercial No Derivatives (by-nc-nd):

Das Werk darf heruntergeladen und weitergegeben werden unter der Bedingung, dass der Autor genannt
wird und auf ihn zurück verlinkt wird. Das Werk darf nicht verändert oder kommerziell genutzt werden. 
