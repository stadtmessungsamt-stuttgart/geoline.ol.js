import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.js";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.css";

import MousePosition from 'ol/control/MousePosition.js';
import Zoom from 'ol/control/Zoom.js';

const mymap = new StmaOpenLayers();
mymap.initMap(3857, {}, {
	center: [1021708, 6237140],
	zoom: 13
});

mymap.addStmaBaseLayer("Basemap");
mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c_EPSG3857");

const mousePosition = new MousePosition({
	coordinateFormat: function(coordinate) {
		return (Math.round(coordinate[0] * 1000) / 1000).toString() + " / " +
			(Math.round(coordinate[1] * 1000) / 1000).toString()
	}
});
mymap.getMap().addControl(mousePosition);

const zoom = new Zoom({});
mymap.getMap().addControl(zoom);
