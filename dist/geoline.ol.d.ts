export default StmaOpenLayers;
export type AGSSpatialReference = {
    wkid?: number;
    latestWkid?: number;
};
export type AGSTileInfoLOD = {
    level: number;
    resolution: number;
    scale: number;
};
export type AGSTileInfo = {
    origin: {
        x: number;
        y: number;
    };
    rows: number;
    cols: number;
    lods: Array<AGSTileInfoLOD>;
};
export type AGSExtent = {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
};
export type AGSInfo = {
    currentVersion?: number;
    singleFusedMapCache?: boolean;
    tileInfo?: AGSTileInfo;
    fullExtent?: AGSExtent;
    spatialReference?: AGSSpatialReference;
    copyrightText?: string;
    error?: {
        code: number;
        message: string;
    };
};
export type AGSServiceEntry = {
    ags_host: string;
    ags_instance: string;
    ags_service: string;
    service: string;
    tiled?: boolean;
    params?: {
        [x: string]: string | number | boolean;
    };
};
export type WMTSServiceEntry = {
    host: string;
    instance: string;
    service: string;
    matrix: string;
    params?: {
        [x: string]: string | number | boolean;
    };
};
export type WMSServiceEntry = {
    host: string;
    instance: string;
    service: string;
    tiled?: boolean;
    params?: {
        [x: string]: string | number | boolean;
    };
};
export type GeolineConfig = {
    ags_host?: string;
    ags_instance?: string;
    ags_service?: string;
    wmts_host?: string;
    wmts_instance?: string;
    wmts_matrix?: string;
    wms_host?: string;
    wms_instance?: string;
    wms_tiled?: boolean;
    ags_hosts?: Array<string>;
    wmts_hosts?: Array<string>;
    wms_hosts?: Array<string>;
    ags_services?: {
        [x: string]: AGSServiceEntry;
    } | Array<AGSServiceEntry>;
    wmts_services?: {
        [x: string]: WMTSServiceEntry;
    } | Array<WMTSServiceEntry>;
    wms_services?: {
        [x: string]: WMSServiceEntry;
    } | Array<WMSServiceEntry>;
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
declare class StmaOpenLayers {
    /**
     * Konstruktor
     *
     * @param       {string} _configUrl Basis-URL für den Abruf der Geoline-Basiskonfiguration. Wird als vorbelegter Parameter verwendet.
     *
     * @returns     {StmaOpenLayers}
     */
    constructor(_configUrl?: string);
    /** @type {GeolineConfig|null} */
    config: GeolineConfig | null;
    configUrl: any;
    configPromise: any;
    viewParams: any;
    tileLoadFunction: any;
    map: any;
    projection: any;
    overlayLayer: any;
    overlayLayers: any[];
    overlayFunctions: any[];
    /**
     * Lädt die Konfiguration asynchron und cached das Ergebnis in einer Promise
     *
     * @returns     {Promise<GeolineConfig>}
     */
    _fetchConfig(): Promise<GeolineConfig>;
    /**
     * @returns     {GeolineConfig}
     * */
    _getConfig(): GeolineConfig;
    /**
     * JSONP with simple Promise cache to avoid duplicate network requests per URL
     * @param {string} url
     * @returns {Promise<any>}
     */
    _jsonpCached(url: string): Promise<any>;
    /**
     * Fetch text with simple Promise cache by URL (POST by default)
     * @param {string} url
     * @param {RequestInit} [options]
     * @returns {Promise<string>}
     */
    _fetchTextCached(url: string, options?: RequestInit): Promise<string>;
    /**
     * Get a cached GeoJSON format instance for a specific dataProjection.
     * The instance is created with featureProjection set to the current map projection.
     * @param {string} dataProjection
     */
    _getGeoJSONFormat(dataProjection: string): any;
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
    _addEsriLayer(_url: string, _layerParams: any, _sourceParams: any, _callbackFunction: Function): void;
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
    _addWMTSLayer_impl(_url: string, _layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): void;
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
    _addWMSLayer(_url: string, _layerName: string, _layerParams: object, _sourceParams: object, _callbackFunction: Function): void;
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
    _initCachedLayer(_url: string, _layerParams: any, _sourceParams: any, ags_info: AGSInfo, _callbackFunction: Function): void;
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
    _initDynamicLayer(_url: string, _layerParams: any, _sourceParams: any, ags_info: AGSInfo, _callbackFunction: Function): void;
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
    initMap(_epsgCode: int, _mapParams?: object, _viewParams?: object, _customParams?: object, _callbackFunction?: Function): null;
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
    addEsriLayer(_url: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
    addWMTSLayer(_url: string, _layerName?: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
    addWMSLayer(_url: string, _layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
    addStmaEsriLayer(_mapservice: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
    addStmaWMTSLayer(_layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
    addStmaWMSLayer(_layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
     *                        mymap.addStmaBaseLayer("Grundkarte");<br/>
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
    addStmaBaseLayer(_mapname: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
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
    addPoints(_pointCoords: any[], _imageURL: string, _callbackFunction?: Function): null;
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
    addGeoJSONfromURL(_url: string, _zoomTo?: boolean, _style?: object, _callbackFunction?: Function): null;
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
    addGeoJSON(_geojson: object, _zoomTo?: boolean, _style?: object, _callbackFunction?: Function): null;
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
    addOverlayForLayer(_layer: object, _overlayFunction?: Function): null;
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
    addStmaEsriFeatureLayer(_mapservice: string, _layerId: integer, _styleFunction?: Function, _callbackFunction?: Function): null;
    /**
     *    @description    gibt das OpenLayer-Map-Objekt zurück.<br/>
     *
     *    @returns        {object} ol.Map<br/>
     *
     *    @since          v0.0
     */
    getMap(): object;
    /**
     *    @description    Gibt die interne Konfiguration von geoline.ol.js zurück.<br/>
     *                    Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel zum Ermitteln der Konfiguration für die Offlineverfügbarkeit in Apps.
     *
     *    @returns        {GeolineConfig}
     *
     *    @since          v1.0
     */
    getConfig(): GeolineConfig;
}
