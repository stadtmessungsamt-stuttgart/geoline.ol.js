// GeoJSON-Eingaben: Datenfehler als Result ohne eingefügten Layer, Zoom erst bei bereiter Karte.
import StmaOpenLayers from '../../dist/geoline.ol.js';
import {CONFIG, CONFIG_URL} from './fixtures/config.js';

const GEOJSON_URL = 'https://daten.example.test/daten.geojson';

const point = (coordinates) => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates}});

// Zwei Punkte in EPSG:25832; Mitte des Extents: [513500, 5402500]
const UTM = {
    type: 'FeatureCollection',
    crs: {type: 'name', properties: {name: 'EPSG:25832'}},
    features: [point([513000, 5402000]), point([514000, 5403000])],
};

const WGS84 = {type: 'FeatureCollection', features: [point([9.18, 48.78])]};

describe('GeoJSON', () => {
    let target;
    let geoline;

    const layerCount = () => geoline.getMap().getLayers().getLength();

    const expectFailure = (result, code) => {
        expect(result.ok, 'Result').to.equal(false);
        expect(result.error.code).to.equal(code);
    };

    const init = (attached = true) => {
        target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        if (attached) {
            document.body.appendChild(target);
        }
        geoline = new StmaOpenLayers();
        geoline.initMap(25832, {target});
    };

    beforeEach(() => {
        cy.intercept('POST', CONFIG_URL, {body: CONFIG});
    });

    afterEach(() => {
        geoline.dispose();
        target.remove();
    });

    describe('CRS', () => {
        beforeEach(() => init());

        it('nimmt ohne CRS und bei crs: null EPSG:4326 an', () => {
            for (const geojson of [WGS84, {...WGS84, crs: null}]) {
                const result = geoline.addGeoJSON(geojson);
                expect(result.ok).to.equal(true);
                const [x, y] = result.value.getSource().getFeatures()[0].getGeometry().getCoordinates();
                // 9.18° / 48.78° liegen in UTM 32 bei etwa 513000 / 5403000
                expect(x).to.be.within(510000, 516000);
                expect(y).to.be.within(5400000, 5406000);
            }
        });

        it('liest ein benanntes CRS und CRS84', () => {
            const utm = geoline.addGeoJSON(UTM);
            expect(utm.value.getSource().getFeatures()[0].getGeometry().getCoordinates()).to.deep.equal([513000, 5402000]);

            const crs84 = geoline.addGeoJSON({...WGS84, crs: {type: 'name', properties: {name: 'urn:ogc:def:crs:OGC:1.3:CRS84'}}});
            expect(crs84.ok).to.equal(true);
        });

        it('meldet eine unbekannte Projektion als PROJECTION_MISMATCH, ohne Layer einzufügen', () => {
            const before = layerCount();
            expectFailure(geoline.addGeoJSON({...UTM, crs: {type: 'name', properties: {name: 'EPSG:99999'}}}), 'PROJECTION_MISMATCH');
            expect(layerCount()).to.equal(before);
        });

        it('meldet ein ungültiges CRS als INVALID_DATA', () => {
            expectFailure(geoline.addGeoJSON({...UTM, crs: {type: 'link', properties: {href: 'https://x.test/crs'}}}), 'INVALID_DATA');
            expectFailure(geoline.addGeoJSON({...UTM, crs: 'EPSG:25832'}), 'INVALID_DATA');
        });
    });

    describe('Struktur', () => {
        beforeEach(() => init());

        const INVALID = {
            'features kein Array': {type: 'FeatureCollection', features: {}},
            'Feature ohne type': {type: 'FeatureCollection', features: [{geometry: null}]},
            'unbekannter Geometrietyp': {type: 'FeatureCollection', features: [{type: 'Feature', geometry: {type: 'Kreis', coordinates: [1, 2]}}]},
            'Koordinaten als String': point('513000, 5402000'),
            'Position mit NaN': point([NaN, 5402000]),
            'Position mit einer Zahl': point([513000]),
            'Polygon mit falscher Tiefe': {type: 'Polygon', coordinates: [[1, 2], [3, 4], [1, 2]]},
            'properties als String': {...point([1, 2]), properties: 'x'},
        };

        Object.entries(INVALID).forEach(([name, geojson]) => {
            it(`meldet ungültiges GeoJSON als INVALID_DATA, ohne Layer einzufügen: ${name}`, () => {
                const before = layerCount();
                expectFailure(geoline.addGeoJSON(geojson), 'INVALID_DATA');
                expect(layerCount()).to.equal(before);
            });
        });

        it('nimmt Features ohne Geometrie, Einzelgeometrien und GeometryCollections an', () => {
            expect(geoline.addGeoJSON({type: 'Feature', properties: null, geometry: null}).ok).to.equal(true);
            expect(geoline.addGeoJSON({type: 'Point', coordinates: [9.18, 48.78]}).ok).to.equal(true);
            expect(geoline.addGeoJSON({
                type: 'GeometryCollection',
                geometries: [{type: 'Point', coordinates: [9.18, 48.78]}, {type: 'LineString', coordinates: [[9.1, 48.7], [9.2, 48.8]]}],
            }).ok).to.equal(true);
        });

        it('wirft bei falschen Parametertypen', () => {
            expect(() => geoline.addGeoJSON('{"type": "Point"}')).to.throw('_geojson');
            expect(() => geoline.addGeoJSON(UTM, 'ja')).to.throw('_zoomTo');
            expect(() => geoline.addGeoJSON(UTM, false, 5)).to.throw('_style');
        });

        it('meldet Datenfehler auch beim Abruf per URL als Result', () => {
            cy.intercept('GET', GEOJSON_URL, {body: {...UTM, crs: {type: 'name', properties: {name: 'EPSG:99999'}}}});
            cy.then(async () => expectFailure(await geoline.addGeoJSONfromURL(GEOJSON_URL), 'PROJECTION_MISMATCH'));
        });
    });

    describe('Zoom', () => {
        const expectCenteredOnUTM = () => {
            const [x, y] = geoline.getMap().getView().getCenter();
            expect(x).to.be.closeTo(513500, 1);
            expect(y).to.be.closeTo(5402500, 1);
        };

        it('zoomt bei bereiter Karte sofort auf die Objekte', () => {
            init();
            geoline.addGeoJSON(UTM, true);
            expectCenteredOnUTM();
        });

        it('ändert den Ausschnitt bei einer leeren FeatureCollection nicht', () => {
            init();
            const center = geoline.getMap().getView().getCenter();
            expect(geoline.addGeoJSON({type: 'FeatureCollection', features: []}, true).ok).to.equal(true);
            expect(geoline.getMap().getView().getCenter()).to.deep.equal(center);
        });

        it('wartet, bis die Karte eine Größe hat', () => {
            init(false);
            const center = geoline.getMap().getView().getCenter();
            geoline.addGeoJSON(UTM, true);
            expect(geoline.getMap().getView().getCenter(), 'vor dem Einhängen unverändert').to.deep.equal(center);
            cy.then(() => document.body.appendChild(target));
            cy.wrap(null).should(expectCenteredOnUTM);
        });

        it('beendet das Warten mit dispose()', () => {
            init(false);
            const map = geoline.getMap();
            const listeners = () => map.getListeners('postrender')?.length ?? 0;
            const before = listeners();
            geoline.addGeoJSON(UTM, true);
            expect(listeners() - before, 'wartender Listener').to.equal(1);
            geoline.dispose();
            expect(listeners(), 'Listener nach dispose()').to.equal(0);
            // Ein später eingehängtes Element darf keinen Zoom mehr auslösen (Cypress meldet sonst den Fehler)
            cy.then(() => document.body.appendChild(target));
            cy.wait(100);
        });
    });
});
