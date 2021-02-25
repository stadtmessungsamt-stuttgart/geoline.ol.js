import geolineOlJs from "../src/geoline.ol";
//import geolineOlJs from "@stadtmessungsamt-stuttgart/geoline.ol.js";
import "../src/geoline.ol.css";

import styleIcon from "ol/style/Icon";
import styleFill from "ol/style/Fill";
import styleStroke from "ol/style/Stroke";
import styleStyle from "ol/style/Style";

import example_25832JSON from "url:./testdata/example_25832.json"
import example_4326JSON from "url:./testdata/example_4326.json"

var mymap;
$(function() {
	mymap = new geolineOlJs();
	mymap.initMap(25832, {}, {});
	
	mymap.addStmaBaseLayer("Grundkarte");
				
	//Aussehen definieren
	var _styles = {
		"Point": new styleStyle({
			image: new styleIcon({
				anchor: [0.5, 1],
				src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAlCAYAAAAjt+tHAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA5xJREFUeNq8WD1s00AUPjuX1goJKog/CSYQqAhoFSgDgglVSKwMSLCxdIGJHQa6M8HShQ0kBlYkBiZQBqCh/AgEQmKg0PJTVU3axokdc9/pvXA1tmMXlyc9+eLE9333/vxerPHxcaHEUlogLRpr3M9DAqU+acdYB5JAcB1Q6pAOEAE7JwJdAmwrbZFi7UkCAmBJ6Wa6DhKpPMVT6ipdUbrElmECDoFvt2275nmesCxLBEEg1Gd9heIetGfXIEhENH/b6XSE67qiXC6fMKyiLVAkAiX1QG3vFikObHXEkFPI9fiLLV98WPBE/fOvWqVSGSE3uLbhgkHf9xW4zB0cgj2xd6kED2sX6zizjYiXMFkW8Es3H2jNQkJKHVrsek3A4mg3fbZR0u12eamxbfGfJXzINanWL6ohu4er4szEtb9cAXk0NSlm39eTKxJlk2mGWHZRAgAAhSUNeJSsywUAenj7jxWwXg+4+JdqN/fprXhy71Zvvd4YsPvFAHweJx+fPdaaFC9RMZDJBQi4OBJ7Dh7VmjZY+2ZBEgn42TT1+etTYtPQNr1eXvwp7t+Y6H23a9+hSPCoLJBxFS4sZy9Pap/D5Dg1g0Owxr0v76bF/uOnxakLVyL3unP1XD5ZkKfIKP+YTPkEpgtwUpjddAHucWA2Fua1xeJOnbkSosiEUw0+5wBkcDNF8UxcHGQKwqQKFwZOUzET60BUKU6qcAg4aBKJTBZI8zIyU42jHT5PWw0TX0ZpCaDIcJBxiiZVzNQuSAseFVxJFTPpkJKGBt2moANO8ybk1OIU7ZdqMRYAZmAbU4qHdhzd60YJ9kbjSzOCxrWNicVF347WeSNIcFtOFnAJ07fUbIgWuYymFYNJo9GoOY4jisXimg1Gdg6IwzsGU4G9+e6KmTm3N9zgys2ocjMGkx/gpLQpyQItHpdoaODRzOIBVW34FNd+JAD+8lsLQCfJ54H2tW2HRzNg+tJwAQdGKzScSpoZxhSJ50kkAP5qvg3wMZqCPdK44dTnLPCMq2sMK0wAiI4iUVWnq0eRME6OXFzl0StEIHI8Fwa4d/FIxeVN775uWAaBso5a2x6tf12dMUkAfHp2BVPPKJm4SerSnoGxZ/pCRA+yVXjTlUKhUFUkNDAUawVe7QceWRfoH5K+9SNkCYzy5Waz+QJfqpH7GIEumeBk2VzacraEWcU6CniYPiOglskCqcGzzgUmCV7L0L8f7SzgkN8CDAD/wMp5zGKV4QAAAABJRU5ErkJggg=="
			})
		}),
		"Polygon": new styleStyle({
			stroke: new styleStroke({
				color: 'blue',
				lineDash: [4],
				width: 3
			}),
			fill: new styleFill({
				color: 'rgba(0, 0, 255, 0.1)',
			})
		})
	};
	var _styleFunction = function (feature) {
		if (_styles[feature.getGeometry().getType()] == null) {
			console.warn(feature.getGeometry().getType(), "-Stil nicht definiert.");
		}
		return _styles[feature.getGeometry().getType()];
	};
	
	mymap.addGeoJSON(example_4326JSON, false, _styleFunction, function(_layer) {
		if (_layer != false) {
			console.info("Features aus GeoJSON hinzugefügt.")
			
			var _overlayFunction = function(_feature) {
				var _data = _feature.get("label"); //Es wird der Inhalt des Attributes label aus dem GeoJSON angezeigt.
				if (_data != null) {
					return _data;
				} else {
					return "Keine weiteren Informationen vorhanden."
				}
			};
			
			mymap.addOverlayForLayer(_layer, _overlayFunction);
		}
	});
	
	mymap.addGeoJSON(example_25832JSON, false, _styleFunction, function(_layer) {
		if (_layer != false) {
			console.info("Features aus GeoJSON hinzugefügt.");
			
			var _overlayFunction2 = function(_feature) {
				return _feature.get("HINWEIS"); //Es wird der Inhalt des Attributes HINWEIS aus dem GeoJSON angezeigt.
			};
			
			mymap.addOverlayForLayer(_layer, _overlayFunction2);
		}
	});
});