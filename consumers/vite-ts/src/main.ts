import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import {get as getProjection} from 'ol/proj.js';
import 'ol/ol.css';
import StmaOpenLayers, {type GeolineConfig} from '@stadtmessungsamt-stuttgart/geoline.ol.js';
import '@stadtmessungsamt-stuttgart/geoline.ol.js/geoline.ol.css';

// Manuelle Konfiguration, damit der Test keinen Konfigurationsdienst braucht
const CONFIG: GeolineConfig = {
    ags_host: 'gis5.stuttgart.de',
    ags_instance: 'arcgis',
    wmts_host: 'geoserver.stuttgart.de',
    wmts_instance: 'geoserver',
    wmts_matrix: 'Stuttgart_UTM_CRS_oL',
    wms_host: 'geoserver.stuttgart.de',
    wms_instance: 'geoserver/ows',
    wms_tiled: true,
    ags_services: {},
    wmts_services: {},
    wms_services: {},
};

// Die Anwendung registriert EPSG:25832 nicht selbst; sie muss die Registrierung von Geoline sehen.
const projectionBefore = getProjection('EPSG:25832') !== null;

const geoline = new StmaOpenLayers();
const map = geoline.initMap(25832, {target: 'map'}, {}, {config: CONFIG});
const layer = geoline.addPoints([[513785, 5402232]], 'marker.png');

let inputError: {name: string; message: string} | null = null;
try {
    // @ts-expect-error falsche Eingabe absichtlich, geprüft wird der Laufzeitfehler
    geoline.addPoints('kein Array', 'marker.png');
} catch (err) {
    if (err instanceof Error) {
        inputError = {name: err.name, message: err.message};
    }
}

declare global {
    interface Window {
        geolineConsumer: unknown;
    }
}

window.geolineConsumer = {
    sameMapClass: map instanceof Map,
    sameLayerClass: layer instanceof VectorLayer,
    projectionBefore,
    projectionAfter: getProjection('EPSG:25832') !== null,
    inputError,
};
