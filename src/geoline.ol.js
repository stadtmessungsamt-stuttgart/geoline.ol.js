/**
 * @module StmaOpenLayers
 */

import Feature from "ol/Feature.js";
import Map from "ol/Map.js";
import Overlay from "ol/Overlay.js";
import TileGrid from "ol/tilegrid/TileGrid.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
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
import {isEmpty as isEmptyExtent} from "ol/extent.js";
import {register} from 'ol/proj/proj4.js';

import proj4 from "proj4";

import {ok, fail} from './result.js';
import {RequestCache} from './request-cache.js';
import {parseConfig, stmaHostnames, serviceEntry, isHostOrSubdomain} from './config.js';
import {parseGeoJSON} from './geojson.js';
import {escapeHtml} from './html.js';
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
 * @property {RequestCache} requests
 */

const DEFAULT_POPUP_ID = 'geoline_ol_js_popup';

/**
 * Auflösungen der Stuttgarter Kachelmatrix Stuttgart_UTM_CRS_oL (m/px). Standard für EPSG:25832, damit die Zoomstufen
 * unabhängig von den eingebundenen Layern gleich bleiben und die Kacheln der Basiskarten unskaliert erscheinen.
 */
const STMA_UTM_RESOLUTIONS = [112, 56, 28, 14, 7, 2.8, 1.4, 0.7, 0.28, 0.14];

/**
 * Standards der View je unterstützter Projektion; Mittelpunkt ist jeweils Stuttgart. Angaben in _viewParams gehen vor.
 * @type {Object.<number, import('ol/View.js').ViewOptions>}
 */
const VIEW_DEFAULTS = {
    25832: {center: [513785, 5402232], zoom: 2, resolutions: STMA_UTM_RESOLUTIONS, constrainResolution: true},
    3857: {center: [1022761, 6236421], zoom: 12},
};

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
 * @typedef {import('./config.js').GeolineConfig} GeolineConfig
 * @typedef {import('./config.js').ServiceKind} ServiceKind
 */

class StmaOpenLayers {

    /** @type {GeolineConfig|null} */
    config = null;
    configUrl = null;
    configPromise = null;
    tileLoadFunction = null;
    map = null;
    projection = null;
    overlayLayer = null;
    overlayLayers = []; //Layer, für die das Overlay aktiviert ist.
    overlayFunctions = []; //Funktionen der Layer, für die das Overlay aktiviert ist.
    overlayClickRegistered = false;
    /**
     * @private
     * @type {globalThis.Map<string, FormatGeoJSON>}
     */
    geojsonFormats = new globalThis.Map();

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
        const configUrl = assertUrl(_configUrl, '_configUrl', 'StmaOpenLayers');
        const local = configUrl.hostname === 'localhost' || configUrl.hostname === '127.0.0.1';
        if (configUrl.protocol !== 'https:' && !(local && configUrl.protocol === 'http:')) {
            throw new TypeError("StmaOpenLayers: _configUrl muss HTTPS verwenden (HTTP nur für localhost), erhalten: " + _configUrl + ".");
        }
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
     * @param   {ServiceKind} kind Art des Dienstes
     * @returns {Array<string>}
     */
    _stmaHosts(kind) {
        return this.config == null ? [] : stmaHostnames(this.config, kind);
    }

    /**
     * Weist Kartendienste des Stadtmessungsamtes in den generischen Methoden zurück. Die Hosts stehen erst nach dem
     * Laden der Konfiguration fest; deshalb wird immer erst nach dem Laden geprüft, damit das Verhalten nicht vom
     * Zeitpunkt abhängt. Ist die Konfiguration nicht ladbar, entfällt die Prüfung.
     *
     * @param   {URL} url URL des Dienstes
     * @param   {ServiceKind} kind Art des Dienstes
     * @param   {string} method Name der aufgerufenen Methode
     * @param   {string} stmaMethod Name der passenden addStma*-Methode
     * @returns {Promise<void>}
     */
    _rejectStmaHost(url, kind, method, stmaMethod) {
        return this._loadConfig().then(() => {
            if (this._stmaHosts(kind).includes(url.hostname)) {
                throw new TypeError(method + ": Kartendienste des Stadtmessungsamtes über die Methode " + stmaMethod + " hinzufügen.");
            }
        });
    }

    /**
     * Lädt und prüft die Konfiguration einmal je Karte. Gleichzeitige Aufrufe teilen sich den Abruf; nach einem
     * Fehler startet der nächste Aufruf einen neuen.
     *
     * @returns {Promise<Result<GeolineConfig>>}
     */
    _loadConfig() {
        if (this.config != null) {
            return Promise.resolve(ok(this.config));
        }
        if (this.configPromise) {
            return this.configPromise;
        }
        // Nur Origin und Pfad: Query und Fragment können Daten der Anwendung enthalten
        const params = new URLSearchParams({
            // GEOLINE_VERSION setzt der Dist-Build beim Kompilieren ein
            v: GEOLINE_VERSION,
            epsg: this.projection,
            url: typeof location !== 'undefined' ? location.origin + location.pathname : ''
        }).toString();
        // Abruf gehört zur Karte, die ihn gestartet hat; nach dispose() darf er die nächste Karte nicht verändern.
        const session = this._session;
        const promise = fetch(this.configUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: params,
            signal: session?.controller.signal
        }).then(
            (response) => response.ok
                ? response.json().then(
                    (data) => parseConfig(data),
                    (err) => fail('INVALID_DATA', "Die Antwort des Konfigurationsdienstes ist kein gültiges JSON.", err))
                : fail('CONFIG_UNAVAILABLE', "Der Konfigurationsdienst antwortet mit HTTP " + response.status + "."),
            (err) => fail('CONFIG_UNAVAILABLE', "Die Konfiguration des Stadtmessungsamtes konnte nicht geladen werden.", err)
        ).then((result) => {
            if (session !== this._session) {
                return this._aborted();
            }
            if (result.ok) {
                this.config = result.value;
            } else if (this.configPromise === promise) {
                this.configPromise = null;
            }
            return result;
        });
        this.configPromise = promise;
        return promise;
    }

    /**
     * Get a cached GeoJSON format instance for a specific dataProjection.
     * The instance is created with featureProjection set to the current map projection.
     * @param {string} dataProjection Projektion der GeoJSON-Daten, z. B. EPSG:4326
     * @returns {FormatGeoJSON}
     * @private
     */
    _getGeoJSONFormat(dataProjection) {
        const key = dataProjection + '->' + this.projection;
        let fmt = this.geojsonFormats.get(key);
        if (!fmt) {
            fmt = new FormatGeoJSON({
                dataProjection: dataProjection,
                featureProjection: this.projection
            });
            this.geojsonFormats.set(key, fmt);
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
        // Fehler beim Aufbau des Layers sind interne Fehler und bleiben Rejections.
        return session.requests.fetchText(_url + "?f=json").then(
            (response) => {
                if (this._isStale(session)) {
                    return this._aborted();
                }
                if (!response.ok) {
                    return response;
                }
                /** @type {AGSInfo} */
                let ags_info;
                try {
                    ags_info = JSON.parse(response.value);
                } catch (err) {
                    return fail('INVALID_DATA', "Der Kartendienst " + _url + " liefert kein gültiges JSON.", err);
                }
                if (ags_info === null || typeof ags_info !== 'object') {
                    return fail('INVALID_DATA', "Der Kartendienst " + _url + " liefert keine Dienstbeschreibung.");
                }
                if (ags_info.error !== undefined) {
                    return fail('SERVICE_ERROR', "Der Kartendienst " + _url + " meldet einen Fehler: " + ags_info.error.message, ags_info.error);
                }

                //Copyright: OpenLayers rendert Attributionen als HTML, copyrightText ist reiner Text
                const url = new URL(_url);
                const copyright = typeof ags_info.copyrightText === 'string' ? ags_info.copyrightText : '';
                ags_info.copyrightText = copyright.length > 0 ? escapeHtml(copyright)
                    : this._stmaHosts('ags').includes(url.hostname) ? "© Stadtmessungsamt, LHS Stuttgart" : undefined;

                //AGS Kartendienst von Esri? Der Copyright-Vermerk muss immer sichtbar sein
                if (isHostOrSubdomain(url.hostname, "arcgisonline.com") || isHostOrSubdomain(url.hostname, "arcgis.com")) {
                    const attribution = this.map.getControls().getArray().find((control) => control instanceof ControlAttribution);
                    attribution?.setCollapsible(false);
                    attribution?.setCollapsed(false);
                }

                //Ist es ein gecachter Dienst? -> gecachten, sonst dynamischen Dienst hinzufügen
                return ags_info.singleFusedMapCache === true
                    ? this._initCachedLayer(_url, _layerParams, _sourceParams, ags_info)
                    : ok(this._initDynamicLayer(_url, _layerParams, _sourceParams, ags_info));
            }
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

        return session.requests.fetchText(_url).then(
            (response) => {
                if (this._isStale(session)) {
                    return this._aborted();
                }
                if (!response.ok) {
                    return response;
                }
                const xml = response.value;

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

                // WMTS-Kacheln werden nicht reprojiziert (Entscheidung offen, Rückfrage R4 an das Stadtmessungsamt)
                const mapProjection = this.map.getView().getProjection();
                const layerProj = sourceParams.projection ? getProjection(sourceParams.projection) : mapProjection;
                if (layerProj?.getCode() !== mapProjection.getCode()) {
                    return fail('PROJECTION_MISMATCH',
                        "Der WMTS-Layer " + _layerName + " liegt in " + layerProj?.getCode() + ", die Karte in " +
                        mapProjection.getCode() + ". WMTS-Kacheln werden nicht reprojiziert.");
                }

                // GeoServer gibt den TopLeftCorner für urn:ogc:def:crs:EPSG::3857 in der Achsfolge Nord/Ost an, OpenLayers
                // liest für EPSG:3857 Ost/Nord. Nur dann die Ursprünge tauschen; alles andere aus den Capabilities bleibt.
                const tileGrid = sourceParams.tileGrid;
                if (mapProjection.getCode() === 'EPSG:3857' && tileGrid != null) {
                    const resolutions = tileGrid.getResolutions();
                    const origins = resolutions.map((_, z) => tileGrid.getOrigin(z));
                    if (origins.every(([x, y]) => x > 0 && y < 0)) {
                        sourceParams.tileGrid = new WMTSTileGrid({
                            origins: origins.map(([x, y]) => [y, x]),
                            resolutions,
                            matrixIds: tileGrid.getMatrixIds(),
                            tileSizes: resolutions.map((_, z) => tileGrid.getTileSize(z)),
                            extent: tileGrid.getExtent() ?? undefined
                        });
                    }
                }

                // STMA-spezifisch (REST-Template, Attribution, zIndex)
                let zIndex = 10;
                const predefined = {};
                if (this._stmaHosts('wmts').includes(url.hostname)) {
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

                this.map.addLayer(layer);
                return ok(layer);
            }
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
        if (this._stmaHosts('wms').includes(url.hostname)) {
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
            if (this._stmaHosts('wms').includes(url.hostname)) {
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
            if (this._stmaHosts('wms').includes(url.hostname)) {
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
     * @returns     {Result<Layer>}
     *
     * @since v0.0
     */
    _initCachedLayer(_url, _layerParams, _sourceParams, ags_info) {
        const tileInfo = ags_info.tileInfo;
        const fullExtent = ags_info.fullExtent;
        const lods = tileInfo?.lods;
        if (!Array.isArray(lods) || lods.length === 0 || tileInfo.origin == null || fullExtent == null
            || !Number.isInteger(tileInfo.rows) || !Number.isInteger(tileInfo.cols)) {
            return fail('INVALID_DATA', "Der gecachte Kartendienst " + _url + " liefert keine vollständigen Kachelinformationen (tileInfo, fullExtent).");
        }
        // Projektion des Dienstes; die Karte behält ihre eigene, OpenLayers reprojiziert die Kacheln bei Bedarf
        const wkid = ags_info.spatialReference?.latestWkid ?? ags_info.spatialReference?.wkid;
        // ArcGIS 10.0 meldet Web Mercator teils noch als 102100
        const serviceProjection = getProjection("EPSG:" + (wkid === 102100 ? 3857 : wkid));
        if (wkid == null || serviceProjection == null) {
            return fail('PROJECTION_MISMATCH', "Die Projektion " + wkid + " des Kartendienstes " + _url + " ist nicht bekannt.");
        }

        const tileGrid = new TileGrid({
            origin: [tileInfo.origin.x, tileInfo.origin.y],
            extent: [fullExtent.xmin, fullExtent.ymin, fullExtent.xmax, fullExtent.ymax],
            minZoom: 0,
            resolutions: lods.map((lod) => lod.resolution),
            // OpenLayers erwartet [Breite, Höhe], ArcGIS liefert Spalten (Breite) und Zeilen (Höhe) getrennt
            tileSize: [tileInfo.cols, tileInfo.rows]
        });

        //sourceParams
        let sourceParams = {
            minZoom: 0
        };

        //diese Parameter können nicht überdefiniert werden.
        let predefinedSourceParams = {
            tileGrid: tileGrid,
            projection: serviceProjection,
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
        if (this._stmaHosts('ags').includes(url.hostname)) {
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
        return ok(layer);
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
            attributions: ags_info.copyrightText
        };
        sourceParams = {
            ...sourceParams,
            ..._sourceParams,
            ...predefinedSourceParams
        };

        //layerParams
        let _zIndex = 40;
        const url = new URL(_url);
        if (this._stmaHosts('ags').includes(url.hostname)) {
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
        if (!(_epsgCode in VIEW_DEFAULTS)) {
            throw new TypeError("initMap: _epsgCode muss 25832 oder 3857 sein, erhalten: " + _epsgCode + ".");
        }
        assertOptionalObject(_mapParams, '_mapParams', 'initMap');
        assertOptionalObject(_viewParams, '_viewParams', 'initMap');
        assertOptionalObject(_customParams, '_customParams', 'initMap');
        const customParams = _customParams ?? {};
        if (customParams.tileLoadFunction != null) {
            assertFunction(customParams.tileLoadFunction, '_customParams.tileLoadFunction', 'initMap');
        }
        let manualConfig = null;
        if (customParams.config != null) {
            const parsed = parseConfig(customParams.config);
            if (!parsed.ok) {
                throw new TypeError("initMap: _customParams.config ist ungültig. " + parsed.error.message);
            }
            manualConfig = parsed.value;
        }
        const popupId = customParams.popupId ?? DEFAULT_POPUP_ID;
        assertString(popupId, '_customParams.popupId', 'initMap');
        if (document.getElementById(popupId) !== null) {
            throw new Error("initMap: Die Popup-ID '" + popupId + "' ist im Dokument bereits vergeben. Für weitere Karten _customParams.popupId angeben.");
        }

        const controller = new AbortController();
        this._session = {controller, requests: new RequestCache(controller.signal)};

        // UTM-Projektion registrieren; EPSG:3857 und EPSG:4326 kennt OpenLayers selbst
        proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
        register(proj4);

        // Projektion der Karte; sie ändert sich bis dispose() nicht, Dienste in anderer Projektion werden reprojiziert oder abgewiesen
        this.projection = "EPSG:" + _epsgCode;

        // Custom-Parameter übernehmen
        if (customParams.tileLoadFunction) {
            this.tileLoadFunction = customParams.tileLoadFunction;
        }
        if (manualConfig != null) {
            console.warn("Konfiguration wurde manuell gesetzt und wird nicht vom Server des Stadtmessungsamtes geladen. Bitte stellen Sie sicher, dass die Konfiguration immer aktuell ist.");
            this.config = manualConfig;
        } else {
            // Config frühzeitig (asynchron) laden; Fehler erreichen die Aufrufer der Layer-Methoden als Result
            void this._loadConfig();
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

        // controls: null schaltet die Bedienelemente ab; die Attribution bleibt, weil die Quellenangabe Pflicht ist
        if (mapParams.controls === null) {
            mapParams.controls = [];
        }
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

        // Die View entsteht einmal und wird von keinem Layer ersetzt; eigene Angaben in _viewParams bleiben erhalten
        mapParams.view = new View({
            ...VIEW_DEFAULTS[_epsgCode],
            ..._viewParams,
            projection: getProjection(this.projection)
        });

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
     *    @description  gibt die Karte frei: bricht laufende Anfragen ab, entfernt wartende Zooms, Listener, Overlays und
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
        this.map.dispose();

        this.map = null;
        this.overlayLayer = null;
        this.overlayLayers = [];
        this.overlayFunctions = [];
        this.overlayClickRegistered = false;
        this.geojsonFormats.clear();
        this.config = null;
        this.configPromise = null;
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
        return this._rejectStmaHost(url, 'ags', 'addEsriLayer', 'addStmaEsriLayer').then(() =>
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
        return this._rejectStmaHost(url, 'wmts', 'addWMTSLayer', 'addStmaWMTSLayer').then(() =>
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
        return this._rejectStmaHost(url, 'wms', 'addWMSLayer', 'addStmaWMSLayer').then(() =>
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
            const ags = serviceEntry(config.ags_services, _mapname);
            const wmts = serviceEntry(config.wmts_services, _mapname);
            const wms = serviceEntry(config.wms_services, _mapname);

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
        const parsed = parseGeoJSON(_geojson);
        if (!parsed.ok) {
            return parsed;
        }
        const dataProjection = parsed.value;
        if (getProjection(dataProjection) == null) {
            return fail('PROJECTION_MISMATCH', "Die Projektion " + dataProjection + " des GeoJSON ist nicht bekannt.");
        }

        let features;
        try {
            features = this._getGeoJSONFormat(dataProjection).readFeatures(_geojson);
        } catch (err) {
            return fail('INVALID_DATA', "Das GeoJSON kann nicht gelesen werden.", err);
        }

        const vectorSource = new SourceVector({features});
        const vectorLayer = new LayerVector({
            zIndex: 60,
            source: vectorSource,
            style: _style
        });
        this.map.addLayer(vectorLayer);

        const extent = vectorSource.getExtent();
        if (_zoomTo === true && !isEmptyExtent(extent)) {
            this._fitWhenReady(extent, session);
        }
        return ok(vectorLayer);
    }

    /**
     * Passt den Ausschnitt an, sobald View und Kartengröße feststehen. Vorher würde fit() ohne Größe scheitern.
     * Das Warten endet mit dispose(), weil map.dispose() die Listener entfernt.
     *
     * @param   {import('ol/extent.js').Extent} extent Ausschnitt
     * @param   {Session} session Session beim Aufruf
     * @returns {void}
     */
    _fitWhenReady(extent, session) {
        const fit = () => this.map.getView().fit(extent);
        if (this.map.getSize() != null && this.map.getView().isDef()) {
            fit();
            return;
        }
        // Gerendert wird erst, wenn Größe und View bereit sind
        this.map.once('postrender', () => {
            if (!this._isStale(session)) {
                fit();
            }
        });
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
     *                    ungefiltert als HTML eingesetzt: Werte aus Kartendiensten, Daten oder Benutzereingaben muss
     *                    die Anwendung vorher escapen. Das Popup-Element hat die Klasse `geoline-ol-js-popup` und die ID
     *                    aus `initMap(…, {popupId})`; darin stehen `div.arrow` und `div.content` mit dem Inhalt.
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

    /**
     *    @description    lädt die Konfiguration der Kartendienste des Stadtmessungsamtes, z. B. um sie für die
     *                    Offline-Nutzung zu speichern und später über <code>initMap(…, {config})</code> zu übergeben.<br/>
     *                    Liefert nie einen Platzhalter: Die Promise erfüllt sich erst, wenn die Konfiguration geladen ist.
     *                    Nach einem Fehler startet der nächste Aufruf einen neuen Abruf.<br/>
     *                    Beispiel:<br/>
     *                    <code>const r = await mymap.loadConfig();</code>
     *
     *    @returns        {Promise<Result<GeolineConfig>>} die geprüfte Konfiguration oder ein erwartbarer Fehler:
     *                    <code>CONFIG_UNAVAILABLE</code>, wenn der Dienst nicht erreichbar ist, <code>INVALID_DATA</code>
     *                    bei ungültiger Antwort, <code>ABORTED</code> nach dispose()
     *
     *    @throws         {TypeError} wenn ein Callback übergeben wird
     *    @throws         {Error} wenn keine Karte initialisiert ist
     *
     *    @since          v4.0
     */
    loadConfig() {
        assertNoCallback(arguments, 0, 'loadConfig');
        this._requireSession('loadConfig');
        return this._loadConfig();
    }
}

/*
 * Default Export für moderne ES6 Imports
 */
// noinspection JSUnusedGlobalSymbols
export default StmaOpenLayers;
