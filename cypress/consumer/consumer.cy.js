// Geoline und Anwendung teilen sich eine OpenLayers-Installation, gebaut mit Webpack 5 bzw. Vite.
const CONSUMERS = {
    'Webpack 5 (JS)': '.consumers/webpack-js/index.html',
    'Vite (TS)': '.consumers/vite-ts/dist/index.html',
};

describe('Verbraucherprojekte', () => {
    Object.entries(CONSUMERS).forEach(([name, page]) => {
        it(`nutzt dieselbe OpenLayers-Installation wie die Anwendung: ${name}`, () => {
            cy.visit(page);
            cy.window().its('geolineConsumer').then((result) => {
                expect(result.sameMapClass, 'Karte ist eine ol/Map der Anwendung').to.equal(true);
                expect(result.sameLayerClass, 'Layer ist ein ol/layer/Vector der Anwendung').to.equal(true);
                expect(result.projectionBefore, 'EPSG:25832 vor initMap').to.equal(false);
                expect(result.projectionAfter, 'EPSG:25832 nach initMap in der OpenLayers-Installation der Anwendung').to.equal(true);
                expect(result.inputError).to.deep.include({name: 'TypeError'});
                expect(result.inputError.message).to.include('_pointCoords');
            });
            cy.get('.ol-viewport').should('have.length', 1);
        });
    });
});
