import {defineConfig} from 'cypress';

export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:8080',
        defaultBrowser: 'chrome',
        specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/e2e.js',
        video: false,
        // Die Beispiele nutzen die echten Dienste von stuttgart.de; ein einzelner Timeout soll den Lauf nicht rot machen.
        // Nur hier: API- und Verbrauchertests laufen gegen Fixtures und bleiben ohne Wiederholung.
        retries: {runMode: 1, openMode: 0},
    },
});
