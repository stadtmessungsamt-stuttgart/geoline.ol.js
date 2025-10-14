const {defineConfig} = require('cypress');

module.exports = defineConfig({
    e2e: {
        baseUrl: 'http://localhost:8080',
        defaultBrowser: 'chrome',
        specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/e2e.js',
        video: false,
        retries: 0,
        setupNodeEvents(on, config) {
            // implement node event listeners here
            return config;
        },
    },
});
