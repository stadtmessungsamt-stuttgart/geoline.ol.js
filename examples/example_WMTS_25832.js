import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.js";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.css";

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {target: "the-map"},
    {zoom: 6, center: [513044, 5403167]}
);
console.log("initMap wurde ausgeführt");

mymap.addStmaWMTSLayer("Base:A62_Luftbild_aktuell_EPSG25832").then((result) => result.ok
    ? console.log("STMA WMTS OK", result.value)
    : console.warn(result.error.code, result.error.message));
