const ESCAPES: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};

/**
 * Macht einen Text sicher für Stellen, an denen OpenLayers HTML erwartet (z. B. Attributionen).
 *
 * @param text reiner Text
 * @returns Text mit maskierten HTML-Sonderzeichen
 */
export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}
