describe('Lade alle Beispiele und prüfe sie', () => {
    let messages;

    const setupConsoleCapture = () => {
        messages = [];
        cy.on('window:before:load', (win) => {
            const origLog = win.console.log;
            win.console.log = function (...args) {
                try {
                    messages.push(args.join(' '));
                } catch (e) {
                }
                return origLog.apply(this, args);
            };
        });
    };

    beforeEach(() => {
        // Browser-Cache über CDP (Chrome DevTools Protocol) leeren,
        // damit die Kacheln neu geladen werden
        if (Cypress.browser.family === 'chromium') {
            cy.wrap(null).then(() => {
                return new Promise((resolve) => {
                    Cypress.automation('remote:debugger:protocol', {
                        command: 'Network.clearBrowserCache'
                    }).then(resolve)
                })
            })
        }
        setupConsoleCapture();
    })


    it('Beispiel: example_UTM_25832.html', () => {

        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        // cy.intercept('https://gis5.stuttgart.de/arcgis/rest/services/1_Base/Stadtkarte_Internet_c_EPSG25832/MapServer/tile/**').as('loadMapTiles');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts?REQUEST=GetCapabilities**').as('loadWmtsCapabilities');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts/rest/Base:Basemap_EPSG25832/default/Stuttgart_UTM_CRS_oL/**').as('loadMapTiles');

        // Beispiel aufrufen
        cy.visit('/example_UTM_25832.html');

        // warten bis die Karte initiaisliert ist
        cy.wait('@loadConfig');
        cy.wait('@loadWmtsCapabilities', {timeout: 30000});
        cy.wait('@loadMapTiles', {timeout: 30000});

        // Prüfe, ob die gewünschte Konsolenausgabe erfolgt ist
        const expectedText = 'addStmaBaseLayer (Basemap) wurde ausgeführt';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });

    });


    it('Beispiel: example_UTM_25832_mit_GeoJSON.html', () => {

        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        // cy.intercept('https://gis5.stuttgart.de/arcgis/rest/services/1_Base/Stadtkarte_Internet_c_EPSG25832/MapServer/tile/**').as('loadMapTiles');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts?REQUEST=GetCapabilities**').as('loadWmtsCapabilities');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts/rest/Base:Basemap_EPSG25832/default/Stuttgart_UTM_CRS_oL/**').as('loadMapTiles');
        cy.intercept('/testdata/example_25832.json').as('loadJson');

        // Beispiel aufrufen
        cy.visit('/example_UTM_25832_mit_GeoJSON.html');

        // warten bis die Karte initiaisliert ist
        cy.wait('@loadConfig');
        cy.wait('@loadMapTiles', {timeout: 30000});
        cy.wait('@loadWmtsCapabilities', {timeout: 30000});
        cy.wait('@loadJson', {timeout: 30000});

        // Prüfe, ob die gewünschte Konsolenausgabe erfolgt ist
        let expectedText = 'Features aus GeoJSON hinzugefügt';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
//            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });

        expectedText = 'Features aus GeoJSON per URL hinzugefügt';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
//            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });
    });


    it('Beispiel: example_Web_Mercator_Auxiliary_Sphere_3857.html', () => {

        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        cy.intercept({hostname: 'gis5.stuttgart.de', pathname: '/arcgis/rest/services/1_Base/Stadtkarte_Internet_c_EPSG3857/MapServer', query: {f: 'json'}}).as('loadLayer');
        cy.intercept('https://gis5.stuttgart.de/arcgis/rest/services/1_Base/Stadtkarte_Internet_c_EPSG3857/MapServer/tile/**').as('loadMapTiles');

        // Beispiel aufrufen
        cy.visit('/example_Web_Mercator_Auxiliary_Sphere_3857.html');

        // warten bis die Karte initiaisliert ist
        cy.wait('@loadConfig');
        cy.wait('@loadLayer', {timeout: 30000}).its('response.statusCode').should('eq', 200);
        cy.wait('@loadMapTiles', {timeout: 30000}).then(({response}) => {
            expect(response.statusCode).to.eq(200);
            expect(response.headers['content-type']).to.match(/^image\//);
        });

        // Koordinaten-Widget
        cy.get('.ol-mouse-position').should('be.visible');
        // Zoom-Widget
        cy.get('.ol-zoom').should('be.visible');
    });


    it('Beispiel: example_WMTS_25832.html', () => {

        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts**').as('loadLayer');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts/rest/Base:A62_Luftbild_aktuell_EPSG25832/**').as('loadMapTiles');

        // Beispiel aufrufen
        cy.visit('/example_WMTS_25832.html');

        // warten bis die Karte initiaisliert ist
        cy.wait('@loadConfig');
        cy.wait('@loadLayer', {timeout: 30000});
        cy.wait('@loadMapTiles', {timeout: 30000});

        // Prüfe, ob die gewünschte Konsolenausgabe erfolgt ist
        let expectedText = 'initMap wurde ausgeführt';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });
        expectedText = 'STMA WMTS OK';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });
    });


    it('Beispiel: example_WMS_25832.html', () => {

        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        //cy.intercept('https://geoserver.stuttgart.de/geoserver/ows?*SERVICE=WMS*LAYERS=Base%3AA62_Luftbild_2009_EPSG25832**').as('loadMapTiles');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/ows?*SERVICE=WMS*FORMAT=image%2Fpng*CRS=EPSG**').as('loadMapTiles');

        // Beispiel aufrufen
        cy.visit('/example_WMS_25832.html');

        // warten bis die Karte initiaisliert ist
        cy.wait('@loadConfig');
        cy.wait('@loadMapTiles', {timeout: 30000});

        // Prüfe, ob die gewünschte Konsolenausgabe erfolgt ist
        let expectedText = 'initMap wurde ausgeführt';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });
        expectedText = 'STMA WMS OK';
        cy.wrap(null).then(() => {
            const joined = messages.join('\n');
            // Debug-Ausgabe im Cypress-Log
            cy.log('Console messages collected:', joined);
            expect(joined, 'Konsole enthält erwartete Meldung').to.include(expectedText);
        });
    });


    it('Beispiel: example_ArcGIS_25832.html', () => {

        const ags = 'https://gis5.stuttgart.de/arcgis/rest/services/1_Base/';
        const metadata = (service) => ({hostname: 'gis5.stuttgart.de', pathname: '/arcgis/rest/services/1_Base/' + service + '/MapServer', query: {f: 'json'}});
        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        cy.intercept(metadata('Stadtkarte_Internet_c_EPSG25832')).as('loadStadtkarte');
        cy.intercept(ags + 'Stadtkarte_Internet_c_EPSG25832/MapServer/tile/**').as('loadStadtkarteTiles');
        cy.intercept(metadata('Luftbilder_aktuell_c_EPSG25832')).as('loadLuftbild');
        cy.intercept(ags + 'Luftbilder_aktuell_c_EPSG25832/MapServer/tile/**').as('loadLuftbildTiles');

        cy.visit('/example_ArcGIS_25832.html');

        cy.wait('@loadConfig');
        ['@loadStadtkarte', '@loadLuftbild'].forEach((alias) => {
            cy.wait(alias, {timeout: 30000}).its('response.statusCode').should('eq', 200);
        });
        ['@loadStadtkarteTiles', '@loadLuftbildTiles'].forEach((alias) => {
            cy.wait(alias, {timeout: 30000}).then(({response}) => {
                expect(response.statusCode, alias).to.eq(200);
                expect(response.headers['content-type'], alias).to.match(/^image\//);
            });
        });

        // Die Callbacks laufen erst, nachdem geoline den Layer zur Karte hinzugefügt hat
        cy.wrap(null).should(() => {
            const joined = messages.join('\n');
            expect(joined, 'Konsole enthält erwartete Meldung').to.include('STMA Stadtkarte OK');
            expect(joined, 'Konsole enthält erwartete Meldung').to.include('STMA Luftbild OK');
        });
    });
});
