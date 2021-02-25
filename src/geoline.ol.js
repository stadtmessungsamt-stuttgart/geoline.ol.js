/**
 @module stma_openlayers
*/

import jquery from "jquery";
window.$ = window.jQuery = jquery;

import Feature from "ol/Feature";
import Map from "ol/Map";
import Overlay from "ol/Overlay";
import TileGrid from "ol/tilegrid/TileGrid";
import View from "ol/View";
import controlAttribution from "ol/control/Attribution";
import formatEsriJSON from "ol/format/EsriJSON";
import formatGeoJSON from "ol/format/GeoJSON";
import geomPoint from "ol/geom/Point";
import layerImage from "ol/layer/Image";
import layerTile from "ol/layer/Tile";
import layerVector from "ol/layer/Vector";
import sourceImageArcGISRest from "ol/source/ImageArcGISRest";
import sourceVector from "ol/source/Vector";
import sourceXYZ from "ol/source/XYZ";
import styleIcon from "ol/style/Icon";
import styleStyle from "ol/style/Style";
import {defaults as defaultControls} from 'ol/control';

import proj4 from "proj4";
import {get as getProjection} from "ol/proj";
import {register} from 'ol/proj/proj4';

/**
 *	version			@version@
*/

/**
 *	@method			stma_openlayers
 *	@description	Momentan ist OpenLayers 6.3.1 eingebunden.
 *
 *	@returns		{null} -
 *
 *	@since			v0.0
 */
var stma_openlayers = /** @class */ (function () {
	
	function stma_openlayers(options) {
		var _this = this;
		return _this;
	}
	
	// ----------------------------------------------------------------------------------
	// Intern
	// ----------------------------------------------------------------------------------
	var projection = null;
	var map = null;
	var viewParams = null;
	
	var config = null;
	
	var tileLoadFunction = null;
	
	var overlayLayer = null;
	var overlayLayers = []; //Layer, für die das Overlay aktiviert ist.
	var overlayFunctions = []; //Funktionen der Layer, für die das Overlay aktiviert ist.

	//	@description	holt die Konfiguration in Abhängigkeit des EPSG-Codes von unserem Internetserver ab.
	//
	//	@since			v0.0
	var _getConfig = function() {
		var _self = this;
		if (config == null) {
			$.ajax({
				method: "POST",
				url: "https://gis5.stuttgart.de/geoline/geoline.config/config.aspx",
				data: {
					v: "@version@",
					epsg: projection,
					url: location.href
				},
				dataType: "json",
				async: false,
				cache: false,
				success: function (_data) {
					
					_data.ags_hosts = $.map(_data.ags_services, function(item){
						return item.ags_host;
					});
					
					config = _data;
				},
				error: function (xhr, status) {
					console.error("OHOH", xhr, status);
				}
			});
		}
		return config;
	}
	
	//	@description	fügt einen EsriLayer hinzu. (gecacht + dynamisch)
	//
	//	@argument		_url {String}
	//					URL zum AGS-Dienst
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v0.0
	var _addEsriLayer = function(_url, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;
		
		//Infos zu dem AGS Kartendienst ermitteln
		$.ajax({
			url: _url + "?f=json",
			type: "POST",
			dataType: "jsonp",
			success: function (ags_info) {
				//console.info(_url, ags_info);
				
				try {
					
					if (typeof(ags_info.error) != "undefined") {
						console.warn("Eigenschaften des Kartendienstes " + _url + " konnten nicht abgerufen werden.", ags_info.error);
						return;
					}
					
					//Copyright
					var url = new URL(_url);
					if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
						if (ags_info.copyrightText == null || ags_info.copyrightText.length == 0) {
							ags_info.copyrightText = "© Stadtmessungsamt, LHS Stuttgart"
						}
					}
					
					//AGS Kartendienst von Esri?
					if (url.hostname.indexOf("arcgisonline.com")>-1 || url.hostname.indexOf("arcgis.com")>-1) {
						//Der Copyright-Vermerk muss immer sichtbar sein
						var _attributionControl = $.grep(map.getControls().getArray(), function(_control, i) {
							return controlAttribution.prototype.isPrototypeOf(_control);
						})[0];
						_attributionControl.setCollapsible(false);
						_attributionControl.setCollapsed(false);
					}
					
					//spatialReference korrigieren für 10.0
					if (ags_info.currentVersion == 10.05 && ags_info.spatialReference.latestWkid == null) {
						switch (ags_info.spatialReference.wkid) {
							case 102100:
								ags_info.spatialReference.latestWkid = 3857;
							break;
						}
					}
					
					//spatialReference überprüfen
					if (projection != "EPSG:" + ags_info.spatialReference.wkid  && projection != "EPSG:" + ags_info.spatialReference.latestWkid) {
						console.warn("Projektion der Karte und des Kartendienstes stimmen nicht überein. Karte: " + projection + ", Kartendienst: EPSG:", ags_info.spatialReference.wkid + " / EPSG:" + ags_info.spatialReference.latestWkid, _url);
					}
					
					//Ist es ein gecachter Dienst?
					if (ags_info.singleFusedMapCache == true) {
						//-> gecachter Dienst hinzufügen
						_initCachedLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction);
					} else {
						//-> dynamischer Dienst hinzufügen
						_initDynamicLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction);
					}
					
				} catch (e) {
					console.error("Fehler beim Initalisieren des Layers " + _url, e);
				}
			},
			error: function (xhr, status) {
				console.error("OHOH", xhr, status);
			}
		});
	}
	
	//	@description	fügt einen EsriLayer hinzu. (gecacht)
	//
	//	@argument		_url {String}
	//					URL zum AGS-Dienst
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html
	//
	//	@argument		ags_info {object}
	//					JSON-Objekt mit den Karteneigenschaften (von ../MapServer?f=json)
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v0.0
	var _initCachedLayer = function (_url, _layerParams, _sourceParams, ags_info, _callbackFunction) {
		var _self = this;
		
		var resolutions = [];
		$.each(ags_info.tileInfo.lods, function(i, lod) {
			resolutions.push(lod.resolution);
		});

		var params =  {
			origin: [ags_info.tileInfo.origin.x, ags_info.tileInfo.origin.y],
			extent: [ags_info.fullExtent.xmin, ags_info.fullExtent.ymin, ags_info.fullExtent.xmax, ags_info.fullExtent.ymax],
			minZoom: 0,
			resolutions: resolutions,
			tileSize: [ags_info.tileInfo.rows, ags_info.tileInfo.cols]
		};
		var tileGrid = new TileGrid(params);
		
		//View konfigurieren, falls diese noch nicht konfiguriert wurde
		if (map.getView().getProjection().getCode() != projection) {
			$.extend(true, viewParams, { resolutions: resolutions, constrainResolution: true} );
			map.setView(new View(viewParams));
		}
		
		//Projektion ermitteln
		var projection;
		if (ags_info.spatialReference.latestWkid != null) {
			projection = ags_info.spatialReference.latestWkid;
		} else {
			projection = ags_info.spatialReference.wkid;
		}
		
		//sourceParams
		var sourceParams = {
			minZoom: '0'
		};
	  
		//ToDo: XYZ-Dienst vorsehen? Anderer Server + Instanz?
		//diese Parameter können nicht überdefiniert werden.
		var predefinedSourceParams = {
			tileGrid: tileGrid,
			projection: getProjection("EPSG:" + projection),
			attributions: ags_info.copyrightText,
			url: _url + '/tile/{z}/{y}/{x}'
		};
		
		if (tileLoadFunction != null) {
			predefinedSourceParams.tileLoadFunction = tileLoadFunction;
		}
		$.extend(true, sourceParams, _sourceParams, predefinedSourceParams);
		
		var _zIndex = 10;
		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
			_zIndex = 20;
		}
		
		//layerParams
		var layerParams = {
			zIndex: _zIndex
		};
	  
		//diese Parameter können nicht überdefiniert werden.
		var predefinedLayerParams = {
			source: new sourceXYZ(sourceParams)
		};
		$.extend(true, layerParams, _layerParams, predefinedLayerParams);
		
		//gecachten Layer erstellen
		var layer = new layerTile(layerParams);
		
		//Layer hinzufügen
		map.addLayer(layer);
		
		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(layer);
		}
	}

	//	@description	fügt einen EsriLayer hinzu. (dynamisch)
	//
	//	@argument		_url {String}
	//					URL zum AGS-Dienst
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html
	//
	//	@argument		ags_info {object}
	//					JSON-Objekt mit den Karteneigenschaften (von ../MapServer?f=json)
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v0.0
	var _initDynamicLayer = function (_url, _layerParams, _sourceParams, ags_info, _callbackFunction) {
		var _self = this;
		
		//sourceParams
		var sourceParams = {
			params: {layers: 'show:0'}
		};
	  
		//diese Parameter können nicht überdefiniert werden.
		var predefinedSourceParams = {
			ratio: 1,
			url: _url,
			attributions: [ags_info.copyrightText]
		};
		$.extend(true, sourceParams, _sourceParams, predefinedSourceParams);
		
		//layerParams
		var _zIndex = 40;
		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
			_zIndex = 50;
		}
		
		//layerParams
		var layerParams = {
			zIndex: _zIndex //damit liegen die dynamischen Dienste über den gecachten Diensten (wenn nicht überkonfiguriert wird)
		};
	  
		//diese Parameter können nicht überdefiniert werden.
		var predefinedLayerParams = {
			source: new sourceImageArcGISRest(sourceParams)
		};
		$.extend(true, layerParams, _layerParams, predefinedLayerParams);
		
		//dynamischen Layer erstellen
		var layer = new layerImage(layerParams);
		//Layer hinzufügen
		map.addLayer(layer);
		
		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(layer);
		}
	}
	
	// ----------------------------------------------------------------------------------
	// Public
	// ----------------------------------------------------------------------------------
	
	/**
	 *	@method			initMap
	 *	@description	initialisiert die Karte
	 *					Beispiel:
	 *					mymap = new stma_openlayers();
	 *					mymap.initMap(25832, {}, {});
	 *
	 *	@argument		_epsgCode {int} EPSG-Code des Koordinatensystems.
	 *					Unterstütze Werte sind: 25832, 3857
						Siehe auch: http://epsg.io/25832, http://epsg.io/3857 
	 *					
	 *	@argument		_mapParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Map-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_Map-Map.html
	 *
	 *	@argument		_viewParams {object}
	 *					zusätzliche Parameter für das OpenLayer-View-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_View-View.html
	 *
	 *	@argument		_customParams {object}
	 *					zusätzliche Parameter für geoline.ol.js
	 *					Unterstützte Parameter:
	 *					-tileLoadFunction: Optionale Funktion, die bei gecachten Kartendiensten ausgeführt wird, um eine Kachel zu laden.
	 *						Beispiel: { tileLoadFunction: function(imageTile, src) { imageTile.getImage().src = src;}}
	 *						Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_XYZ-XYZ.html
	 *
	 *					-config: Hier kann das Konfigurationsobjekt, das normalerweise direkt vom Server des Stadtmessungsamtes geladen wird überschrieben werden.
	 *						Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel für die Offlineverfügbarkeit in Apps.
	 *						Wird diese Funktion verwendet, so muss sichergestellt werden, dass die übergebene Konfiguration aktuell ist.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.initMap = function(_epsgCode, _mapParams, _viewParams, _customParams) {
		var _self = this;
		
		//(25832)UTM-Projektion zu den Projektionen von OpenLayers hinzufügen
		proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
		register(proj4);
		
		//(31467)GK-Projektion zu den Projektionen von OpenLayers hinzufügen
		proj4.defs("EPSG:31467", "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs");
		register(proj4);
	
		//Projektion definieren
		projection = "EPSG:" + _epsgCode;
		if (getProjection(projection) == null) {
			console.error("Projektion " + projection + " nicht gefunden. Es kann zu falscher Darstellung der Karte kommen");
		}
		
		//zusätzliche Parameter für geoline.ol.js hinzufügen
		if (_customParams != null && _customParams.tileLoadFunction != null) {
			tileLoadFunction = _customParams.tileLoadFunction;
		}
		if (_customParams != null && _customParams.config != null) {
			console.warn("Konfiguration wurde manuell gesetzt und wird nicht vom Server des Stadtmessungamtes geladen. Bitte stellen Sie sicher, dass die Konfiguration immer aktuell ist.");
			config = _customParams.config;
		}
		
		//Karte initialisieren
		var mapParams = {
			target: "map",
			controls: defaultControls({
				attribution: true,
				attributionOptions: {
					tipLabel: "Copyright"
				}
			})
		};
	  
		//diese Parameter können nicht überdefiniert werden.
		//Sie dürfen nicht geändert werden, da es sonst ggf. zu Problemen bei der Darstellung der Stadtmessungsamt-Kartendienste kommen kann.
		var predefinedMapParams = {
			logo: false,
			pixelRatio: 1, //wichtige Einstellung für unsere Kartendienste!
			loadTilesWhileAnimating: true, //Kacheln während des Zoomens nachladen
			loadTilesWhileInteracting: true //Kacheln während des Panens nachladen
		};
		$.extend(true, mapParams, _mapParams, predefinedMapParams);
		
		//Sicherstellen, dass der Attribution-Control vorhanden ist.
		//Dieser muss vorhanden sein, wenn Karten von ESRI genutzt werden.
		if (mapParams.controls != null) {
			var _attributionControlAvailable = false;
			mapParams.controls.forEach(function(_control, i) {
				if (controlAttribution.prototype.isPrototypeOf(_control)) {
					_attributionControlAvailable = true;
				}
			});
			if (_attributionControlAvailable == false) {
				//Attribution-Control hinzufügen
				mapParams.controls.push(new controlAttribution({
					tipLabel: "Copyright"
				}));
			}
		}
		
		//View definieren
		viewParams = $.extend(true,
			{},
			{
				center: [513785, 5402232],
				zoom: 2
			},
			_viewParams,
			{
				projection: getProjection(projection)
			}
		);
		
		//Karte definieren
		map = new Map(mapParams);
		
		//Rechtsklick auf der Karte unterbinden
		$(".ol-viewport").on("contextmenu", function(e) {
			e.preventDefault();
		});
		
		//Nach dem Start die Größe der Karte automatisch bestimmen
		map.updateSize();
	}
	
	/**
	 *	@method			addEsriLayer
	 *	@description	fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) hinzu.
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					10:	gecacht
	 *					20: gecacht - Kartendienst des Stadtmessungsamtes
	 *					40: dynamisch
	 *					50: dynamisch - Kartendienst des Stadtmessungsamtes
	 *					
	 *					Beispiel:
	 *					mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");
	 *
	 *	@argument		_url {String} URL des Kartendienstes
	 *					Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaEsriLayer hinzugefügt werden.
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addEsriLayer = function(_url, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;
		
		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
			console.error("Kartendienste des Stadtmessungsamtes über die Methode addStmaEsriLayer hinzufügen");
		} else {
			_addEsriLayer(_url, _layerParams, _sourceParams, _callbackFunction);
		}
	}
	
	/**
	 *	@method			addStmaEsriLayer
	 *	@description	fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) des Stadtmessungsamtes hinzu.
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					10:	gecacht
	 *					20: gecacht - Kartendienst des Stadtmessungsamtes
	 *					40: dynamisch
	 *					50: dynamisch - Kartendienst des Stadtmessungsamtes
	 *					
	 *					Beispiel:
	 *					mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c");
	 *
	 *	@argument		_mapservice {String} Bezeichnung des Kartendienstes
	 *					Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
	 *					so sollte ORDNER/KARTENDIENST angegeben werden.
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addStmaEsriLayer = function(_mapservice, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;
		
		_addEsriLayer("https://" + _getConfig().ags_host + "/" + _getConfig().ags_instance + "/rest/services/" + _mapservice + "/MapServer", _layerParams, _sourceParams, _callbackFunction);
	}
	
	/**
	 *	@method			addStmaBaseLayer
	 *	@description	fügt einen Basis-Kartendienst (dynamisch / gecacht) des Stadtmessungsamtes hinzu.
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					10: gecacht
	 *					20: gecacht - Kartendienst des Stadtmessungsamtes
	 *					40: dynamisch
	 *					50: dynamisch - Kartendienst des Stadtmessungsamtes
	 *					
	 *					Beispiel:
	 *					mymap.addStmaBaseLayer("Grundkarte");
	 *					mymap.addStmaBaseLayer("Luftbild");
	 *
	 *	@argument		_mapname {String} sprechende Bezeichnung des Kartendienstes
	 *					Für ausgewählte Basiskartendienste kann hierüber über eine sprechende Bezeichnung der Kartendienst hinzugefügt werden.
	 *					Eventuelle Kartendienstnamenänderungen werden automatisch von der API berücksichtigt.
	 *					Deswegen sollten die Basiskarten (Grundkarte, Luftbild, ..) immer über diese Funktion eingebundne werden.
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addStmaBaseLayer = function(_mapname, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;
		
		if (_getConfig().ags_services[_mapname] != null) {
			_addEsriLayer("https://" + _getConfig().ags_services[_mapname].ags_host + "/" + _getConfig().ags_services[_mapname].ags_instance + "/rest/services/" + _getConfig().ags_services[_mapname].ags_service + "/MapServer", _layerParams, _sourceParams, _callbackFunction);
		} else {
			console.error("Karte '" + _mapname + "' nicht gefunden");
		}
	}
	
	/**
	 *	@method			addPoints
	 *	@description	fügt einzelne Punkte hinzu.
	 *					Wenn nichts anderes angegeben ist, dann gilt der zIndex 60.
	 *					
	 *					Beispiel:
	 *					mymap.addPoints([[3513223, 5405026]], "images/target.png");
	 *
	 *	@argument		_pointCoords {Array} Array von Koordinatenpaaren
	 *					[ [x,y], [x,y], ... ]
	 *
	 *	@argument		_imageURL {String} URL zu dem Bild des Punktes / Data-URL des Bildes
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addPoints = function(_pointCoords, _imageURL, _callbackFunction) {
		
		var features = [];
		for (var i=0; i < _pointCoords.length; i++) {
			features.push(new Feature({
				geometry: new geomPoint(_pointCoords[i])
			}));
		}

		var vectorLayer = new layerVector({
			zIndex: 60,
			source: new sourceVector({
				features: features
			}),
			style: new styleStyle({
				image: new styleIcon({
					anchor: [0.5, 1],
					src: _imageURL
				})
			})
		});
		map.addLayer(vectorLayer);
		
		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(vectorLayer);
		}
	}
	
	/**
	 *	@method			addGeoJSONfromURL
	 *	@description	fügt Objekte aus einem geoJSON hinzu. Das geoJSON ist über eine URL erreichbar.
	 *					
	 *					Beispiel:
	 *					mymap.addGeoJSONfromURL("examples/example.geojson");
	 *
	 *	@argument		_url {String} URL zur geoJSON-Datei
	 *
	 *	@argument		_style {object} (optional) Ausprägungs-Details
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_style_Style-Style.html
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben. Der Funktion wird false übergeben, wenn das GeoJSON
	 *					nicht abgerufen werden konnte.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.0
	 */
	stma_openlayers.prototype.addGeoJSONfromURL = function(_url, _zoomTo, _style, _callbackFunction) {
		$.getJSON(_url, $.proxy(function(_geojson) {
			this.addGeoJSON(_geojson, _zoomTo, _style, _callbackFunction);
		}, this)).fail(function(_error) {
			console.error( "JSON konnte von URL ", _url, " nicht abgerufen werden.", _error);
			
			//Callbackfunktion ausführen
			if (typeof _callbackFunction == "function") {
				_callbackFunction(false);
			}
		});
	}
	
	/**
	 *	@method			addGeoJSON
	 *	@description	fügt Objekte aus einem geoJSON hinzu.
	 *					
	 *					Beispiel:
	 *					mymap.addGeoJSON(_geojson);
	 *
	 *	@argument		_geojson {object} GeoJSON-Objekt
	 *
	 *	@argument		_style {object} (optional) Ausprägungs-Details
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_style_Style-Style.html
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.0
	 */
	stma_openlayers.prototype.addGeoJSON = function(_geojson, _zoomTo, _style, _callbackFunction) {

		var _projectionGeoJSON = "EPSG:4326";
		//Wurde das Koordinatensystem angegeben?
		if ("crs" in _geojson) {
			if ("properties" in _geojson.crs) {
				if ("name" in _geojson.crs.properties) {
					_projectionGeoJSON = _geojson.crs.properties.name;
				}
			}
		}
		
		//Bei urn:ogc:def:crs:OGC:1.3:CRS84 wird unter Verwendung von UTM(EPSG:25832) nicht korrekt transformiert.
		if (_projectionGeoJSON == "urn:ogc:def:crs:OGC:1.3:CRS84") {
			_projectionGeoJSON = "EPSG:4326";
		}
		
		if (getProjection(_projectionGeoJSON) == null) {
			console.error("Projektion " + _projectionGeoJSON + " nicht gefunden. Es kann zu falscher Darstellung der Karte kommen");
		}

		var _geojsonFormat = new formatGeoJSON({
			dataProjection: _projectionGeoJSON,
			featureProjection: projection
		})
		
		var _vectorSource = new sourceVector({
			features: _geojsonFormat.readFeatures(_geojson)
		});
		
		var vectorLayer = new layerVector({
			zIndex: 60,
			source: _vectorSource,
			style: _style
		});
		
		map.addLayer(vectorLayer);
		
		if (_zoomTo == true) {
			//warte bis View bereit ist.
			var zoomToInterval = window.setInterval(function() {
				if (map.getView().getZoom() != "undefined") {
					clearInterval(zoomToInterval);
					map.getView().fit(_vectorSource.getExtent());
				}
			}, 500);
		}
		
		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(vectorLayer);
		}
	}
	
	/**
	 *	@method			addOverlayForLayer
	 *	@description	Bietet die Möglichkeit an für einen Layer ein Overlay hinzuzufügen.
	 *					
	 *					Beispiel:
	 *					mymap.addOverlayForLayer(_layer, _overlayFunction);
	 *
	 *	@argument		_layer {object} Das Layerobjekt
	 *
	 *	@argument		_overlayFunction {function}
	 *					Funktion, die bei einem Klick auf das Objekt ausgeführt wird.
	 *					Die Funktion muss den HTML-Inhalt für ein Overlay-Fenster zurückgeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v1.2
	 */
	stma_openlayers.prototype.addOverlayForLayer = function(_layer, _overlayFunction) {
		
		//globaler Overlay-Layer hinzufügen
		if (overlayLayer == null) {
			if ($(map.getTargetElement()).find("#geoline_ol_js_popup").length == 0) {
				//Element für Overlay definieren
				$(map.getTargetElement()).append("<div id='geoline_ol_js_popup'/>");
			}
			var _overlayDIV = $(map.getTargetElement()).find("#geoline_ol_js_popup").get(0);
			
			overlayLayer = new Overlay({
				element: _overlayDIV,
			});
			map.addOverlay(overlayLayer);
			
			map.on('click', function (evt) {
				var featuredata = map.forEachFeatureAtPixel(
					evt.pixel,
					function (_feature, _layer) {
						return {
							"feature": _feature,
							"layer": _layer
						};
					},
					{
						layerFilter: function(_layerCandidate) {
							//Filter, damit nur die Features gefunden werden, für die auch der Overlay aktiviert wurde.
							if (overlayLayers.includes(_layerCandidate)) {
								return true;
							} else {
								return false;
							}
						}
					}
				);
				if (featuredata) {
					var _overlayFunction = overlayFunctions[overlayLayers.indexOf(featuredata.layer)];
					
					$(overlayLayer.getElement()).html(
						'<div class="arrow"></div>' + 
						'<div class="content">' + _overlayFunction(featuredata.feature) + '</div>'
					);
			
					overlayLayer.setPosition(evt.coordinate);
					$(_overlayDIV).show();
					
					var _transform = "translate3d(-" + $(_overlayDIV).width()/2 + "px, calc(-" + $(_overlayDIV).height() + "px - 0.5rem), 0px)";
					$(_overlayDIV).css("transform", _transform);
				} else {
					$(_overlayDIV).hide();
				}
			});
		}
		
		//Füge Layer zu den Layern hinzu, für die das Overlay aktiviert ist.
		if (!overlayLayers.includes(_layer)) {
			overlayLayers.push(_layer);
			overlayFunctions[overlayLayers.indexOf(_layer)] = _overlayFunction;
		}
	}
	
	/**
	 *	@method			addStmaEsriFeatureLayer
	 *	@description	fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) des Stadtmessungsamtes hinzu.
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					10:	gecacht
	 *					20: gecacht - Kartendienst des Stadtmessungsamtes
	 *					40: dynamisch
	 *					50: dynamisch - Kartendienst des Stadtmessungsamtes
	 *					
	 *					Beispiel:
	 *					mymap.addStmaEsriFeatureLayer("1_Base/Stadtkarte_Internet_c");
	 *
	 *	@argument		_mapservice {String} Bezeichnung des Kartendienstes
	 *					Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
	 *					so sollte ORDNER/KARTENDIENST angegeben werden.
	 *
	 *	@argument		_layerId {Integer} LayerId im Kartendienst
	 *					Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer/LAYERID heißt,
	 *					so sollte LAYERID angegeben werden.
	 *
	 *	@argument		_styleFunction {function}
	 *					Funktion, wie die Objekte aussehen sollen. Der Funktion wird als 1. Parameter das feature-Objekt (ol.Feature) übergeben.
	 *					Mit Hilfe von z.B. feature.get('activeprod') könnte dann der Inhalt des Attributes 'activeprod' abgerufen werden und in Abhängigkeit
	 *					von ihm unterschiedliche Stile angegeben werden.
	 *					Rückgabe der Funktion muss ein ol.style.Style-Objekt sein.
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_style_Style-Style.html
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.86
	 */
	stma_openlayers.prototype.addStmaEsriFeatureLayer = function(_mapservice, _layerId, _styleFunction, _callbackFunction) {
		var _self = this;
		
		var _epsgCode = projection.replace("EPSG:", "");
		
		var _esrijsonFormat = new formatEsriJSON();
		
		var vectorSource = new sourceVector({
			loader: function(_extent, _resolution, _projection) {
				var _url = "https://" + _getConfig().ags_host + "/" + _getConfig().ags_instance + "/rest/services/" + _mapservice + "/MapServer/" + _layerId + "/query/";
				
				var _urlParams = {
					"f": "json",
					"returnGeometry": true,
					"spatialRel": "esriSpatialRelIntersects",
					"geometry":  encodeURIComponent('{"xmin":' + _extent[0] + ',"ymin":' + _extent[1] + ',"xmax":' + _extent[2] + ',"ymax":' + _extent[3] + ',"spatialReference":{"wkid":' + _epsgCode + '}}'),
					"geometryType": "esriGeometryEnvelope",
					"inSR": _epsgCode,
					"outFields": "*",
					"outSR": _epsgCode
				};
				
				$.ajax({
					method: "POST",
					url: _url,
					data: _urlParams,
					dataType: 'jsonp',
					success: function(_response) {
						if (_response.error) {
							alert(_response.error.message + '\n' + _response.error.details.join('\n'));
						} else {
							var features = _esrijsonFormat.readFeatures(_response, {
								featureProjection: _projection
							});
							if (features.length > 0) {
								vectorSource.addFeatures(features);
							}
						}
					}
				});
			},
			strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
				tileSize: 512
			}))
		});

		var vectorLayer = new layerVector({
			zIndex: 60,
			source: vectorSource,
			style: _styleFunction
		});
		
		map.addLayer(vectorLayer);
		
		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(vectorLayer);
		}
	}
	
	/**
	 *	@method			getMap
	 *	@description	gibt das OpenLayer-Map-Objekt zurück.
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_Map-Map.html
	 *
	 *	@returns		{object} ol.Map
	 *					Siehe https://openlayers.org/en/v6.3.1/apidoc/module-ol_Map-Map.html
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.getMap = function() {
		return map;
	}
	
	/**
	 *	@method			getConfig
	 *	@description	gibt die interne Konfiguration von geoline.ol.js zurück.
	 *					Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel zum Ermitteln der Konfiguration für die Offlineverfügbarkeit in Apps.
	 *
	 *	@returns		{object}
	 *
	 *	@since			v1.0
	 */
	stma_openlayers.prototype.getConfig = function() {
		return _getConfig();
	}
	
	return stma_openlayers;
}());
export default stma_openlayers;