// Stellt sicher, dass im Bibliotheksartefakt kein OpenLayers-JavaScript steckt (ol ist Peer-Dependency).
// Grundlage ist die Source Map: Jedes eingebundene Modul erscheint dort als Quelle.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const map = JSON.parse(readFileSync(resolve(import.meta.dirname, '../dist/geoline.ol.js.map'), 'utf8'));
const bundled = map.sources.filter((source) => /\/node_modules\/ol\//.test(source));
if (bundled.length > 0) {
    console.error('OpenLayers-Module im Bundle:\n  ' + bundled.join('\n  '));
    process.exit(1);
}
const bundle = readFileSync(resolve(import.meta.dirname, '../dist/geoline.ol.js'), 'utf8');
if (!/from\s*"ol\//.test(bundle)) {
    console.error('Das Bundle importiert OpenLayers nicht als externes Modul.');
    process.exit(1);
}
console.log('✓ Kein OpenLayers-JavaScript im Bundle (' + map.sources.length + ' Quellen geprüft)');
