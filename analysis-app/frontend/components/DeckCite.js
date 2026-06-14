'use client';

import { deckUrl, citeLabel, parseSlideNumber } from '../lib/deckCite';

/* A small pill that cites the deck and opens it at the right page.
 *
 *   <DeckCite deckPath={deckPath} slideRef={"Slide 7"} />
 *
 * If no slideRef is supplied the pill says "Source PDF". If no deck is
 * attached to the analysis at all we render nothing — never a dead link.
 */
export default function DeckCite({ deckPath, slideRef, compact = false, className = '' }) {
    if (!deckPath) return null;
    const url   = deckUrl(deckPath, slideRef);
    const label = citeLabel(slideRef);
    const n     = parseSlideNumber(slideRef);

    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title={n ? `Open the deck at slide ${n} in a new tab` : 'Open the original deck'}
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-md border border-edge bg-surface
                        hover:bg-brand-500/10 hover:border-brand-500/40 hover:text-brand-500 text-ink2-muted
                        ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'} ${className}`}
        >
            <i className="bi bi-file-earmark-pdf text-[10px]" />
            <span>{label}</span>
            <i className="bi bi-arrow-up-right-square text-[9px] opacity-70" />
        </a>
    );
}
