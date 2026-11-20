export default {
    mode: 'production',
    entry: './src/main.js',
    output: {filename: 'main.js', clean: true},
    module: {
        rules: [{test: /\.css$/i, use: ['style-loader', 'css-loader']}],
    },
    performance: {hints: false},
};
