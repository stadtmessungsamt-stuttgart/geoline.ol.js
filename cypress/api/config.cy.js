// Getestet wird das ausgelieferte Artefakt; das Script cypress-api baut es vorher.
import StmaOpenLayers from '../../dist/geoline.ol.js';

const CONFIG_URL = 'https://gis5.stuttgart.de/geoline/geoline.config/config.aspx';

const CONFIG = {
    ags_services: [],
    wms_services: [],
    wmts_services: [{host: 'wmts.example.test'}],
};

describe('Konfigurationsabruf', () => {
    let target;

    beforeEach(() => {
        target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        document.body.appendChild(target);
    });

    afterEach(() => target.remove());

    it('lädt die Konfiguration nach einem Netzwerkfehler beim nächsten Zugriff erneut', () => {
        // Chrome wiederholt Requests nach einem Netzwerkfehler teils selbst; deshalb scheitert der Dienst, solange
        // failing gesetzt ist, und geprüft wird nur, dass der nächste Zugriff genau einen neuen Request auslöst.
        let failing = true;
        let requests = 0;
        cy.intercept('POST', CONFIG_URL, (req) => {
            requests += 1;
            req.reply(failing ? {forceNetworkError: true} : {body: CONFIG});
        });

        const geoline = new StmaOpenLayers();
        let before;
        cy.then(async () => {
            geoline.initMap(25832, {target});
            const result = await geoline.addStmaBaseLayer('Basemap');
            // getConfig() hier nicht aufrufen: es startet selbst einen Abruf
            expect(result.error.code).to.equal('CONFIG_UNAVAILABLE');
            failing = false;
            before = requests;
        });

        // Der nächste Zugriff startet einen neuen Request
        cy.then(async () => {
            const result = await geoline.addStmaBaseLayer('Basemap');
            expect(result.error.code, 'Konfiguration geladen, Karte unbekannt').to.equal('NOT_FOUND');
            expect(geoline.getConfig().wmts_hosts).to.deep.equal(['wmts.example.test']);
            expect(requests - before, 'neue Requests').to.equal(1);
        });
    });

    // Das Stadtmessungsamt filtert Testläufe anhand dieses Merkmals aus seiner Statistik.
    it('meldet Testläufe im Parameter url unter localhost', () => {
        cy.intercept('POST', CONFIG_URL, {body: CONFIG}).as('config');

        const geoline = new StmaOpenLayers();
        cy.then(() => geoline.initMap(25832, {target}));
        cy.wait('@config').then(({request}) => {
            const url = new URLSearchParams(request.body).get('url');
            expect(new URL(url).hostname).to.equal('localhost');
        });
    });
});
