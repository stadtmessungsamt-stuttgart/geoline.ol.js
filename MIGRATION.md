# Migration von geoline.ol.js 3.x auf 4.0

Diese Anleitung beschreibt die Änderungen, die Anwendungen beim Umstieg auf die neue Hauptversion anpassen müssen. Sie wird bis zum Release vervollständigt.

## OpenLayers als Peer-Dependency, Einstiegspunkte und CSS

geoline.ol.js bringt keine eigene Kopie von OpenLayers mehr mit. Bisher arbeiteten Anwendungen, die OpenLayers selbst verwenden, mit zwei getrennten Kopien; Karten, Layer und Projektionen passten dann nicht zusammen.

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

## Rückgabewerte statt Callbacks, beobachtbare Fehler

In 3.x gaben die Methoden nichts zurück. Ergebnisse kamen nur über einen Callback als letzten Parameter, Fehler meist nur über `console.error`. Ab 4.0 liefern alle Methoden ihr Ergebnis als Rückgabewert, und Fehler erreichen den Aufrufer.

### Drei Arten von Fehlern

| Art | Beispiele | Verhalten in 4.0 |
|---|---|---|
| Programmierfehler | falscher Parametertyp, fehlender Pflichtparameter, Callback übergeben, Aufruf vor `initMap` oder nach `dispose` | Die Methode wirft sofort einen `TypeError` bzw. `Error` mit Hinweis auf den Parameter. |
| Erwartbare Dienst- und Datenfehler | Dienst nicht erreichbar, HTTP-Fehler, Dienst meldet einen Fehler, unbekannte Karte, unpassende Projektion, ungültiges GeoJSON | Rückgabe eines Result-Objekts mit `ok: false`. Die Promise wird **nicht** abgelehnt. |
| Interne Fehler der Bibliothek | Bugs | Exception bzw. abgelehnte Promise. Bitte als Fehler melden. |

Der synchrone Fehler fliegt beim Aufruf, auch bei asynchronen Methoden. `try { await … } catch` fängt ihn trotzdem.

Ausnahme: Ob ein Dienst dem Stadtmessungsamt gehört, steht erst nach dem Laden der Konfiguration fest. Wird ein solcher Dienst über `addEsriLayer`, `addWMTSLayer` oder `addWMSLayer` statt über die `addStma*`-Methode eingebunden, lehnt die Bibliothek die Promise mit einem `TypeError` ab. Das gilt immer, auch wenn die Konfiguration schon geladen ist.

### Result-Objekt

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

### Rückgaben je Methode

| Methode | 3.x | 4.0 |
|---|---|---|
| `initMap` | nichts, Callback mit Map | `Map` |
| `addEsriLayer`, `addStmaEsriLayer` | nichts, Callback mit Layer | `Promise<Result<Layer>>` |
| `addWMTSLayer`, `addStmaWMTSLayer` | nichts, Callback mit Layer oder `false` | `Promise<Result<Layer>>` |
| `addWMSLayer`, `addStmaWMSLayer` | nichts, Callback mit Layer (synchron) | `Promise<Result<Layer>>` (jetzt asynchron) |
| `addStmaBaseLayer` | nichts, Callback mit Layer | `Promise<Result<Layer>>` |
| `addGeoJSONfromURL` | nichts, Callback mit Layer oder `false` | `Promise<Result<VectorLayer>>` |
| `addGeoJSON` | nichts, Callback mit Layer | `Result<VectorLayer>` (synchron) |
| `addPoints` | nichts, Callback mit Layer | `VectorLayer` |
| `addOverlayForLayer` | nichts | nichts |
| `getMap` | Map oder `null` | `Map`; wirft vor `initMap` |
| `getConfig` | Konfiguration, während des Ladens ein Platzhalter | entfällt, siehe unten |

### Callbacks migrieren

Die Callback-Parameter entfallen. Wer an dieser Stelle noch eine Funktion übergibt, erhält einen `TypeError`. Die Logik aus dem Callback läuft unverändert weiter, nur nach dem Rückgabewert.

Nicht betroffen sind die Overlay-Funktion von `addOverlayForLayer` und `tileLoadFunction` in `initMap`. Beide bleiben Parameter.

Synchrone Methoden: Rückgabewert verwenden.

```js
// 3.x
mymap.addPoints([[x, y]], iconUrl, (vectorLayer) => {
    vectorLayer.set('name', 'marker');
});

// 4.0
const vectorLayer = mymap.addPoints([[x, y]], iconUrl);
vectorLayer.set('name', 'marker');
```

```js
// 3.x
mymap.initMap(25832, {target: 'map'}, {}, {}, () => onInit());

// 4.0
mymap.initMap(25832, {target: 'map'});
onInit();
```

Asynchrone Methoden: `await` bzw. `.then` verwenden. Aus `if (layer)` bzw. dem bisher ausbleibenden Aufruf im Fehlerfall wird `if (r.ok)`.

```js
// 3.x
mymap.addWMSLayer(url, layerName, {}, {}, (layer) => {
    layers[layerName] = layer;
});

// 4.0
const r = await mymap.addWMSLayer(url, layerName);
if (r.ok) {
    layers[layerName] = r.value;
}
```

`addWMSLayer` und `addStmaWMSLayer` arbeiteten in 3.x synchron. Code, der den Layer direkt nach dem Aufruf erwartet, muss auf das Ergebnis warten.

Ein Vorteil der neuen Form: Fehler im eigenen Code laufen in die eigene Fehlerbehandlung. In 3.x lief der Callback in der Promise-Kette der Bibliothek; eine Exception darin erschien nur als Bibliotheksfehler in der Konsole.

### `getConfig()` wird zu `loadConfig()`

`getConfig()` lieferte während des Ladens einen Platzhalter. Die Methode entfällt. Ersatz:

```js
const r = await mymap.loadConfig();
if (r.ok) {
    speichereFuerOffline(r.value);
}
```

Der neue Name ist Absicht: Würde `getConfig()` eine Promise liefern, läse bestehender Code wie `getConfig().wmts_hosts` still `undefined`. So meldet der Aufruf sofort `getConfig is not a function`.

Eine manuell gesetzte Konfiguration bleibt über `initMap(…, {config})` möglich.

### Die Konfiguration wird geprüft

Antworten des Konfigurationsdienstes und manuell gesetzte Konfigurationen werden vor der Verwendung geprüft:

- Hosts sind reine Hostnamen, optional mit Port, ohne Schema, Zugangsdaten und Pfad. Instanzen und Dienstnamen sind relative Pfade ohne `.` und `..`.
- Dienste stehen als Objekt mit dem Namen als Schlüssel in `ags_services`, `wmts_services` und `wms_services`. Die Listenform aus den Typen von 3.x wird nicht mehr angenommen.
- Unbekannte Felder entfallen, darunter die abgeleiteten Listen `ags_hosts`, `wmts_hosts` und `wms_hosts` aus `getConfig()`. Eine in 3.x gespeicherte Konfiguration bleibt damit verwendbar.
- Eine ungültige Antwort des Dienstes meldet `INVALID_DATA`; es gehen dann keine Requests an die Kartendienste. Eine ungültige manuelle Konfiguration ist ein Programmierfehler: `initMap` wirft einen `TypeError`.
- Die Konfigurations-URL im Konstruktor muss HTTPS verwenden, HTTP ist nur für `localhost` erlaubt.

Im Konfigurationsabruf sendet geoline.ol.js im Parameter `url` nur noch Origin und Pfad der Seite, ohne Query und Fragment. Für Anwendungen ändert sich dadurch nichts.

### GeoJSON wird geprüft

`addGeoJSON` und `addGeoJSONfromURL` prüfen Struktur, Koordinaten und CRS, bevor sie einen Layer einfügen. Bei einem Fehler wird kein Layer eingefügt.

- Ungültige Struktur oder Koordinaten melden `INVALID_DATA`. In 3.x warf `crs: null` einen `TypeError`; jetzt gilt wie bei fehlendem CRS EPSG:4326.
- Eine unbekannte Projektion meldet `PROJECTION_MISMATCH`. In 3.x wurde nur geloggt und der Layer trotzdem eingefügt, meist an falscher Stelle.
- Mit `_zoomTo` wartet die Karte, bis sie eine Größe hat, und zoomt nur auf nicht leere Daten. `dispose()` beendet das Warten.

### Lebenszyklus: `dispose()`

Eine Instanz von `StmaOpenLayers` gehört zu genau einer Karte.

- `dispose()` bricht laufende Anfragen ab, entfernt Listener, Intervalle, Overlays und Caches und löst die Karte von ihrem Element. Offene Promises liefern `{ok: false, error: {code: 'ABORTED'}}`. Mehrfacher Aufruf ist unschädlich.
- Ergebnisse, die nach `dispose()` eintreffen, werden verworfen und nie in eine Karte eingefügt.
- Ein zweiter Aufruf von `initMap` auf derselben Instanz wirft. Zum Neuaufbau vorher `dispose()` aufrufen:

```js
mymap.dispose();
mymap.initMap(25832, {target: 'map'});
```

Nach `dispose()` werfen alle Methoden außer `initMap` und `dispose`.

### Mehrere Karten auf einer Seite und das Popup-Element

Jede Instanz spricht nur noch ihre eigenen Elemente an. Damit funktionieren mehrere Karten auf einer Seite unabhängig voneinander.

Das Popup-Element erhält immer die Klasse `geoline-ol-js-popup`, das mitgelieferte CSS nutzt diese Klasse. Die ID ist über `initMap` wählbar, Standard bleibt `geoline_ol_js_popup`:

```js
karte1.initMap(25832, {target: 'karte1'});
karte2.initMap(25832, {target: 'karte2'}, {}, {popupId: 'popup_karte2'});
```

- Eine Karte, eigenes CSS auf `#geoline_ol_js_popup`: keine Änderung nötig.
- Mehrere Karten: jede weitere Karte braucht eine eigene `popupId`. Ist die ID im Dokument schon vergeben oder kein String, wirft `initMap`. Eigenes CSS sollte die Klasse statt der ID verwenden.

## Ansicht und Projektion der Karte

`initMap` legt die View einmal fest; kein Layer ersetzt sie mehr. In 3.x setzte der erste gecachte ArcGIS-, WMTS- oder WMS-Layer eine neue View. Zoomstufen, Mittelpunkt und eigene `_viewParams` hingen dann davon ab, welcher Dienst zuerst antwortete. `getMap().getView()` liefert jetzt bis `dispose()` dasselbe Objekt.

- **Zoomstufen in EPSG:25832** folgen der Kachelmatrix `Stuttgart_UTM_CRS_oL` der Stadtmessungsamt-Dienste, Standard ist Zoom 2:

  | Zoom | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | m/Pixel | 112 | 56 | 28 | 14 | 7 | 2,8 | 1,4 | 0,7 | 0,28 | 0,14 |

  Mit einem gecachten ArcGIS-Dienst als erstem Layer ändert sich der Ausschnitt in 3.x-Anwendungen kaum (vorher 105,83 … 0,13 m/Pixel). Wer nur WMS oder GeoJSON nutzte, bekam in 3.x die Standardstufen von OpenLayers; dort `zoom` neu wählen, z. B. 16 (2,4 m/Pixel) → 5. Eigene `resolutions` in `_viewParams` sind weiter möglich.
- **EPSG:3857** behält die Standardstufen von OpenLayers und ist ohne eigene Angaben auf Stuttgart zentriert (Zoom 12).
- **Nur noch EPSG:25832 und EPSG:3857:** Die Registrierung von EPSG:31467 (Gauß-Krüger) entfällt. Für andere Codes wirft `initMap` einen `TypeError`.
- **Dienste in anderer Projektion:** Gecachte ArcGIS-Dienste werden von OpenLayers in die Projektion der Karte umgerechnet; die Karte behält ihre Projektion. In 3.x wurde `projection` mit der WKID des Dienstes überschrieben. Eine unbekannte WKID meldet `PROJECTION_MISMATCH`, fehlende Kachelinformationen melden `INVALID_DATA`, jeweils ohne Layer. WMTS-Layer in anderer Projektion melden `PROJECTION_MISMATCH`.
- **Kachelgröße:** Nicht quadratische ArcGIS-Kacheln werden als Breite × Höhe gelesen; in 3.x waren Breite und Höhe vertauscht.
- **`controls: null`** schaltet alle Bedienelemente ab, die Quellenangabe bleibt.

## Quellenangaben von ArcGIS-Diensten nur noch als Text

Den `copyrightText` aus der Dienstbeschreibung von ArcGIS-Diensten zeigt geoline.ol.js als reinen Text an, auch bei eigenen Diensten über `addEsriLayer`. In 3.x wertete OpenLayers ihn als HTML aus.

- **Betroffen:** Dienste, deren `copyrightText` HTML enthält. Links darin sind nicht mehr anklickbar, Markup erscheint als Text. HTML-Entities wie `&copy;` erscheinen wörtlich; im Dienst das Zeichen `©` verwenden.
- **Nicht betroffen:** Die Dienste des Stadtmessungsamtes; ihr Copyright-Text enthält kein HTML.
- **Eigene Quellenangabe mit Link:** nach dem Hinzufügen mit OpenLayers setzen, z. B. `result.value.getSource().setAttributions('<a href="…">© …</a>')`. OpenLayers übernimmt diesen Wert als HTML.

## Eigene Dienste brauchen CORS

Dienstinformationen von ArcGIS-Servern lädt geoline.ol.js nicht mehr per JSONP, sondern per `fetch`. JSONP hat die Antwort als Script in der Anwendung ausgeführt. Einen Legacy-Modus gibt es nicht.

- **Betroffen:** eigene ArcGIS-Dienste über `addEsriLayer` und eine eigene Konfigurations-URL im Konstruktor (`new StmaOpenLayers(configUrl)`). Die Dienste des Stadtmessungsamtes liefern die nötigen Header bereits.
- **Voraussetzung:** Der Server antwortet mit `Access-Control-Allow-Origin` für den Origin der Anwendung (oder `*`). Cookies und HTTP-Authentifizierung werden nicht mitgesendet.
- **Ohne CORS:** Das Result meldet `SERVICE_UNAVAILABLE`, die Browser-Konsole nennt die fehlenden Header. Für WMTS-Capabilities (`addWMTSLayer`) galt das schon in 3.x.

## Gebaute Dateien nur noch über npm

`dist/` liegt nicht mehr im Git-Repository. Die Pfade im npm-Paket bleiben gleich.

- **Betroffen:** Installation direkt aus GitHub (`github:stadtmessungsamt-stuttgart/geoline.ol.js`) sowie Einbindung über `raw.githubusercontent.com` oder jsDelivr `gh/…`.
- **Umstellen auf:** das npm-Paket bzw. jsDelivr `npm/…` oder unpkg, jeweils mit fester Hauptversion.

## `addStmaEsriFeatureLayer` entfällt

Die Methode `addStmaEsriFeatureLayer(mapservice, layerId, styleFunction, callback)` ist entfernt. Sie war in 3.x nicht lauffähig: Der Ladevorgang brach mit `self._fetchConfig is not a function` ab, und im ESM-Build fehlte `require('jsonp')`.

**Alternative:** Features eines ArcGIS-Dienstes direkt mit OpenLayers laden. `getMap()` liefert die OpenLayers-Karte, zu der der Layer hinzugefügt wird. Der Dienst muss die Operation `query` unterstützen und CORS erlauben.

```js
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import EsriJSON from 'ol/format/EsriJSON.js';
import {tile as tileStrategy} from 'ol/loadingstrategy.js';
import {createXYZ} from 'ol/tilegrid.js';

// URL des Layers: .../rest/services/ORDNER/DIENST/MapServer/LAYERID
const layerUrl = 'https://SERVER/arcgis/rest/services/ORDNER/DIENST/MapServer/LAYERID';
const format = new EsriJSON();

const source = new VectorSource({
    strategy: tileStrategy(createXYZ({tileSize: 512})),
    loader(extent, resolution, projection, success, failure) {
        const wkid = projection.getCode().split(':')[1];
        const params = new URLSearchParams({
            f: 'json',
            returnGeometry: 'true',
            spatialRel: 'esriSpatialRelIntersects',
            geometry: JSON.stringify({
                xmin: extent[0], ymin: extent[1], xmax: extent[2], ymax: extent[3],
                spatialReference: {wkid},
            }),
            geometryType: 'esriGeometryEnvelope',
            inSR: wkid,
            outFields: '*',
            outSR: wkid,
        });
        fetch(`${layerUrl}/query?${params}`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((json) => {
                if (json.error) throw new Error(json.error.message);
                const features = format.readFeatures(json, {featureProjection: projection});
                source.addFeatures(features);
                success(features);
            })
            .catch(() => {
                // Bereich erneut ladbar machen
                source.removeLoadedExtent(extent);
                failure();
            });
    },
});

mymap.getMap().addLayer(new VectorLayer({source, zIndex: 60, style: myStyleFunction}));
```

Hinweise:
- `zIndex: 60` entspricht dem bisherigen Standard der Methode.
- Bei großen Layern begrenzt der Dienst die Anzahl der Features pro Abfrage (`exceededTransferLimit`). Dann `outFields` auf die benötigten Felder beschränken oder kleinere Kacheln wählen.
