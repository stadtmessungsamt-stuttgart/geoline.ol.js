import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.js";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/src/geoline.ol.css";

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {target: "the-map"},
    {zoom: 6},
    {},
    function (map) {
        console.log("initMap wurde ausgeführt");
    }
);

mymap.addStmaWMTSLayer(
    "Base:A62_Luftbild_2021_EPSG25832",
    {},
    {},
    (layer) => console.log("STMA WMTS OK", layer)
);
