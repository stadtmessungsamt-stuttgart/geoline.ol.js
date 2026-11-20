// Kleine Dienstbeschreibungen in der Form, die ArcGIS Server und GeoServer liefern.

// Gecachter ArcGIS-Dienst; Kacheln absichtlich nicht quadratisch (512 breit, 256 hoch)
export const agsCachedInfo = (wkid = 25832) => ({
    currentVersion: 11.1,
    copyrightText: 'Test',
    singleFusedMapCache: true,
    spatialReference: {wkid, latestWkid: wkid},
    tileInfo: {
        rows: 256,
        cols: 512,
        origin: {x: -5120900, y: 9998100},
        lods: [{level: 0, resolution: 105.83}, {level: 1, resolution: 52.92}, {level: 2, resolution: 26.46}],
    },
    fullExtent: {xmin: 500000, ymin: 5390000, xmax: 530000, ymax: 5415000},
});

// GeoServer schreibt den TopLeftCorner für urn:ogc:def:crs:EPSG::3857 in der Achsfolge Nord/Ost
const matrix = (z, topLeftCorner) => `
      <TileMatrix>
        <ows:Identifier>${z}</ows:Identifier>
        <ScaleDenominator>${559082264.0287178 / 2 ** z}</ScaleDenominator>
        <TopLeftCorner>${topLeftCorner}</TopLeftCorner>
        <TileWidth>256</TileWidth>
        <TileHeight>256</TileHeight>
        <MatrixWidth>${2 ** z}</MatrixWidth>
        <MatrixHeight>${2 ** z}</MatrixHeight>
      </TileMatrix>`;

const layer = (name, matrixSet) => `
    <Layer>
      <ows:Identifier>${name}</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>default</ows:Identifier></Style>
      <Format>image/png</Format>
      <TileMatrixSetLink><TileMatrixSet>${matrixSet}</TileMatrixSet></TileMatrixSetLink>
      <ResourceURL format="image/png" resourceType="tile" template="https://wmts.extern.test/rest/${name}/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}?format=image/png"/>
    </Layer>`;

export const WMTS_CAPABILITIES = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
  <Contents>${layer('Basemap_EPSG3857', 'WebMercatorQuad')}${layer('Basemap_EPSG25832', 'UTM')}
    <TileMatrixSet>
      <ows:Identifier>WebMercatorQuad</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::3857</ows:SupportedCRS>${[0, 1, 2].map((z) => matrix(z, '2.003750834E7 -2.003750834E7')).join('')}
    </TileMatrixSet>
    <TileMatrixSet>
      <ows:Identifier>UTM</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::25832</ows:SupportedCRS>${[0, 1].map((z) => matrix(z, '239323.44 9336416.0')).join('')}
    </TileMatrixSet>
  </Contents>
</Capabilities>`;
