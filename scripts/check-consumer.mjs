// Installiert das gepackte Paket in ein leeres Verbraucherprojekt und prüft dort das TS-Beispiel mit tsc.
// So fallen fehlende Dateien im Paket, falsche Paketpfade und fehlerhafte .d.ts auf, die im Repository verdeckt wären.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packDir = join(root, '.pack');
const tarballs = readdirSync(packDir).filter((file) => file.endsWith('.tgz'));
if (tarballs.length !== 1) {
    throw new Error(`In ${packDir} wird genau ein Paket erwartet, gefunden: ${tarballs.length}. Zuerst npm run pack-dist ausführen.`);
}

const consumer = mkdtempSync(join(tmpdir(), 'geoline-consumer-'));
const run = (command, args) => execFileSync(command, args, {cwd: consumer, stdio: 'inherit'});
try {
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({name: 'geoline-consumer', private: true, type: 'module'}));
    run('npm', ['install', '--no-audit', '--no-fund', join(packDir, tarballs[0])]);
    for (const file of ['example_UTM_25832_TS.ts', 'css.d.ts', 'tsconfig.json']) {
        copyFileSync(join(root, 'examples', file), join(consumer, file));
    }
    // tsc aus dem Repository, Typen und Pakete aus dem Verbraucherprojekt
    run(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json']);
    console.log('✓ Verbraucherprojekt kompiliert gegen ' + tarballs[0]);
} finally {
    rmSync(consumer, {recursive: true, force: true});
}
