// Schreibt dist/THIRD_PARTY_LICENSES.txt für alle Pakete, die laut Source-Map in dist/geoline.ol.js eingebettet sind
// (derzeit proj4 und dessen Abhängigkeiten). Bricht ab, wenn ein eingebettetes Paket keine Lizenzdatei hat.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const map = JSON.parse(readFileSync(join(root, 'dist', 'geoline.ol.js.map'), 'utf8'));
const packages = [...new Set(map.sources
    .map((source) => /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(source)?.[1])
    .filter(Boolean))].sort();

const sections = packages.map((name) => {
    const dir = join(root, 'node_modules', name);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const file = readdirSync(dir).find((entry) => /^licen[cs]e(\.|$)/i.test(entry));
    if (file === undefined) {
        throw new Error(`Eingebettetes Paket ${name} hat keine Lizenzdatei.`);
    }
    return `${name}@${pkg.version} (${pkg.license})\n\n${readFileSync(join(dir, file), 'utf8').trim()}\n`;
});

writeFileSync(join(root, 'dist', 'THIRD_PARTY_LICENSES.txt'),
    'In dist/geoline.ol.js eingebettete Pakete und ihre Lizenzen.\n\n' + sections.join('\n' + '-'.repeat(72) + '\n\n'));
console.log('Drittlizenzen: ' + packages.join(', '));
