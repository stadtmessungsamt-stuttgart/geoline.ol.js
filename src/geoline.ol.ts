/**
 * @module StmaOpenLayers
 */

import Collection from "ol/Collection.js";
import Feature, {type FeatureLike} from "ol/Feature.js";
import Map, {type MapOptions} from "ol/Map.js";
import Overlay from "ol/Overlay.js";
import TileGrid from "ol/tilegrid/TileGrid.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
import View, {type ViewOptions} from "ol/View.js";
import type Control from "ol/control/Control.js";
import ControlAttribution from "ol/control/Attribution.js";
import FormatGeoJSON from "ol/format/GeoJSON.js";
import FormatWMTSCapabilities from "ol/format/WMTSCapabilities.js";
import GeomPoint from "ol/geom/Point.js";
import type OLLayer from "ol/layer/Layer.js";
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
import StyleStyle, {type StyleLike} from "ol/style/Style.js";
import type {FlatStyleLike} from "ol/style/flat.js";
import type {LoadFunction} from "ol/Tile.js";
import type {Coordinate} from "ol/coordinate.js";
import type {Extent} from "ol/extent.js";
import type {Pixel} from "ol/pixel.js";
import {defaults as defaultControls} from 'ol/control.js';
import {get as getProjection} from "ol/proj.js";
import {isEmpty as isEmptyExtent} from "ol/extent.js";
import {register} from 'ol/proj/proj4.js';

import proj4 from "proj4";

import {ok, fail, type Result} from './result.js';
import {RequestCache} from './request-cache.js';
import {parseConfig, stmaHostnames, serviceEntry, isHostOrSubdomain, type GeolineConfig, type ServiceKind} from './config.js';
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

export type {ErrorCode, GeolineError, Result} from './result.js';
export type {AGSServiceEntry, WMTSServiceEntry, WMSServiceEntry, GeolineConfig, ServiceKind} from './config.js';

/** OpenLayers-Layer, wie ihn die `add*`-Methoden liefern. */
export type Layer = OLLayer;

// GEOLINE_VERSION setzt der Dist-Build beim Kompilieren ein (DefinePlugin)
declare const GEOLINE_VERSION: string;

/**
 * Zustand einer initialisierten Karte. Wird bei dispose() verworfen; verspätete Ergebnisse erkennen daran,
 * dass sie zu einer früheren Karte gehören.
 */
interface Session {
    controller: AbortController;
    requests: RequestCache;
}

/** Zusätzliche Parameter, die die Anwendung an OpenLayers-Layer und -Quellen durchreicht. */
type Params = Record<string, unknown>;

/** Inhalt eines Popups: String als HTML, ein DOM-Knoten unverändert, leer lässt das Popup geschlossen. */
type OverlayFunction = (feature: FeatureLike) => string | Node | null | undefined;

/** Raumbezug eines ArcGIS-Dienstes. */
export interface AGSSpatialReference {
    wkid?: number;
    latestWkid?: number;
}

/** Zoomstufe eines gecachten ArcGIS-Dienstes. */
export interface AGSTileInfoLOD {
    level: number;
    resolution: number;
    scale: number;
}

/** Kachelschema eines gecachten ArcGIS-Dienstes. */
export interface AGSTileInfo {
    origin: {x: number; y: number};
    rows: number;
    cols: number;
    lods: Array<AGSTileInfoLOD>;
}

/** Ausdehnung eines ArcGIS-Dienstes. */
export interface AGSExtent {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
}

/** Dienstbeschreibung eines ArcGIS-Dienstes (`…/MapServer?f=json`), soweit geoline.ol.js sie nutzt. */
export interface AGSInfo {
    currentVersion?: number;
    singleFusedMapCache?: boolean;
    tileInfo?: AGSTileInfo;
    fullExtent?: AGSExtent;
    spatialReference?: AGSSpatialReference;
    copyrightText?: string;
    error?: {code: number; message: string};
}

/** Zusätzliche Parameter für geoline.ol.js in `initMap`. */
export interface GeolineCustomParams {
    /** Funktion, die bei gecachten Kartendiensten eine Kachel lädt, z. B. `(imageTile, src) => { imageTile.getImage().src = src; }`. */
    tileLoadFunction?: LoadFunction;
    /**
     * Ersetzt die Konfiguration, die sonst vom Server des Stadtmessungsamtes geladen wird. Nur sparsam nutzen, z. B. für
     * die Offlineverfügbarkeit in Apps; die übergebene Konfiguration muss aktuell sein.
     */
    config?: GeolineConfig;
    /**
     * ID des Popup-Elements, Standard `geoline_ol_js_popup`. Bei mehreren Karten auf einer Seite braucht jede weitere
     * Karte eine eigene ID. Das Element trägt immer die Klasse `geoline-ol-js-popup`.
     */
    popupId?: string;
    /** `true` lässt das Kontextmenü des Browsers auf der Karte zu. Standard `false`: Ein Rechtsklick öffnet kein Menü. */
    contextMenu?: boolean;
}

const DEFAULT_POPUP_ID = 'geoline_ol_js_popup';

/**
 * Auflösungen der Stuttgarter Kachelmatrix Stuttgart_UTM_CRS_oL (m/px). Standard für EPSG:25832, damit die Zoomstufen
 * unabhängig von den eingebundenen Layern gleich bleiben und die Kacheln der Basiskarten unskaliert erscheinen.
 */
const STMA_UTM_RESOLUTIONS = [112, 56, 28, 14, 7, 2.8, 1.4, 0.7, 0.28, 0.14];

/** Standards der View je unterstützter Projektion; Mittelpunkt ist jeweils Stuttgart. Angaben in _viewParams gehen vor. */
const VIEW_DEFAULTS: Record<number, ViewOptions> = {
    25832: {center: [513785, 5402232], zoom: 2, resolutions: STMA_UTM_RESOLUTIONS, constrainResolution: true},
    3857: {center: [1022761, 6236421], zoom: 12},
};

/**
 * Karte mit den Kartendiensten des Stadtmessungsamtes Stuttgart auf Basis von OpenLayers.
 *
 * @example
 * ```js
 * const mymap = new StmaOpenLayers();
 * mymap.initMap(25832, {target: 'map'});
 * const r = await mymap.addStmaBaseLayer('Basemap');
 * ```
 */
class StmaOpenLayers {

    private config: GeolineConfig | null = null;
    private configUrl: string;
    private configPromise: Promise<Result<GeolineConfig>> | null = null;
    private tileLoadFunction: LoadFunction | null = null;
    private map: Map | null = null;
    private projection: string | null = null;
    private overlayLayer: Overlay | null = null;
    private overlayLayers: Layer[] = []; //Layer, für die das Overlay aktiviert ist.
    private overlayFunctions: OverlayFunction[] = []; //Funktionen der Layer, für die das Overlay aktiviert ist.
    private overlayClickRegistered = false;
    private _addedTabIndex: HTMLElement | null = null;
    private geojsonFormats = new globalThis.Map<string, FormatGeoJSON>();
    private _session: Session | null = null;

    /**
     * Konstruktor
     *
     * @param _configUrl Basis-URL für den Abruf der Geoline-Basiskonfiguration. Wird als vorbelegter Parameter verwendet.
     *
     * @throws TypeError, wenn `_configUrl` keine absolute URL ist oder nicht HTTPS verwendet (HTTP nur für localhost)
     */
    constructor(_configUrl: string = "https://gis5.stuttgart.de/geoline/geoline.config/config.aspx") {
        const configUrl = assertUrl(_configUrl, '_configUrl', 'StmaOpenLayers');
        const local = configUrl.hostname === 'localhost' || configUrl.hostname === '127.0.0.1';
        if (configUrl.protocol !== 'https:' && !(local && configUrl.protocol === 'http:')) {
            throw new TypeError("StmaOpenLayers: _configUrl muss HTTPS verwenden (HTTP nur für localhost), erhalten: " + _configUrl + ".");
        }
        this.configUrl = _configUrl;
    }

    /** Die Karte der aktiven Session; nur nach initMap() und vor dispose() aufrufen. */
    private get olMap(): Map {
        if (this.map == null) {
            throw new Error("Keine aktive Karte. Zuerst initMap() aufrufen (nach dispose() erneut).");
        }
        return this.map;
    }

    /**
     * Liefert die aktive Session oder wirft einen Fehler, wenn keine Karte initialisiert ist.
     *
     * @param method Name der aufgerufenen Methode für die Fehlermeldung
     */
    private _requireSession(method: string): Session {
        if (this._session == null) {
            throw new Error(method + ": Keine aktive Karte. Zuerst initMap() aufrufen (nach dispose() erneut).");
        }
        return this._session;
    }

    /**
     * Ergebnis für Vorgänge, deren Karte inzwischen mit dispose() freigegeben wurde.
     *
     * @param session Session beim Start des Vorgangs
     */
    private _isStale(session: Session): boolean {
        return session !== this._session;
    }

    private _aborted(): Result<never> {
        return fail('ABORTED', 'Der Vorgang wurde durch dispose() abgebrochen.');
    }

    /**
     * Hosts der Kartendienste des Stadtmessungsamtes aus der geladenen Konfiguration, ohne einen Abruf auszulösen.
     *
     * @param kind Art des Dienstes
     */
    private _stmaHosts(kind: ServiceKind): string[] {
        return this.config == null ? [] : stmaHostnames(this.config, kind);
    }

    /**
     * Weist Kartendienste des Stadtmessungsamtes in den generischen Methoden zurück. Die Hosts stehen erst nach dem
     * Laden der Konfiguration fest; deshalb wird immer erst nach dem Laden geprüft, damit das Verhalten nicht vom
     * Zeitpunkt abhängt. Ist die Konfiguration nicht ladbar, entfällt die Prüfung.
     *
     * @param url URL des Dienstes
     * @param kind Art des Dienstes
     * @param method Name der aufgerufenen Methode
     * @param stmaMethod Name der passenden addStma*-Methode
     */
    private _rejectStmaHost(url: URL, kind: ServiceKind, method: string, stmaMethod: string): Promise<void> {
        return this._loadConfig().then(() => {
            if (this._stmaHosts(kind).includes(url.hostname)) {
                throw new TypeError(method + ": Kartendienste des Stadtmessungsamtes über die Methode " + stmaMethod + " hinzufügen.");
            }
        });
    }

    /**
     * Lädt und prüft die Konfiguration einmal je Karte. Gleichzeitige Aufrufe teilen sich den Abruf; nach einem
     * Fehler startet der nächste Aufruf einen neuen.
     */
    private _loadConfig(): Promise<Result<GeolineConfig>> {
        if (this.config != null) {
            return Promise.resolve(ok(this.config));
        }
        if (this.configPromise) {
            return this.configPromise;
        }
        // Nur Origin und Pfad: Query und Fragment können Daten der Anwendung enthalten
        const params = new URLSearchParams({
            v: GEOLINE_VERSION,
            epsg: String(this.projection),
            url: typeof location !== 'undefined' ? location.origin + location.pathname : ''
        }).toString();
        // Abruf gehört zur Karte, die ihn gestartet hat; nach dispose() darf er die nächste Karte nicht verändern.
        const session = this._session;
        const promise: Promise<Result<GeolineConfig>> = fetch(this.configUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: params,
            signal: session?.controller.signal
        }).then(
            (response): Promise<Result<GeolineConfig>> | Result<GeolineConfig> => response.ok
                ? response.json().then(
                    (data: unknown) => parseConfig(data),
                    (err: unknown) => fail('INVALID_DATA', "Die Antwort des Konfigurationsdienstes ist kein gültiges JSON.", err))
                : fail('CONFIG_UNAVAILABLE', "Der Konfigurationsdienst antwortet mit HTTP " + response.status + "."),
            (err: unknown) => fail('CONFIG_UNAVAILABLE', "Die Konfiguration des Stadtmessungsamtes konnte nicht geladen werden.", err)
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
     * Liefert eine zwischengespeicherte GeoJSON-Format-Instanz je Datenprojektion, mit der Projektion der Karte als
     * featureProjection.
     *
     * @param dataProjection Projektion der GeoJSON-Daten, z. B. EPSG:4326
     */
    private _getGeoJSONFormat(dataProjection: string): FormatGeoJSON {
        const key = dataProjection + '->' + this.projection;
        let fmt = this.geojsonFormats.get(key);
        if (!fmt) {
            fmt = new FormatGeoJSON({
                dataProjection: dataProjection,
                featureProjection: this.projection ?? undefined
            });
            this.geojsonFormats.set(key, fmt);
        }
        return fmt;
    }

    /**
     * Fügt einen ArcGIS-Dienst hinzu (gecacht oder dynamisch).
     *
     * @param _url URL zum AGS-Dienst
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     * @param session Session beim Aufruf
     */
    private _addEsriLayer(_url: string, _layerParams: Params, _sourceParams: Params, session: Session): Promise<Result<Layer>> {
        // Fehler beim Aufbau des Layers sind interne Fehler und bleiben Rejections.
        return session.requests.fetchText(_url + "?f=json").then(
            (response): Result<Layer> => {
                if (this._isStale(session)) {
                    return this._aborted();
                }
                if (!response.ok) {
                    return response;
                }
                let parsed: unknown;
                try {
                    parsed = JSON.parse(response.value);
                } catch (err) {
                    return fail('INVALID_DATA', "Der Kartendienst " + _url + " liefert kein gültiges JSON.", err);
                }
                if (parsed === null || typeof parsed !== 'object') {
                    return fail('INVALID_DATA', "Der Kartendienst " + _url + " liefert keine Dienstbeschreibung.");
                }
                // Die einzelnen Felder werden dort geprüft, wo sie verwendet werden (Kachelinformationen, Projektion, Copyright)
                const ags_info = parsed as AGSInfo;
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
                    const attribution = this.olMap.getControls().getArray().find((control) => control instanceof ControlAttribution);
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
     * Fügt einen gecachten WMTS-Kartendienst hinzu.
     *
     * @param _url GetCapabilities-URL zum WMTS
     * @param _layerName Name des Layers, der eingebunden werden soll
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     * @param session Session beim Aufruf
     */
    private _addWMTSLayer_impl(_url: string, _layerName: string, _layerParams: Params, _sourceParams: Params, session: Session): Promise<Result<Layer>> {
        const url = new URL(_url);

        return session.requests.fetchText(_url).then(
            (response): Result<Layer> => {
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
                const mapProjection = this.olMap.getView().getProjection();
                const layerProj = sourceParams.projection ? getProjection(sourceParams.projection) : mapProjection;
                if (layerProj?.getCode() !== mapProjection.getCode()) {
                    return fail('PROJECTION_MISMATCH',
                        "Der WMTS-Layer " + _layerName + " liegt in " + layerProj?.getCode() + ", die Karte in " +
                        mapProjection.getCode() + ". WMTS-Kacheln werden nicht reprojiziert.");
                }

                // GeoServer gibt den TopLeftCorner für urn:ogc:def:crs:EPSG::3857 in der Achsfolge Nord/Ost an, OpenLayers
                // liest für EPSG:3857 Ost/Nord. Nur dann die Ursprünge tauschen; alles andere aus den Capabilities bleibt.
                const tileGrid = sourceParams.tileGrid;
                if (mapProjection.getCode() === 'EPSG:3857' && tileGrid instanceof WMTSTileGrid) {
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
                const predefined: Partial<ConstructorParameters<typeof SourceWMTS>[0]> = {};
                if (this._stmaHosts('wmts').includes(url.hostname)) {
                    predefined.urls = [
                        url.origin + url.pathname +
                        "/rest/" + _layerName + "/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}?format=image/png"
                    ];
                    predefined.requestEncoding = 'REST';
                    predefined.attributions = '© Stadtmessungsamt, LHS Stuttgart';
                    zIndex = 20;
                }

                // finale Source-Parameter (User-Params zuletzt, aber Projektion unverändert lassen).
                // Die Parameter der Anwendung reicht geoline ungeprüft an OpenLayers weiter.
                const finalSourceParams = {
                    ...sourceParams,
                    ...predefined,
                    ..._sourceParams,
                    projection: layerProj
                } as ConstructorParameters<typeof SourceWMTS>[0];

                // Layer bauen
                const layer = new LayerTile({
                    zIndex,
                    ..._layerParams,
                    source: new SourceWMTS(finalSourceParams)
                });

                this.olMap.addLayer(layer);
                return ok(layer);
            }
        );
    }

    /**
     * Fügt einen dynamischen WMS-Kartendienst hinzu. Mit `{TILED: true}` in `_sourceParams` gekachelt, sonst als ganzes
     * Bild.
     *
     * @param _url URL zum WMS
     * @param _layerName Name des Layers, der eingebunden werden soll
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     */
    private _addWMSLayer(_url: string, _layerName: string, _layerParams: Params, _sourceParams: Params): Layer {

        //diese Parameter können nicht überdefiniert werden.
        const predefinedSourceParams: Params = {
            ratio: 1
        };

        const url = new URL(_url);
        if (this._stmaHosts('wms').includes(url.hostname)) {
            //Copyrighthinweis
            predefinedSourceParams.attributions = "© Stadtmessungsamt, LHS Stuttgart";
        }

        // Die Parameter der Anwendung reicht geoline ungeprüft an OpenLayers weiter
        const sourceParams = {
            url: _url,
            params: {"LAYERS": _layerName},
            ..._sourceParams,
            ...predefinedSourceParams
        } as ConstructorParameters<typeof SourceImageWMS>[0] & {params: Record<string, unknown>; TILED?: unknown};
        // Beim Zusammenführen von WMS-Diensten kann es vorkommen, dass der Layername nicht immer im Parameter "LAYERS" enthalten ist.
        sourceParams.params.LAYERS = _layerName;

        //Der Layer kann gekachelt oder als ganzes Bild abgerufen werden.
        let layer: Layer;
        if (sourceParams.TILED === true) {
            //gekachelter Abruf = gecacht; anderer zIndex für Stadtmessungsamt-Kartendienste
            const zIndex = this._stmaHosts('wms').includes(url.hostname) ? 20 : 10;
            layer = new LayerTile({
                zIndex,
                ..._layerParams,
                //diese Parameter können nicht überdefiniert werden.
                source: new SourceTileWMS(sourceParams as ConstructorParameters<typeof SourceTileWMS>[0])
            });
        } else {
            //Abruf als ein Bild = dynamisch; anderer zIndex für Stadtmessungsamt-Kartendienste
            const zIndex = this._stmaHosts('wms').includes(url.hostname) ? 50 : 40;
            layer = new LayerImage({
                zIndex,
                ..._layerParams,
                //diese Parameter können nicht überdefiniert werden.
                source: new SourceImageWMS(sourceParams)
            });
        }

        this.olMap.addLayer(layer);
        return layer;
    }

    /**
     * Fügt einen gecachten ArcGIS-Dienst hinzu.
     *
     * @param _url URL zum AGS-Dienst
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     * @param ags_info Dienstbeschreibung (von `…/MapServer?f=json`)
     */
    private _initCachedLayer(_url: string, _layerParams: Params, _sourceParams: Params, ags_info: AGSInfo): Result<Layer> {
        const tileInfo = ags_info.tileInfo;
        const fullExtent = ags_info.fullExtent;
        const lods = tileInfo?.lods;
        if (tileInfo == null || !Array.isArray(lods) || lods.length === 0 || tileInfo.origin == null || fullExtent == null
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

        //diese Parameter können nicht überdefiniert werden.
        const predefinedSourceParams: ConstructorParameters<typeof SourceXYZ>[0] = {
            tileGrid: tileGrid,
            projection: serviceProjection,
            attributions: ags_info.copyrightText,
            url: _url + '/tile/{z}/{y}/{x}'
        };
        if (this.tileLoadFunction != null) {
            predefinedSourceParams.tileLoadFunction = this.tileLoadFunction;
        }
        // Die Parameter der Anwendung reicht geoline ungeprüft an OpenLayers weiter
        const sourceParams = {
            minZoom: 0,
            ..._sourceParams,
            ...predefinedSourceParams
        } as ConstructorParameters<typeof SourceXYZ>[0];

        const url = new URL(_url);
        const zIndex = this._stmaHosts('ags').includes(url.hostname) ? 20 : 10;

        //gecachten Layer erstellen; source kann nicht überdefiniert werden
        const layer = new LayerTile({
            zIndex,
            ..._layerParams,
            source: new SourceXYZ(sourceParams)
        });

        //Layer hinzufügen
        this.olMap.addLayer(layer);
        return ok(layer);
    }

    /**
     * Fügt einen dynamischen ArcGIS-Dienst hinzu.
     *
     * @param _url URL zum AGS-Dienst
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     * @param ags_info Dienstbeschreibung (von `…/MapServer?f=json`)
     */
    private _initDynamicLayer(_url: string, _layerParams: Params, _sourceParams: Params, ags_info: AGSInfo): Layer {
        // Die Parameter der Anwendung reicht geoline ungeprüft an OpenLayers weiter; ratio, url und attributions
        // können nicht überdefiniert werden.
        const sourceParams = {
            params: {layers: 'show:0'},
            ..._sourceParams,
            ratio: 1,
            url: _url,
            attributions: ags_info.copyrightText
        } as ConstructorParameters<typeof SourceImageArcGISRest>[0];

        const url = new URL(_url);
        //damit liegen die dynamischen Dienste über den gecachten Diensten (wenn nicht überkonfiguriert wird)
        const zIndex = this._stmaHosts('ags').includes(url.hostname) ? 50 : 40;

        //dynamischen Layer erstellen; source kann nicht überdefiniert werden
        const layer = new LayerImage({
            zIndex,
            ..._layerParams,
            source: new SourceImageArcGISRest(sourceParams)
        });
        //Layer hinzufügen
        this.olMap.addLayer(layer);
        return layer;
    }

    /**
     * Initialisiert die Karte.
     *
     * @param _epsgCode EPSG-Code des Koordinatensystems. Unterstützt werden 25832 und 3857
     *                  (siehe {@link https://epsg.io/25832}, {@link https://epsg.io/3857}).
     * @param _mapParams zusätzliche Parameter für das OpenLayers-Map-Objekt. `controls: null` schaltet die
     *                   Bedienelemente ab, die Quellenangabe bleibt.
     * @param _viewParams zusätzliche Parameter für das OpenLayers-View-Objekt
     * @param _customParams zusätzliche Parameter für geoline.ol.js: `tileLoadFunction`, `config`, `popupId`,
     *                      `contextMenu` (siehe {@link GeolineCustomParams})
     *
     * @returns die OpenLayers-Karte
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn die Instanz bereits eine Karte hat oder die Popup-ID im Dokument vergeben ist
     *
     * @example
     * ```js
     * const mymap = new StmaOpenLayers();
     * const map = mymap.initMap(25832, {target: 'map'}, {});
     * ```
     *
     * @since v0.0
     */
    initMap(_epsgCode: number, _mapParams: object = {}, _viewParams: object = {}, _customParams: GeolineCustomParams = {}): Map {
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
        let manualConfig: GeolineConfig | null = null;
        if (customParams.config != null) {
            const parsed = parseConfig(customParams.config);
            if (!parsed.ok) {
                throw new TypeError("initMap: _customParams.config ist ungültig. " + parsed.error.message);
            }
            manualConfig = parsed.value;
        }
        const contextMenu: unknown = customParams.contextMenu ?? false;
        assertBoolean(contextMenu, '_customParams.contextMenu', 'initMap');
        const popupId: unknown = customParams.popupId ?? DEFAULT_POPUP_ID;
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
        const projection = "EPSG:" + _epsgCode;
        this.projection = projection;

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

        // Map-Parameter zusammenbauen; die Parameter der Anwendung reicht geoline ungeprüft an OpenLayers weiter
        const mapParams = {
            target: "map",
            controls: defaultControls({
                attribution: false
            }),
            // Die Kartendienste liefern Kacheln für 1 Bildpunkt je Pixel; höhere Werte laden mehr Kacheln und
            // verkleinern Beschriftungen. Für hochauflösende Dienste in _mapParams überschreibbar.
            pixelRatio: 1,
            ..._mapParams,
            logo: false,
            loadTilesWhileAnimating: true, //Kacheln während des Zoomens nachladen
            loadTilesWhileInteracting: true
        } as MapOptions & {controls?: Collection<Control> | Control[] | null};

        // controls: null schaltet die Bedienelemente ab; die Attribution bleibt, weil die Quellenangabe Pflicht ist
        if (mapParams.controls === null) {
            mapParams.controls = [];
        }
        // Attribution-Control sicherstellen (z. B. für Esri-Dienste)
        const controls = mapParams.controls;
        if (controls != null) {
            const list = controls instanceof Collection ? controls.getArray() : controls;
            if (!list.some((control) => control instanceof ControlAttribution)) {
                const attribution = new ControlAttribution({
                    tipLabel: "Copyright",
                    collapsible: true
                });
                if (controls instanceof Collection) {
                    controls.push(attribution);
                } else {
                    controls.push(attribution);
                }
            }
        }

        // Die View entsteht einmal und wird von keinem Layer ersetzt; eigene Angaben in _viewParams bleiben erhalten
        mapParams.view = new View({
            ...VIEW_DEFAULTS[_epsgCode],
            ..._viewParams,
            projection: getProjection(projection) ?? undefined
        });

        // Map erzeugen
        const map = new Map(mapParams);
        this.map = map;

        // OpenLayers legt den Viewport im Konstruktor an; die Typen erlauben trotzdem undefined
        const viewport = map.getViewport();
        // Die mitgelieferten Styles gelten nur innerhalb dieser Klasse
        viewport?.classList.add('geoline-ol-js-map');
        if (!contextMenu) {
            viewport?.addEventListener("contextmenu", (e) => e.preventDefault());
        }

        // Popup-Element sofort anlegen, damit die ID für weitere Karten auf der Seite als vergeben erkennbar ist
        const popupElement = document.createElement('div');
        popupElement.id = popupId;
        popupElement.className = 'geoline-ol-js-popup';
        popupElement.setAttribute('role', 'dialog');
        popupElement.setAttribute('aria-label', 'Informationen zum Kartenobjekt');
        popupElement.tabIndex = -1;
        popupElement.style.display = 'none';
        const arrow = document.createElement('div');
        arrow.className = 'arrow';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'close';
        closeButton.setAttribute('aria-label', 'Schließen');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => this._closeOverlay(true));
        const content = document.createElement('div');
        content.className = 'content';
        popupElement.append(arrow, closeButton, content);
        this.overlayLayer = new Overlay({element: popupElement});
        map.addOverlay(this.overlayLayer);

        //Nach dem Start die Größe der Karte automatisch bestimmen
        map.updateSize();

        return map;
    }

    /**
     * Gibt die Karte frei: bricht laufende Anfragen ab, entfernt wartende Zooms, Listener, Overlays und Caches und löst
     * die Karte von ihrem Element. Offene Promises liefern ein Result mit dem Code `ABORTED`; ihre Ergebnisse werden in
     * keine Karte eingefügt. Danach kann mit initMap() eine neue Karte aufgebaut werden. Mehrfacher Aufruf ist
     * unschädlich.
     *
     * @since v4.0
     */
    dispose(): void {
        const session = this._session;
        if (session == null) {
            return;
        }
        // Zuerst die Session lösen, damit Ergebnisse, die während des Abbruchs eintreffen, als veraltet gelten.
        this._session = null;
        session.controller.abort();
        this._addedTabIndex?.removeAttribute('tabindex');
        this._addedTabIndex = null;
        this.map?.dispose();

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
     * Fügt einen Kartendienst eines ArcGIS Servers (dynamisch oder gecacht) hinzu.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * @param _url URL des Kartendienstes. Kartendienste des Stadtmessungsamtes werden über die Methode
     *             addStmaEsriLayer hinzugefügt.
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler. Die Promise wird mit einem TypeError abgelehnt, wenn
     *          die URL zu einem Kartendienst des Stadtmessungsamtes gehört.
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");
     * ```
     *
     * @since v0.0
     */
    addEsriLayer(_url: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
        assertNoCallback(arguments, 3, 'addEsriLayer');
        const session = this._requireSession('addEsriLayer');
        const url = assertUrl(_url, '_url', 'addEsriLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addEsriLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addEsriLayer');
        return this._rejectStmaHost(url, 'ags', 'addEsriLayer', 'addStmaEsriLayer').then(() =>
            this._isStale(session) ? this._aborted() : this._addEsriLayer(_url, _layerParams ?? {}, _sourceParams ?? {}, session));
    }

    /**
     * Fügt einen gecachten WMTS-Kartendienst hinzu.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * @param _url GetCapabilities-URL zum WMTS. Kartendienste des Stadtmessungsamtes werden über die Methode
     *             addStmaWMTSLayer hinzugefügt.
     * @param _layerName Name des Layers, der eingebunden werden soll
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler. Die Promise wird mit einem TypeError abgelehnt, wenn
     *          die URL zu einem Kartendienst des Stadtmessungsamtes gehört.
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addWMTSLayer("https://SERVERNAME/INSTANZ/gwc/service/wmts?REQUEST=GetCapabilities", "LAYERNAME");
     * ```
     *
     * @since v2.1
     */
    addWMTSLayer(_url: string, _layerName: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
        assertNoCallback(arguments, 4, 'addWMTSLayer');
        const session = this._requireSession('addWMTSLayer');
        const url = assertUrl(_url, '_url', 'addWMTSLayer');
        assertString(_layerName, '_layerName', 'addWMTSLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addWMTSLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addWMTSLayer');
        return this._rejectStmaHost(url, 'wmts', 'addWMTSLayer', 'addStmaWMTSLayer').then(() =>
            this._isStale(session) ? this._aborted() : this._addWMTSLayer_impl(_url, _layerName, _layerParams ?? {}, _sourceParams ?? {}, session));
    }

    /**
     * Fügt einen dynamischen WMS-Kartendienst hinzu.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild, da aber
     * einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt abgerufen werden.
     * Dies kann zu Lasten der Kartographie gehen: Beschriftungen können abgeschnitten oder mehrfach im Kartenbild
     * enthalten sein. Standardmäßig wird der WMS-Dienst als dynamischer Dienst behandelt; gekachelt eingebunden gilt er
     * als gecachter Dienst (wichtig für die zIndexe). Zum gekachelten Abruf `{TILED: true}` als `_sourceParams` übergeben.
     *
     * @param _url URL zum WMS. Kartendienste des Stadtmessungsamtes werden über die Methode addStmaWMSLayer
     *             hinzugefügt.
     * @param _layerName Name des Layers, der eingebunden werden soll
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler. Asynchron, weil die Kartendienste des
     *          Stadtmessungsamtes erst nach dem Laden der Konfiguration bekannt sind. Die Promise wird mit einem TypeError
     *          abgelehnt, wenn die URL zu einem Kartendienst des Stadtmessungsamtes gehört.
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME");
     * const tiled = await mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME", {}, {TILED: true});
     * ```
     *
     * @since v2.1
     */
    addWMSLayer(_url: string, _layerName: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
        assertNoCallback(arguments, 4, 'addWMSLayer');
        const session = this._requireSession('addWMSLayer');
        const url = assertUrl(_url, '_url', 'addWMSLayer');
        assertString(_layerName, '_layerName', 'addWMSLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addWMSLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addWMSLayer');
        return this._rejectStmaHost(url, 'wms', 'addWMSLayer', 'addStmaWMSLayer').then(() =>
            this._isStale(session) ? this._aborted() : ok(this._addWMSLayer(_url, _layerName, _layerParams ?? {}, _sourceParams ?? {})));
    }

    /**
     * Fügt einen Kartendienst eines ArcGIS Servers (dynamisch oder gecacht) des Stadtmessungsamtes hinzu.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * @param _mapservice Bezeichnung des Kartendienstes. Heißt die URL des Kartendienstes beispielsweise
     *                    `https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer`, wird `ORDNER/KARTENDIENST`
     *                    angegeben.
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c_EPSG25832");
     * ```
     *
     * @since v0.0
     */
    addStmaEsriLayer(_mapservice: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
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
            return this._addEsriLayer("https://" + config.ags_host + "/" + config.ags_instance + "/rest/services/" + _mapservice + "/MapServer", _layerParams ?? {}, _sourceParams ?? {}, session);
        });
    }

    /**
     * Fügt einen gecachten WMTS-Kartendienst des Stadtmessungsamtes hinzu.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * @param _layerName Name des Layers, der eingebunden werden soll
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt; `matrixSet` legt die Konfiguration
     *                      fest
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addStmaWMTSLayer("LAYERNAME");
     * ```
     *
     * @since v2.1
     */
    addStmaWMTSLayer(_layerName: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
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
            return this._addWMTSLayer_impl("https://" + config.wmts_host + "/" + config.wmts_instance + "/gwc/service/wmts?REQUEST=GetCapabilities", _layerName, _layerParams ?? {}, sourceParams, session);
        });
    }

    /**
     * Fügt einen dynamischen WMS-Kartendienst des Stadtmessungsamtes hinzu. Ob der Layer gekachelt oder als ganzes Bild
     * abgerufen wird, legt die Konfiguration des Stadtmessungsamtes fest.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * @param _layerName Name des Layers, der eingebunden werden soll
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addStmaWMSLayer("LAYERNAME");
     * ```
     *
     * @since v2.1
     */
    addStmaWMSLayer(_layerName: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
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
            return ok(this._addWMSLayer("https://" + config.wms_host + "/" + config.wms_instance, _layerName, _layerParams ?? {}, sourceParams));
        });
    }

    /**
     * Fügt einen Basis-Kartendienst (dynamisch oder gecacht) des Stadtmessungsamtes über eine sprechende Bezeichnung
     * hinzu. Änderungen der Kartendienstnamen berücksichtigt die API automatisch; Basiskarten deshalb immer über diese
     * Methode einbinden.
     *
     * Wenn nichts anderes angegeben ist, gelten folgende zIndexe für die Kartendienste:
     * - 10: gecacht
     * - 20: gecacht, Kartendienst des Stadtmessungsamtes
     * - 40: dynamisch
     * - 50: dynamisch, Kartendienst des Stadtmessungsamtes
     *
     * @param _mapname sprechende Bezeichnung des Kartendienstes aus der Konfiguration des Stadtmessungsamtes
     * @param _layerParams zusätzliche Parameter für das OpenLayers-Layer-Objekt
     * @param _sourceParams zusätzliche Parameter für das OpenLayers-Source-Objekt
     *
     * @returns der hinzugefügte Layer oder ein erwartbarer Fehler, `NOT_FOUND` bei einer unbekannten Bezeichnung
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addStmaBaseLayer("Basemap");
     * ```
     *
     * @since v0.0
     */
    addStmaBaseLayer(_mapname: string, _layerParams: object = {}, _sourceParams: object = {}): Promise<Result<Layer>> {
        assertNoCallback(arguments, 3, 'addStmaBaseLayer');
        const session = this._requireSession('addStmaBaseLayer');
        assertString(_mapname, '_mapname', 'addStmaBaseLayer');
        assertOptionalObject(_layerParams, '_layerParams', 'addStmaBaseLayer');
        assertOptionalObject(_sourceParams, '_sourceParams', 'addStmaBaseLayer');
        const layerParams = _layerParams ?? {};
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
                return this._addEsriLayer(finalUrl, layerParams, _sourceParams ?? {}, session);
            }
            if (wmts) {
                const finalUrl = `https://${wmts.host}/${wmts.instance}/gwc/service/wmts?REQUEST=GetCapabilities`;
                const sourceParams = {
                    ..._sourceParams,
                    matrixSet: wmts.matrix
                };
                return this._addWMTSLayer_impl(finalUrl, wmts.service, layerParams, sourceParams, session);
            }
            if (wms) {
                const finalUrl = `https://${wms.host}/${wms.instance}`;
                const sourceParams = {
                    ..._sourceParams,
                    TILED: wms.tiled
                };
                return ok(this._addWMSLayer(finalUrl, wms.service, layerParams, sourceParams));
            }
            return fail('NOT_FOUND', "Die Karte '" + _mapname + "' ist in der Konfiguration des Stadtmessungsamtes nicht vorhanden.");
        });
    }

    /**
     * Fügt einzelne Punkte hinzu. Wenn nichts anderes angegeben ist, gilt der zIndex 60.
     *
     * @param _pointCoords Array von Koordinatenpaaren `[[x, y], [x, y], …]`
     * @param _imageURL URL zu dem Bild des Punktes oder Data-URL des Bildes
     *
     * @returns der hinzugefügte Vektor-Layer
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const layer = mymap.addPoints([[513223, 5405026]], "images/target.png");
     * ```
     *
     * @since v0.0
     */
    addPoints(_pointCoords: Array<Array<number>>, _imageURL: string): LayerVector {
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
        this.olMap.addLayer(vectorLayer);
        return vectorLayer;
    }

    /**
     * Fügt Objekte aus einem GeoJSON hinzu, das über eine URL erreichbar ist.
     *
     * @param _url URL zur GeoJSON-Datei, auch relativ zur Seite
     * @param _zoomTo passt den sichtbaren Bereich der Karte so an, dass alle Objekte vollständig sichtbar sind
     * @param _style Ausprägung der Objekte
     *
     * @returns der hinzugefügte Vektor-Layer oder ein erwartbarer Fehler: `SERVICE_UNAVAILABLE`, wenn die Datei nicht
     *          abrufbar ist, `INVALID_DATA` bei ungültigem Inhalt
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.addGeoJSONfromURL("examples/example.geojson");
     * ```
     *
     * @since v2.0
     */
    addGeoJSONfromURL(_url: string, _zoomTo: boolean = false, _style: StyleLike | FlatStyleLike = {}): Promise<Result<LayerVector>> {
        assertNoCallback(arguments, 3, 'addGeoJSONfromURL');
        const session = this._requireSession('addGeoJSONfromURL');
        assertString(_url, '_url', 'addGeoJSONfromURL');
        assertBoolean(_zoomTo, '_zoomTo', 'addGeoJSONfromURL');
        assertOptionalStyle(_style, '_style', 'addGeoJSONfromURL');

        return fetch(_url, {signal: session.controller.signal}).then(
            (response): Promise<Result<LayerVector>> | Result<LayerVector> => {
                if (this._isStale(session)) {
                    return this._aborted();
                }
                if (!response.ok) {
                    return fail('SERVICE_UNAVAILABLE', "Das GeoJSON unter " + _url + " ist nicht abrufbar (HTTP " + response.status + ").");
                }
                return response.json().then(
                    (geojson: unknown) => this._isStale(session)
                        ? this._aborted()
                        : this._addGeoJSON(geojson, _zoomTo, _style, session),
                    (err: unknown) => this._isStale(session)
                        ? this._aborted()
                        : fail('INVALID_DATA', "Die Datei unter " + _url + " enthält kein gültiges JSON.", err)
                );
            },
            (err: unknown) => this._isStale(session)
                ? this._aborted()
                : fail('SERVICE_UNAVAILABLE', "Das GeoJSON unter " + _url + " ist nicht abrufbar.", err)
        );
    }

    /**
     * Fügt Objekte aus einem GeoJSON hinzu.
     *
     * @param _geojson GeoJSON-Objekt
     * @param _zoomTo passt den sichtbaren Bereich der Karte so an, dass alle Objekte vollständig sichtbar sind
     * @param _style Ausprägung der Objekte
     *
     * @returns der hinzugefügte Vektor-Layer oder `INVALID_DATA`, wenn das GeoJSON nicht gelesen werden kann
     *
     * @throws TypeError bei ungültigen Parametern oder wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = mymap.addGeoJSON(geojson);
     * ```
     *
     * @since v2.0
     */
    addGeoJSON(_geojson: object, _zoomTo: boolean = false, _style: StyleLike | FlatStyleLike = {}): Result<LayerVector> {
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
     * @param _geojson GeoJSON-Daten
     * @param _zoomTo Ausschnitt auf die Objekte anpassen
     * @param _style Ausprägung der Objekte
     * @param session Session beim Aufruf
     */
    private _addGeoJSON(_geojson: unknown, _zoomTo: boolean, _style: StyleLike | FlatStyleLike, session: Session): Result<LayerVector> {
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
            // parseGeoJSON hat geprüft, dass _geojson ein GeoJSON-Objekt ist
            features = this._getGeoJSONFormat(dataProjection).readFeatures(_geojson as object);
        } catch (err) {
            return fail('INVALID_DATA', "Das GeoJSON kann nicht gelesen werden.", err);
        }

        const vectorSource = new SourceVector({features});
        const vectorLayer = new LayerVector({
            zIndex: 60,
            source: vectorSource,
            style: _style
        });
        this.olMap.addLayer(vectorLayer);

        const extent = vectorSource.getExtent();
        if (_zoomTo === true && extent != null && !isEmptyExtent(extent)) {
            this._fitWhenReady(extent, session);
        }
        return ok(vectorLayer);
    }

    /**
     * Passt den Ausschnitt an, sobald View und Kartengröße feststehen. Vorher würde fit() ohne Größe scheitern.
     * Das Warten endet mit dispose(), weil map.dispose() die Listener entfernt.
     *
     * @param extent Ausschnitt
     * @param session Session beim Aufruf
     */
    private _fitWhenReady(extent: Extent, session: Session): void {
        const map = this.olMap;
        const fit = () => map.getView().fit(extent);
        if (map.getSize() != null && map.getView().isDef()) {
            fit();
            return;
        }
        // Gerendert wird erst, wenn Größe und View bereit sind
        map.once('postrender', () => {
            if (!this._isStale(session)) {
                fit();
            }
        });
    }

    /**
     * Öffnet das Popup für das oberste Objekt an einem Pixel, das zu einem Layer mit Overlay gehört; sonst schließt es.
     *
     * @param pixel Pixel in der Karte
     * @param coordinate Position des Popups
     * @param byKeyboard Fokus ins Popup setzen
     * @param hitTolerance Toleranz in Pixeln
     */
    private _openOverlayAt(pixel: Pixel, coordinate: Coordinate, byKeyboard: boolean, hitTolerance = 0): void {
        const hit = this.olMap.forEachFeatureAtPixel(
            pixel,
            (feature, layer) => ({feature, layer}),
            {
                //Filter, damit nur die Features gefunden werden, für die auch der Overlay aktiviert wurde.
                layerFilter: (candidate) => this.overlayLayers.includes(candidate),
                hitTolerance
            }
        );
        const overlayFunction = hit ? this.overlayFunctions[this.overlayLayers.indexOf(hit.layer)] : undefined;
        const result = hit && overlayFunction ? overlayFunction(hit.feature) : undefined;
        const element = this.overlayLayer?.getElement();
        const content = element?.querySelector('.content');
        if (element == null || content == null) {
            return;
        }
        if (result instanceof Node) {
            content.replaceChildren(result);
        } else if (result != null && String(result).trim() !== '') {
            // Vertrag: Zeichenketten werden ungefiltert als HTML eingesetzt (README, „Popups und Quellenangaben“)
            content.innerHTML = String(result);
        } else {
            this._closeOverlay(false);
            return;
        }

        this.overlayLayer?.setPosition(coordinate);
        element.style.display = 'block';
        element.style.transform = "translate3d(-" + element.offsetWidth / 2 + "px, calc(-" + element.offsetHeight + "px - 0.5rem), 0px)";
        if (byKeyboard) {
            element.focus();
        }
    }

    /**
     * Schließt das Popup.
     *
     * @param returnFocus Fokus zurück auf die Karte setzen
     */
    private _closeOverlay(returnFocus: boolean): void {
        const element = this.overlayLayer?.getElement();
        if (element == null || element.style.display === 'none') {
            return;
        }
        element.style.display = 'none';
        element.querySelector('.content')?.replaceChildren();
        this.overlayLayer?.setPosition(undefined);
        if (returnFocus) {
            this.map?.getTargetElement()?.focus();
        }
    }

    /**
     * Tastaturbedienung: Die Karte wird fokussierbar, Enter öffnet das Popup für das Objekt in der Kartenmitte
     * (verschieben mit den Pfeiltasten), Escape schließt es.
     *
     * @param session Session, mit deren Ende der Listener entfernt wird
     */
    private _registerOverlayKeys(session: Session): void {
        const map = this.olMap;
        const target = map.getTargetElement();
        if (target == null) {
            return;
        }
        if (!target.hasAttribute('tabindex')) {
            target.tabIndex = 0;
            this._addedTabIndex = target;
        }
        target.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._closeOverlay(true);
            } else if (e.key === 'Enter' && e.target === target) {
                const center = map.getView().getCenter();
                const pixel = center && map.getPixelFromCoordinate(center);
                if (center && pixel) {
                    e.preventDefault();
                    this._openOverlayAt(pixel, center, true, 8);
                }
            }
        }, {signal: session.controller.signal});
    }

    /**
     * Zeigt beim Klick auf ein Objekt des Layers ein Popup. Mit der Tastatur öffnet Enter auf der fokussierten Karte das
     * Popup für das Objekt in der Kartenmitte, Escape schließt es.
     *
     * @param _layer der Layer, für dessen Objekte das Popup erscheint
     * @param _overlayFunction Funktion, die bei einem Klick auf das Objekt ausgeführt wird und den Inhalt des Popups
     *                         liefert. Ein String wird ungefiltert als HTML eingesetzt: Werte aus Kartendiensten, Daten
     *                         oder Benutzereingaben muss die Anwendung vorher escapen. Ein DOM-Knoten wird unverändert
     *                         eingesetzt, ein leerer Rückgabewert lässt das Popup geschlossen. Das Popup-Element hat die
     *                         Klasse `geoline-ol-js-popup` und die ID aus `initMap(…, {popupId})`; darin stehen
     *                         `div.arrow`, `button.close` und `div.content` mit dem Inhalt.
     *
     * @throws TypeError, wenn `_layer` kein Layer oder `_overlayFunction` keine Funktion ist
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * mymap.addOverlayForLayer(layer, (feature) => '<b>' + escape(feature.get('name')) + '</b>');
     * ```
     *
     * @since v1.2
     */
    addOverlayForLayer(_layer: Layer, _overlayFunction: OverlayFunction): void {
        const session = this._requireSession('addOverlayForLayer');
        if (_layer == null || typeof (_layer as {getSource?: unknown}).getSource !== 'function') {
            throw new TypeError("addOverlayForLayer: _layer muss ein OpenLayers-Layer sein.");
        }
        assertFunction(_overlayFunction, '_overlayFunction', 'addOverlayForLayer');

        if (!this.overlayClickRegistered) {
            this.overlayClickRegistered = true;
            this.olMap.on('click', (evt) => this._openOverlayAt(evt.pixel, evt.coordinate, false));
            this._registerOverlayKeys(session);
        }

        //Füge Layer zu den Layern hinzu, für die das Overlay aktiviert ist.
        if (!this.overlayLayers.includes(_layer)) {
            this.overlayLayers.push(_layer);
            this.overlayFunctions[this.overlayLayers.indexOf(_layer)] = _overlayFunction;
        }
    }

    /**
     * Gibt die OpenLayers-Karte zurück.
     *
     * @returns die OpenLayers-Karte
     *
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @since v0.0
     */
    getMap(): Map {
        this._requireSession('getMap');
        return this.olMap;
    }

    /**
     * Lädt die Konfiguration der Kartendienste des Stadtmessungsamtes, z. B. um sie für die Offline-Nutzung zu speichern
     * und später über `initMap(…, {config})` zu übergeben. Liefert nie einen Platzhalter: Die Promise erfüllt sich erst,
     * wenn die Konfiguration geladen ist. Nach einem Fehler startet der nächste Aufruf einen neuen Abruf.
     *
     * @returns die geprüfte Konfiguration oder ein erwartbarer Fehler: `CONFIG_UNAVAILABLE`, wenn der Dienst nicht
     *          erreichbar ist, `INVALID_DATA` bei ungültiger Antwort, `ABORTED` nach dispose()
     *
     * @throws TypeError, wenn ein Callback übergeben wird
     * @throws Error, wenn keine Karte initialisiert ist
     *
     * @example
     * ```js
     * const r = await mymap.loadConfig();
     * ```
     *
     * @since v4.0
     */
    loadConfig(): Promise<Result<GeolineConfig>> {
        assertNoCallback(arguments, 0, 'loadConfig');
        this._requireSession('loadConfig');
        return this._loadConfig();
    }
}

export default StmaOpenLayers;
