!function(e,t,o,n){var r="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},a="function"==typeof r.parcelRequire&&r.parcelRequire,i="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function l(o,n){if(!t[o]){if(!e[o]){var r="function"==typeof parcelRequire&&parcelRequire;if(!n&&r)return r(o,!0);if(a)return a(o,!0);if(i&&"string"==typeof o)return i(o);var d=new Error("Cannot find module '"+o+"'");throw d.code="MODULE_NOT_FOUND",d}f.resolve=function(t){return e[o][1][t]||t},f.cache={};var u=t[o]=new l.Module(o);e[o][0].call(u.exports,f,u,u.exports,this)}return t[o].exports;function f(e){return l(f.resolve(e))}}l.isParcelRequire=!0,l.Module=function(e){this.id=e,this.bundle=l,this.exports={}},l.modules=e,l.cache=t,l.parent=a,l.register=function(t,o){e[t]=[function(e,t){t.exports=o},{}]},r.parcelRequire=l;for(var d=0;d<o.length;d++)l(o[d]);if(o.length){var u=l(o[o.length-1]);"object"==typeof exports&&"undefined"!=typeof module?module.exports=u:"function"==typeof define&&define.amd&&define((function(){return u}))}}({fa64923d8ca3f49eddafe5e250470ab2:[function(e,t,o){"use strict";var n=s(e("../src/geoline.ol"));e("../src/geoline.ol.css");var r,a=s(e("ol/style/Icon")),i=s(e("ol/style/Fill")),l=s(e("ol/style/Stroke")),d=s(e("ol/style/Style")),u=s(e("url:./testdata/example_25832.json")),f=s(e("url:./testdata/example_4326.json"));function s(e){return e&&e.__esModule?e:{default:e}}$((function(){(r=new n.default).initMap(25832,{},{}),r.addStmaBaseLayer("Grundkarte");var e={Point:new d.default({image:new a.default({anchor:[.5,1],src:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAlCAYAAAAjt+tHAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA5xJREFUeNq8WD1s00AUPjuX1goJKog/CSYQqAhoFSgDgglVSKwMSLCxdIGJHQa6M8HShQ0kBlYkBiZQBqCh/AgEQmKg0PJTVU3axokdc9/pvXA1tmMXlyc9+eLE9333/vxerPHxcaHEUlogLRpr3M9DAqU+acdYB5JAcB1Q6pAOEAE7JwJdAmwrbZFi7UkCAmBJ6Wa6DhKpPMVT6ipdUbrElmECDoFvt2275nmesCxLBEEg1Gd9heIetGfXIEhENH/b6XSE67qiXC6fMKyiLVAkAiX1QG3vFikObHXEkFPI9fiLLV98WPBE/fOvWqVSGSE3uLbhgkHf9xW4zB0cgj2xd6kED2sX6zizjYiXMFkW8Es3H2jNQkJKHVrsek3A4mg3fbZR0u12eamxbfGfJXzINanWL6ohu4er4szEtb9cAXk0NSlm39eTKxJlk2mGWHZRAgAAhSUNeJSsywUAenj7jxWwXg+4+JdqN/fprXhy71Zvvd4YsPvFAHweJx+fPdaaFC9RMZDJBQi4OBJ7Dh7VmjZY+2ZBEgn42TT1+etTYtPQNr1eXvwp7t+Y6H23a9+hSPCoLJBxFS4sZy9Pap/D5Dg1g0Owxr0v76bF/uOnxakLVyL3unP1XD5ZkKfIKP+YTPkEpgtwUpjddAHucWA2Fua1xeJOnbkSosiEUw0+5wBkcDNF8UxcHGQKwqQKFwZOUzET60BUKU6qcAg4aBKJTBZI8zIyU42jHT5PWw0TX0ZpCaDIcJBxiiZVzNQuSAseFVxJFTPpkJKGBt2moANO8ybk1OIU7ZdqMRYAZmAbU4qHdhzd60YJ9kbjSzOCxrWNicVF347WeSNIcFtOFnAJ07fUbIgWuYymFYNJo9GoOY4jisXimg1Gdg6IwzsGU4G9+e6KmTm3N9zgys2ocjMGkx/gpLQpyQItHpdoaODRzOIBVW34FNd+JAD+8lsLQCfJ54H2tW2HRzNg+tJwAQdGKzScSpoZxhSJ50kkAP5qvg3wMZqCPdK44dTnLPCMq2sMK0wAiI4iUVWnq0eRME6OXFzl0StEIHI8Fwa4d/FIxeVN775uWAaBso5a2x6tf12dMUkAfHp2BVPPKJm4SerSnoGxZ/pCRA+yVXjTlUKhUFUkNDAUawVe7QceWRfoH5K+9SNkCYzy5Waz+QJfqpH7GIEumeBk2VzacraEWcU6CniYPiOglskCqcGzzgUmCV7L0L8f7SzgkN8CDAD/wMp5zGKV4QAAAABJRU5ErkJggg=="})}),Polygon:new d.default({stroke:new l.default({color:"blue",lineDash:[4],width:3}),fill:new i.default({color:"rgba(0, 0, 255, 0.1)"})})},t=function(t){return null==e[t.getGeometry().getType()]&&console.warn(t.getGeometry().getType(),"-Stil nicht definiert."),e[t.getGeometry().getType()]};r.addGeoJSON(f.default,!1,t,(function(e){if(0!=e){console.info("Features aus GeoJSON hinzugefügt.");r.addOverlayForLayer(e,(function(e){var t=e.get("label");return null!=t?t:"Keine weiteren Informationen vorhanden."}))}})),r.addGeoJSON(u.default,!1,t,(function(e){if(0!=e){console.info("Features aus GeoJSON hinzugefügt.");r.addOverlayForLayer(e,(function(e){return e.get("HINWEIS")}))}}))}))},{"../src/geoline.ol":"6ce36666a2a65908b3284051e20a13d6","../src/geoline.ol.css":"db99857e3f9249f4b1768c5e90d014c7","ol/style/Icon":"364d4a0b21505ad2fd7e365600bc7428","ol/style/Fill":"642fc8320422cf4af06e5417aceaa9a6","ol/style/Stroke":"30e784d1cea49382db545e5926e5618a","ol/style/Style":"eb49a9625251cd59dcfaefe91a2a1832","url:./testdata/example_25832.json":"78dd4572f1c24e71ed0247450b1f403c","url:./testdata/example_4326.json":"715993ec49d1828e60f1e4286733c12f"}],db99857e3f9249f4b1768c5e90d014c7:[function(){},{}],"78dd4572f1c24e71ed0247450b1f403c":[function(e,t,o){t.exports=JSON.parse('{"type":"FeatureCollection","name":"Beispieldatensatz","crs":{"type":"name","properties":{"name":"EPSG:25832"}},"features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[509626.57,5404795.15]},"properties":{"ID":1,"HINWEIS":"Dieser Text wird dem Nutzer angezeigt.","IMG":null}},{"type":"Feature","geometry":{"type":"Point","coordinates":[509714.41,5404795.15]},"properties":{"ID":2,"HINWEIS":"Ich habe genau definiert, wie ich aussehen möchte.","IMG":"https://gis5.stuttgart.de/geoline/geoline.ol.js/examples/point.png"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[509628.69,5404705.19]},"properties":{"ID":3,"HINWEIS":"Ich bin ein Punktobjekt.","IMG":null}},{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[509286.82,5404853],[509286.82,5404611.03],[509548.07,5404611.03],[509548.07,5404853],[509286.82,5404853]]]},"properties":{"ID":1,"HINWEIS":"Hier könnte Text zu dem Polygon stehen."}},{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[509798.81,5404732.01],[509798.81,5404668.89],[509874.21,5404668.89],[509874.21,5404732.01],[509798.81,5404732.01]]]},"properties":{"ID":2,"HINWEIS":"Dieser Text wird dem Nutzer angezeigt."}},{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[509747.96,5404523.38],[509743.07,5404523.17],[509738.21,5404522.53],[509733.43,5404521.47],[509728.76,5404520],[509724.24,5404518.12],[509719.89,5404515.86],[509715.76,5404513.23],[509711.88,5404510.25],[509708.27,5404506.94],[509704.96,5404503.33],[509701.98,5404499.45],[509699.35,5404495.32],[509697.09,5404490.97],[509695.21,5404486.45],[509693.74,5404481.78],[509692.68,5404477],[509692.04,5404472.14],[509691.83,5404467.25],[509692.04,5404462.35],[509692.68,5404457.5],[509693.74,5404452.72],[509695.21,5404448.05],[509697.09,5404443.52],[509699.35,5404439.18],[509701.98,5404435.05],[509704.96,5404431.16],[509708.27,5404427.55],[509711.88,5404424.24],[509715.76,5404421.26],[509719.89,5404418.63],[509724.24,5404416.37],[509728.76,5404414.5],[509733.43,5404413.02],[509738.21,5404411.96],[509743.07,5404411.32],[509747.96,5404411.11],[509752.86,5404411.32],[509757.71,5404411.96],[509762.49,5404413.02],[509767.16,5404414.5],[509771.69,5404416.37],[509776.03,5404418.63],[509780.16,5404421.26],[509784.05,5404424.24],[509787.66,5404427.55],[509790.97,5404431.16],[509793.95,5404435.05],[509796.58,5404439.18],[509798.84,5404443.52],[509800.71,5404448.05],[509802.19,5404452.72],[509803.25,5404457.5],[509803.89,5404462.35],[509804.1,5404467.25],[509803.89,5404472.14],[509803.25,5404477],[509802.19,5404481.78],[509800.71,5404486.45],[509798.84,5404490.97],[509796.58,5404495.32],[509793.95,5404499.45],[509790.97,5404503.33],[509787.66,5404506.94],[509784.05,5404510.25],[509780.16,5404513.23],[509776.03,5404515.86],[509771.69,5404518.12],[509767.16,5404520],[509762.49,5404521.47],[509757.71,5404522.53],[509752.86,5404523.17],[509747.96,5404523.38]]]},"properties":{"ID":3,"HINWEIS":"Ich bin ein Kreis."}}]}')},{}],"715993ec49d1828e60f1e4286733c12f":[function(e,t,o){t.exports=JSON.parse('{"type":"FeatureCollection","name":"punkte_wgs84","features":[{"type":"Feature","properties":{"fid":1,"id":1,"url":null,"label":null},"geometry":{"type":"Point","coordinates":[9.1084,48.7847]}},{"type":"Feature","properties":{"fid":2,"id":2,"url":null,"label":"Lindenbach"},"geometry":{"type":"Point","coordinates":[9.11305,48.79475]}},{"type":"Feature","properties":{"fid":3,"id":3,"url":null,"label":"Talgraben"},"geometry":{"type":"Point","coordinates":[9.1021,48.78615]}}]}')},{}]},{},["fa64923d8ca3f49eddafe5e250470ab2"]);
//# sourceMappingURL=example_UTM_25832_mit_GeoJSON.aa0e7956.js.map
