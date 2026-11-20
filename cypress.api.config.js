import {defineConfig} from 'cypress';

// Tests der öffentlichen API ohne Beispielseite und ohne Dev-Server:
// Specs importieren das frisch gebaute dist/geoline.ol.js, das Netzwerk wird per cy.intercept gesteuert.
export default defineConfig({
    e2e: {
        defaultBrowser: 'chrome',
        specPattern: 'cypress/api/**/*.cy.js',
        supportFile: false,
        video: false,
        retries: 0,
    },
});
