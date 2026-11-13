import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import {get as getProjection} from 'ol/proj.js';
import 'ol/ol.css';
import StmaOpenLayers from '@stadtmessungsamt-stuttgart/geoline.ol.js';
import '@stadtmessungsamt-stuttgart/geoline.ol.js/geoline.ol.css';
import {CONFIG} from './config.js';

// Die Anwendung registriert EPSG:25832 nicht selbst; sie muss die Registrierung von Geoline sehen.
const projectionBefore = getProjection('EPSG:25832') !== null;

const geoline = new StmaOpenLayers();
const map = geoline.initMap(25832, {target: 'map'}, {}, {config: CONFIG});
const layer = geoline.addPoints([[513785, 5402232]], 'marker.png');

let inputError = null;
try {
    geoline.addPoints('kein Array', 'marker.png');
} catch (err) {
    inputError = {name: err.name, message: err.message};
}

window.geolineConsumer = {
    sameMapClass: map instanceof Map,
    sameLayerClass: layer instanceof VectorLayer,
    projectionBefore,
    projectionAfter: getProjection('EPSG:25832') !== null,
    inputError,
};
