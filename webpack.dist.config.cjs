const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const {execSync} = require('child_process');

module.exports = {
    mode: 'production',
    performance: {
        maxEntrypointSize: 512000, // 500 KiB statt 244 KiB
        maxAssetSize: 512000,      // 500 KiB statt 244 KiB
    },
    entry: {
        'geoline.ol': path.resolve(__dirname, 'src/geoline.ol.js'),
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
    resolve: {
        extensions: ['.js', '.css'],
    },
    module: {
        rules: [
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

        // Nach Build die Version im erzeugten JS ersetzen
        {
            apply: (compiler) => {
                compiler.hooks.done.tap('PostBuildTasks', () => {
                    // 1) Version in dist JS ersetzen
                    execSync("npx cross-var replace '@version@' '$npm_package_version' 'dist/geoline.ol.js'", {
                        stdio: 'inherit',
                        shell: true
                    });

                    // 2) TypeScript-Declaration Files generieren
                    execSync('npx tsc -p tsconfig.json', {stdio: 'inherit', shell: true});

                    // 3) Version auch in d.ts aktualisieren (falls Datei existiert)
                    execSync("npx cross-var replace '@version@' '$npm_package_version' 'dist/geoline.ol.d.ts'", {
                        stdio: 'inherit',
                        shell: true
                    });
                });
            }
        },
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
