import {defineConfig} from 'cypress';

// Browsertest der gebauten Verbraucherprojekte aus .consumers/ (siehe scripts/check-consumer.mjs).
// Ohne baseUrl liefert Cypress die Dateien aus dem Projektordner aus.
export default defineConfig({
    e2e: {
        defaultBrowser: 'chrome',
        specPattern: 'cypress/consumer/**/*.cy.js',
        supportFile: false,
        video: false,
        retries: 0,
    },
});
