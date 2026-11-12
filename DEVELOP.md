# Entwickeln mit geoline.ol.js

Dieses Dokument beschreibt, wie eine lokale Entwicklungsumgebung für geoline.ol.js gestartet, Beispiele ausgeführt und Tests gestartet werden können.

## Voraussetzungen
- Node.js 24 LTS mit npm 11.5.1 oder höher (Basis, auch für die Veröffentlichung). Die CI prüft zusätzlich Node 22 LTS.
- Optional: nvm (Node Version Manager) für die Verwaltung mehrerer Node-Versionen
- Optional: Docker (falls ohne lokale Node-Installation gearbeitet werden soll)

Die Datei `.nvmrc` legt die Version fest (mit nvm):
```
nvm install
nvm use
```

## Repository klonen
```
git clone https://github.com/stadtmessungsamt-stuttgart/geoline.ol.js.git
cd geoline.ol.js
```

## Abhängigkeiten installieren
```
npm ci
```

`npm ci` installiert genau die Versionen aus `package-lock.json`. `npm install` nur verwenden, um Abhängigkeiten bewusst zu ändern.

`dist/` liegt nicht im Repository. Die Scripts, die es brauchen, bauen es vorher selbst.

## Beispiele lokal bauen und serven (Schnellstart)
Die Beispiele befinden sich unter `examples/` und werden in den Ordner `demo/` gebündelt. Ein Webpack Dev Server stellt diese anschließend auf Port 8080 bereit.

Die Beispiele importieren das Paket wie ein Verbraucher (`@stadtmessungsamt-stuttgart/geoline.ol.js`). Der Name zeigt über die `exports`-Map des eigenen Pakets auf den gebauten Stand im Repository. Änderungen in `src/` erscheinen deshalb erst, nachdem `dist/` neu gebaut ist; `npm run start-dev` erledigt das im Watch-Modus.

- Starten:
```
npm run start-dev
```
- Aufruf im Browser:
  - http://localhost:8080/ (Übersichtsseite)
  - oder die einzelnen Beispielseiten in `demo/` (z. B. `example_WMS_25832.html`).

Relevante Scripts (siehe package.json):
- `npm run build-dist` – baut `dist/` (webpack, danach Typprüfung und `.d.ts` mit tsc)
- `npm run pack-dist` – baut `dist/` und packt das npm-Paket nach `.pack/`
- `npm run test-consumer` – installiert das Paket aus `.pack/` in leere Projekte: prüft das TS-Beispiel mit `moduleResolution` `bundler` und `nodenext`, baut die Verbraucherprojekte aus `consumers/` (Webpack 5, Vite) und prüft sie im Browser
- `npm run build-examples` – baut `dist/` und bündelt alle Beispiele nach `demo/`
- `npm run serve-examples` – baut `dist/` und startet den Webpack Dev Server auf Port 8080
- `npm run cypress-api` / `npm run cypress-run` – bauen `dist/` und starten die API- bzw. E2E-Tests; `test-api` und `test-e2e` testen ohne erneuten Build

## Entwicklung ohne lokale Node-Installation (Docker)
Folgendes Kommando erzeugt einen Docker-Container und startet die Demo unter Port 8080:
```
docker run -it --rm --name geoline-ol-js \
   -w /app \
   -v $(pwd):/app \
   -e NODE_ENV=development \
   -p 8080:8080 \
   node:24 \
   bash -c "npm install && npm run start-dev"
```
Voraussetzungen:
- Docker installiert und lauffähig
- Der aktuelle Projektordner wird als Volume eingebunden; `npm run start-dev` baut `dist/` und die Beispiele bei Änderungen neu.

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

Tipp (mit nvm, Version aus `.nvmrc`):
```
nvm exec npm run cypress-open
nvm exec npm run cypress-run
```

## Ports & Pfade
- Demo-Server: http://localhost:8080
- Beispiele: `examples/` (Quellcode) → `demo/` (gebündelte Ausgabe)

Troubleshooting:
- Port 8080 schon belegt: Port im `package.json`-Script `serve-examples` (Flag `--port`) anpassen oder den belegenden Prozess beenden.
- Leere Beispielseite/nicht geladenes JS: Der Dev Server baut die Beispiele automatisch. Prüfen Sie die Terminalausgabe des Dev Servers auf Fehler.

## Troubleshooting (weiteres)
- Kaputte Abhängigkeiten: `rm -rf node_modules && npm ci` ausführen. `package-lock.json` nicht löschen, sonst entstehen ungeprüfte Versionsstände.

## Nützliche Ordner
- `src/` – Bibliotheksquellcode
- `dist/` – gebaute Bibliotheksartefakte (JS, CSS, Typdefinitionen); nicht im Repository, nur im npm-Paket
- `.pack/` – gepacktes npm-Paket aus `npm run pack-dist`
- `examples/` – Beispiel-HTML/JS/TS-Dateien
- `demo/` – generiertes Ausgabeverzeichnis der Beispiele
- `cypress/` – End-to-End-Tests

## Neues Release erstellen
Dieser Abschnitt beschreibt, wie ein neues Release der Bibliothek erstellt und auf npm veröffentlicht wird. Die Veröffentlichung erfolgt automatisiert über GitHub Actions, sobald ein GitHub-Release veröffentlicht wird.

Empfohlener Ablauf:
1. Lokal testen und bauen
   - Sicherstellen, dass alle Änderungen committet sind und die Beispiele/Tests lokal funktionieren:
     - `npm ci`
     - `npm run serve-examples` (optional zur Sichtprüfung)
     - `npm run cypress-api` und `npm run cypress-run`
     - Safari (manuell, nicht automatisiert): `npm run serve-examples`, alle Beispielseiten öffnen; Karte, Popup per Klick und per Tastatur (Enter/Escape) und Quellenangabe prüfen
2. Version anheben
   - Version in `package.json` anheben (`npm version X.Y.Z --no-git-tag-version`)
   - Änderungen commiten
   - Tag erstellen: Schema `X.Y.Z` ohne Präfix, genau die Version aus `package.json` (der Workflow bricht sonst vor der Veröffentlichung ab).
3. Änderungen pushen
   - `git push`
   - `git push --tags`
4. GitHub-Release erstellen
   - Auf GitHub → Releases → "Draft a new release" wechseln.
   - Den zuvor erstellten Tag wählen (oder dort erstellen) und einen Titel vergeben (z. B. `vX.Y.Z`).
   - Optional: Release Notes hinzufügen (Kurzbeschreibung der Änderungen) und auf "Publish release" klicken.
5. Automatischen Publish abwarten
   - Der Workflow `.github/workflows/main.yml` startet bei veröffentlichtem Release:
     - Baut und packt das Paket einmal (`npm run pack-dist`)
     - Prüft genau dieses Paket (Verbrauchertest, API- und E2E-Tests)
     - Prüft, dass Tag und Paketversion übereinstimmen
     - Wartet auf die Freigabe in der Umgebung `npm` und veröffentlicht dieses Paket mit Provenance auf npm
     - Baut die Beispiele und veröffentlicht sie auf GitHub Pages
   - Den Status im Tab "Actions" verfolgen. Bei Erfolg ist die Version auf npm verfügbar.

Hinweise:
- Veröffentlicht wird über npm Trusted Publishing (OIDC), ohne gespeicherten Token. Voraussetzung im Repository und bei npm: Trusted Publisher für `main.yml` mit Umgebung `npm`, Umgebung `npm` mit Freigabe, Pages-Quelle „GitHub Actions“.
- Die CI läuft für Pull Requests, Pushes auf `master`, wöchentlich (montags) und bei Releases. Ein Branch ohne Pull Request wird nicht getestet. Neuere Commits im selben Pull Request brechen ältere Läufe ab. Der Audit ist ein eigener Job und blockiert nur die Veröffentlichung; die E2E-Tests gegen die Dienste von stuttgart.de laufen nur mit Node 24 und wiederholen einen fehlgeschlagenen Test einmal. Firefox: API-Tests in jedem Lauf, E2E-Tests nicht für Pull Requests (Last auf den Live-Diensten). Der Verbrauchertest prüft das TS-Beispiel auch mit TypeScript 5.7 (Untergrenze).
- Die Actions sind auf Commit-SHAs gepinnt; Dependabot (`.github/dependabot.yml`) schlägt Aktualisierungen wöchentlich als Pull Request vor.
- Jobs ohne Push-Bedarf checken ohne gespeicherte Zugangsdaten aus (`persist-credentials: false`); Schreibrechte fordert nur der jeweilige Job an.
- Sicherheitscheck optional: `npm run audit` (nur Prod-Abhängigkeiten, siehe Scripts in `package.json`).

## Review-Regeln
- Jede Änderung an `master` läuft über einen Pull Request mit grüner CI.
- Ein zweites Paar Augen ist Pflicht bei sicherheitsrelevanten Änderungen: Workflows unter `.github/`, `package.json` und `package-lock.json` (neue oder angehobene Abhängigkeiten), HTML-Ausgabe (Popups, `src/html.ts`, Quellenangaben), Konfigurations- und Netzwerkzugriffe (`src/config.ts`, `src/request-cache.ts`).
- Veröffentlicht wird erst nach Freigabe durch eine der in der Umgebung `npm` eingetragenen Personen (Required reviewers).
- Breaking Changes stehen vor dem Merge im CHANGELOG und im Migrationsleitfaden.
