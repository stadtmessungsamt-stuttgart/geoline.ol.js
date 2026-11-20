// Geoline und Anwendung teilen sich eine OpenLayers-Installation (ol ist Peer-Dependency).
// Eigene Layer, Controls und Overlays aus "ol" lassen sich deshalb direkt mit der Karte von Geoline kombinieren.
import Feature from "ol/Feature.js";
import Overlay from "ol/Overlay.js";
import ScaleLine from "ol/control/ScaleLine.js";
import LineString from "ol/geom/LineString.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import "ol/ol.css";
import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/geoline.ol.css";

const mymap = new StmaOpenLayers();
const map = mymap.initMap(
    25832,
    {target: "the-map"},
    {zoom: 6, center: [513300, 5402900]}
);

mymap.addStmaBaseLayer("Basemap")
    .then((result) => result.ok
        ? console.log("addStmaBaseLayer (Basemap) wurde ausgeführt", result.value)
        : console.warn(result.error.code, result.error.message));

// Eigener Vektor-Layer: Koordinaten in der Projektion der Karte (EPSG:25832)
const route = new VectorLayer({
    zIndex: 70,
    source: new VectorSource({
        features: [new Feature(new LineString([[513000, 5402600], [513300, 5402900], [513600, 5402700]]))],
    }),
    style: new Style({stroke: new Stroke({color: "#d4002d", width: 4})}),
});
map.addLayer(route);
console.log("Eigener OpenLayers-Layer hinzugefügt", route);

// Eigenes Control
map.addControl(new ScaleLine());
console.log("Eigenes OpenLayers-Control hinzugefügt");

// Eigenes Overlay
map.addOverlay(new Overlay({
    element: document.getElementById("hinweis"),
    position: [513300, 5402900],
    positioning: "bottom-center",
}));
console.log("Eigenes OpenLayers-Overlay hinzugefügt");
