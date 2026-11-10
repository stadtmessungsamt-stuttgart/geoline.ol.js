// API-Form nach ADR 5: Programmierfehler werfen, erwartbare Fehler kommen als Result, dispose() bricht ab.
import StmaOpenLayers from '../../dist/geoline.ol.js';
import {CONFIG, CONFIG_URL} from './fixtures/config.js';

const GEOJSON_URL = 'https://daten.example.test/punkte.geojson';

const GEOJSON = {
    type: 'FeatureCollection',
    features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [9.18, 48.78]}}],
};

describe('API-Form', () => {
    let targets;
    let instances;

    const createTarget = () => {
        const target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        document.body.appendChild(target);
        targets.push(target);
        return target;
    };

    const create = () => {
        const geoline = new StmaOpenLayers();
        instances.push(geoline);
        return geoline;
    };

    const initMap = (customParams = {}) => {
        const geoline = create();
        geoline.initMap(25832, {target: createTarget()}, {}, customParams);
        return geoline;
    };

    // chai prüft den Fehlertyp per instanceof; das scheitert an der Realm-Grenze zwischen Cypress und Spec-Iframe.
    const expectThrow = (fn, type, text) => {
        let thrown = null;
        try {
            fn();
        } catch (err) {
            thrown = err;
        }
        expect(thrown, 'geworfener Fehler').to.not.equal(null);
        expect(thrown.name).to.equal(type.name);
        expect(thrown.message).to.include(text);
    };

    beforeEach(() => {
        targets = [];
        instances = [];
        cy.intercept('POST', CONFIG_URL, {body: CONFIG}).as('config');
        // Kacheln fremder Dienste nicht wirklich abrufen
        cy.intercept('https://wms.extern.test/**', {statusCode: 204});
    });

    afterEach(() => {
        instances.forEach((geoline) => geoline.dispose());
        targets.forEach((target) => target.remove());
    });

    describe('Programmierfehler werfen synchron', () => {
        it('weist Callbacks an der früheren Callback-Position zurück', () => {
            const geoline = create();
            expectThrow(() => geoline.initMap(25832, {target: createTarget()}, {}, {}, () => {}), TypeError, 'Callback-Parameter entfallen');

            const map = initMap();
            expectThrow(() => map.addStmaBaseLayer('Basemap', {}, {}, () => {}), TypeError, 'Callback-Parameter entfallen');
            expectThrow(() => map.addGeoJSON(GEOJSON, false, {}, () => {}), TypeError, 'Callback-Parameter entfallen');
        });

        it('weist ungültige Eingaben zurück', () => {
            expectThrow(() => new StmaOpenLayers('kein-url'), TypeError, '_configUrl');
            expectThrow(() => create().initMap('25832', {target: createTarget()}), TypeError, '_epsgCode');

            const map = initMap();
            expectThrow(() => map.addWMSLayer('relativ/wms', 'Layer'), TypeError, 'absolute URL');
            expectThrow(() => map.addWMSLayer('https://wms.extern.test/wms', ''), TypeError, '_layerName');
            expectThrow(() => map.addPoints([[1, 'x']], 'bild.png'), TypeError, '_pointCoords');
            expectThrow(() => map.addGeoJSON(GEOJSON, 'ja'), TypeError, '_zoomTo');
            expectThrow(() => map.addOverlayForLayer({}, () => ''), TypeError, '_layer');
        });

        it('wirft vor initMap und nach dispose', () => {
            const geoline = create();
            expectThrow(() => geoline.getMap(), Error, 'Keine aktive Karte');
            expectThrow(() => geoline.addPoints([[513785, 5402232]], 'bild.png'), Error, 'Keine aktive Karte');

            geoline.initMap(25832, {target: createTarget()});
            geoline.dispose();
            expectThrow(() => geoline.getMap(), Error, 'Keine aktive Karte');
        });

        it('wirft bei erneutem initMap und erlaubt es nach dispose', () => {
            const geoline = initMap();
            expectThrow(() => geoline.initMap(25832, {target: createTarget()}), Error, 'bereits initialisiert');

            geoline.dispose();
            const map = geoline.initMap(25832, {target: createTarget()});
            expect(geoline.getMap()).to.equal(map);
        });
    });

    describe('Rückgabewerte', () => {
        it('liefert Karte und Punkt-Layer synchron', () => {
            const geoline = create();
            const map = geoline.initMap(25832, {target: createTarget()});
            expect(map).to.equal(geoline.getMap());

            const layer = geoline.addPoints([[513785, 5402232]], 'bild.png');
            expect(map.getLayers().getArray()).to.include(layer);
            expect(layer.getSource().getFeatures()).to.have.length(1);
        });

        it('liefert den WMS-Layer als Result', () => {
            const geoline = initMap();
            cy.then(async () => {
                const result = await geoline.addWMSLayer('https://wms.extern.test/wms', 'Layer');
                expect(result.ok).to.equal(true);
                expect(geoline.getMap().getLayers().getArray()).to.include(result.value);
            });
        });

        it('meldet eine unbekannte Basiskarte als NOT_FOUND', () => {
            const geoline = initMap();
            cy.then(async () => {
                const result = await geoline.addStmaBaseLayer('Unbekannt');
                expect(result.ok).to.equal(false);
                expect(result.error.code).to.equal('NOT_FOUND');
            });
        });

        it('meldet eine nicht ladbare Konfiguration als CONFIG_UNAVAILABLE', () => {
            cy.intercept('POST', CONFIG_URL, {statusCode: 500});
            cy.then(async () => {
                const result = await initMap().addStmaBaseLayer('Basemap');
                expect(result.ok).to.equal(false);
                expect(result.error.code).to.equal('CONFIG_UNAVAILABLE');
            });
        });
    });

    describe('GeoJSON', () => {
        it('fügt GeoJSON synchron hinzu und meldet ungültige Daten als INVALID_DATA', () => {
            const geoline = initMap();
            const added = geoline.addGeoJSON(GEOJSON);
            expect(added.ok).to.equal(true);
            expect(added.value.getSource().getFeatures()).to.have.length(1);

            const invalid = geoline.addGeoJSON({type: 'Feature', geometry: {type: 'Unbekannt', coordinates: []}});
            expect(invalid.ok).to.equal(false);
            expect(invalid.error.code).to.equal('INVALID_DATA');
        });

        it('lädt GeoJSON per URL', () => {
            cy.intercept('GET', GEOJSON_URL, {body: GEOJSON});
            const geoline = initMap();
            cy.then(async () => {
                const result = await geoline.addGeoJSONfromURL(GEOJSON_URL);
                expect(result.ok).to.equal(true);
                expect(geoline.getMap().getLayers().getArray()).to.include(result.value);
            });
        });

        it('meldet eine nicht abrufbare Datei als SERVICE_UNAVAILABLE', () => {
            cy.intercept('GET', GEOJSON_URL, {statusCode: 404});
            const geoline = initMap();
            cy.then(async () => {
                const result = await geoline.addGeoJSONfromURL(GEOJSON_URL);
                expect(result.ok).to.equal(false);
                expect(result.error.code).to.equal('SERVICE_UNAVAILABLE');
            });
        });

        it('meldet ungültiges JSON als INVALID_DATA', () => {
            cy.intercept('GET', GEOJSON_URL, {body: 'kein json', headers: {'content-type': 'text/plain'}});
            const geoline = initMap();
            cy.then(async () => {
                const result = await geoline.addGeoJSONfromURL(GEOJSON_URL);
                expect(result.ok).to.equal(false);
                expect(result.error.code).to.equal('INVALID_DATA');
            });
        });
    });

    describe('Kartendienste des Stadtmessungsamtes in generischen Methoden', () => {
        const expectRejected = (promise) => promise.then(
            () => expect.fail('Promise hätte abgelehnt werden müssen'),
            (err) => {
                expect(err).to.be.instanceOf(TypeError);
                expect(err.message).to.include('addStmaWMSLayer');
            }
        );

        it('lehnt ab, wenn die Konfiguration schon geladen ist', () => {
            const geoline = initMap();
            cy.then(() => geoline.loadConfig());
            cy.then(() => expectRejected(geoline.addWMSLayer('https://wms.stma.test/wms', 'Layer')));
        });

        it('lehnt ab, wenn die Konfiguration noch lädt', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG, delay: 300});
            // initMap erst nach dem Intercept auslösen, sonst gilt noch die Antwort ohne Verzögerung
            cy.then(() => {
                const geoline = initMap();
                expect(geoline.config, 'Konfiguration noch nicht geladen').to.equal(null);
                return expectRejected(geoline.addWMSLayer('https://wms.stma.test/wms', 'Layer'));
            });
        });
    });

    describe('dispose', () => {
        it('bricht einen laufenden GeoJSON-Abruf mit ABORTED ab', () => {
            cy.intercept('GET', GEOJSON_URL, {body: GEOJSON, delay: 300});
            const geoline = initMap();
            cy.then(async () => {
                const pending = geoline.addGeoJSONfromURL(GEOJSON_URL);
                geoline.dispose();
                const result = await pending;
                expect(result.ok).to.equal(false);
                expect(result.error.code).to.equal('ABORTED');
            });
        });

        it('bricht einen Layer-Aufruf während des Konfigurationsabrufs mit ABORTED ab', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG, delay: 300});
            cy.then(async () => {
                const geoline = initMap();
                const pending = geoline.addStmaBaseLayer('Unbekannt');
                geoline.dispose();
                const result = await pending;
                expect(result.ok).to.equal(false);
                expect(result.error.code).to.equal('ABORTED');
            });
        });
    });

    describe('mehrere Karten auf einer Seite', () => {
        it('verlangt eine eigene Popup-ID für jede weitere Karte', () => {
            initMap();
            expect(document.querySelector('#geoline_ol_js_popup.geoline-ol-js-popup')).to.not.equal(null);
            expectThrow(() => initMap(), Error, 'bereits vergeben');

            initMap({popupId: 'zweites_popup'});
            expect(document.querySelector('#zweites_popup.geoline-ol-js-popup')).to.not.equal(null);
        });

        it('gibt die Popup-ID mit dispose frei', () => {
            initMap().dispose();
            expect(document.getElementById('geoline_ol_js_popup')).to.equal(null);
            expect(() => initMap()).to.not.throw();
        });

        it('unterdrückt das Kontextmenü auf jeder Karte, aber nicht auf der Seite', () => {
            const first = initMap();
            const second = initMap({popupId: 'zweites_popup'});
            const contextmenu = (element) => {
                const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
                element.dispatchEvent(event);
                return event.defaultPrevented;
            };
            expect(contextmenu(first.getMap().getViewport())).to.equal(true);
            expect(contextmenu(second.getMap().getViewport())).to.equal(true);
            expect(contextmenu(createTarget())).to.equal(false);
        });
    });
});
