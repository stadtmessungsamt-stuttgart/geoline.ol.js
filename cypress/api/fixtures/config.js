// Form der Antwort des Konfigurationsdienstes für EPSG:25832 (Stand 2026-11-12), Hosts durch Testhosts ersetzt.
export const CONFIG_URL = 'https://gis5.stuttgart.de/geoline/geoline.config/config.aspx';

export const CONFIG = {
    ags_host: 'ags.stma.test',
    ags_instance: 'arcgis',
    wmts_host: 'wmts.stma.test',
    wmts_instance: 'geoserver',
    wmts_matrix: 'Stuttgart_UTM_CRS_oL',
    wms_host: 'wms.stma.test',
    wms_instance: 'geoserver/ows',
    wms_tiled: true,
    ags_services: {
        Grundkarte: {ags_host: 'ags.stma.test', ags_instance: 'arcgis', ags_service: '1_Base/Stadtkarte_Internet_c_EPSG25832'},
    },
    wmts_services: {
        Basemap: {host: 'wmts.stma.test', instance: 'geoserver', service: 'Base:Basemap_EPSG25832', matrix: 'Stuttgart_UTM_CRS_oL'},
    },
    wms_services: {
        Basemap_Light_Textlos_WMS: {host: 'wms.stma.test', instance: 'geoserver/Base/wms', service: 'Base:Basemap_ULTRALIGHT_EPSG25832', tiled: true},
    },
};
