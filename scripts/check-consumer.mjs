// Installiert das gepackte Paket in leere Verbraucherprojekte, wie es eine Anwendung täte:
// 1. Das TS-Beispiel wird mit moduleResolution bundler und nodenext geprüft (ohne skipLibCheck).
// 2. Die Projekte aus consumers/ werden gebaut; die Ergebnisse landen in .consumers/ für den Browsertest.
// So fallen fehlende Dateien im Paket, falsche Paketpfade, fehlerhafte .d.ts und doppelte OpenLayers-Kopien auf,
// die im Repository verdeckt wären.
import {execFileSync} from 'node:child_process';
import {copyFileSync, cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packDir = join(root, '.pack');
const tarballs = readdirSync(packDir).filter((file) => file.endsWith('.tgz'));
if (tarballs.length !== 1) {
    throw new Error(`In ${packDir} wird genau ein Paket erwartet, gefunden: ${tarballs.length}. Zuerst npm run pack-dist ausführen.`);
}
const tarball = join(packDir, tarballs[0]);
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const output = join(root, '.consumers');

function inTempDir(name, work) {
    const dir = mkdtempSync(join(tmpdir(), 'geoline-' + name + '-'));
    const run = (command, args) => execFileSync(command, args, {cwd: dir, stdio: 'inherit'});
    try {
        work(dir, run);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
}

function install(run) {
    run('npm', ['install', '--no-audit', '--no-fund', tarball]);
}

inTempDir('ts-example', (dir, run) => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({name: 'geoline-consumer-ts', private: true, type: 'module'}));
    install(run);
    for (const file of ['example_UTM_25832_TS.ts', 'css.d.ts', 'tsconfig.json']) {
        copyFileSync(join(root, 'examples', file), join(dir, file));
    }
    // tsc aus dem Repository, Typen und Pakete aus dem Verbraucherprojekt
    run(process.execPath, [tsc, '-p', 'tsconfig.json']);
    run(process.execPath, [tsc, '-p', 'tsconfig.json', '--module', 'nodenext', '--moduleResolution', 'nodenext']);
    console.log('✓ TS-Beispiel kompiliert mit moduleResolution bundler und nodenext');
});

rmSync(output, {recursive: true, force: true});
for (const name of readdirSync(join(root, 'consumers'), {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name)) {
    inTempDir(name, (dir, run) => {
        cpSync(join(root, 'consumers', name), dir, {recursive: true});
        run('npm', ['install', '--no-audit', '--no-fund']);
        install(run);
        run('npm', ['run', 'build']);
        rmSync(join(dir, 'node_modules'), {recursive: true, force: true});
        cpSync(dir, join(output, name), {recursive: true});
        console.log('✓ Verbraucherprojekt ' + name + ' gebaut');
    });
}
