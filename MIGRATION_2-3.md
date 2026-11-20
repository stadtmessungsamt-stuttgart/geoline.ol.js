# Migration von geoline.ol.js 2.x auf 3.0

## Änderungen in Version 3.0

In Version 3.0 wurden folgende Anpassungen und Erweiterungen vorgenommen:

- Aktualisierung auf OpenLayers v10: Das Modul basiert nun auf OpenLayers 10 und wurde entsprechend angepasst.
- ES Module (ESM) als Standard: Das Paket ist ESM-only (package.json: "type": "module").
- TypeScript-Typdefinitionen: Bereitstellung von Deklarationsdateien (dist/geoline.ol.d.ts) für bessere Entwickler-Experience.
- Separates CSS-Bundle: Styles liegen in dist/geoline.ol.css und sind zusätzlich über das Feld "style" im Paket referenziert.
- Die "Grundkarte" als `StmaBaseLayer` ist als „deprecated“ (veraltet) markiert worden. In Zukunft soll "Basemap" verwendet werden. 
  _Siehe example_UTM_25832.js_


## Breaking Changes

Potenziell inkompatible Änderungen und Migrationshinweise:

1) Gauß-Krüger-Karten (EPSG:31467) werden nicht mehr unterstützt


2) Nur noch ES Module (kein CommonJS):  
   Statt require() muss Import-Syntax verwendet werden.    
   Beispiel:
    ```
    import GeoLine from '@stadtmessungsamt-stuttgart/geoline.ol.js';
    ```

3) Keine globale UMD-Einbindung mehr:  
   Eine Nutzung über ein globales Fensterobjekt per `<script>`-Tag ohne Bundler wird nicht mehr unterstützt.  
   Es sollte ein entsprechender Build-Prozess (z.B. Webpack, Vite, Rollup) verwendet werden.

 
4) CSS muss explizit eingebunden werden:   
   ```
   import '@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.css';
   ```


5) Mindestanforderungen an Umgebung:
   - Moderne Browser mit nativer Modulunterstützung (ESM) werden vorausgesetzt.
   - Für Server-/Build-Tools wird Node.js ≥ 18 empfohlen.

    
6) Geänderte Importpfade und benannte Exporte:  
   Die Exporte des Moduls wurden aktualisiert:
   ```
   export default StmaOpenLayers;
   ```
