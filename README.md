# geoline.ol.js
Eine API auf Basis von OpenLayers zur einfachen
Einbindung der Kartendienste der Stadtmessungsamtes Stuttgart.

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

- Browser: aktuelle Evergreen-Browser (ES2020, natives ESM). Der Build transpiliert nicht.
- Bundler: Webpack 5 und Vite.
- TypeScript: `moduleResolution` `bundler` oder `nodenext`, ohne `skipLibCheck`. Für CSS-Importe braucht das Projekt eine Deklaration, z. B. `declare module '*.css';` oder die Typen des Bundlers (`vite/client`). Wer selbst `ol/format/GeoJSON` importiert, braucht `@types/geojson`.
- CDN als ESM nur mit einer Import-Map für `ol`, weil geoline.ol.js OpenLayers als `ol/…` importiert. Immer mit fester Hauptversion einbinden.

### Eine OpenLayers-Installation für alle Pakete

geoline.ol.js und Ihre Anwendung müssen dieselben OpenLayers-Klassen verwenden, sonst scheitern z. B. `instanceof`-Prüfungen oder Projektionen sind nur in einer Kopie registriert.

- Mit `npm ls ol` prüfen, dass genau eine Version installiert ist. Verlangen mehrere Pakete unterschiedliche Bereiche, die Versionen angleichen oder über `overrides` in der `package.json` der Anwendung eine Version festlegen.
- Microfrontends mit getrennten Bundles teilen `ol` nicht automatisch. Dort `ol` ausdrücklich gemeinsam bereitstellen (z. B. Module Federation mit `singleton: true` oder eine gemeinsame Import-Map).

Das Beispiel „mit eigenen OpenLayers-Layern, -Controls und -Overlays“ zeigt die gemeinsame Nutzung.

## Beispiele

Das Repository enthält verschiedene Beispiele im Ordner
"[examples](https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js/tree/master/examples)".

Die Beispiele können auch direkt über [GitHub Pages](https://stadtmessungsamt-stuttgart.github.io/geoline.ol.js/) aufgerufen werden.


## Änderungen in Version 3.0

In Version 3.0 wurden folgende Anpassungen und Erweiterungen vorgenommen:

- Aktualisierung auf OpenLayers v10: Das Modul basiert nun auf OpenLayers 10 und wurde entsprechend angepasst.
- ES Module (ESM) als Standard: Das Paket ist ESM-only (package.json: "type": "module").
- TypeScript-Typdefinitionen: Bereitstellung von Deklarationsdateien (dist/geoline.ol.d.ts) für bessere Entwickler-Experience.
- Separates CSS-Bundle: Styles liegen in dist/geoline.ol.css und sind zusätzlich über das Feld "style" im Paket referenziert.
- Die "Grundkarte" als `StmaBaseLayer` ist als "deprectaed" markiert worden. In Zukunft soll "Basemap" verwendet werden. 
  _Siehe example_UTM_25832.js_


## Breaking Changes

Potenziell inkompatible Änderungen und Migrationshinweise:

1) Gauß-Krüger Karten (EPSG:31467) werden nicht mehr unterstützt


2) Nur noch ES Module (kein CommonJS):  
   Statt require() muss Import-Syntax verwendet werden.    
   Beispiel:
    ```
    import GeoLine from '@stadtmessungsamt-stuttgart/geoline.ol.js';
    ```

3) Keine globale UMD-Einbindung mehr:  
   Eine Nutzung über ein globales Fenster-Objekt via `<script>`-Tag ohne Bundler wird nicht mehr unterstützt.  
   Es sollte ein entsprechender Build-Prozess (z.B. Webpack, Vite, Rollup) verwendet werden.

 
4) CSS muss explizit eingebunden werden:   
   ```
   import '@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.css';
   ```


5) Mindestanforderungen an Umgebung:
   - Moderne Browser mit nativer Modulunterstützung (ESM) werden vorausgesetzt.
   - Für Server-/Build-Tools wird Node.js ≥ 18 empfohlen.

    
6) Geänderte Importpfade und benannte Exporte:  
   Die Exporte des Mudols wurden aktualisiert:
   ```
   export default StmaOpenLayers;
   ```


## Lizenz API
Copyright © Stadtmessungsamt, LHS Stuttgart

Lizenziert unter: Creative Commons Attribution Non-commercial Share Alike (by-nc-sa) License.

Das Werk darf heruntergeladen, verändert und als Grundlage für eigene Werke verwendet werden. Es
darf in veränderter Form weitergegeben werden unter der Bedingung, dass der Urheber genannt wird
und die neue Version unter denselben Bedingungen lizenziert wird. Weder das Original noch die
veränderte Version darf kommerziell verwendet werden.

Eine Kopie der Lizenz ist in diesem Repository unter [LICENCE](https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js/blob/master/LICENSE) verfügbar.


## Lizenz Kartendienste und -inhalte
Copyright © Stadtmessungsamt, LHS Stuttgart

Lizenziert unter: Creative Commons Attribution Non-commercial No Derivatives (by-nc-nd):

Das Werk darf heruntergeladen und weitergegeben werden unter der Bedingung, dass der Autor genannt
wird und auf ihn zurück verlinkt wird. Das Werk darf nicht verändert oder kommerziell genutzt werden. 
