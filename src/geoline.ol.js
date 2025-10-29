/**
 * @module StmaOpenLayers
 */

import './geoline.ol.css';

import Feature from "ol/Feature.js";
import Map from "ol/Map.js";
import Overlay from "ol/Overlay.js";
import TileGrid from "ol/tilegrid/TileGrid.js";
import View from "ol/View.js";
import ControlAttribution from "ol/control/Attribution.js";
import FormatEsriJSON from "ol/format/EsriJSON.js";
import FormatGeoJSON from "ol/format/GeoJSON.js";
import FormatWMTSCapabilities from "ol/format/WMTSCapabilities.js";
import GeomPoint from "ol/geom/Point.js";
import LayerImage from "ol/layer/Image.js";
import LayerTile from "ol/layer/Tile.js";
import LayerVector from "ol/layer/Vector.js";
import SourceImageArcGISRest from "ol/source/ImageArcGISRest.js";
import SourceImageWMS from "ol/source/ImageWMS.js";
import SourceTileWMS from 'ol/source/TileWMS.js';
import SourceVector from "ol/source/Vector.js";
import SourceXYZ from "ol/source/XYZ.js";
import SourceWMTS, {optionsFromCapabilities as sourceWMTS_optionsFromCapabilities} from 'ol/source/WMTS.js';
import StyleIcon from "ol/style/Icon.js";
import StyleStyle from "ol/style/Style.js";
import {defaults as defaultControls} from 'ol/control.js';
import {tile as tileLoadingStrategy} from 'ol/loadingstrategy.js';
import {createXYZ} from 'ol/tilegrid.js';
import {get as getProjection} from "ol/proj.js";
import {register} from 'ol/proj/proj4.js';

import proj4 from "proj4";
import jsonp from "jsonp";

/**
 * @typedef {Object} AGSSpatialReference
 * @property {number} [wkid]
 * @property {number} [latestWkid]
 */

/**
 * @typedef {Object} AGSTileInfoLOD
 * @property {number} level
 * @property {number} resolution
 * @property {number} scale
 */

/**
 * @typedef {Object} AGSTileInfo
 * @property {{x:number,y:number}} origin
 * @property {number} rows
 * @property {number} cols
 * @property {Array<AGSTileInfoLOD>} lods
 */

/**
 * @typedef {Object} AGSExtent
 * @property {number} xmin
 * @property {number} ymin
 * @property {number} xmax
 * @property {number} ymax
 */

/**
 * @typedef {Object} AGSInfo
 * @property {number} [currentVersion]
 * @property {boolean} [singleFusedMapCache]
 * @property {AGSTileInfo} [tileInfo]
 * @property {AGSExtent} [fullExtent]
 * @property {AGSSpatialReference} [spatialReference]
 * @property {string} [copyrightText]
 * @property {{code:number,message:string}} [error]
 */

/**
 * @typedef {Object} AGSServiceEntry
 * @property {string} ags_host
 * @property {string} ags_instance
 * @property {string} ags_service
 * @property {string} service
 * @property {boolean} [tiled]
 * @property {Object.<string, string|number|boolean>} [params]
 */

/**
 * @typedef {Object} WMTSServiceEntry
 * @property {string} host
 * @property {string} instance
 * @property {string} service
 * @property {string} matrix
 * @property {Object.<string, string|number|boolean>} [params]
 */

/**
 * @typedef {Object} WMSServiceEntry
 * @property {string} host
 * @property {string} instance
 * @property {string} service
 * @property {boolean} [tiled]
 * @property {Object.<string, string|number|boolean>} [params]
 */

/**
 * @typedef {Object} GeolineConfig
 * @property {string} [ags_host]
 * @property {string} [ags_instance]
 * @property {string} [ags_service]
 * @property {string} [wmts_host]
 * @property {string} [wmts_instance]
 * @property {string} [wmts_matrix]
 * @property {string} [wms_host]
 * @property {string} [wms_instance]
 * @property {boolean} [wms_tiled]
 * @property {Array<string>} [ags_hosts]
 * @property {Array<string>} [wmts_hosts]
 * @property {Array<string>} [wms_hosts]
 * @property {Object.<string, AGSServiceEntry>|Array<AGSServiceEntry>} [ags_services]
 * @property {Object.<string, WMTSServiceEntry>|Array<WMTSServiceEntry>} [wmts_services]
 * @property {Object.<string, WMSServiceEntry>|Array<WMSServiceEntry>} [wms_services]
 */

class StmaOpenLayers {

    /** @type {GeolineConfig|null} */
    config = null;
    configUrl = null;
    configPromise = null;
    viewParams = null;
    tileLoadFunction = null;
    map = null;
    projection = null;
    overlayLayer = null;
    overlayLayers = []; //Layer, für die das Overlay aktiviert ist.
    overlayFunctions = []; //Funktionen der Layer, für die das Overlay aktiviert ist.


    /**
     * Konstruktor
     *
     * @param       {string} _configUrl Basis-URL für den Abruf der Geoline-Basiskonfiguration. Wird als vorbelegter Parameter verwendet.
     *
     * @returns     {StmaOpenLayers}
     */
    constructor(_configUrl = "https://gis5.stuttgart.de/geoline/geoline.config/config.aspx") {
        this.configUrl = _configUrl;
        return this;
    }


    /**
     * Lädt die Konfiguration asynchron und cached das Ergebnis in einer Promise
     *
     * @returns     {Promise<GeolineConfig>}
     */
    _fetchConfig() {
        if (this.config != null) {
            return Promise.resolve(this.config);
        }
        if (this.configPromise) {
            return this.configPromise;
        }
        const params = new URLSearchParams({
            v: "@version@",
            epsg: this.projection,
            url: typeof location !== 'undefined' ? location.href : ''
        }).toString();
        this.configPromise = fetch(this.configUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: params
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.status);
                }
                return response.json();
            })
            .then(_data => {
                _data.ags_hosts = Array.isArray(_data.ags_services)
                    ? _data.ags_services.map(item => item.ags_host)
                    : Object.values(_data.ags_services || {}).map(item => item.ags_host);
                _data.wmts_hosts = Array.isArray(_data.wmts_services)
                    ? _data.wmts_services.map(item => item.host)
                    : Object.values(_data.wmts_services || {}).map(item => item.host);
                _data.wms_hosts = Array.isArray(_data.wms_services)
                    ? _data.wms_services.map(item => item.host)
                    : Object.values(_data.wms_services || {}).map(item => item.host);
                this.config = _data;
                return this.config;
            })
            .catch(err => {
                console.error("Konfiguration (geoline.config) konnte nicht geladen werden", err);
                // Fehler weiterreichen, aber Promise für spätere erneute Versuche zurücksetzen
                this.configPromise = null;
                throw err;
            });
        return this.configPromise;
    }

    /**
     * @returns     {GeolineConfig}
     * */
    _getConfig() {
        // Nicht mehr blockieren: Startet den asynchronen Ladevorgang, falls nötig
        if (this.config == null) {
            this._fetchConfig().catch(() => {
            });
        }
        // Rückgabe des aktuell bekannten Werts (oder eines Platzhalters, damit Aufrufer nicht crashen)
        return this.config || {ags_hosts: [], wmts_hosts: [], wms_hosts: []};
    }

    /**
     * JSONP with simple Promise cache to avoid duplicate network requests per URL
     * @param {string} url
     * @returns {Promise<any>}
     */
    _jsonpCached(url) {
        const cached = this.map.get(url);
        if (cached) return cached;
        const p = new Promise((resolve, reject) => {
            jsonp(url, null, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            });
        });
        this.map.set(url, p);
        return p;
    }

    /**
     * Fetch text with simple Promise cache by URL (POST by default)
     * @param {string} url
     * @param {RequestInit} [options]
     * @returns {Promise<string>}
     */
    _fetchTextCached(url, options = {method: 'POST'}) {
        const cached = this.map.get(url);
        if (cached) return cached;
        const p = fetch(url, options).then(r => {
            if (!r.ok) throw new Error('Network response was not ok: ' + r.status);
            return r.text();
        }).catch(err => {
            // On failure, drop cache to allow retry later
            this.map.delete(url);
            throw err;
        });
        this.map.set(url, p);
        return p;
    }

    /**
     * Get a cached GeoJSON format instance for a specific dataProjection.
     * The instance is created with featureProjection set to the current map projection.
     * @param {string} dataProjection
     */
    _getGeoJSONFormat(dataProjection) {
        const key = dataProjection + '->' + this.projection;
        let fmt = this.map.get(key);
        if (!fmt) {
            fmt = new FormatGeoJSON({
                dataProjection: dataProjection,
                featureProjection: this.projection
            });
            this.map.set(key, fmt);
        }
        return fmt;
    }

    /**
     * @description fügt einen EsriLayer hinzu. (gecacht + dynamisch)
     *
     * @param       {string} _url URL zum AGS-Dienst
     *
     * @param       {Object} _layerParams zusätzliche Parameter für das OpenLayer-Layer-Objekt
     *
     * @param       {Object} _sourceParams zusätzliche Parameter für das OpenLayer-Source-Objekt
     *
     * @param       {Function} _callbackFunction Funktion, die nach dem Hinzufügen des Layers ausgeführt wird
     *
     * @since       v0.0
     */
    _addEsriLayer(_url, _layerParams, _sourceParams, _callbackFunction) {
        this._jsonpCached(_url + "?f=json")
            .then((/** @type {AGSInfo} */ ags_info) => {
                try {
                    if (ags_info.error !== undefined) {
                        console.warn("Eigenschaften des Kartendienstes " + _url + " konnten nicht abgerufen werden.", ags_info.error);
                        return;
                    }

                    //Copyright
                    const url = new URL(_url);
                    if (((this._getConfig().ags_hosts) || []).includes(url.hostname)) {
                        if (ags_info.copyrightText == null || ags_info.copyrightText.length === 0) {
                            ags_info.copyrightText = "© Stadtmessungsamt, LHS Stuttgart"
                        }
                    }

                    //AGS Kartendienst von Esri?
                    if (url.hostname.indexOf("arcgisonline.com") > -1 || url.hostname.indexOf("arcgis.com") > -1) {
                        //Der Copyright-Vermerk muss immer sichtbar sein
                        const _attributionControl = this.map.getControls().getArray().filter(function (_control) {
                            return (_control instanceof ControlAttribution);
                        })[0];
                        _attributionControl.setCollapsible(false);
                        _attributionControl.setCollapsed(false);
                    }

                    //spatialReference korrigieren für 10.0
                    if (ags_info.currentVersion === 10.05 && ags_info.spatialReference.latestWkid == null) {
                        switch (ags_info.spatialReference.wkid) {
                            case 102100:
                                ags_info.spatialReference.latestWkid = 3857;
                                break;
                        }
                    }

                    //spatialReference überprüfen
                    if (this.projection !== "EPSG:" + ags_info.spatialReference.wkid && this.projection !== "EPSG:" + ags_info.spatialReference.latestWkid) {
                        console.warn("Projektion der Karte und des Kartendienstes stimmen nicht überein. Karte: " + this.projection + ", Kartendienst: EPSG:", ags_info.spatialReference.wkid + " / EPSG:" + ags_info.spatialReference.latestWkid, _url);
                    }

                    //Ist es ein gecachter Dienst?
                    if (ags_info.singleFusedMapCache === true) {
                        //-> gecachter Dienst hinzufügen
                        this._initCachedLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction);
                    } else {
                        //-> dynamischer Dienst hinzufügen
                        this._initDynamicLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction);
                    }
                } catch (e) {
                    console.error("Fehler beim Initalisieren des Layers " + _url, e);
                }
            })
            .catch(err => {
                console.error("Fehler beim Abrufen der Informationen des AGS-Diensts", err);
            });

    }

    /**
     * @description    fügt einen gecachten WMTS-Kartendienst hinzu.
     *
     * @param          {String} _url GetCapabilities-URL zum WMTS
     *
     * @param          {String} _layerName Name des Layers, der eingebunden werden soll
     *
     * @param          {object} _layerParams zusätzliche Parameter für das OpenLayer-Layer-Objekt
     *
     * @param          {object} _sourceParams zusätzliche Parameter für das OpenLayer-Source-Objekt
     *
     * @param          {function} _callbackFunction Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen
     *                 des Layers ausgeführt wird. Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     * @since          v2.1
     */
    _addWMTSLayer_impl(_url, _layerName, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        const url = new URL(_url);

        this._fetchTextCached(_url, {method: 'GET'})
            .then(xml => {
                const fmt = new FormatWMTSCapabilities();
                const caps = fmt.read(xml);

                // Wenn matrixSet in _sourceParams übergeben wurde, nutzt OL das hier direkt.
                // (z.B. { matrixSet: "EU_EPSG_25832_TOPPLUS" })
                let sourceParams = sourceWMTS_optionsFromCapabilities(caps, {
                    layer: _layerName,
                    matrixSet: _sourceParams?.matrixSet,
                    style: _sourceParams?.style
                });

                if (!sourceParams) {
                    throw new Error('WMTS layer not found in capabilities: ' + _layerName);
                }

                // sensible Defaults
                if (!sourceParams.style) sourceParams.style = 'default';
                if (sourceParams.crossOrigin == null) sourceParams.crossOrigin = 'anonymous';
                if (sourceParams.wrapX == null) sourceParams.wrapX = true;

                // Layer-/View-Projektion ermitteln
                const layerProj = sourceParams.projection || getProjection(this.projection);
                const view = this.map.getView();
                const viewProj = view?.getProjection?.() || getProjection(this.projection);

                // *** Wichtig: WMTS kann nicht reprojiziert werden → bei Mismatch überspringen ***
                const sameProj = layerProj?.getCode?.() === viewProj?.getCode?.();
                if (!sameProj) {
                    console.error(
                        "[WMTS] Projection mismatch – map:", viewProj?.getCode?.(),
                        "layer:", layerProj?.getCode?.(),
                        "→ WMTS wird übersprungen (kein Reprojection-Support)."
                    );
                    if (typeof _callbackFunction === 'function') _callbackFunction(false);
                    return;
                }

                // --- origin fix NUR für WebMercatorQuad ---
                try {
                    if (sourceParams.matrixSet === 'WebMercatorQuad' && sourceParams.tileGrid) {
                        const tg = sourceParams.tileGrid;
                        const resolutions = tg.getResolutions();
                        const matrixIds = (typeof tg.getMatrixIds === 'function' && tg.getMatrixIds())
                            ? tg.getMatrixIds()
                            : resolutions.map((_, z) => String(z));

                        const extent = getProjection('EPSG:3857').getExtent();
                        const topLeft = [extent[0], extent[3]]; // minX, maxY

                        const tileSize = typeof tg.getTileSize === 'function' ? tg.getTileSize(0) : 256;
                        const WMTSGridClass = tg.constructor;

                        sourceParams.tileGrid = new WMTSGridClass({
                            origin: topLeft,
                            resolutions,
                            matrixIds,
                            tileSize
                        });
                    }
                } catch (e) {
                    console.warn('[WMTS] Origin correction skipped:', e);
                }

                // STMA-spezifisch (REST-Template, Attribution, zIndex)
                let zIndex = 10;
                const predefined = {};
                if (((this._getConfig().wmts_hosts) || []).includes(url.hostname)) {
                    predefined.urls = [
                        url.origin + url.pathname +
                        "/rest/" + _layerName + "/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}?format=image/png"
                    ];
                    predefined.requestEncoding = 'REST';
                    predefined.attributions = '© Stadtmessungsamt, LHS Stuttgart';
                    zIndex = 20;
                }

                // finale Source-Parameter (User-Params zuletzt, aber Projektion unverändert lassen)
                sourceParams = {
                    ...sourceParams,
                    ...predefined,
                    ..._sourceParams,
                    projection: layerProj
                };

                // Layer bauen
                const layer = new LayerTile({
                    zIndex,
                    ..._layerParams,
                    source: new SourceWMTS(sourceParams)
                });

                // View NICHT auf andere Projektion umstellen – nur Resolutions anpassen
                const resolutions = sourceParams.tileGrid.getResolutions();
                const center = view.getCenter() ?? this.viewParams?.center;
                const zoom = view.getZoom() ?? this.viewParams?.zoom;

                this.map.setView(new View({
                    ...this.viewParams,
                    center,
                    zoom,
                    projection: viewProj,           // unverändert lassen
                    resolutions,
                    constrainResolution: true
                }));

                this.map.addLayer(layer);

                //Callbackfunktion ausführen
                if (typeof _callbackFunction == "function") {
                    _callbackFunction(layer);
                }
            })
            .catch(err => console.error('Fehler beim Abrufen der WMTS-GetCapabilities', err));
    }

    /**
     * @description     fügt einen dynamischen WMS-Kartendienst hinzu.
     *                  Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
     *                  da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
     *                  abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
     *                  abgeschnitten oder mehrfach im Kartenbild enthalten sind.
     *                  Zum gekachelten Abruf muss als _sourceParams { "TILED": true } übergeben werden.
     *
     * @param           {String} _url URL zum WMS
     *
     * @param           {String} _layerName Name des Layers, der eingebunden werden soll
     *
     * @param           {object} _layerParams zusätzliche Parameter für das OpenLayer-Layer-Objekt
     *
     * @param           {object} _sourceParams zusätzliche Parameter für das OpenLayer-Source-Objekt
     *
     * @param           {function} _callbackFunction Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                  Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     * @returns         {void}
     *
     * @since           v2.1
     */
    _addWMSLayer(_url, _layerName, _layerParams, _sourceParams, _callbackFunction) {

        //diese Parameter können nicht überdefiniert werden.
        const predefinedSourceParams = {
            ratio: 1
        };

        const url = new URL(_url);
        if (((this._getConfig().wms_hosts) || []).includes(url.hostname)) {
            //Copyrighthinweis
            predefinedSourceParams.attributions = "© Stadtmessungsamt, LHS Stuttgart";
        }

        let sourceParams = {
            ...{
                url: _url,
                params: {"LAYERS": _layerName}
            },
            ..._sourceParams,
            ...predefinedSourceParams
        };
        // Beim Zusammenführen von WMS-Diensten kann es vorkommen, dass der Layername nicht immer im Parameter "LAYERS" enthalten ist.
        sourceParams.params.LAYERS = _layerName;

        //Der Layer kann gekachelt oder als ganzes Bild abgerufen werden.
        let layer;
        if (sourceParams.TILED === true) {
            //gekachelter Abruf = gecacht

            let _zIndex = 10;
            //anderer zIndex für Stadtmessungsamt-Kartendienste
            if (((this._getConfig().wms_hosts) || []).includes(url.hostname)) {
                _zIndex = 20;
            }

            //layerParams
            let layerParams = {
                zIndex: _zIndex
            };

            //diese Parameter können nicht überdefiniert werden.
            let predefinedLayerParams = {
                source: new SourceTileWMS(sourceParams)
            };
            layerParams = {
                ...layerParams,
                ..._layerParams,
                ...predefinedLayerParams
            };

            //Layer erstellen
            layer = new LayerTile(layerParams);

        } else {
            //Abruf als ein Bild = dynamisch

            let _zIndex = 40;
            //anderer zIndex für Stadtmessungsamt-Kartendienste
            if (((this._getConfig().wms_hosts) || []).includes(url.hostname)) {
                _zIndex = 50;
            }

            //layerParams
            let layerParams = {
                zIndex: _zIndex
            };

            //diese Parameter können nicht überdefiniert werden.
            let predefinedLayerParams = {
                source: new SourceImageWMS(sourceParams)
            };
            layerParams = {
                ...layerParams,
                ..._layerParams,
                ...predefinedLayerParams
            };

            //Layer erstellen
            layer = new LayerImage(layerParams);
        }

        //View konfigurieren, falls diese noch nicht konfiguriert wurde
        if (this.map.getView().getProjection().getCode() !== this.projection) {
            this.map.setView(new View({
                ...this.viewParams,
                ...{constrainResolution: true}
            }));
        }

        //Layer hinzufügen
        this.map.addLayer(layer);

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(layer);
        }
    }

    /**
     * @description fügt einen EsriLayer hinzu. (gecacht)
     *
     * @param       {string} _url URL zum AGS-Dienst
     *
     * @param       {Object} _layerParams zusätzliche Parameter für das OpenLayer-Layer-Objekt
     *
     * @param       {Object} _sourceParams zusätzliche Parameter für das OpenLayer-Source-Objekt
     *
     * @param       {AGSInfo} ags_info JSON-Objekt mit den Karteneigenschaften (von ../MapServer?f=json)
     *
     * @param       {Function} _callbackFunction Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird
     *
     * @since v0.0
     */
    _initCachedLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction) {
        let resolutions = [];
        ags_info.tileInfo.lods.forEach(function (lod) {
            resolutions.push(lod.resolution);
        });

        const params = {
            origin: [ags_info.tileInfo.origin.x, ags_info.tileInfo.origin.y],
            extent: [ags_info.fullExtent.xmin, ags_info.fullExtent.ymin, ags_info.fullExtent.xmax, ags_info.fullExtent.ymax],
            minZoom: 0,
            resolutions: resolutions,
            tileSize: [ags_info.tileInfo.rows, ags_info.tileInfo.cols]
        };
        const tileGrid = new TileGrid(params);

        //View konfigurieren, falls diese noch nicht konfiguriert wurde
        if (this.map.getView().getProjection().getCode() !== this.projection) {
            this.map.setView(new View({
                ...this.viewParams,
                ...{resolutions: resolutions, constrainResolution: true}
            }));
        }

        //Projektion ermitteln
        if (ags_info.spatialReference.latestWkid != null) {
            this.projection = ags_info.spatialReference.latestWkid;
        } else {
            this.projection = ags_info.spatialReference.wkid;
        }

        //sourceParams
        let sourceParams = {
            minZoom: 0
        };

        //ToDo: XYZ-Dienst vorsehen? Anderer Server + Instanz?
        //diese Parameter können nicht überdefiniert werden.
        let predefinedSourceParams = {
            tileGrid: tileGrid,
            projection: getProjection("EPSG:" + this.projection),
            attributions: ags_info.copyrightText,
            url: _url + '/tile/{z}/{y}/{x}'
        };

        if (this.tileLoadFunction != null) {
            predefinedSourceParams.tileLoadFunction = this.tileLoadFunction;
        }
        sourceParams = {
            ...sourceParams,
            ..._sourceParams,
            ...predefinedSourceParams
        };

        let _zIndex = 10;
        const url = new URL(_url);
        if (((this._getConfig().ags_hosts) || []).includes(url.hostname)) {
            _zIndex = 20;
        }

        //layerParams
        let layerParams = {
            zIndex: _zIndex
        };

        //diese Parameter können nicht überdefiniert werden.
        let predefinedLayerParams = {
            source: new SourceXYZ(sourceParams)
        };
        layerParams = {
            ...layerParams,
            ..._layerParams,
            ...predefinedLayerParams
        };

        //gecachten Layer erstellen
        let layer = new LayerTile(layerParams);

        //Layer hinzufügen
        this.map.addLayer(layer);

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(layer);
        }
    }

    /**
     * @description fügt einen EsriLayer hinzu. (dynamisch)
     *
     * @param       {string} _url URL zum AGS-Dienst
     *
     * @param       {Object} _layerParams zusätzliche Parameter für das OpenLayer-Layer-Objekt
     *
     * @param       {Object} _sourceParams zusätzliche Parameter für das OpenLayer-Source-Objekt
     *
     * @param       {AGSInfo} ags_info JSON-Objekt mit den Karteneigenschaften (von ../MapServer?f=json)
     *
     * @param       {Function} _callbackFunction Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird
     *
     * @since v0.0
     */
    _initDynamicLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction) {
        //sourceParams
        let sourceParams = {
            params: {layers: 'show:0'}
        };

        //diese Parameter können nicht überdefiniert werden.
        let predefinedSourceParams = {
            ratio: 1,
            url: _url,
            attributions: [ags_info.copyrightText]
        };
        sourceParams = {
            ...sourceParams,
            ..._sourceParams,
            ...predefinedSourceParams
        };

        //layerParams
        let _zIndex = 40;
        const url = new URL(_url);
        if (((this._getConfig().ags_hosts) || []).includes(url.hostname)) {
            _zIndex = 50;
        }

        //layerParams
        let layerParams = {
            zIndex: _zIndex //damit liegen die dynamischen Dienste über den gecachten Diensten (wenn nicht überkonfiguriert wird)
        };

        //diese Parameter können nicht überdefiniert werden.
        let predefinedLayerParams = {
            source: new SourceImageArcGISRest(sourceParams)
        };
        layerParams = {
            ...layerParams,
            ..._layerParams,
            ...predefinedLayerParams
        };

        //dynamischen Layer erstellen
        let layer = new LayerImage(layerParams);
        //Layer hinzufügen
        this.map.addLayer(layer);

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(layer);
        }
    }

    /**
     *    @description  initialisiert die Karte<br/>
     *                  Beispiel:<br/>
     *                  <code>mymap = new StmaOpenLayers();<br/>
     *                  mymap.initMap(25832, {}, {});</code>
     *
     *    @param        {int} _epsgCode EPSG-Code des Koordinatensystems.
     *                  Unterstütze Werte sind: 25832, 3857<br/>
     *                  Siehe auch: {@link https://epsg.io/25832}, {@link http://epsg.io/3857}
     *
     *    @param        {object} _mapParams
     *                  zusätzliche Parameter für das OpenLayer-Map-Objekt<br/>
     *
     *    @param        {object} _viewParams
     *                  zusätzliche Parameter für das OpenLayer-View-Objekt<br/>
     *
     *    @param        {object} _customParams
     *                  zusätzliche Parameter für geoline.ol.js<br/>
     *                  Unterstützte Parameter:
     *                  <ul>
     *                  <li>tileLoadFunction: Optionale Funktion, die bei gecachten Kartendiensten ausgeführt wird, um eine Kachel zu laden.<br/>
     *                      Beispiel:<br/>
     *                      <code>{ tileLoadFunction: function(imageTile, src) { imageTile.getImage().src = src;}}</code><br/>
     *                  </li>
     *
     *                  <li>config: Hier kann das Konfigurationsobjekt, das normalerweise direkt vom Server des Stadtmessungsamtes geladen wird überschrieben werden.<br/>
     *                      Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel für die Offlineverfügbarkeit in Apps.<br/>
     *                      Wird diese Funktion verwendet, so muss sichergestellt werden, dass die übergebene Konfiguration aktuell ist.
     *                  </li>
     *                  </ul>
     *
     *    @param        {function} _callbackFunction
     *                  Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
     *                  Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns      {null}
     *
     *    @since        v0.0
     */
    initMap(_epsgCode, _mapParams = {}, _viewParams = {}, _customParams = {}, _callbackFunction = null) {
        // (25832) UTM-Projektion registrieren
        proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
        register(proj4);

        // (31467) GK-Projektion registrieren (falls benötigt)
        proj4.defs("EPSG:31467", "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs");
        register(proj4);

        // Karten-Projektion festlegen (NICHT später überschreiben)
        this.projection = "EPSG:" + _epsgCode;
        if (getProjection(this.projection) == null) {
            console.error("Projektion " + this.projection + " nicht gefunden. Es kann zu falscher Darstellung der Karte kommen");
        }

        // Custom-Parameter übernehmen
        if (_customParams?.tileLoadFunction) {
            this.tileLoadFunction = _customParams.tileLoadFunction;
        }
        if (_customParams?.config) {
            console.warn("Konfiguration wurde manuell gesetzt und wird nicht vom Server des Stadtmessungsamtes geladen. Bitte stellen Sie sicher, dass die Konfiguration immer aktuell ist.");
            this.config = _customParams.config;
        } else {
            // Config frühzeitig (asynchron) laden
            this._fetchConfig().catch(() => {
            });
        }

        // Map-Parameter zusammenbauen
        let mapParams = {
            target: "map",
            controls: defaultControls({
                attribution: false
            })
        };
        const predefinedMapParams = {
            logo: false,
            pixelRatio: 1,                 // wichtige Einstellung für unsere Kartendienste
            loadTilesWhileAnimating: true, //Kacheln während des Zoomens nachladen
            loadTilesWhileInteracting: true
        };
        mapParams = {
            ...mapParams,
            ..._mapParams,
            ...predefinedMapParams
        };

        // Attribution-Control sicherstellen (z. B. für Esri-Dienste)
        if (mapParams.controls != null) {
            let hasAttribution = false;
            mapParams.controls.forEach((_control) => {
                if (_control instanceof ControlAttribution) {
                    hasAttribution = true;
                }
            });
            if (!hasAttribution) {
                mapParams.controls.push(new ControlAttribution({
                    tipLabel: "Copyright",
                    collapsible: true
                }));
            }
        }

        // View-Parameter aufbauen (mit deiner gewünschten Projektion)
        this.viewParams = {
            center: [513785, 5402232], // Default Stuttgart
            zoom: 2,
            ..._viewParams,
            projection: getProjection(this.projection)
        };

        // >>> WICHTIG: View direkt an die Map geben (verhindert OL-Default EPSG:3857)
        mapParams.view = new View(this.viewParams);

        // Map erzeugen
        this.map = new Map(mapParams);

        // Kontextmenü (Rechtsklick) auf der Karte unterbinden
        const vp = document.querySelector(".ol-viewport");
        if (vp) {
            vp.addEventListener("contextmenu", function (e) {
                e.preventDefault();
            });
        }

        //Nach dem Start die Größe der Karte automatisch bestimmen
        this.map.updateSize();

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(this.map);
        }
    }

    /**
     *    @description    fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");</code>
     *
     *    @param          {String} _url URL des Kartendienstes
     *                    Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaEsriLayer hinzugefügt werden.
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v0.0
     */
    addEsriLayer(_url, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        const url = new URL(_url);
        if (((this._getConfig().ags_hosts) || []).includes(url.hostname)) {
            console.error("Kartendienste des Stadtmessungsamtes über die Methode addStmaEsriLayer hinzufügen");
        } else {
            this._addEsriLayer(_url, _layerParams, _sourceParams, _callbackFunction);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *    @description    fügt einen gecachten WMTS-Kartendienst hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>mymap.addWMTSLayer("https://SERVERNAME/INSTANZ/gwc/service/wmts?REQUEST=GetCapabilities", "LAYERNAME");</code>
     *
     *    @param          {String} _url GetCapabilities-URL zum WMTS
     *                    Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaWMTSLayer hinzugefügt werden.
     *
     *    @param          {String} _layerName Layername
     *                    Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v2.1
     */
    addWMTSLayer(_url, _layerName = '', _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        const url = new URL(_url);
        if (((this._getConfig().wmts_hosts) || []).includes(url.hostname)) {
            console.error("WMTS-Kartendienste des Stadtmessungsamtes über die Methode addStmaWMTSLayer hinzufügen");
        } else {
            this._addWMTSLayer_impl(_url, _layerName, _layerParams, _sourceParams, _callbackFunction);
        }
    }

    /**
     *    @description    fügt einen dynamischen WMS-Kartendienst hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME");</code>
     *                    <br/><br/>
     *                    Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
     *                    da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
     *                    abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
     *                    abgeschnitten oder mehrfach im Kartenbild enthalten sind.<br/>
     *                    Standardmäßig wird der WMS-Dienst als dynamischer Dienst behandelt, wenn der als gekachelter Dienst eingebunden wird,
     *                    wird er als gecachter Dienst behandelt (wichtig für die zIndexe der Kartendienste)
     *                    Zum gekachelten Abruf muss als _sourceParams <code>{ "TILED": true }</code> übergeben werden.<br/>
     *                    Beispiel:<br/>
     *                    <code>mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME", {}, { "TILED": true });</code>
     *
     *
     *    @param          {String} _url URL zum WMS
     *                    Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaWMSLayer hinzugefügt werden.
     *
     *    @param          {String} _layerName Layername
     *                    Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v2.1
     */
    addWMSLayer(_url, _layerName, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        const url = new URL(_url);
        if (((this._getConfig().wms_hosts) || []).includes(url.hostname)) {
            console.error("WMS-Kartendienste des Stadtmessungsamtes über die Methode addStmaWMSLayer hinzufügen");
        } else {
            this._addWMSLayer(_url, _layerName, _layerParams, _sourceParams, _callbackFunction);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *    @description    fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) des Stadtmessungsamtes hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c");</code>
     *
     *    @param          {String} _mapservice Bezeichnung des Kartendienstes
     *                    Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
     *                    so sollte ORDNER/KARTENDIENST angegeben werden.
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v0.0
     */
    addStmaEsriLayer(_mapservice, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        this._fetchConfig()
            .then(() => {
                this._addEsriLayer("https://" + this._getConfig().ags_host + "/" + this._getConfig().ags_instance + "/rest/services/" + _mapservice + "/MapServer", _layerParams, _sourceParams, _callbackFunction);
            })
            .catch(err => {
                console.error("Konfiguration (geoline.config) konnte nicht geladen werden – addStmaEsriLayer wird übersprungen", err);
            });
    }

    /**
     *    @description    fügt einen gecachten WMTS-Kartendienst des Stadtmessungsamtes hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>mymap.addStmaWMTSLayer("LAYERNAME");</code>
     *
     *    @param          {String} _layerName Layername
     *                    Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v2.1
     */
    addStmaWMTSLayer(_layerName, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        this._fetchConfig()
            .then(() => {
                //Matrix definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
                if (_sourceParams == null) {
                    _sourceParams = {};
                }
                const _predefinedSourceParams = {
                    matrixSet: this._getConfig().wmts_matrix
                }
                _sourceParams = {
                    ..._sourceParams,
                    ..._predefinedSourceParams
                };
                this._addWMTSLayer_impl("https://" + this._getConfig().wmts_host + "/" + this._getConfig().wmts_instance + "/gwc/service/wmts?REQUEST=GetCapabilities", _layerName, _layerParams, _sourceParams, _callbackFunction);
            })
            .catch(err => {
                console.error("Konfiguration (geoline.config) konnte nicht geladen werden – addStmaWMTSLayer wird übersprungen", err);
            });
    }

    /**
     *    @description    fügt einen dynamischen WMS-Kartendienst des Stadtmessungsamtes hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>mymap.addStmaWMSLayer("LAYERNAME");</code>
     *                    <br/><br/>
     *                    Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
     *                    da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
     *                    abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
     *                    abgeschnitten oder mehrfach im Kartenbild enthalten sind.<br/>
     *                    Standardmäßig wird der WMS-Dienst als dynamischer Dienst behandelt, wenn der als gekachelter Dienst eingebunden wird,
     *                    wird er als gecachter Dienst behandelt (wichtig für die zIndexe der Kartendienste)
     *                    Zum gekachelten Abruf muss als _sourceParams <code>{ "TILED": true }</code> übergeben werden.<br/>
     *                    Beispiel:<br/>
     *                    <code>mymap.addStmaWMSLayer("LAYERNAME", {}, { "TILED": true });</code>
     *
     *    @param          {String} _layerName Layername
     *                    Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v2.1
     */
    addStmaWMSLayer(_layerName, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        this._fetchConfig()
            .then(() => {
                //Tiled definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
                if (_sourceParams == null) {
                    _sourceParams = {};
                }
                const _predefinedSourceParams = {
                    TILED: this._getConfig().wms_tiled
                }
                _sourceParams = {
                    ..._sourceParams,
                    ..._predefinedSourceParams
                };
                this._addWMSLayer("https://" + this._getConfig().wms_host + "/" + this._getConfig().wms_instance, _layerName, _layerParams, _sourceParams, _callbackFunction);
            })
            .catch(err => {
                console.error("Konfiguration (geoline.config) konnte nicht geladen werden – addStmaWMSLayer wird übersprungen", err);
            });
    }

    /**
     *    @description    fügt einen Basis-Kartendienst (dynamisch / gecacht) des Stadtmessungsamtes hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *                    Beispiel:<br/>
     *                    <code>
     *                        mymap.addStmaBaseLayer("Basemap");<br/>
     *                        mymap.addStmaBaseLayer("Luftbild");
     *                    </code>
     *
     *    @param          {String} _mapname sprechende Bezeichnung des Kartendienstes
     *                    Für ausgewählte Basiskartendienste kann hierüber über eine sprechende Bezeichnung der Kartendienst hinzugefügt werden.
     *                    Eventuelle Kartendienstnamenänderungen werden automatisch von der API berücksichtigt.
     *                    Deswegen sollten die Basiskarten (Grundkarte, Luftbild, ..) immer über diese Funktion eingebundne werden.
     *
     *    @param          {object} _layerParams
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} _sourceParams
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v0.0
     */
    addStmaBaseLayer(_mapname, _layerParams = {}, _sourceParams = {}, _callbackFunction = null) {
        this._fetchConfig()
            .then(() => {
                const config = this._getConfig();
                const ags = config?.ags_services?.[_mapname] ?? null;
                const wmts = config?.wmts_services?.[_mapname] ?? null;
                const wms = config?.wms_services?.[_mapname] ?? null;

                if (ags) {
                    const finalUrl = `https://${ags.ags_host}/${ags.ags_instance}/rest/services/${ags.ags_service}/MapServer`;
                    this._addEsriLayer(finalUrl, _layerParams, _sourceParams, _callbackFunction);
                } else if (wmts) {
                    const finalUrl = `https://${wmts.host}/${wmts.instance}/gwc/service/wmts?REQUEST=GetCapabilities`;
                    const sourceParams = {
                        ..._sourceParams,
                        matrixSet: wmts.matrix
                    };
                    this._addWMTSLayer_impl(finalUrl, wmts.service, _layerParams, sourceParams, _callbackFunction);
                } else if (wms) {
                    const finalUrl = `https://${wms.host}/${wms.instance}`;
                    const sourceParams = {
                        ..._sourceParams,
                        TILED: wms.tiled
                    };
                    this._addWMSLayer(finalUrl, wms.service, _layerParams, sourceParams, _callbackFunction);
                } else {
                    console.error("Karte '" + _mapname + "' nicht gefunden");
                }
            })
            .catch(err => {
                console.error("Konfiguration (geoline.config) konnte nicht geladen werden – addStmaBaseLayer wird übersprungen", err);
            });
    }

    /**
     *    @description    fügt einzelne Punkte hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gilt der zIndex 60.<br/>
     *                    Beispiel:<br/>
     *                    <code>mymap.addPoints([[3513223, 5405026]], "images/target.png");</code>
     *
     *    @param          {Array} _pointCoords Array von Koordinatenpaaren<br/>
     *                    [ [x,y], [x,y], ... ]
     *
     *    @param          {String} _imageURL URL zu dem Bild des Punktes / Data-URL des Bildes
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v0.0
     */
    addPoints(_pointCoords, _imageURL, _callbackFunction = null) {

        let features = [];
        for (let i = 0; i < _pointCoords.length; i++) {
            features.push(new Feature({
                geometry: new GeomPoint(_pointCoords[i])
            }));
        }

        const vectorLayer = new LayerVector({
            zIndex: 60,
            source: new SourceVector({
                features: features
            }),
            style: new StyleStyle({
                image: new StyleIcon({
                    anchor: [0.5, 1],
                    src: _imageURL
                })
            })
        });
        this.map.addLayer(vectorLayer);

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(vectorLayer);
        }
    }

    /**
     *    @description    fügt Objekte aus einem geoJSON hinzu. Das geoJSON ist über eine URL erreichbar.<br/>
     *                    Beispiel:
     *                    <code>mymap.addGeoJSONfromURL("examples/example.geojson");</code>
     *
     *    @param          {String} _url URL zur geoJSON-Datei
     *
     *    @param          {boolean} _zoomTo
     *                    Passt den sichtbaren Bereich der Karte so an, dass alle Objekte der Vektorquelle vollständig sichtbar sind
     *
     *    @param          {object} _style (optional) Ausprägungs-Details<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben. Der Funktion wird false übergeben, wenn das GeoJSON
     *                    nicht abgerufen werden konnte.
     *
     *    @returns        {null}
     *
     *    @since          v2.0
     */
    addGeoJSONfromURL(_url, _zoomTo = false, _style = {}, _callbackFunction = null) {
        fetch(_url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(geojson => {
                this.addGeoJSON(geojson, _zoomTo, _style, _callbackFunction);
            })
            .catch(error => {
                console.error("JSON konnte von URL " + _url + " nicht abgerufen werden.", error);

                // Callbackfunktion ausführen
                if (typeof _callbackFunction === "function") {
                    _callbackFunction(false);
                }
            });
    }

    /**
     *    @description    fügt Objekte aus einem geoJSON hinzu.
     *                    Beispiel:
     *                    <code>mymap.addGeoJSON(_geojson);</code>
     *
     *    @param          {object} _geojson GeoJSON-Objekt
     *
     *    @param          {boolean} _zoomTo
     *                    Passt den sichtbaren Bereich der Karte so an, dass alle Objekte der Vektorquelle vollständig sichtbar sind
     *
     *    @param          {object} _style (optional) Ausprägungs-Details<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v2.0
     */
    addGeoJSON(_geojson, _zoomTo = false, _style = {}, _callbackFunction = null) {

        let _projectionGeoJSON = "EPSG:4326";
        //Wurde das Koordinatensystem angegeben?
        if ("crs" in _geojson) {
            if ("properties" in _geojson.crs) {
                if ("name" in _geojson.crs.properties) {
                    _projectionGeoJSON = _geojson.crs.properties.name;
                }
            }
        }

        //Bei urn:ogc:def:crs:OGC:1.3:CRS84 wird unter Verwendung von UTM(EPSG:25832) nicht korrekt transformiert.
        if (_projectionGeoJSON === "urn:ogc:def:crs:OGC:1.3:CRS84") {
            _projectionGeoJSON = "EPSG:4326";
        }

        if (getProjection(_projectionGeoJSON) == null) {
            console.error("Projektion " + _projectionGeoJSON + " nicht gefunden. Es kann zu falscher Darstellung der Karte kommen");
        }

        const _geojsonFormat = this._getGeoJSONFormat(_projectionGeoJSON);
        const _vectorSource = new SourceVector({
            features: _geojsonFormat.readFeatures(_geojson)
        });

        const vectorLayer = new LayerVector({
            zIndex: 60,
            source: _vectorSource,
            style: _style
        });

        this.map.addLayer(vectorLayer);

        if (_zoomTo === true) {
            //warte bis View bereit ist.
            let self = this;
            const zoomToInterval = window.setInterval(function () {
                if (self.map.getView().getZoom() !== undefined) {
                    clearInterval(zoomToInterval);
                    self.map.getView().fit(_vectorSource.getExtent());
                }
            }, 500);
        }

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(vectorLayer);
        }
    }

    /**
     *    @description    Bietet die Möglichkeit an für einen Layer ein Overlay hinzuzufügen.
     *                    Beispiel:
     *                    <code>mymap.addOverlayForLayer(_layer, _overlayFunction);</code>
     *
     *    @param          {object} _layer Das Layerobjekt
     *
     *    @param          {function} _overlayFunction
     *                    Funktion, die bei einem Klick auf das Objekt ausgeführt wird.
     *                    Die Funktion muss den HTML-Inhalt für ein Overlay-Fenster zurückgeben.
     *
     *    @returns        {null}
     *
     *    @since          v1.2
     */
    addOverlayForLayer(_layer, _overlayFunction = null) {

        //globaler Overlay-Layer hinzufügen
        if (this.overlayLayer == null) {
            if (this.map.getTargetElement().querySelector("#geoline_ol_js_popup") === null) {
                // Element für Overlay definieren
                this.map.getTargetElement().insertAdjacentHTML('beforeend', '<div id="geoline_ol_js_popup"></div>');
            }
            /** @type {HTMLDivElement} */
            const _overlayDIV = this.map.getTargetElement().querySelector("#geoline_ol_js_popup");

            this.overlayLayer = new Overlay({
                element: _overlayDIV,
            });
            this.map.addOverlay(this.overlayLayer);

            let self = this;
            this.map.on('click', function (evt) {
                const featuredata = self.map.forEachFeatureAtPixel(
                    evt.pixel,
                    function (_feature, _layer) {
                        return {
                            "feature": _feature,
                            "layer": _layer
                        };
                    },
                    {
                        layerFilter: function (_layerCandidate) {
                            //Filter, damit nur die Features gefunden werden, für die auch der Overlay aktiviert wurde.
                            return self.overlayLayers.includes(_layerCandidate);
                        }
                    }
                );
                if (featuredata) {
                    const _overlayFunction = self.overlayFunctions[self.overlayLayers.indexOf(featuredata.layer)];

                    self.overlayLayer.getElement().innerHTML =
                        '<div class="arrow"></div>' +
                        '<div class="content">' + _overlayFunction(featuredata.feature) + '</div>';

                    self.overlayLayer.setPosition(evt.coordinate);
                    _overlayDIV.style.display = 'block';

                    _overlayDIV.style.transform = "translate3d(-" + _overlayDIV.offsetWidth / 2 + "px, calc(-" + _overlayDIV.offsetHeight + "px - 0.5rem), 0px)";
                } else {
                    _overlayDIV.style.display = 'none';
                }
            });
        }

        //Füge Layer zu den Layern hinzu, für die das Overlay aktiviert ist.
        if (!this.overlayLayers.includes(_layer)) {
            this.overlayLayers.push(_layer);
            this.overlayFunctions[this.overlayLayers.indexOf(_layer)] = _overlayFunction;
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *    @description    fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) des Stadtmessungsamtes hinzu.
     *                    Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
     *                    <ul>
     *                    <li>10: gecacht</li>
     *                    <li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
     *                    <li>40: dynamisch</li>
     *                    <li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
     *                    </ul>
     *
     *                    Beispiel:<br/>
     *                    <code>mymap.addStmaEsriFeatureLayer("1_Base/Stadtkarte_Internet_c");</code>
     *
     *    @param          {String} _mapservice Bezeichnung des Kartendienstes
     *                    Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
     *                    so sollte ORDNER/KARTENDIENST angegeben werden.
     *
     *    @param          {integer} _layerId LayerId im Kartendienst
     *                    Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer/LAYERID heißt,
     *                    so sollte LAYERID angegeben werden.
     *
     *    @param          {function} _styleFunction
     *                    Funktion, wie die Objekte aussehen sollen. Der Funktion wird als 1. Parameter das feature-Objekt (ol.Feature) übergeben.
     *                    Mit Hilfe von z.B. feature.get('activeprod') könnte dann der Inhalt des Attributes 'activeprod' abgerufen werden und in Abhängigkeit
     *                    von ihm unterschiedliche Stile angegeben werden.
     *                    Rückgabe der Funktion muss ein ol.style.Style-Objekt sein.<br/>
     *
     *    @param          {function} _callbackFunction
     *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
     *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
     *
     *    @returns        {null}
     *
     *    @since          v0.86
     */
    addStmaEsriFeatureLayer(_mapservice, _layerId, _styleFunction = null, _callbackFunction = null) {
        const _epsgCode = this.projection.replace("EPSG:", "");

        const vectorSource = new SourceVector({
            loader: function (_extent, _resolution, _projection) {
                let self = this;
                self._fetchConfig()
                    .then(() => {
                        const _url = "https://" + self._getConfig().ags_host + "/" + self._getConfig().ags_instance + "/rest/services/" + _mapservice + "/MapServer/" + _layerId + "/query/";
                        const _urlParams = {
                            "f": "json",
                            "returnGeometry": true,
                            "spatialRel": "esriSpatialRelIntersects",
                            "geometry": encodeURIComponent('{"xmin":' + _extent[0] + ',"ymin":' + _extent[1] + ',"xmax":' + _extent[2] + ',"ymax":' + _extent[3] + ',"spatialReference":{"wkid":' + _epsgCode + '}}'),
                            "geometryType": "esriGeometryEnvelope",
                            "inSR": _epsgCode,
                            "outFields": "*",
                            "outSR": _epsgCode
                        };
                        // Create URL with parameters
                        const queryString = new URLSearchParams(_urlParams).toString();
                        const fullUrl = _url + '?' + queryString;
                        // Use the jsonp module that's already imported in the file
                        const jsonp = require('jsonp');
                        jsonp(fullUrl, null, (err, _response) => {
                            if (err) {
                                console.error("Error fetching JSONP data:", err);
                                return;
                            }
                            if (_response.error) {
                                alert(_response.error.message + '\n' + _response.error.details.join('\n'));
                            } else {
                                const _esrijsonFormat = new FormatEsriJSON()
                                const features = _esrijsonFormat.readFeatures(_response, {
                                    featureProjection: _projection
                                });
                                if (features.length > 0) {
                                    vectorSource.addFeatures(features);
                                }
                            }
                        });
                    })
                    .catch(err => {
                        console.error("Konfiguration (geoline.config) konnte nicht geladen werden – FeatureLoader übersprungen", err);
                    });
            },
            strategy: tileLoadingStrategy(createXYZ({
                tileSize: 512
            }))
        });

        const vectorLayer = new LayerVector({
            zIndex: 60,
            source: vectorSource,
            style: _styleFunction
        });

        this.map.addLayer(vectorLayer);

        //Callbackfunktion ausführen
        if (typeof _callbackFunction == "function") {
            _callbackFunction(vectorLayer);
        }
    }

    /**
     *    @description    gibt das OpenLayer-Map-Objekt zurück.<br/>
     *
     *    @returns        {object} ol.Map<br/>
     *
     *    @since          v0.0
     */
    getMap() {
        return this.map;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *    @description    Gibt die interne Konfiguration von geoline.ol.js zurück.<br/>
     *                    Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel zum Ermitteln der Konfiguration für die Offlineverfügbarkeit in Apps.
     *
     *    @returns        {GeolineConfig}
     *
     *    @since          v1.0
     */
    getConfig() {
        return this._getConfig();
    }

}

/*
 * Default Export für moderne ES6 Imports
 */
// noinspection JSUnusedGlobalSymbols
export default StmaOpenLayers;
