/*
 *  PROXY-SERVER für CORS-Anfragen
 *
 *  Verwendung:
 *    1) node cors-proxy.cjs
 *    2) URLs prefixen: 'http://localhost:1235/https://geoservice.stuttgart.de';
 *
 */

const corsAnywhere = require('cors-anywhere');

const host = '0.0.0.0'; // wegen Docker
const port = 1235;

corsAnywhere.createServer({
    originWhitelist: [], // Erlaubt alle Ursprünge während der Entwicklung
    requireHeader: [
//        'origin',
//        'x-requested-with'
    ],
    removeHeaders: [
        'cookie',
        'cookie2',
        // Strip Heroku-specific headers
        'x-request-start',
        'x-request-id',
        'via',
        'connect-time',
        'total-route-time',
        // Other Heroku added debug headers
        // 'x-forwarded-for',
        // 'x-forwarded-proto',
        // 'x-forwarded-port',
    ],
    redirectSameOrigin: true,
    httpProxyOptions: {
        // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
        xfwd: false,
    },
}).listen(port, host, function() {
    console.log('CORS Anywhere läuft auf ' + host + ':' + port);
});
