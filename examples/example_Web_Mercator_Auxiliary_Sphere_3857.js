import geolineOlJs from "../src/geoline.ol";
//import geolineOlJs from "@stadtmessungsamt-stuttgart/geoline.ol.js";
import "../src/geoline.ol.css";

var mymap;
$(function() {
	mymap = new geolineOlJs();
	mymap.initMap(3857, {}, {
		center: [1031492, 6220413],
		zoom: 10
	});
	
	mymap.addStmaBaseLayer("Grundkarte");
	mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");
});