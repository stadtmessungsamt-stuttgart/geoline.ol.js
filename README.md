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
Um die API zu nutzen, können Sie das Paket installieren:
    ```
    npm install @stadtmessungsamt-stuttgart/geoline.ol.js
    ```

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
