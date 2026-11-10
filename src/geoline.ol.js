/**
 * @module StmaOpenLayers
 */

import Feature from "ol/Feature.js";
import Map from "ol/Map.js";
import Overlay from "ol/Overlay.js";
import TileGrid from "ol/tilegrid/TileGrid.js";
import View from "ol/View.js";
import ControlAttribution from "ol/control/Attribution.js";
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
import {get as getProjection} from "ol/proj.js";
import {register} from 'ol/proj/proj4.js';

import proj4 from "proj4";
import jsonp from "jsonp";

import {ok, fail} from './result.js';
import {
    assertBoolean,
    assertCoordinateList,
    assertFunction,
    assertInteger,
    assertNoCallback,
    assertObject,
    assertOptionalObject,
    assertOptionalStyle,
    assertString,
    assertUrl,
} from './validate.js';

/**
 * @typedef {import('./result.js').ErrorCode} ErrorCode
 * @typedef {import('./result.js').GeolineError} GeolineError
 */

/**
 * @template T
 * @typedef {import('./result.js').Result<T>} Result
 */

/**
 * @typedef {import('ol/layer/Layer.js').default} Layer
 */

/**
 * Zustand einer initialisierten Karte. Wird bei dispose() verworfen; verspätete Ergebnisse erkennen daran,
 * dass sie zu einer früheren Karte gehören.
 *
 * @typedef {Object} Session
 * @property {AbortController} controller
 * @property {Set<ReturnType<typeof setInterval>>} intervals
 */

const DEFAULT_POPUP_ID = 'geoline_ol_js_popup';

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
    overlayClickRegistered = false;

    /** @type {Session|null} */
    _session = null;


    /**
     * Konstruktor
     *
     * @param       {string} _configUrl Basis-URL für den Abruf der Geoline-Basiskonfiguration. Wird als vorbelegter Parameter verwendet.
     *
     * @throws      {TypeError} wenn `_configUrl` keine absolute URL ist
     */
    constructor(_configUrl = "https://gis5.stuttgart.de/geoline/geoline.config/config.aspx") {
        assertUrl(_configUrl, '_configUrl', 'StmaOpenLayers');
        this.configUrl = _configUrl;
    }

    /**
     * Liefert die aktive Session oder wirft einen Fehler, wenn keine Karte initialisiert ist.
     *
     * @param   {string} method Name der aufgerufenen Methode für die Fehlermeldung
     * @returns {Session}
     */
    _requireSession(method) {
        if (this._session == null) {
            throw new Error(method + ": Keine aktive Karte. Zuerst initMap() aufrufen (nach dispose() erneut).");
        }
        return this._session;
    }

    /**
     * Ergebnis für Vorgänge, deren Karte inzwischen mit dispose() freigegeben wurde.
     *
     * @param   {Session} session Session beim Start des Vorgangs
     * @returns {boolean}
     */
    _isStale(session) {
        return session !== this._session;
    }

    /**
     * @returns {Result<never>}
     */
    _aborted() {
        return fail('ABORTED', 'Der Vorgang wurde durch dispose() abgebrochen.');
    }

    /**
     * Hosts der Kartendienste des Stadtmessungsamtes aus der geladenen Konfiguration, ohne einen Abruf auszulösen.
     *
     * @param   {'ags_hosts'|'wmts_hosts'|'wms_hosts'} kind Art des Dienstes
     * @returns {Array<string>}
     */
    _stmaHosts(kind) {
        return this.config?.[kind] ?? [];
    }

    /**
     * Lädt die Konfiguration als Result.
     *
     * @returns {Promise<Result<GeolineConfig>>}
     */
    _loadConfig() {
        return this._fetchConfig().then(
            (config) => ok(config),
            (err) => fail('CONFIG_UNAVAILABLE', 'Die Konfiguration des Stadtmessungsamtes konnte nicht geladen werden.', err)
        );
    }

    /**
     * Weist Kartendienste des Stadtmessungsamtes in den generischen Methoden zurück. Die Hosts stehen erst nach dem
     * Laden der Konfiguration fest; deshalb wird immer erst nach dem Laden geprüft, damit das Verhalten nicht vom
     * Zeitpunkt abhängt. Ist die Konfiguration nicht ladbar, entfällt die Prüfung.
     *
     * @param   {URL} url URL des Dienstes
     * @param   {'ags_hosts'|'wmts_hosts'|'wms_hosts'} kind Art des Dienstes
     * @param   {string} method Name der aufgerufenen Methode
     * @param   {string} stmaMethod Name der passenden addStma*-Methode
     * @returns {Promise<void>}
     */
    _rejectStmaHost(url, kind, method, stmaMethod) {
        return this._fetchConfig().catch(() => undefined).then(() => {
            if (this._stmaHosts(kind).includes(url.hostname)) {
                throw new TypeError(method + ": Kartendienste des Stadtmessungsamtes über die Methode " + stmaMethod + " hinzufügen.");
            }
        });
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
        // Abruf gehört zur Karte, die ihn gestartet hat; nach dispose() darf er die nächste Karte nicht verändern.
        const session = this._session;
        const promise = fetch(this.configUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: params,
            signal: session?.controller.signal
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
                if (session === this._session) {
                    this.config = _data;
                }
                return _data;
            })
            .catch(err => {
                // Fehler weiterreichen, aber Promise für spätere erneute Versuche zurücksetzen
                if (this.configPromise === promise) {
                    this.configPromise = null;
                }
                throw err;
            });
        this.configPromise = promise;
        return promise;
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
     * @param {string} url URL des Dienstes, dient auch als Cache-Schlüssel
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
     * @param {string} url URL des Dienstes, dient auch als Cache-Schlüssel
     * @param {RequestInit} [options] Optionen für fetch
     * @returns {Promise<string>}
     */
    _fetchTextCached(url, options = {method: 'POST'}) {
        const cached = this.map.get(url);
        if (cached) return cached;
        const p = fetch(url, {...options, signal: this._session?.controller.signal}).then(r => {
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
     * @param {string} dataProjection Projektion der GeoJSON-Daten, z. B. EPSG:4326
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
     * @param       {Session} session Session beim Aufruf
     *
     * @returns     {Promise<Result<Layer>>}
     *
     * @since       v0.0
     */
    _addEsriLayer(_url, _layerParams, _sourceParams, session) {
        // Zwei Zweige in then(): Fehler beim Aufbau des Layers sind interne Fehler und bleiben Rejections.
        return this._jsonpCached(_url + "?f=json").then(
            (/** @type {AGSInfo} */ ags_info) => {
                if (this._isStale(session)) {
                    return this._aborted();
                }
                if (ags_info.error !== undefined) {
                    return fail('SERVICE_ERROR', "Der Kartendienst " + _url + " meldet einen Fehler: " + ags_info.error.message, ags_info.error);
                }

                //Copyright
                const url = new URL(_url);
                if (this._stmaHosts('ags_hosts').includes(url.hostname)) {
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

                //Ist es ein gecachter Dienst? -> gecachten, sonst dynamischen Dienst hinzufügen
                return ok(ags_info.singleFusedMapCache === true
                    ? this._initCachedLayer(_url, _layerParams, _sourceParams, ags_info)
                    : this._initDynamicLayer(_url, _layerParams, _sourceParams, ags_info));
            },
            (err) => this._isStale(session)
                ? this._aborted()
                : fail('SERVICE_UNAVAILABLE', "Der Kartendienst " + _url + " ist nicht erreichbar.", err)
        );
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
     * @param          {Session} session Session beim Aufruf
     *
     * @returns        {Promise<Result<Layer>>}
     *
     * @since          v2.1
     */
    _addWMTSLayer_impl(_url, _layerName, _layerParams, _sourceParams, session) {
        const url = new URL(_url);
        _layerParams = _layerParams ?? {};
        _sourceParams = _sourceParams ?? {};

        return this._fetchTextCached(_url, {method: 'GET'}).then(
            (xml) => {
                if (this._isStale(session)) {
                    return this._aborted();
                }

                let sourceParams;
                try {
                    const caps = new FormatWMTSCapabilities().read(xml);
                    // Wenn matrixSet in _sourceParams übergeben wurde, nutzt OL das hier direkt.
                    // (z.B. { matrixSet: "EU_EPSG_25832_TOPPLUS" })
                    sourceParams = sourceWMTS_optionsFromCapabilities(caps, {
                        layer: _layerName,
                        matrixSet: _sourceParams.matrixSet,
                        style: _sourceParams.style
                    });
                } catch (err) {
                    return fail('INVALID_DATA', "Die Capabilities von " + _url + " sind ungültig.", err);
                }
                if (!sourceParams) {
                    return fail('NOT_FOUND', "Der WMTS-Layer " + _layerName + " ist in den Capabilities von " + _url + " nicht vorhanden.");
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
                    return fail('PROJECTION_MISMATCH',
                        "Der WMTS-Layer " + _layerName + " liegt in " + layerProj?.getCode?.() + ", die Karte in " +
                        viewProj?.getCode?.() + ". WMTS-Kacheln werden nicht reprojiziert.");
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
                if (this._stmaHosts('wmts_hosts').includes(url.hostname)) {
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
                return ok(layer);
            },
            (err) => this._isStale(session)
                ? this._aborted()
                : fail('SERVICE_UNAVAILABLE', "Die Capabilities von " + _url + " sind nicht abrufbar.", err)
        );
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
     * @returns         {Layer}
     *
     * @since           v2.1
     */
    _addWMSLayer(_url, _layerName, _layerParams, _sourceParams) {

        //diese Parameter können nicht überdefiniert werden.
        const predefinedSourceParams = {
            ratio: 1
        };

        const url = new URL(_url);
        if (this._stmaHosts('wms_hosts').includes(url.hostname)) {
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
            if (this._stmaHosts('wms_hosts').includes(url.hostname)) {
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
            if (this._stmaHosts('wms_hosts').includes(url.hostname)) {
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
        return layer;
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
     * @returns     {Layer}
     *
     * @since v0.0
     */
    _initCachedLayer(_url, _layerParams, _sourceParams, ags_info) {
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
        if (this._stmaHosts('ags_hosts').includes(url.hostname)) {
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
        return layer;
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
     * @returns     {Layer}
     *
     * @since v0.0
     */
    _initDynamicLayer(_url, _layerParams, _sourceParams, ags_info) {
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
        if (this._stmaHosts('ags_hosts').includes(url.hostname)) {
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
        return layer;
    }

    /**
     *    @description  initialisiert die Karte<br/>
     *                  Beispiel:<br/>
     *                  <code>mymap = new StmaOpenLayers();<br/>
     *                  const map = mymap.initMap(25832, {target: "map"}, {});</code>
     *
     *    @param        {number} _epsgCode EPSG-Code des Koordinatensystems.
     *                  Unterstütze Werte sind: 25832, 3857<br/>
     *                  Siehe auch: {@link https://epsg.io/25832}, {@link http://epsg.io/3857}
     *
     *    @param        {object} [_mapParams]
     *                  zusätzliche Parameter für das OpenLayer-Map-Objekt<br/>
     *
     *    @param        {object} [_viewParams]
     *                  zusätzliche Parameter für das OpenLayer-View-Objekt<br/>
     *
     *    @param        {{tileLoadFunction?: Function, config?: GeolineConfig, popupId?: string}} [_customParams]
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
     *
     *                  <li>popupId: ID des Popup-Elements, Standard <code>geoline_ol_js_popup</code>. Bei mehreren Karten auf
     *                      einer Seite braucht jede weitere Karte eine eigene ID. Das Element trägt immer die Klasse
     *                      <code>geoline-ol-js-popup</code>.
     *                  </li>
     *                  </ul>
     *
     *    @returns      {Map} die OpenLayers-Karte
     *
     *    @throws       {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws       {Error} wenn die Instanz bereits eine Karte hat oder die Popup-ID im Dokument vergeben ist
     *
     *    @since        v0.0
     */
    initMap(_epsgCode, _mapParams = {}, _viewParams = {}, _customParams = {}) {
        assertNoCallback(arguments, 4, 'initMap');
        if (this._session != null) {
            throw new Error("initMap: Die Karte ist bereits initialisiert. Vorher dispose() aufrufen.");
        }
        assertInteger(_epsgCode, '_epsgCode', 'initMap');
        assertOptionalObject(_mapParams, '_mapParams', 'initMap');
        assertOptionalObject(_viewParams, '_viewParams', 'initMap');
        assertOptionalObject(_customParams, '_customParams', 'initMap');
        const customParams = _customParams ?? {};
        if (customParams.tileLoadFunction != null) {
            assertFunction(customParams.tileLoadFunction, '_customParams.tileLoadFunction', 'initMap');
        }
        assertOptionalObject(customParams.config, '_customParams.config', 'initMap');
        const popupId = customParams.popupId ?? DEFAULT_POPUP_ID;
        assertString(popupId, '_customParams.popupId', 'initMap');
        if (document.getElementById(popupId) !== null) {
            throw new Error("initMap: Die Popup-ID '" + popupId + "' ist im Dokument bereits vergeben. Für weitere Karten _customParams.popupId angeben.");
        }

        this._session = {controller: new AbortController(), intervals: new Set()};

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
        if (customParams.tileLoadFunction) {
            this.tileLoadFunction = customParams.tileLoadFunction;
        }
        if (customParams.config) {
            console.warn("Konfiguration wurde manuell gesetzt und wird nicht vom Server des Stadtmessungsamtes geladen. Bitte stellen Sie sicher, dass die Konfiguration immer aktuell ist.");
            this.config = customParams.config;
        } else {
            // Config frühzeitig (asynchron) laden; Fehler erreichen die Aufrufer der Layer-Methoden als Result
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

        // Kontextmenü (Rechtsklick) auf der eigenen Karte unterbinden
        this.map.getViewport().addEventListener("contextmenu", function (e) {
            e.preventDefault();
        });

        // Popup-Element sofort anlegen, damit die ID für weitere Karten auf der Seite als vergeben erkennbar ist
        const popupElement = document.createElement('div');
        popupElement.id = popupId;
        popupElement.className = 'geoline-ol-js-popup';
        this.overlayLayer = new Overlay({element: popupElement});
        this.map.addOverlay(this.overlayLayer);

        //Nach dem Start die Größe der Karte automatisch bestimmen
        this.map.updateSize();

        return this.map;
    }

    /**
     *    @description  gibt die Karte frei: bricht laufende Anfragen ab, entfernt Intervalle, Listener, Overlays und
     *                  Caches und löst die Karte von ihrem Element. Offene Promises liefern ein Result mit dem Code
     *                  <code>ABORTED</code>; ihre Ergebnisse werden in keine Karte eingefügt.<br/>
     *                  Danach kann mit initMap() eine neue Karte aufgebaut werden. Mehrfacher Aufruf ist unschädlich.
     *
     *    @returns      {void}
     *
     *    @since        v4.0
     */
    dispose() {
        const session = this._session;
        if (session == null) {
            return;
        }
        // Zuerst die Session lösen, damit Ergebnisse, die während des Abbruchs eintreffen, als veraltet gelten.
        this._session = null;
        session.controller.abort();
        session.intervals.forEach((id) => clearInterval(id));
        session.intervals.clear();
        this.map.dispose();

        this.map = null;
        this.overlayLayer = null;
        this.overlayLayers = [];
        this.overlayFunctions = [];
        this.overlayClickRegistered = false;
        this.config = null;
        this.configPromise = null;
        this.viewParams = null;
        this.tileLoadFunction = null;
        this.projection = null;
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
     *                    <code>const r = await mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");</code>
     *
     *    @param          {string} _url URL des Kartendienstes
     *                    Kartendienste des Stadtmessungsamtes werden über die Methode addStmaEsriLayer hinzugefügt.
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler.
     *                    Die Promise wird mit einem TypeError abgelehnt, wenn die URL zu einem Kartendienst des Stadtmessungsamtes gehört.
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v0.0
     */
    addEsriLayer(_url, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 3, 'addEsriLayer');
        const session = this._requireSession('addEsriLayer');
        const url = assertUrl(_url, '_url', 'addEsriLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addEsriLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addEsriLayer');
        return this._rejectStmaHost(url, 'ags_hosts', 'addEsriLayer', 'addStmaEsriLayer').then(() =>
            this._isStale(session) ? this._aborted() : this._addEsriLayer(_url, _layerParams, _sourceParams, session));
    }

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
     *                    <code>const r = await mymap.addWMTSLayer("https://SERVERNAME/INSTANZ/gwc/service/wmts?REQUEST=GetCapabilities", "LAYERNAME");</code>
     *
     *    @param          {string} _url GetCapabilities-URL zum WMTS
     *                    Kartendienste des Stadtmessungsamtes werden über die Methode addStmaWMTSLayer hinzugefügt.
     *
     *    @param          {string} _layerName Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler.
     *                    Die Promise wird mit einem TypeError abgelehnt, wenn die URL zu einem Kartendienst des Stadtmessungsamtes gehört.
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v2.1
     */
    addWMTSLayer(_url, _layerName, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 4, 'addWMTSLayer');
        const session = this._requireSession('addWMTSLayer');
        const url = assertUrl(_url, '_url', 'addWMTSLayer');
        assertString(_layerName, '_layerName', 'addWMTSLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addWMTSLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addWMTSLayer');
        return this._rejectStmaHost(url, 'wmts_hosts', 'addWMTSLayer', 'addStmaWMTSLayer').then(() =>
            this._isStale(session) ? this._aborted() : this._addWMTSLayer_impl(_url, _layerName, _layerParams, _sourceParams, session));
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
     *                    <code>const r = await mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME");</code>
     *                    <br/><br/>
     *                    Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
     *                    da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
     *                    abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
     *                    abgeschnitten oder mehrfach im Kartenbild enthalten sind.<br/>
     *                    Standardmäßig wird der WMS-Dienst als dynamischer Dienst behandelt, wenn der als gekachelter Dienst eingebunden wird,
     *                    wird er als gecachter Dienst behandelt (wichtig für die zIndexe der Kartendienste)
     *                    Zum gekachelten Abruf muss als _sourceParams <code>{ "TILED": true }</code> übergeben werden.<br/>
     *                    Beispiel:<br/>
     *                    <code>const r = await mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME", {}, { "TILED": true });</code>
     *
     *    @param          {string} _url URL zum WMS
     *                    Kartendienste des Stadtmessungsamtes werden über die Methode addStmaWMSLayer hinzugefügt.
     *
     *    @param          {string} _layerName Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler.
     *                    Asynchron, weil die Kartendienste des Stadtmessungsamtes erst nach dem Laden der Konfiguration bekannt sind.
     *                    Die Promise wird mit einem TypeError abgelehnt, wenn die URL zu einem Kartendienst des Stadtmessungsamtes gehört.
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v2.1
     */
    addWMSLayer(_url, _layerName, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 4, 'addWMSLayer');
        const session = this._requireSession('addWMSLayer');
        const url = assertUrl(_url, '_url', 'addWMSLayer');
        assertString(_layerName, '_layerName', 'addWMSLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addWMSLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addWMSLayer');
        return this._rejectStmaHost(url, 'wms_hosts', 'addWMSLayer', 'addStmaWMSLayer').then(() =>
            this._isStale(session) ? this._aborted() : ok(this._addWMSLayer(_url, _layerName, _layerParams, _sourceParams)));
    }

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
     *                    <code>const r = await mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c_EPSG25832");</code>
     *
     *    @param          {string} _mapservice Bezeichnung des Kartendienstes
     *                    Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
     *                    so sollte ORDNER/KARTENDIENST angegeben werden.
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v0.0
     */
    addStmaEsriLayer(_mapservice, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 3, 'addStmaEsriLayer');
        const session = this._requireSession('addStmaEsriLayer');
        assertString(_mapservice, '_mapservice', 'addStmaEsriLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addStmaEsriLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addStmaEsriLayer');
        return this._loadConfig().then((result) => {
            if (this._isStale(session)) {
                return this._aborted();
            }
            if (!result.ok) {
                return result;
            }
            const config = result.value;
            return this._addEsriLayer("https://" + config.ags_host + "/" + config.ags_instance + "/rest/services/" + _mapservice + "/MapServer", _layerParams, _sourceParams, session);
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
     *                    <code>const r = await mymap.addStmaWMTSLayer("LAYERNAME");</code>
     *
     *    @param          {string} _layerName Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v2.1
     */
    addStmaWMTSLayer(_layerName, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 3, 'addStmaWMTSLayer');
        const session = this._requireSession('addStmaWMTSLayer');
        assertString(_layerName, '_layerName', 'addStmaWMTSLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addStmaWMTSLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addStmaWMTSLayer');
        return this._loadConfig().then((result) => {
            if (this._isStale(session)) {
                return this._aborted();
            }
            if (!result.ok) {
                return result;
            }
            const config = result.value;
            //Matrix definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
            const sourceParams = {
                ..._sourceParams,
                matrixSet: config.wmts_matrix
            };
            return this._addWMTSLayer_impl("https://" + config.wmts_host + "/" + config.wmts_instance + "/gwc/service/wmts?REQUEST=GetCapabilities", _layerName, _layerParams, sourceParams, session);
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
     *                    <code>const r = await mymap.addStmaWMSLayer("LAYERNAME");</code>
     *                    <br/><br/>
     *                    Ob der Layer gekachelt oder als ganzes Bild abgerufen wird, legt die Konfiguration des Stadtmessungsamtes fest.
     *
     *    @param          {string} _layerName Name des Layers, der eingebunden werden soll
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v2.1
     */
    addStmaWMSLayer(_layerName, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 3, 'addStmaWMSLayer');
        const session = this._requireSession('addStmaWMSLayer');
        assertString(_layerName, '_layerName', 'addStmaWMSLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addStmaWMSLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addStmaWMSLayer');
        return this._loadConfig().then((result) => {
            if (this._isStale(session)) {
                return this._aborted();
            }
            if (!result.ok) {
                return result;
            }
            const config = result.value;
            //Tiled definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
            const sourceParams = {
                ..._sourceParams,
                TILED: config.wms_tiled
            };
            return ok(this._addWMSLayer("https://" + config.wms_host + "/" + config.wms_instance, _layerName, _layerParams, sourceParams));
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
     *                    <code>const r = await mymap.addStmaBaseLayer("Basemap");</code>
     *
     *    @param          {string} _mapname sprechende Bezeichnung des Kartendienstes
     *                    Für ausgewählte Basiskartendienste kann hierüber über eine sprechende Bezeichnung der Kartendienst hinzugefügt werden.
     *                    Eventuelle Kartendienstnamenänderungen werden automatisch von der API berücksichtigt.
     *                    Deswegen sollten die Basiskarten immer über diese Funktion eingebunden werden.
     *
     *    @param          {object} [_layerParams]
     *                    zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
     *
     *    @param          {object} [_sourceParams]
     *                    zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
     *
     *    @returns        {Promise<Result<Layer>>} der hinzugefügte Layer oder ein erwartbarer Fehler,
     *                    <code>NOT_FOUND</code> bei einer unbekannten Bezeichnung
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v0.0
     */
    addStmaBaseLayer(_mapname, _layerParams = {}, _sourceParams = {}) {
        assertNoCallback(arguments, 3, 'addStmaBaseLayer');
        const session = this._requireSession('addStmaBaseLayer');
        assertString(_mapname, '_mapname', 'addStmaBaseLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addStmaBaseLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addStmaBaseLayer');
        return this._loadConfig().then((result) => {
            if (this._isStale(session)) {
                return this._aborted();
            }
            if (!result.ok) {
                return result;
            }
            const config = result.value;
            const ags = config?.ags_services?.[_mapname] ?? null;
            const wmts = config?.wmts_services?.[_mapname] ?? null;
            const wms = config?.wms_services?.[_mapname] ?? null;

            if (ags) {
                const finalUrl = `https://${ags.ags_host}/${ags.ags_instance}/rest/services/${ags.ags_service}/MapServer`;
                return this._addEsriLayer(finalUrl, _layerParams, _sourceParams, session);
            }
            if (wmts) {
                const finalUrl = `https://${wmts.host}/${wmts.instance}/gwc/service/wmts?REQUEST=GetCapabilities`;
                const sourceParams = {
                    ..._sourceParams,
                    matrixSet: wmts.matrix
                };
                return this._addWMTSLayer_impl(finalUrl, wmts.service, _layerParams, sourceParams, session);
            }
            if (wms) {
                const finalUrl = `https://${wms.host}/${wms.instance}`;
                const sourceParams = {
                    ..._sourceParams,
                    TILED: wms.tiled
                };
                return ok(this._addWMSLayer(finalUrl, wms.service, _layerParams, sourceParams));
            }
            return fail('NOT_FOUND', "Die Karte '" + _mapname + "' ist in der Konfiguration des Stadtmessungsamtes nicht vorhanden.");
        });
    }

    /**
     *    @description    fügt einzelne Punkte hinzu.<br/>
     *                    Wenn nichts anderes angegeben ist, dann gilt der zIndex 60.<br/>
     *                    Beispiel:<br/>
     *                    <code>const layer = mymap.addPoints([[513223, 5405026]], "images/target.png");</code>
     *
     *    @param          {Array<Array<number>>} _pointCoords Array von Koordinatenpaaren<br/>
     *                    [ [x,y], [x,y], ... ]
     *
     *    @param          {string} _imageURL URL zu dem Bild des Punktes / Data-URL des Bildes
     *
     *    @returns        {LayerVector} der hinzugefügte Vektor-Layer
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v0.0
     */
    addPoints(_pointCoords, _imageURL) {
        assertNoCallback(arguments, 2, 'addPoints');
        this._requireSession('addPoints');
        assertCoordinateList(_pointCoords, '_pointCoords', 'addPoints');
        assertString(_imageURL, '_imageURL', 'addPoints');

        const features = _pointCoords.map((coordinate) => new Feature({
            geometry: new GeomPoint(coordinate)
        }));

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
        return vectorLayer;
    }

    /**
     *    @description    fügt Objekte aus einem geoJSON hinzu. Das geoJSON ist über eine URL erreichbar.<br/>
     *                    Beispiel:
     *                    <code>const r = await mymap.addGeoJSONfromURL("examples/example.geojson");</code>
     *
     *    @param          {string} _url URL zur geoJSON-Datei, auch relativ zur Seite
     *
     *    @param          {boolean} [_zoomTo]
     *                    Passt den sichtbaren Bereich der Karte so an, dass alle Objekte der Vektorquelle vollständig sichtbar sind
     *
     *    @param          {import('ol/style/Style.js').StyleLike} [_style] (optional) Ausprägungs-Details<br/>
     *
     *    @returns        {Promise<Result<LayerVector>>} der hinzugefügte Vektor-Layer oder ein erwartbarer Fehler:
     *                    <code>SERVICE_UNAVAILABLE</code>, wenn die Datei nicht abrufbar ist, <code>INVALID_DATA</code>
     *                    bei ungültigem Inhalt
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v2.0
     */
    addGeoJSONfromURL(_url, _zoomTo = false, _style = {}) {
        assertNoCallback(arguments, 3, 'addGeoJSONfromURL');
        const session = this._requireSession('addGeoJSONfromURL');
        assertString(_url, '_url', 'addGeoJSONfromURL');
        assertBoolean(_zoomTo, '_zoomTo', 'addGeoJSONfromURL');
        assertOptionalStyle(_style, '_style', 'addGeoJSONfromURL');

        return fetch(_url, {signal: session.controller.signal}).then(
            (response) => {
                if (this._isStale(session)) {
                    return this._aborted();
                }
                if (!response.ok) {
                    return fail('SERVICE_UNAVAILABLE', "Das GeoJSON unter " + _url + " ist nicht abrufbar (HTTP " + response.status + ").");
                }
                return response.json().then(
                    (geojson) => this._isStale(session)
                        ? this._aborted()
                        : this._addGeoJSON(geojson, _zoomTo, _style, session),
                    (err) => this._isStale(session)
                        ? this._aborted()
                        : fail('INVALID_DATA', "Die Datei unter " + _url + " enthält kein gültiges JSON.", err)
                );
            },
            (err) => this._isStale(session)
                ? this._aborted()
                : fail('SERVICE_UNAVAILABLE', "Das GeoJSON unter " + _url + " ist nicht abrufbar.", err)
        );
    }

    /**
     *    @description    fügt Objekte aus einem geoJSON hinzu.
     *                    Beispiel:
     *                    <code>const r = mymap.addGeoJSON(_geojson);</code>
     *
     *    @param          {object} _geojson GeoJSON-Objekt
     *
     *    @param          {boolean} [_zoomTo]
     *                    Passt den sichtbaren Bereich der Karte so an, dass alle Objekte der Vektorquelle vollständig sichtbar sind
     *
     *    @param          {import('ol/style/Style.js').StyleLike} [_style] (optional) Ausprägungs-Details<br/>
     *
     *    @returns        {Result<LayerVector>} der hinzugefügte Vektor-Layer oder <code>INVALID_DATA</code>, wenn das
     *                    GeoJSON nicht gelesen werden kann
     *
     *    @throws         {TypeError} bei ungültigen Parametern oder wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v2.0
     */
    addGeoJSON(_geojson, _zoomTo = false, _style = {}) {
        assertNoCallback(arguments, 3, 'addGeoJSON');
        const session = this._requireSession('addGeoJSON');
        assertObject(_geojson, '_geojson', 'addGeoJSON');
        assertBoolean(_zoomTo, '_zoomTo', 'addGeoJSON');
        assertOptionalStyle(_style, '_style', 'addGeoJSON');
        return this._addGeoJSON(_geojson, _zoomTo, _style, session);
    }

    /**
     * Liest das GeoJSON und fügt es als Vektor-Layer hinzu. Ungültige Daten sind ein erwartbarer Fehler.
     *
     * @param   {unknown} _geojson GeoJSON-Daten
     * @param   {boolean} _zoomTo Ausschnitt auf die Objekte anpassen
     * @param   {import('ol/style/Style.js').StyleLike} _style Ausprägungs-Details
     * @param   {Session} session Session beim Aufruf
     * @returns {Result<LayerVector>}
     */
    _addGeoJSON(_geojson, _zoomTo, _style, session) {
        let features;
        try {
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

            features = this._getGeoJSONFormat(_projectionGeoJSON).readFeatures(_geojson);
        } catch (err) {
            return fail('INVALID_DATA', "Das GeoJSON kann nicht gelesen werden.", err);
        }

        const _vectorSource = new SourceVector({features});
        const vectorLayer = new LayerVector({
            zIndex: 60,
            source: _vectorSource,
            style: _style
        });

        this.map.addLayer(vectorLayer);

        if (_zoomTo === true) {
            //warte bis View bereit ist.
            const zoomToInterval = setInterval(() => {
                if (this.map.getView().getZoom() !== undefined) {
                    clearInterval(zoomToInterval);
                    session.intervals.delete(zoomToInterval);
                    this.map.getView().fit(_vectorSource.getExtent());
                }
            }, 500);
            session.intervals.add(zoomToInterval);
        }

        return ok(vectorLayer);
    }

    /**
     *    @description    Bietet die Möglichkeit an für einen Layer ein Overlay hinzuzufügen.
     *                    Beispiel:
     *                    <code>mymap.addOverlayForLayer(_layer, _overlayFunction);</code>
     *
     *    @param          {Layer} _layer Das Layerobjekt
     *
     *    @param          {function(import('ol/Feature.js').FeatureLike): string} _overlayFunction
     *                    Funktion, die bei einem Klick auf das Objekt ausgeführt wird.
     *                    Die Funktion muss den HTML-Inhalt für ein Overlay-Fenster zurückgeben. Der Inhalt wird
     *                    ungefiltert als HTML eingesetzt.
     *
     *    @returns        {void}
     *
     *    @throws         {TypeError} wenn `_layer` kein Layer oder `_overlayFunction` keine Funktion ist
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v1.2
     */
    addOverlayForLayer(_layer, _overlayFunction) {
        this._requireSession('addOverlayForLayer');
        if (_layer == null || typeof _layer.getSource !== 'function') {
            throw new TypeError("addOverlayForLayer: _layer muss ein OpenLayers-Layer sein.");
        }
        assertFunction(_overlayFunction, '_overlayFunction', 'addOverlayForLayer');

        if (!this.overlayClickRegistered) {
            this.overlayClickRegistered = true;
            this.map.on('click', (evt) => {
                const _overlayDIV = this.overlayLayer.getElement();
                const featuredata = this.map.forEachFeatureAtPixel(
                    evt.pixel,
                    function (_feature, _layer) {
                        return {
                            "feature": _feature,
                            "layer": _layer
                        };
                    },
                    {
                        //Filter, damit nur die Features gefunden werden, für die auch der Overlay aktiviert wurde.
                        layerFilter: (_layerCandidate) => this.overlayLayers.includes(_layerCandidate)
                    }
                );
                if (featuredata) {
                    const overlayFunction = this.overlayFunctions[this.overlayLayers.indexOf(featuredata.layer)];

                    _overlayDIV.innerHTML =
                        '<div class="arrow"></div>' +
                        '<div class="content">' + overlayFunction(featuredata.feature) + '</div>';

                    this.overlayLayer.setPosition(evt.coordinate);
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

    /**
     *    @description    gibt das OpenLayer-Map-Objekt zurück.<br/>
     *
     *    @returns        {Map} die OpenLayers-Karte
     *
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v0.0
     */
    getMap() {
        this._requireSession('getMap');
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
