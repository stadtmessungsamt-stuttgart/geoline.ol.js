import {fail, ok, type Result} from './result.js';

/**
 * Abrufe von Dienst-Metadaten (ArcGIS-Dienstinfo, WMTS-Capabilities) einer Karte. Gleiche URLs teilen sich einen
 * Request; Fehlschläge verlassen den Cache, damit der nächste Aufruf neu anfragt.
 *
 * Bewusst ohne Größen- und Zeitlimit: Die Schlüssel sind die Dienste, die die Anwendung selbst einbindet, ihre Zahl
 * ist durch den Anwendungscode begrenzt. Der Cache gehört zu einer Karte und endet mit `dispose()`.
 *
 * Schlüssel ist die URL allein, weil alle Abrufe GET ohne weitere Optionen sind. Kommen Optionen hinzu, gehören sie
 * in den Schlüssel.
 */
export class RequestCache {
    private readonly entries = new Map<string, Promise<Result<string>>>();

    /**
     * @param signal Abbruchsignal der Karte; abgebrochene Abrufe liefern `ABORTED`
     */
    constructor(private readonly signal: AbortSignal) {}

    /**
     * Ruft eine URL per GET ab und liefert den Antworttext. Ohne Cookies und HTTP-Authentifizierung fremder Origins.
     *
     * @param url Absolute URL des Abrufs
     * @returns Antworttext oder `SERVICE_UNAVAILABLE` bzw. `ABORTED`, mit dem ursprünglichen Fehler in `cause`
     */
    fetchText(url: string): Promise<Result<string>> {
        const cached = this.entries.get(url);
        if (cached !== undefined) {
            return cached;
        }
        const failure = (err: unknown): Result<string> => this.signal.aborted
            ? fail('ABORTED', 'Der Abruf von ' + url + ' wurde durch dispose() abgebrochen.', err)
            : fail('SERVICE_UNAVAILABLE', url + ' ist nicht erreichbar.', err);

        const request = fetch(url, {signal: this.signal}).then(
            (response) => response.ok
                ? response.text().then((text) => ok(text), failure)
                : fail<string>('SERVICE_UNAVAILABLE', url + ' antwortet mit HTTP ' + response.status + '.'),
            failure
        ).then((result) => {
            if (!result.ok && this.entries.get(url) === request) {
                this.entries.delete(url);
            }
            return result;
        });
        this.entries.set(url, request);
        return request;
    }
}
