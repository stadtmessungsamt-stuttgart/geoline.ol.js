# Entwickeln mit geoline.ol.js

Dieses Dokument beschreibt, wie eine lokale Entwicklungsumgebung für geoline.ol.js gestartet, Beispiele ausgeführt und Tests gestartet werden können.

## Voraussetzungen
- Node.js 18 oder höher (empfohlen: 22 LTS)
- Optional: nvm (Node Version Manager) für die Verwaltung mehrerer Node-Versionen
- Optional: Docker (falls ohne lokale Node-Installation gearbeitet werden soll)

Empfohlene Node-Version setzen (mit nvm):
```
nvm install 22
nvm use 22
```

## Repository klonen
```
git clone https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js.git
cd geoline.ol.js
```

## Abhängigkeiten installieren
```
npm install
```

Hinweis: Für reproduzierbare Builds kann auch `npm ci` verwendet werden (erfordert vorhandene package-lock.json).

## Beispiele lokal bauen und serven (Schnellstart)
Die Beispiele befinden sich unter `examples/` und werden in den Ordner `demo/` gebündelt. Ein Webpack Dev Server stellt diese anschließend auf Port 8080 bereit.

Bei der Entwicklung in der `geoline.ol.js` muss darauf geachtet werden, 
dass in den Beispielen das Modul reguläre über `import StmaOpenLayers from "@stadtmessungsamt-stuttgart/geoline.ol.js/dist/geoline.ol.js";` eingebunden wird.
Das bedeutet, dass Änderungen an der Datei erst durch den "" Prozess laufen müssen.
Je nach Leistung des Entwicklungssystems kann es etwas dauern, bis die Änderungen "publiziert" wurden und sich die Seite im Browser aktualisiert.

- Starten:
```
npm run start-dev
```
- Aufruf im Browser:
  - http://localhost:8080/ (Übersichtsseite)
  - oder die einzelnen Beispielseiten in `demo/` (z. B. `example_WMS_25832.html`).

Relevante Scripts (siehe package.json):
- `npm run build-examples` – bundelt alle Beispiel-JS/TS-Dateien nach `demo/`
- `npm run serve-examples` – startet den Webpack Dev Server auf Port 8080
- `npm run examples` – startet den Dev Server (baut dabei automatisch)

## Entwicklung ohne lokale Node-Installation (Docker)
Folgendes Kommando erzeugt einen Docker-Container und startet die Demo unter Port 8080:
```
docker run -it --rm --name geoline-ol-js \
   -w /app \
   -v $(pwd):/app \
   -e NODE_ENV=development \
   -p 8080:8080 \
   node:22 \
   bash -c "npm install && npm run start-dev"
```
Voraussetzungen:
- Docker installiert und lauffähig
- Der aktuelle Projektordner wird als Volume eingebunden; Änderungen an den Beispielen erfordern ggf. ein erneutes `npm run examples` im Container-Lauf (das Script erledigt das automatisch pro Start).

## Optional: CORS-Proxy für externe Dienste
Ein einfacher CORS-Proxy ist enthalten, um Entwicklungszugriffe auf externe Dienste zu erleichtern (nur lokal verwenden!).  

Starten:
```
node cors-proxy.cjs
```
Der Proxy lauscht auf `http://localhost:1235`. Ziel-URLs bspw. so präfixen:
```
http://localhost:1235/https://geoservice.stuttgart.de/...
```

Sicherheitshinweis: Der Proxy ist für die lokale Entwicklung gedacht (whitelist leer). Nicht öffentlich betreiben.

## Cypress-Tests ausführen
Die Cypress-Tests erwarten, dass die Demo auf Port 8080 läuft und bauen/serven diese automatisch in einem separaten Prozess.

- Interaktiver Modus:
```
npm run cypress-open
```
- Headless-Run (Chrome):
```
npm run cypress-run
```

Tipp (mit nvm und Node 22):
```
# Cypress im interaktiven Modus mit Node 22 starten
nvm exec 22 npm run cypress-open

# Headless-Run mit Node 22
nvm exec 22 npm run cypress-run
```

## Ports & Pfade
- Demo-Server: http://localhost:8080
- CORS-Proxy (optional): http://localhost:1235
- Beispiele: `examples/` (Quellcode) → `demo/` (gebündelte Ausgabe)

Troubleshooting:
- Port 8080 schon belegt: Port im `package.json`-Script `serve-examples` (Flag `--port`) anpassen oder den belegenden Prozess beenden.
- Leere Beispielseite/nicht geladenes JS: Der Dev Server baut die Beispiele automatisch. Prüfen Sie die Terminalausgabe des Dev Servers auf Fehler.

## Troubleshooting (weiteres)
- CORS-Fehler bei externen Diensten: Optionalen CORS-Proxy (`node cors-proxy.cjs`) nutzen oder die Ziel-Server entsprechend konfigurieren.
- Kaputte Abhängigkeiten: `rm -rf node_modules package-lock.json && npm install` ausführen.

## Nützliche Ordner
- `src/` – Bibliotheksquellcode
- `dist/` – gebaute Bibliotheksartefakte (JS, CSS, Typdefinitionen)
- `examples/` – Beispiel-HTML/JS/TS-Dateien
- `demo/` – generiertes Ausgabeverzeichnis der Beispiele
- `cypress/` – End-to-End-Tests

## Neues Release erstellen
Dieser Abschnitt beschreibt, wie ein neues Release der Bibliothek erstellt und auf npm veröffentlicht wird. Die Veröffentlichung erfolgt automatisiert über GitHub Actions, sobald ein GitHub-Release veröffentlicht wird.

Empfohlener Ablauf:
1. Lokal testen und bauen
   - Sicherstellen, dass alle Änderungen committet sind und die Beispiele/Tests lokal funktionieren:
     - `npm install`
     - `npm run examples` (optional zur Sichtprüfung)
     - `npm run cypress-run` (führt E2E-Tests headless aus)
2. Version anheben
   - Version in `package.json` anheben
   - `npm run build-dist` ausführen
   - Änderungen commiten
   - Tag erstellen (Als Tag-Namen das Schema `vX.Y.Z` passend zur `package.json` verwenden.
3. Änderungen pushen
   - `git push`
   - `git push --tags`
4. GitHub-Release erstellen
   - Auf GitHub → Releases → "Draft a new release" wechseln.
   - Den zuvor erstellten Tag wählen (oder dort erstellen) und einen Titel vergeben (z. B. `vX.Y.Z`).
   - Optional: Release Notes hinzufügen (Kurzbeschreibung der Änderungen) und auf "Publish release" klicken.
5. Automatischen Publish abwarten
   - Der Workflow `.github/workflows/main.yml` startet bei veröffentlichtem Release:
     - Führt Cypress-Tests aus
     - Baut das Paket (`npm run build-dist`)
     - Veröffentlicht auf npm (`npm publish --access public`)
   - Den Status im Tab "Actions" verfolgen. Bei Erfolg ist die Version auf npm verfügbar.

Hinweise:
- Der Publish-Job benötigt das GitHub-Secret `NPM_TOKEN`. Dieses sollte für das Repo bereits konfiguriert sein.
- GitHub-Tag und Version in `package.json` müssen übereinstimmen.
- Sicherheitscheck optional: `npm run audit` (nur Prod-Abhängigkeiten, siehe Scripts in `package.json`).
