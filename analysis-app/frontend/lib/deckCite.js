/* =====================================================================
 *  Deck citation helpers.
 *
 *  The pipeline stores a "source_slide" string on every metric / deviation
 *  / competitor — things like "Slide 7", "p.12", "Page 3", or just "7".
 *  We use that to:
 *    · render a small "Slide N" pill,
 *    · link to the original PDF at the cited page via /files/<deck>#page=N
 *      (Chrome, Edge, Firefox, Safari all honour #page= on their native
 *      PDF viewer — no extra library required).
 *
 *  When no slide reference is available we fall back to a plain "deck"
 *  link so the reader can still verify the claim in the source document.
 * =================================================================== */

/** Pull an integer page number out of any source_slide string. */
export function parseSlideNumber(s) {
    if (s == null) return null;
    const m = String(s).match(/(\d+)/);
    return m ? Number(m[1]) : null;
}

/** Build the URL the citation pill opens. */
export function deckUrl(deckPath, slideRef) {
    if (!deckPath) return null;
    // deckPath comes in as `uploads/xxxxx.pdf` from the controller.
    const base = '/files/' + String(deckPath).replace(/^uploads[\\/]/, '');
    const n = parseSlideNumber(slideRef);
    return n ? `${base}#page=${n}` : base;
}

/** Pretty label — "Slide 7" / "Source PDF" / "Deck" */
export function citeLabel(slideRef) {
    if (!slideRef) return 'Source PDF';
    const n = parseSlideNumber(slideRef);
    return n ? `Slide ${n}` : String(slideRef);
}
