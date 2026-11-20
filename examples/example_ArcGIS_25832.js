import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js";
import "ol/ol.css";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/geoline.ol.css";

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {target: "the-map"},
    {zoom: 6, center: [513044, 5403167]}
);
console.log("initMap wurde ausgeführt");

// ArcGIS-Dienste des Stadtmessungsamtes über den Dienstpfad
mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c_EPSG25832").then((result) => result.ok
    ? console.log("STMA Stadtkarte OK", result.value)
    : console.warn(result.error.code, result.error.message));

// Luftbild halbtransparent über der Stadtkarte
mymap.addStmaEsriLayer("1_Base/Luftbilder_aktuell_c_EPSG25832", {opacity: 0.5}).then((result) => result.ok
    ? console.log("STMA Luftbild OK", result.value)
    : console.warn(result.error.code, result.error.message));
