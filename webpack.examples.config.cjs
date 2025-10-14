const path = require('path');
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Alle JS/TS-Dateien im Ordner examples als eigene Bundles bauen
const examplesDir = path.resolve(__dirname, 'examples');
const entries = {};
for (const file of fs.readdirSync(examplesDir)) {
    if (/^example.*\.(js|ts)$/i.test(file)) {
        const name = path.parse(file).name;
        entries[name] = path.join(examplesDir, file);
    }
}

// Package.json laden, um die Version zu erhalten
const packageJson = require('./package.json');

module.exports = {
    mode: 'production',
    // Mehrere Einträge: jedes Beispiel erhält ein eigenes Bundle, das den gleichen Namen wie die Quelldatei trägt.
    entry: entries,
    output: {
        path: path.resolve(__dirname, 'demo'),
        filename: '[name].js',
        clean: true,
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'demo'),
            watch: true,
        },
        client: {
            overlay: true,
        },
        port: 8080,
        open: true,
        hot: false,
    },
    resolve: {
        extensions: ['.js', '.ts'],
        alias: {
            // optional: Alias auf lokale SRC, damit die Beispiele wie in dev funktionieren
            '@src': path.resolve(__dirname, 'src'),
        },
    },
    module: {
        rules: [
            // CSS-Dateien aus src und node_modules zulassen (z. B. ol/ol.css)
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            // TypeScript-Beispiele unterstützen, ohne separates tsconfig zu benötigen
            {
                test: /\.ts$/i,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                            compilerOptions: {module: 'ESNext', moduleResolution: 'Bundler'}
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        // Kopiert statische Demo-Dateien aus examples nach demo.
        // - HTML-Dateien der Beispiele
        // - Testdaten
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'examples'),
                    to: path.resolve(__dirname, 'demo'),
                    globOptions: {
                        ignore: [
                            '**/*.js', // JS wird über webpack gebündelt
                            '**/*.ts',
                        ],
                    },
                    transform(content, path) {
                        // Nur für index.html die Version ersetzen
                        if (path.endsWith('index.html')) {
                            return content.toString().replace('@version@', packageJson.version);
                        }
                        return content;
                    },
                },
                // Optional: ol.css direkt zugänglich machen
                {
                    from: path.resolve(__dirname, 'node_modules/ol/ol.css'),
                    to: path.resolve(__dirname, 'demo/ol.css'),
                },
            ],
        }),
    ],

    performance: {
        maxEntrypointSize: 1048576,
        maxAssetSize: 1048576,
    },
    devtool: 'source-map',
};
