// Getestet wird das ausgelieferte Artefakt; das Script cypress-api baut es vorher.
import StmaOpenLayers from '../../dist/geoline.ol.js';
import pkg from '../../package.json';
import {CONFIG, CONFIG_URL} from './fixtures/config.js';

describe('Konfiguration', () => {
    let target;
    let instances;

    const initMap = (customParams = {}) => {
        const geoline = new StmaOpenLayers();
        instances.push(geoline);
        geoline.initMap(25832, {target}, {}, customParams);
        return geoline;
    };

    const expectFailure = (result, code) => {
        expect(result.ok, 'Result').to.equal(false);
        expect(result.error.code).to.equal(code);
        return result;
    };

    beforeEach(() => {
        instances = [];
        target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        document.body.appendChild(target);
    });

    afterEach(() => {
        instances.forEach((geoline) => geoline.dispose());
        target.remove();
    });

    describe('Abruf', () => {
        it('liefert die Konfiguration erst nach dem Laden, ohne Platzhalter', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG, delay: 200});
            cy.then(async () => {
                const result = await initMap().loadConfig();
                expect(result.ok).to.equal(true);
                expect(result.value).to.deep.equal(CONFIG);
            });
        });

        it('lädt die Konfiguration nach einem Netzwerkfehler beim nächsten Zugriff erneut', () => {
            // Chrome wiederholt Requests nach einem Netzwerkfehler teils selbst; deshalb scheitert der Dienst, solange
            // failing gesetzt ist, und geprüft wird nur, dass der nächste Zugriff genau einen neuen Request auslöst.
            let failing = true;
            let requests = 0;
            cy.intercept('POST', CONFIG_URL, (req) => {
                requests += 1;
                req.reply(failing ? {forceNetworkError: true} : {body: CONFIG});
            });

            let geoline;
            let before;
            cy.then(async () => {
                geoline = initMap();
                const result = expectFailure(await geoline.loadConfig(), 'CONFIG_UNAVAILABLE');
                expect(result.error.cause).to.have.property('name', 'TypeError');
                failing = false;
                before = requests;
            });
            cy.then(async () => {
                expect((await geoline.loadConfig()).ok).to.equal(true);
                expect(requests - before, 'neue Requests').to.equal(1);
            });
        });

        it('meldet einen HTTP-Fehler als CONFIG_UNAVAILABLE', () => {
            cy.intercept('POST', CONFIG_URL, {statusCode: 503});
            cy.then(async () => expectFailure(await initMap().loadConfig(), 'CONFIG_UNAVAILABLE'));
        });

        it('meldet eine Antwort ohne JSON als INVALID_DATA', () => {
            cy.intercept('POST', CONFIG_URL, {body: '<html></html>', headers: {'content-type': 'text/html'}});
            cy.then(async () => expectFailure(await initMap().loadConfig(), 'INVALID_DATA'));
        });

        it('wirft vor initMap', () => {
            expect(() => new StmaOpenLayers().loadConfig()).to.throw('Keine aktive Karte');
        });
    });

    describe('Parameter des Abrufs', () => {
        it('sendet im Parameter url nur Origin und Pfad, ohne Query und Fragment', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG}).as('config');
            const original = location.href;
            cy.then(() => {
                history.replaceState(history.state, '', location.pathname + '?nutzer=4711#geheim');
                initMap();
                history.replaceState(history.state, '', original);
            });
            cy.wait('@config').then(({request}) => {
                expect(new URLSearchParams(request.body).get('url')).to.equal(location.origin + location.pathname);
            });
        });

        // Das Stadtmessungsamt filtert Testläufe anhand dieses Merkmals aus seiner Statistik.
        it('meldet Testläufe im Parameter url unter localhost', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG}).as('config');
            cy.then(() => initMap());
            cy.wait('@config').then(({request}) => {
                const url = new URLSearchParams(request.body).get('url');
                expect(new URL(url).hostname).to.equal('localhost');
            });
        });

        it('sendet im Parameter v die Paketversion', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG}).as('config');
            cy.then(() => initMap());
            cy.wait('@config').then(({request}) => {
                expect(new URLSearchParams(request.body).get('v')).to.equal(pkg.version);
            });
        });

        it('verlangt HTTPS für die Konfigurations-URL, HTTP nur für localhost', () => {
            expect(() => new StmaOpenLayers('http://config.example.test/config')).to.throw('HTTPS');
            expect(() => new StmaOpenLayers('ftp://config.example.test/config')).to.throw('HTTPS');
            expect(() => new StmaOpenLayers('http://localhost:8080/config')).to.not.throw();
        });
    });

    describe('Prüfung', () => {
        const INVALID = {
            'null': null,
            'Array': [],
            'Host mit Pfad': {...CONFIG, wmts_host: 'boese.test/pfad'},
            'Host mit Zugangsdaten': {...CONFIG, ags_host: 'nutzer:pw@ags.stma.test'},
            'Host mit Schema': {...CONFIG, wms_host: 'https://wms.stma.test'},
            'Instanz mit ..': {...CONFIG, wms_instance: '../admin'},
            'falscher Typ': {...CONFIG, wms_tiled: 'ja'},
            'Dienst mit Host mit Pfad': {...CONFIG, wmts_services: {Basemap: {...CONFIG.wmts_services.Basemap, host: 'boese.test/x'}}},
            'Dienste als Array': {...CONFIG, ags_services: []},
        };

        Object.entries(INVALID).forEach(([name, config]) => {
            it(`meldet eine ungültige Antwort als INVALID_DATA: ${name}`, () => {
                cy.intercept('POST', CONFIG_URL, {body: JSON.stringify(config), headers: {'content-type': 'application/json'}});
                cy.then(async () => expectFailure(await initMap().loadConfig(), 'INVALID_DATA'));
            });

            it(`weist eine ungültige manuelle Konfiguration zurück: ${name}`, () => {
                const geoline = new StmaOpenLayers();
                instances.push(geoline);
                // null gilt als „nicht angegeben“
                if (config === null) {
                    return;
                }
                expect(() => geoline.initMap(25832, {target}, {}, {config})).to.throw('_customParams.config');
            });
        });

        it('löst bei ungültiger Konfiguration keine Requests an die Dienste aus', () => {
            let serviceRequests = 0;
            cy.intercept({hostname: 'boese.test'}, (req) => {
                serviceRequests += 1;
                req.reply({statusCode: 204});
            });
            cy.intercept('POST', CONFIG_URL, {body: INVALID['Dienst mit Host mit Pfad']});
            cy.then(async () => {
                const geoline = initMap();
                expectFailure(await geoline.addStmaBaseLayer('Basemap'), 'INVALID_DATA');
                expectFailure(await geoline.addStmaWMTSLayer('Layer'), 'INVALID_DATA');
                expect(serviceRequests).to.equal(0);
            });
        });

        it('meldet unbekannte und geerbte Namen als NOT_FOUND', () => {
            cy.intercept('POST', CONFIG_URL, {body: CONFIG});
            cy.then(async () => {
                const geoline = initMap();
                for (const name of ['Unbekannt', 'toString', '__proto__', 'constructor']) {
                    expectFailure(await geoline.addStmaBaseLayer(name), 'NOT_FOUND');
                }
            });
        });

        it('übernimmt eine manuelle Konfiguration ohne Abruf und ignoriert unbekannte Felder', () => {
            let requests = 0;
            cy.intercept('POST', CONFIG_URL, (req) => {
                requests += 1;
                req.reply({body: CONFIG});
            });
            cy.then(async () => {
                const result = await initMap({config: {...CONFIG, ags_hosts: ['alt.test'], kommentar: 'x'}}).loadConfig();
                expect(result.value).to.deep.equal(CONFIG);
                expect(requests).to.equal(0);
            });
        });

        it('weist Stma-Dienste anhand der Standard-Hosts zurück, auch ohne benannte Dienste', () => {
            cy.intercept('POST', CONFIG_URL, {body: {...CONFIG, wms_services: {}}});
            cy.then(() => initMap().addWMSLayer('https://wms.stma.test/geoserver/ows', 'Layer').then(
                () => expect.fail('Promise hätte abgelehnt werden müssen'),
                (err) => expect(err.message).to.include('addStmaWMSLayer')
            ));
        });
    });
});
