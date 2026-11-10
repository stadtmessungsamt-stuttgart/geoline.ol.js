# Migration von geoline.ol.js 3.x auf 4.0

Diese Anleitung beschreibt die Änderungen, die Anwendungen beim Umstieg auf die neue Hauptversion anpassen müssen. Sie wird bis zum Release vervollständigt.

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
