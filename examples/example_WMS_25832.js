import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.js";
import "@stadtmessungsamt-stuttgart/geoline.ol.js/src/geoline.ol.css";

const mymap = new StmaOpenLayers();
mymap.initMap(
    25832,
    {
        target: "the-map"
    },
    {
        center: [513044, 5403167], // somewhere inside Stuttgart in EPSG:25832
        zoom: 16
    },
    {},
    function () {
        console.log("initMap wurde ausgeführt");
    }
);

mymap.addStmaWMSLayer(
    "Base:A62_Luftbild_2009_EPSG25832",
    {},
    {
        TILED: true,   // make sure we request cached tiles
        serverType: "geoserver",
        crossOrigin: "anonymous",
        params: {
            VERSION: "1.3.0",
            FORMAT: "image/png",
            TRANSPARENT: true,
            STYLES: ""
        }
    },
    function (layer) {
        console.log("STMA WMS OK", layer);
    }
);
