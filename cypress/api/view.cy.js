// Ansicht der Karte: einmal in initMap festgelegt, von keinem Layer ersetzt; Dienste behalten ihre eigene Projektion.
import Attribution from 'ol/control/Attribution.js';
import StmaOpenLayers from '../../dist/geoline.ol.js';
import {CONFIG, CONFIG_URL} from './fixtures/config.js';
import {agsCachedInfo, WMTS_CAPABILITIES} from './fixtures/services.js';

const ESRI_URL = 'https://ags.extern.test/arcgis/rest/services/Test/MapServer';
const ESRI_INFO = {hostname: 'ags.extern.test', pathname: '/arcgis/rest/services/Test/MapServer', query: {f: 'json'}};
const WMTS_URL = 'https://wmts.extern.test/WMTSCapabilities.xml';
const STMA_UTM_RESOLUTIONS = [112, 56, 28, 14, 7, 2.8, 1.4, 0.7, 0.28, 0.14];

describe('Ansicht der Karte', () => {
    let target;
    let geoline;

    const init = (epsg = 25832, mapParams = {}, viewParams = {}) => {
        geoline = new StmaOpenLayers();
        return geoline.initMap(epsg, {target, ...mapParams}, viewParams);
    };
    const view = () => geoline.getMap().getView();
    const layers = () => geoline.getMap().getLayers().getLength();

    const expectResult = (result, code) => {
        if (code === undefined) {
            expect(result.ok, JSON.stringify(result.error)).to.equal(true);
        } else {
            expect(result.ok, 'Result').to.equal(false);
            expect(result.error.code).to.equal(code);
        }
        return result;
    };

    beforeEach(() => {
        cy.intercept('POST', CONFIG_URL, {body: CONFIG});
        // Kacheln nicht wirklich abrufen
        cy.intercept({hostname: /\.extern\.test$/, pathname: /\/tile\/|\/rest\//}, {statusCode: 204});
        target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        document.body.appendChild(target);
    });

    afterEach(() => {
        geoline?.dispose();
        geoline = undefined;
        target.remove();
    });

    describe('initMap', () => {
        it('nutzt in EPSG:25832 die Auflösungen der Stuttgarter Kachelmatrix', () => {
            init();
            expect(view().getProjection().getCode()).to.equal('EPSG:25832');
            expect(view().getResolutions()).to.deep.equal(STMA_UTM_RESOLUTIONS);
            expect(view().getResolution()).to.equal(28);
        });

        it('übernimmt eigene Angaben für die Ansicht', () => {
            init(25832, {}, {center: [510000, 5400000], zoom: 5});
            expect(view().getCenter()).to.deep.equal([510000, 5400000]);
            expect(view().getResolution()).to.equal(2.8);
        });

        it('zentriert EPSG:3857 auf Stuttgart', () => {
            init(3857);
            expect(view().getProjection().getCode()).to.equal('EPSG:3857');
            expect(view().getCenter()).to.deep.equal([1022761, 6236421]);
        });

        it('wirft bei einem nicht unterstützten EPSG-Code', () => {
            for (const epsg of [31467, 4326]) {
                let thrown = null;
                try {
                    new StmaOpenLayers().initMap(epsg, {target});
                } catch (err) {
                    thrown = err;
                }
                expect(thrown?.name, String(epsg)).to.equal('TypeError');
                expect(thrown.message).to.contain('25832 oder 3857');
            }
        });

        it('behält bei controls: null nur die Quellenangabe', () => {
            init(25832, {controls: null});
            const controls = geoline.getMap().getControls().getArray();
            expect(controls).to.have.length(1);
            expect(controls[0]).to.be.instanceOf(Attribution);
        });
    });

    describe('gecachte ArcGIS-Dienste', () => {
        const addEsriLayer = (code) => cy.then(async () => expectResult(await geoline.addEsriLayer(ESRI_URL), code));

        it('ersetzt die Ansicht nicht und übernimmt nicht quadratische Kacheln als [Breite, Höhe]', () => {
            cy.intercept(ESRI_INFO, {body: agsCachedInfo()});
            cy.then(() => init(25832, {}, {zoom: 4}));
            let before;
            cy.then(() => (before = view()));
            addEsriLayer().then((result) => {
                expect(view(), 'dieselbe View').to.equal(before);
                expect(view().getResolutions()).to.deep.equal(STMA_UTM_RESOLUTIONS);
                expect(view().getResolution()).to.equal(7);
                expect(result.value.getSource().getTileGrid().getTileSize(0)).to.deep.equal([512, 256]);
            });
        });

        it('behält die Projektion der Karte, wenn der Dienst in einer anderen liegt', () => {
            cy.intercept(ESRI_INFO, {body: agsCachedInfo(3857)});
            cy.then(() => init(25832));
            addEsriLayer().then((result) => {
                expect(geoline.projection).to.equal('EPSG:25832');
                expect(view().getProjection().getCode()).to.equal('EPSG:25832');
                expect(result.value.getSource().getProjection().getCode()).to.equal('EPSG:3857');
            });
        });

        it('meldet eine unbekannte Projektion als PROJECTION_MISMATCH, ohne Layer einzufügen', () => {
            cy.intercept(ESRI_INFO, {body: agsCachedInfo(99999)});
            cy.then(() => init());
            let before;
            cy.then(() => (before = layers()));
            addEsriLayer('PROJECTION_MISMATCH').then(() => expect(layers()).to.equal(before));
        });

        it('meldet fehlende Kachelinformationen als INVALID_DATA, ohne Layer einzufügen', () => {
            const {tileInfo, ...withoutTileInfo} = agsCachedInfo();
            const broken = [withoutTileInfo, {...agsCachedInfo(), tileInfo: {...tileInfo, lods: []}}, {...agsCachedInfo(), fullExtent: undefined}];
            cy.then(() => init());
            let before;
            cy.then(() => (before = layers()));
            broken.forEach((body, i) => {
                cy.intercept({...ESRI_INFO, pathname: ESRI_INFO.pathname + i}, {body});
                cy.then(async () => expectResult(await geoline.addEsriLayer(ESRI_URL + i), 'INVALID_DATA'));
            });
            cy.then(() => expect(layers()).to.equal(before));
        });
    });

    describe('WMTS', () => {
        const addWMTSLayer = (name, code) => cy.then(async () => expectResult(await geoline.addWMTSLayer(WMTS_URL, name), code));

        beforeEach(() => {
            cy.intercept('GET', WMTS_URL, {body: WMTS_CAPABILITIES, headers: {'content-type': 'application/xml'}});
        });

        it('liest den Ursprung der GeoServer-Matrix für EPSG:3857 in der Achsfolge Ost/Nord', () => {
            cy.then(() => init(3857));
            addWMTSLayer('Basemap_EPSG3857').then((result) => {
                const [x, y] = result.value.getSource().getTileGrid().getOrigin(0);
                expect(x).to.be.closeTo(-20037508.34, 1);
                expect(y).to.be.closeTo(20037508.34, 1);
                expect(view().getCenter()).to.deep.equal([1022761, 6236421]);
            });
        });

        it('meldet einen Layer in anderer Projektion als PROJECTION_MISMATCH', () => {
            cy.then(() => init(25832));
            addWMTSLayer('Basemap_EPSG3857', 'PROJECTION_MISMATCH');
        });

        it('lässt die Ansicht unabhängig von der Reihenfolge der Antworten unverändert', () => {
            // Früher setzte der zuletzt geladene Dienst seine eigene View; die Antworten kommen hier absichtlich vertauscht
            cy.intercept(ESRI_INFO, {body: agsCachedInfo(), delay: 50});
            cy.intercept('GET', WMTS_URL, {body: WMTS_CAPABILITIES, headers: {'content-type': 'application/xml'}, delay: 250});
            cy.then(() => init(25832, {}, {center: [510000, 5400000], zoom: 3}));
            cy.then(async () => {
                const before = view();
                const results = await Promise.all([geoline.addWMTSLayer(WMTS_URL, 'Basemap_EPSG25832'), geoline.addEsriLayer(ESRI_URL)]);
                results.forEach((result) => expectResult(result));
                expect(view()).to.equal(before);
                expect(view().getCenter()).to.deep.equal([510000, 5400000]);
                expect(view().getResolution()).to.equal(14);
            });
        });
    });
});
