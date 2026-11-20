# Verbraucherprojekte

Kleine Anwendungen, die das gepackte Paket so einbinden wie eine echte Anwendung: `npm run test-consumer` kopiert jedes
Projekt in ein leeres Verzeichnis, installiert dort das Paket aus `.pack/` samt `ol`, baut es und prüft das Ergebnis im
Browser (`cypress/consumer`).

- `webpack-js`: Webpack 5, JavaScript
- `vite-ts`: Vite, TypeScript (vor dem Build mit `tsc` geprüft)

Geprüft wird, dass Geoline und Anwendung dieselben OpenLayers-Klassen nutzen, dass die von Geoline registrierte
Projektion EPSG:25832 in der OpenLayers-Installation der Anwendung bekannt ist und dass falsche Eingaben einen
verständlichen Fehler liefern.
