const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const {version} = require('./package.json');

// Die Typdeklarationen erzeugt tsc im Script build-dist nach diesem Build (output.clean würde sie sonst löschen).
module.exports = {
    mode: 'production',
    performance: {
        maxEntrypointSize: 512000, // 500 KiB statt 244 KiB
        maxAssetSize: 512000,      // 500 KiB statt 244 KiB
    },
    entry: {
        // CSS als eigener Eintrag statt Import im Einstieg: TypeScript übernähme den Import sonst in die .d.ts (TS2882 bei Verbrauchern).
        // Reihenfolge ist Pflicht: Die Bibliothek exportiert, was das letzte Modul des Arrays exportiert.
        'geoline.ol': [path.resolve(__dirname, 'src/geoline.ol.css'), path.resolve(__dirname, 'src/geoline.ol.js')],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: {},
        module: true,
        library: {
            type: 'module'
        }
    },
    // OpenLayers ist Peer-Dependency: Geoline und Anwendung nutzen dieselbe Installation, im Bundle steckt keine Kopie
    externals: [/^ol(\/.*)?$/],
    externalsType: 'module',
    resolve: {
        extensions: ['.ts', '.js', '.css'],
        // TS-Module werden mit Endung .js importiert, damit die erzeugten .d.ts auch unter moduleResolution nodenext auflösbar sind
        extensionAlias: {'.js': ['.ts', '.js']},
    },
    module: {
        rules: [
            {
                test: /\.ts$/i,
                // Nur Transpilieren; Typprüfung und .d.ts übernimmt tsc
                loader: 'esbuild-loader',
                options: {loader: 'ts', target: 'es2020'},
            },
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            import: true,     // @import verarbeiten
                            url: false,       // URLs nicht verarbeiten
                            sourceMap: true,  // Source Maps für CSS
                        }
                    }
                ],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),

        // Version beim Kompilieren einsetzen, damit Bundle und Source Map übereinstimmen
        new webpack.DefinePlugin({GEOLINE_VERSION: JSON.stringify(version)}),
    ],
    optimization: {
        minimizer: [
            `...`, // Behält die Standard JS-Minifier (Terser)
            new CssMinimizerPlugin({
                minimizerOptions: {
                    preset: [
                        'default',
                        {
                            discardComments: {removeAll: true}, // Alle Kommentare entfernen
                            normalizeWhitespace: true,            // Whitespace normalisieren
                            mergeLonghand: true,                  // Longhand-Properties zusammenführen
                            mergeRules: true,                     // Ähnliche Regeln zusammenführen
                        },
                    ],
                },
            }),
        ],
    },
    devtool: 'source-map',
    experiments: {
        outputModule: true,
    },
};
