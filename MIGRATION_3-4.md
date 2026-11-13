# Migration von geoline.ol.js 3.x auf 4.0

Diese Anleitung beschreibt die Änderungen, die Anwendungen beim Umstieg auf die neue Hauptversion anpassen müssen. Die Checkliste nennt, was fast jede Anwendung betrifft; die weiteren Abschnitte gelten nur unter der jeweils genannten Bedingung.

## Checkliste

1. `ol` installieren und `ol/ol.css` importieren, Importpfade anpassen → [OpenLayers als Peer-Dependency](#openlayers-als-peer-dependency-einstiegspunkte-und-css)
2. Callbacks durch Rückgabewerte bzw. `await` und `if (r.ok)` ersetzen → [Rückgabewerte statt Callbacks](#rückgabewerte-statt-callbacks-beobachtbare-fehler)
3. `getConfig()` durch `loadConfig()` ersetzen → [`loadConfig()`](#getconfig-wird-zu-loadconfig)
4. Ein zweites `initMap` nur nach `dispose()` → [Lebenszyklus](#lebenszyklus-dispose)
5. Zoomstufen in EPSG:25832 prüfen; nur noch EPSG:25832 und EPSG:3857 → [Ansicht und Projektion](#ansicht-und-projektion-der-karte)
6. Schrift der Seite und eigenes Popup-CSS prüfen → [Styles, Popup und Bedienung](#styles-popup-und-bedienung)

Danach die Abschnitte unter [Nur betroffen, wenn …](#nur-betroffen-wenn-) durchsehen.

## Betrifft alle Anwendungen

### OpenLayers als Peer-Dependency, Einstiegspunkte und CSS

geoline.ol.js bringt keine eigene Kopie von OpenLayers mehr mit; zwei Kopien in einer Anwendung passten nicht zusammen.

- **`ol` selbst installieren:** `npm install ol` (unterstützt: `ol@^10.11.0`). Mit `npm ls ol` prüfen, dass nur eine Version installiert ist.
- **OpenLayers-CSS selbst importieren:** `import 'ol/ol.css';`. Die CSS von geoline.ol.js enthält sie nicht mehr.
- **Einstiegspunkte:** Die `exports`-Map erlaubt nur noch `@stadtmessungsamt-stuttgart/geoline.ol.js`, `…/geoline.ol.css` sowie die bisherigen `…/dist/geoline.ol.js` und `…/dist/geoline.ol.css`. Imports aus `…/src/…` (z. B. `…/src/geoline.ol.css`) funktionieren nicht mehr; `src` ist nicht mehr im Paket.
- **proj4** ist eingebettet und keine Abhängigkeit mehr. Wer proj4 selbst nutzt, installiert es selbst.

```js
// 3.x
import StmaOpenLayers from '@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.js';
import '@stadtmessungsamt-stuttgart/geoline.ol.js/src/geoline.ol.css';

// 4.0
import 'ol/ol.css';
import StmaOpenLayers from '@stadtmessungsamt-stuttgart/geoline.ol.js';
import '@stadtmessungsamt-stuttgart/geoline.ol.js/geoline.ol.css';
```

### Rückgabewerte statt Callbacks, beobachtbare Fehler

In 3.x kamen Ergebnisse nur über einen Callback als letzten Parameter, Fehler meist nur über `console.error`. Ab 4.0 liefern alle Methoden ihr Ergebnis als Rückgabewert, und Fehler erreichen den Aufrufer.

#### Drei Arten von Fehlern

| Art | Beispiele | Verhalten in 4.0 |
|---|---|---|
| Programmierfehler | falscher Parametertyp, fehlender Pflichtparameter, Callback übergeben, Aufruf vor `initMap` oder nach `dispose` | Die Methode wirft sofort einen `TypeError` bzw. `Error` mit Hinweis auf den Parameter. |
| Erwartbare Dienst- und Datenfehler | Dienst nicht erreichbar, HTTP-Fehler, Dienst meldet einen Fehler, unbekannte Karte, unpassende Projektion, ungültiges GeoJSON | Rückgabe eines Result-Objekts mit `ok: false`. Die Promise wird **nicht** abgelehnt. |
| Interne Fehler der Bibliothek | Bugs | Exception bzw. abgelehnte Promise. Bitte als Fehler melden. |

Der synchrone Fehler fliegt beim Aufruf, auch bei asynchronen Methoden. `try { await … } catch` fängt ihn trotzdem.

#### Result-Objekt

```js
{ ok: true,  value: layer }
{ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: '…', cause: … } }
```

| `code` | Bedeutung |
|---|---|
| `CONFIG_UNAVAILABLE` | Die Konfiguration des Stadtmessungsamtes konnte nicht geladen werden. |
| `SERVICE_UNAVAILABLE` | Der Dienst ist nicht erreichbar oder antwortet mit einem HTTP-Fehler. |
| `SERVICE_ERROR` | Der Dienst antwortet, meldet aber einen Fehler. |
| `NOT_FOUND` | Karte, Dienst oder Layer ist unbekannt. |
| `PROJECTION_MISMATCH` | Der Dienst passt nicht zur Projektion der Karte. |
| `INVALID_DATA` | Die Daten sind ungültig, z. B. GeoJSON oder Capabilities. |
| `ABORTED` | Der Vorgang wurde durch `dispose()` abgebrochen. |

Weitere Codes können in Minor-Versionen hinzukommen. Auswertungen brauchen deshalb immer einen Default-Zweig. `message` ist für Menschen gedacht, `cause` nur für die Diagnose; beides ist kein stabiler Vertrag.

```js
const r = await mymap.addStmaEsriLayer('1_Base/Stadtkarte_Internet_c_EPSG25832');
if (!r.ok) {
    switch (r.error.code) {
        case 'ABORTED':
            return;
        case 'SERVICE_UNAVAILABLE':
            zeigeHinweis('Kartendienst derzeit nicht erreichbar');
            return;
        default:
            console.warn(r.error.code, r.error.message);
            return;
    }
}
const layer = r.value;
```

#### Rückgaben je Methode

| Methode | 3.x: Callback-Argument | 4.0: Rückgabewert |
|---|---|---|
| `initMap` | Map | `Map` |
| `addEsriLayer`, `addStmaEsriLayer` | Layer | `Promise<Result<Layer>>` |
| `addWMTSLayer`, `addStmaWMTSLayer` | Layer oder `false` | `Promise<Result<Layer>>` |
| `addWMSLayer` | Layer (synchron) | `Layer` (synchron) |
| `addStmaWMSLayer` | Layer | `Promise<Result<Layer>>` |
| `addStmaBaseLayer` | Layer | `Promise<Result<Layer>>` |
| `addGeoJSONfromURL` | Layer oder `false` | `Promise<Result<VectorLayer>>` |
| `addGeoJSON` | Layer | `Result<VectorLayer>` (synchron) |
| `addPoints` | Layer | `VectorLayer` |
| `getMap` | – (Rückgabe Map oder `null`) | `Map`; wirft vor `initMap` |
| `getConfig` | – (Rückgabe Konfiguration oder Platzhalter) | entfällt, siehe unten |

#### Callbacks migrieren

Die Callback-Parameter entfallen; wer noch eine Funktion übergibt, erhält einen `TypeError`. Die Logik aus dem Callback läuft nach dem Rückgabewert weiter. Nicht betroffen sind die Overlay-Funktion von `addOverlayForLayer` und `tileLoadFunction` in `initMap`.

Synchrone Methoden (`initMap`, `addWMSLayer`, `addGeoJSON`, `addPoints`): Rückgabewert verwenden.

```js
// 3.x
mymap.addPoints([[x, y]], iconUrl, (vectorLayer) => {
    vectorLayer.set('name', 'marker');
});

// 4.0
const vectorLayer = mymap.addPoints([[x, y]], iconUrl);
vectorLayer.set('name', 'marker');
```

Asynchrone Methoden: `await` bzw. `.then` verwenden. Aus `if (layer)` bzw. dem bisher ausbleibenden Aufruf im Fehlerfall wird `if (r.ok)`.

```js
// 3.x
mymap.addStmaWMSLayer(layerName, {}, {}, (layer) => {
    layers[layerName] = layer;
});

// 4.0
const r = await mymap.addStmaWMSLayer(layerName);
if (r.ok) {
    layers[layerName] = r.value;
}
```

### `getConfig()` wird zu `loadConfig()`

`getConfig()` lieferte während des Ladens einen Platzhalter und entfällt. Ersatz:

```js
const r = await mymap.loadConfig();
if (r.ok) {
    speichereFuerOffline(r.value);
}
```

Eine manuell gesetzte Konfiguration bleibt über `initMap(…, {config})` möglich.

### Lebenszyklus: `dispose()`

Eine Instanz von `StmaOpenLayers` gehört zu genau einer Karte. `dispose()` räumt sie ab; offene Promises liefern `ABORTED` (Details im README).

- Ein zweiter Aufruf von `initMap` auf derselben Instanz wirft. Zum Neuaufbau vorher `dispose()` aufrufen:

```js
mymap.dispose();
mymap.initMap(25832, {target: 'map'});
```

- Nach `dispose()` werfen alle Methoden außer `initMap` und `dispose`.

### Ansicht und Projektion der Karte

`initMap` legt die View einmal fest; in 3.x ersetzte sie der erste gecachte Layer. `getMap().getView()` liefert jetzt bis `dispose()` dasselbe Objekt.

- **Zoomstufen in EPSG:25832** folgen der Kachelmatrix `Stuttgart_UTM_CRS_oL` der Stadtmessungsamt-Dienste, Standard ist Zoom 2:

  | Zoom | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | m/Pixel | 112 | 56 | 28 | 14 | 7 | 2,8 | 1,4 | 0,7 | 0,28 | 0,14 |

  Mit einem gecachten ArcGIS-Dienst als erstem Layer ändert sich kaum etwas. Wer nur WMS oder GeoJSON nutzte, bekam in 3.x die Standardstufen von OpenLayers; dort `zoom` neu wählen, z. B. 16 (2,4 m/Pixel) → 5. Eigene `resolutions` in `_viewParams` sind weiter möglich.
- **EPSG:3857** behält die Standardstufen von OpenLayers und ist ohne eigene Angaben auf Stuttgart zentriert (Zoom 12).
- **Nur noch EPSG:25832 und EPSG:3857:** EPSG:31467 (Gauß-Krüger) entfällt. Für andere Codes wirft `initMap` einen `TypeError`.
- **Dienste in anderer Projektion:** Gecachte ArcGIS-Dienste werden in die Projektion der Karte umgerechnet; in 3.x übernahm die Karte die Projektion des Dienstes. Eine unbekannte WKID meldet `PROJECTION_MISMATCH`, fehlende Kachelinformationen `INVALID_DATA`. WMTS-Layer in anderer Projektion melden `PROJECTION_MISMATCH`.
- **`controls: null`** schaltet alle Bedienelemente ab, die Quellenangabe bleibt.

### Styles, Popup und Bedienung

- **CSS nur noch in der Karte:** `geoline.ol.css` setzt keine Schrift mehr auf `body` und färbt `.ol-control`-Schaltflächen nur noch in geoline-Karten. Wer sich auf `sans-serif` für die ganze Seite verlassen hat, setzt sie selbst. Anpassung über CSS-Variablen: README, „Darstellung und Bedienung“.
- **Popup:** Das Element ist anfangs ausgeblendet und enthält zusätzlich `button.close`; Inhalt weiter in `div.content`. Ein leerer Rückgabewert der Overlay-Funktion lässt das Popup geschlossen; DOM-Knoten werden eingesetzt statt als `[object …]` angezeigt.
- **Tastatur:** Das Kartenelement erhält `tabindex="0"`, wenn es keinen hat und ein Overlay registriert ist; die Tab-Reihenfolge der Seite ändert sich dadurch.
- **`pixelRatio`** in `_mapParams` wird jetzt berücksichtigt; in 3.x wurde die Angabe ignoriert.

## Nur betroffen, wenn …

### Die Konfiguration wird geprüft

**Betroffen:** manuelle Konfiguration über `initMap(…, {config})`, z. B. eine in 3.x gespeicherte, oder eine eigene Konfigurations-URL.

Antworten des Konfigurationsdienstes und manuell gesetzte Konfigurationen werden vor der Verwendung geprüft:

- Hosts sind reine Hostnamen, optional mit Port. Instanzen und Dienstnamen sind relative Pfade ohne `.` und `..`.
- Dienste stehen als Objekt mit dem Namen als Schlüssel in `ags_services`, `wmts_services` und `wms_services`. Die Listenform aus den Typen von 3.x wird nicht mehr angenommen.
- Unbekannte Felder entfallen, darunter `ags_hosts`, `wmts_hosts` und `wms_hosts` aus `getConfig()`. Eine in 3.x gespeicherte Konfiguration bleibt damit verwendbar.
- Eine ungültige Antwort des Dienstes meldet `INVALID_DATA`. Eine ungültige manuelle Konfiguration lässt `initMap` einen `TypeError` werfen.
- Die Konfigurations-URL im Konstruktor muss HTTPS verwenden, HTTP ist nur für `localhost` erlaubt.

### GeoJSON wird geprüft

**Betroffen:** Anwendungen, die GeoJSON laden.

`addGeoJSON` und `addGeoJSONfromURL` prüfen Struktur, Koordinaten und CRS; bei einem Fehler wird kein Layer eingefügt.

- Ungültige Struktur oder Koordinaten melden `INVALID_DATA`.
- Eine unbekannte Projektion meldet `PROJECTION_MISMATCH`. In 3.x wurde der Layer trotzdem eingefügt, meist an falscher Stelle.
- Ohne `_style` erscheinen die Objekte im Standardstil von OpenLayers. In 3.x waren sie unsichtbar und für Popups nicht anklickbar.

### Mehrere Karten auf einer Seite und das Popup-Element

**Betroffen:** mehrere Karten auf einer Seite oder eigenes CSS für das Popup.

Jede Instanz spricht nur noch ihre eigenen Elemente an. Das Popup-Element erhält immer die Klasse `geoline-ol-js-popup`; die ID ist über `initMap` wählbar, Standard bleibt `geoline_ol_js_popup`:

```js
karte1.initMap(25832, {target: 'karte1'});
karte2.initMap(25832, {target: 'karte2'}, {}, {popupId: 'popup_karte2'});
```

- Eine Karte, eigenes CSS auf `#geoline_ol_js_popup`: keine Änderung nötig.
- Mehrere Karten: jede weitere Karte braucht eine eigene `popupId`, sonst wirft `initMap`. Eigenes CSS sollte die Klasse statt der ID verwenden.

### Quellenangaben von ArcGIS-Diensten nur noch als Text

Den `copyrightText` von ArcGIS-Diensten zeigt geoline.ol.js als reinen Text an, auch bei eigenen Diensten über `addEsriLayer`. In 3.x wertete OpenLayers ihn als HTML aus.

- **Betroffen:** Dienste, deren `copyrightText` HTML enthält. Links darin sind nicht mehr anklickbar, Markup und Entities wie `&copy;` erscheinen wörtlich; im Dienst das Zeichen `©` verwenden. Die Dienste des Stadtmessungsamtes sind nicht betroffen.
- **Eigene Quellenangabe mit Link:** nach dem Hinzufügen setzen, z. B. `result.value.getSource().setAttributions('<a href="…">© …</a>')`. OpenLayers übernimmt diesen Wert als HTML.

### TypeScript-Deklarationen

**Betroffen:** TypeScript-Projekte.

Die Deklarationen kompilieren jetzt ohne `skipLibCheck`.

- **Genauere Typen:** `getMap()` liefert `Map` statt `object`, asynchrone Methoden `Promise<Result<…>>`, die Overlay-Funktion `(feature) => string | Node | null | undefined`. Zugriffe auf `result.value` brauchen vorher die Prüfung von `ok`.
- **Interne Member** sind `private` und erscheinen ohne Typ; `Session` wird nicht mehr exportiert. Neu exportiert ist `GeolineCustomParams` (viertes Argument von `initMap`).
- **Projekt-Einstellungen:** `moduleResolution` `bundler` oder `nodenext`. CSS-Importe brauchen eine Deklaration, z. B. `declare module '*.css';` oder `vite/client`. Wer selbst `ol/format/GeoJSON` importiert, installiert `@types/geojson`.

### Eigene Dienste brauchen CORS

Dienstinformationen von ArcGIS-Servern lädt geoline.ol.js per `fetch` statt per JSONP. Einen Legacy-Modus gibt es nicht.

- **Betroffen:** eigene ArcGIS-Dienste über `addEsriLayer` und eine eigene Konfigurations-URL im Konstruktor (`new StmaOpenLayers(configUrl)`). Die Dienste des Stadtmessungsamtes liefern die nötigen Header bereits.
- **Voraussetzung:** Der Server antwortet mit `Access-Control-Allow-Origin` für den Origin der Anwendung (oder `*`). Cookies und HTTP-Authentifizierung werden nicht mitgesendet.
- **Ohne CORS:** Das Result meldet `SERVICE_UNAVAILABLE`, die Browser-Konsole nennt die fehlenden Header.

### Gebaute Dateien nur noch über npm

`dist/` liegt nicht mehr im Git-Repository. Die Pfade im npm-Paket bleiben gleich.

- **Betroffen:** Installation direkt aus GitHub (`github:stadtmessungsamt-stuttgart/geoline.ol.js`) sowie Einbindung über `raw.githubusercontent.com` oder jsDelivr `gh/…`.
- **Umstellen auf:** das npm-Paket bzw. jsDelivr `npm/…` oder unpkg, jeweils mit fester Hauptversion.

### `addStmaEsriFeatureLayer` entfällt

Die Methode ist entfernt; sie war in 3.x nicht lauffähig. Features eines ArcGIS-Dienstes lassen sich direkt mit OpenLayers laden (`ol/format/EsriJSON`, siehe [OpenLayers-Beispiel „ArcGIS REST Feature Service“](https://openlayers.org/en/latest/examples/vector-esri.html)) und über `getMap().addLayer(…)` einfügen. Der bisherige Standard-zIndex war 60.
