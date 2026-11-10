// Abruf von Dienstinformationen per fetch: Fehler als Result, Cache je Karte, Abbruch mit dispose().
import StmaOpenLayers from '../../dist/geoline.ol.js';

import {CONFIG, CONFIG_URL} from './fixtures/config.js';

const ESRI_URL = 'https://ags.extern.test/arcgis/rest/services/Test/MapServer';
const ESRI_INFO = {hostname: 'ags.extern.test', pathname: '/arcgis/rest/services/Test/MapServer', query: {f: 'json'}};

// Dynamischer Dienst: kein singleFusedMapCache
const AGS_INFO = {
    currentVersion: 11.1,
    copyrightText: 'Test',
    spatialReference: {wkid: 25832, latestWkid: 25832},
};

describe('Abruf von Dienstinformationen', () => {
    let target;
    let geoline;

    beforeEach(() => {
        cy.intercept('POST', CONFIG_URL, {body: CONFIG});
        // Kartenbilder des dynamischen Dienstes nicht wirklich abrufen
        cy.intercept({hostname: 'ags.extern.test', pathname: /\/export$/}, {statusCode: 204});
        target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        document.body.appendChild(target);
        geoline = new StmaOpenLayers();
        geoline.initMap(25832, {target});
    });

    afterEach(() => {
        geoline.dispose();
        target.remove();
    });

    const addEsriLayer = (expectedCode) => cy.then(async () => {
        const result = await geoline.addEsriLayer(ESRI_URL);
        if (expectedCode === undefined) {
            expect(result.ok, JSON.stringify(result.error)).to.equal(true);
            expect(geoline.getMap().getLayers().getArray()).to.include(result.value);
        } else {
            expect(result.ok).to.equal(false);
            expect(result.error.code).to.equal(expectedCode);
        }
        return result;
    });

    it('fügt einen ArcGIS-Dienst ohne Script-Ausführung hinzu', () => {
        cy.intercept(ESRI_INFO, {body: AGS_INFO});
        const scripts = document.scripts.length;
        addEsriLayer().then(() => expect(document.scripts.length, 'keine Script-Elemente').to.equal(scripts));
    });

    it('meldet eine Fehlerantwort des Dienstes als SERVICE_ERROR', () => {
        cy.intercept(ESRI_INFO, {body: {error: {code: 499, message: 'Token Required'}}});
        addEsriLayer('SERVICE_ERROR');
    });

    it('meldet eine ungültige Antwort als INVALID_DATA', () => {
        cy.intercept(ESRI_INFO, {body: 'kein json', headers: {'content-type': 'text/plain'}});
        addEsriLayer('INVALID_DATA');
    });

    it('meldet einen HTTP-Fehler als SERVICE_UNAVAILABLE', () => {
        cy.intercept(ESRI_INFO, {statusCode: 503});
        addEsriLayer('SERVICE_UNAVAILABLE');
    });

    it('fragt nach einem Netzwerkfehler erneut an und liefert den ursprünglichen Fehler in cause', () => {
        // Chrome wiederholt Requests nach einem Netzwerkfehler teils selbst; deshalb scheitert der Dienst, solange
        // failing gesetzt ist, und geprüft wird nur, dass der zweite Aufruf genau einen neuen Request auslöst.
        let failing = true;
        let requests = 0;
        cy.intercept(ESRI_INFO, (req) => {
            requests += 1;
            req.reply(failing ? {forceNetworkError: true} : {body: AGS_INFO});
        });
        let before;
        addEsriLayer('SERVICE_UNAVAILABLE').then((result) => {
            expect(result.error.cause).to.have.property('name', 'TypeError');
            failing = false;
            before = requests;
        });
        addEsriLayer().then(() => expect(requests - before, 'neue Requests').to.equal(1));
    });

    it('teilt sich bei gleichzeitigen Aufrufen einen Request', () => {
        let requests = 0;
        cy.intercept(ESRI_INFO, (req) => {
            requests += 1;
            req.reply({body: AGS_INFO, delay: 100});
        });
        cy.then(async () => {
            const results = await Promise.all([geoline.addEsriLayer(ESRI_URL), geoline.addEsriLayer(ESRI_URL)]);
            expect(results.map((result) => result.ok)).to.deep.equal([true, true]);
            expect(requests).to.equal(1);
        });
    });

    it('bricht einen laufenden Abruf mit dispose() als ABORTED ab', () => {
        cy.intercept(ESRI_INFO, {body: AGS_INFO, delay: 300});
        cy.then(async () => {
            const pending = geoline.addEsriLayer(ESRI_URL);
            geoline.dispose();
            const result = await pending;
            expect(result.ok).to.equal(false);
            expect(result.error.code).to.equal('ABORTED');
        });
    });
});
