// Styles und Bedienung: CSS nur in der Karte, Popup per Tastatur, Kontextmenü und pixelRatio einstellbar.
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import StmaOpenLayers from '../../dist/geoline.ol.js';
import {CONFIG, CONFIG_URL} from './fixtures/config.js';

describe('Styles und Bedienung', () => {
    let target;
    let geoline;

    const init = (mapParams = {}, customParams = {}) => {
        geoline = new StmaOpenLayers();
        geoline.initMap(25832, {target, ...mapParams}, {}, customParams);
        return geoline.getMap();
    };

    const popup = () => target.querySelector('.geoline-ol-js-popup');
    const isOpen = () => popup().style.display === 'block';
    const key = (element, name) => element.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true}));
    const contextMenuPrevented = () => {
        const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
        geoline.getMap().getViewport().dispatchEvent(event);
        return event.defaultPrevented;
    };

    // Ein Objekt in der Kartenmitte auf einem Layer mit Overlay
    const withOverlay = (overlayFunction) => {
        const map = init();
        const layer = new VectorLayer({source: new VectorSource({features: [new Feature(new Point(map.getView().getCenter()))]})});
        map.addLayer(layer);
        geoline.addOverlayForLayer(layer, overlayFunction);
        map.renderSync();
        return map;
    };

    beforeEach(() => {
        cy.intercept('POST', CONFIG_URL, {body: CONFIG});
        target = document.createElement('div');
        target.style.width = '400px';
        target.style.height = '300px';
        document.body.appendChild(target);
    });

    afterEach(() => {
        geoline?.dispose();
        geoline = undefined;
        target.remove();
    });

    it('wirkt mit dem mitgelieferten CSS nur innerhalb der Karte', () => {
        cy.readFile('dist/geoline.ol.css').then((css) => {
            const outside = document.createElement('div');
            outside.className = 'ol-control';
            outside.innerHTML = '<button>außen</button>';
            document.body.appendChild(outside);
            const before = {
                body: getComputedStyle(document.body).fontFamily,
                button: getComputedStyle(outside.firstChild).backgroundColor,
            };
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            init();
            try {
                expect(getComputedStyle(document.body).fontFamily, 'Schrift der Seite').to.equal(before.body);
                expect(getComputedStyle(outside.firstChild).backgroundColor, 'Button außerhalb').to.equal(before.button);
                const zoomButton = target.querySelector('.ol-zoom-in');
                expect(getComputedStyle(zoomButton).backgroundColor, 'Button in der Karte').to.equal('rgb(234, 184, 17)');
            } finally {
                style.remove();
                outside.remove();
            }
        });
    });

    describe('Popup', () => {
        it('öffnet per Enter das Objekt in der Kartenmitte und schließt per Escape', () => {
            withOverlay(() => '<b>Inhalt</b>');
            expect(target.tabIndex, 'Karte fokussierbar').to.equal(0);
            target.focus();
            key(target, 'Enter');
            expect(isOpen(), 'offen').to.equal(true);
            expect(popup().getAttribute('role')).to.equal('dialog');
            expect(popup().querySelector('.content b').textContent).to.equal('Inhalt');
            expect(document.activeElement, 'Fokus im Popup').to.equal(popup());

            key(popup(), 'Escape');
            expect(isOpen(), 'geschlossen').to.equal(false);
            expect(document.activeElement, 'Fokus zurück auf der Karte').to.equal(target);
        });

        it('schließt über die Schaltfläche', () => {
            withOverlay(() => 'Inhalt');
            key(target, 'Enter');
            popup().querySelector('button.close').click();
            expect(isOpen()).to.equal(false);
        });

        it('bleibt bei leerem Inhalt zu, ohne Fehler', () => {
            for (const result of ['', '   ', null, undefined]) {
                withOverlay(() => result);
                key(target, 'Enter');
                expect(isOpen(), JSON.stringify(result)).to.equal(false);
                geoline.dispose();
            }
        });

        it('setzt einen DOM-Knoten als Inhalt ein', () => {
            const node = document.createElement('p');
            node.textContent = 'Knoten';
            withOverlay(() => node);
            key(target, 'Enter');
            expect(popup().querySelector('.content').firstChild).to.equal(node);
        });

        it('öffnet per Enter nichts, wenn in der Mitte kein Objekt liegt', () => {
            const map = withOverlay(() => 'Inhalt');
            map.getView().setCenter([500000, 5390000]);
            map.renderSync();
            key(target, 'Enter');
            expect(isOpen()).to.equal(false);
        });

        it('behält eine vorhandene tabindex und entfernt die eigene mit dispose()', () => {
            withOverlay(() => 'Inhalt');
            geoline.dispose();
            expect(target.hasAttribute('tabindex'), 'eigene tabindex entfernt').to.equal(false);

            target.setAttribute('tabindex', '-1');
            withOverlay(() => 'Inhalt');
            geoline.dispose();
            expect(target.getAttribute('tabindex')).to.equal('-1');
        });
    });

    describe('Kontextmenü und pixelRatio', () => {
        it('unterbindet das Kontextmenü standardmäßig und lässt es mit contextMenu: true zu', () => {
            init();
            expect(contextMenuPrevented(), 'Standard').to.equal(true);
            geoline.dispose();
            init({}, {contextMenu: true});
            expect(contextMenuPrevented(), 'contextMenu: true').to.equal(false);
        });

        it('wirft bei einem ungültigen Wert für contextMenu', () => {
            let thrown = null;
            try {
                new StmaOpenLayers().initMap(25832, {target}, {}, {contextMenu: 'ja'});
            } catch (err) {
                thrown = err;
            }
            expect(thrown?.name).to.equal('TypeError');
        });

        it('nutzt pixelRatio 1 und erlaubt eine eigene Angabe', () => {
            expect(init().getPixelRatio()).to.equal(1);
            geoline.dispose();
            expect(init({pixelRatio: 2}).getPixelRatio()).to.equal(2);
        });
    });
});
