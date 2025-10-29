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
        cy.wait('@loadWmtsCapabilities', {timeout: 30000});
        cy.wait('@loadMapTiles', {timeout: 30000});
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
        cy.intercept('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer**').as('loadLayer');
        cy.intercept('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/**').as('loadMapTiles');

        // Beispiel aufrufen
        cy.visit('/example_Web_Mercator_Auxiliary_Sphere_3857.html');

        // warten bis die Karte initiaisliert ist
        cy.wait('@loadConfig');
        cy.wait('@loadLayer', {timeout: 30000});
        cy.wait('@loadMapTiles', {timeout: 30000});

        // Koordinaten-Widget
        cy.get('.ol-mouse-position').should('be.visible');
        // Zoom-Widget
        cy.get('.ol-zoom').should('be.visible');
    });


    it('Beispiel: example_WMTS_25832.html', () => {

        cy.intercept('https://gis5.stuttgart.de/geoline/geoline.config/config.aspx').as('loadConfig');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts**').as('loadLayer');
        cy.intercept('https://geoserver.stuttgart.de/geoserver/gwc/service/wmts/rest/Base:A62_Luftbild_2021_EPSG25832/**').as('loadMapTiles');

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
});
