# Changelog

Versionen folgen [Semantic Versioning](https://semver.org/lang/de/). Details und Codebeispiele zu den Breaking Changes stehen im jeweiligen Migrationsleitfaden.

## 4.0.0 (unveröffentlicht)

### Breaking Changes

Siehe [Migrationsleitfaden 3.x → 4.0](MIGRATION_3-4.md).

- OpenLayers ist Peer-Dependency (`ol@^10.11.0`) und nicht mehr im Bundle; Anwendungen installieren `ol` und importieren `ol/ol.css` selbst. Einstiegspunkte über eine `exports`-Map, `…/src/…` ist nicht mehr erreichbar. → [OpenLayers als Peer-Dependency](MIGRATION_3-4.md#openlayers-als-peer-dependency-einstiegspunkte-und-css)
- Callbacks entfallen: Methoden liefern Rückgabewerte, asynchrone Methoden `Promise<Result<…>>`; `addWMSLayer` bleibt synchron und liefert den Layer. Programmierfehler werfen sofort. → [Rückgabewerte statt Callbacks](MIGRATION_3-4.md#rückgabewerte-statt-callbacks-beobachtbare-fehler)
- `getConfig()` wird zu `loadConfig()`. → [`loadConfig()`](MIGRATION_3-4.md#getconfig-wird-zu-loadconfig)
- Konfiguration und GeoJSON werden geprüft; Dienste in der Konfiguration nur noch als Objekt je Name. → [Konfiguration](MIGRATION_3-4.md#die-konfiguration-wird-geprüft), [GeoJSON](MIGRATION_3-4.md#geojson-wird-geprüft)
- `dispose()`; ein zweites `initMap` auf derselben Instanz wirft. → [Lebenszyklus](MIGRATION_3-4.md#lebenszyklus-dispose)
- Popup-Element mit Klasse `geoline-ol-js-popup`, ID über `popupId` wählbar; mehrere Karten pro Seite. → [Mehrere Karten](MIGRATION_3-4.md#mehrere-karten-auf-einer-seite-und-das-popup-element)
- View wird einmal in `initMap` festgelegt; neue Zoomstufen für EPSG:25832; EPSG:31467 entfällt; andere EPSG-Codes werfen. → [Ansicht und Projektion](MIGRATION_3-4.md#ansicht-und-projektion-der-karte)
- `copyrightText` von ArcGIS-Diensten wird als Text angezeigt, nicht als HTML. → [Quellenangaben](MIGRATION_3-4.md#quellenangaben-von-arcgis-diensten-nur-noch-als-text)
- CSS gilt nur noch innerhalb der Karte; Popup per Tastatur bedienbar. → [Styles, Popup und Bedienung](MIGRATION_3-4.md#styles-popup-und-bedienung)
- Genauere TypeScript-Deklarationen, interne Member nicht mehr öffentlich. → [TypeScript-Deklarationen](MIGRATION_3-4.md#typescript-deklarationen)
- JSONP entfällt; eigene ArcGIS-Dienste und eine eigene Konfigurations-URL brauchen CORS. → [CORS](MIGRATION_3-4.md#eigene-dienste-brauchen-cors)
- `dist/` liegt nicht mehr im Git-Repository, nur im npm-Paket. → [Gebaute Dateien](MIGRATION_3-4.md#gebaute-dateien-nur-noch-über-npm)
- `addStmaEsriFeatureLayer` entfällt (war in 3.x nicht lauffähig). → [Alternative](MIGRATION_3-4.md#addstmaesrifeaturelayer-entfällt)

### Behoben

- Fehlgeschlagene Abrufe blieben im Cache; Caches lagen im OpenLayers-Kartenobjekt.
- Projektion und View hingen von der Antwortreihenfolge der Dienste ab; Kachelgröße nicht quadratischer ArcGIS-Kacheln war vertauscht.
- `addGeoJSON` mit `crs: null` warf einen `TypeError`; GeoJSON ohne `_style` war unsichtbar; das Zoom-Intervall lief ohne Ende.
- Die Rechtsklick-Sperre und das Popup wirkten auf die erste Karte der Seite statt auf die eigene.

### Weitere Änderungen

- Im Konfigurationsabruf enthält `url` nur noch Origin und Pfad der Seite, ohne Query und Fragment.
- Styles über CSS-Variablen anpassbar, Kontrast der Bedienelemente verbessert; `pixelRatio` überschreibbar.
- Lizenzen der eingebetteten Pakete (`proj4` und Abhängigkeiten) liegen unter `dist/THIRD_PARTY_LICENSES.txt`.
- Veröffentlichung über npm Trusted Publishing mit Provenance.

Frühere Versionen: siehe [GitHub-Releases](https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js/releases) und [Migrationsleitfaden 2.x → 3.0](MIGRATION_2-3.md).
