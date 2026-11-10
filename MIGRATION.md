# Migration von geoline.ol.js 3.x auf 4.0

Diese Anleitung beschreibt die Änderungen, die Anwendungen beim Umstieg auf die neue Hauptversion anpassen müssen. Sie wird bis zum Release vervollständigt.

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
