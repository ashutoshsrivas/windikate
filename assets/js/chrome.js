/* ============================================================
   Windikate · Studio
   Shared chrome (nav + footer + background helpers)
   Emitted via document.write to keep every page DRY.
   ============================================================ */

const NAV_LINKS = [
    { key: 'work',     label: 'Work',     href: 'work.html' },
    { key: 'products', label: 'Products', href: 'products.html' },
    { key: 'studio',   label: 'Studio',   href: 'about.html' },
    { key: 'journal',  label: 'Journal',  href: 'resources.html' }
];

function backgroundLayers() {
    /* Light theme has no orbs — the paper texture lives on body::before. */
    return '';
}

/* Full-page preloader. Hidden once fonts + images have loaded
   (managed in main.js). Emitted first so it covers the page from
   the very first paint. */
function preloaderHtml() {
    return `
    <div id="preloader" class="preloader" aria-hidden="true">
        <div class="preloader__inner">
            <div class="preloader__logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l3 11 3-7 2 7 3-11"/></svg>
            </div>
            <div class="preloader__progress" aria-hidden="true"><div class="preloader__bar"></div></div>
            <div class="preloader__caption"><strong>windikate</strong> / studio · <span data-loader-pct>loading</span></div>
        </div>
    </div>
    <div class="site-content">`;
}

function siteContentClose() {
    return `</div>`;
}

function navHtml(activeKey) {
    const desktop = NAV_LINKS.map(item => {
        const active = item.key === activeKey;
        return `<li><a href="${item.href}" class="swipe-link ${active ? 'text-ink-900' : 'text-ink-700 hover:text-ink-900'} text-[15px]"><span class="swipe-target">${item.label}</span></a></li>`;
    }).join('');

    const mobile = NAV_LINKS.map(item => {
        const active = item.key === activeKey;
        return `<a href="${item.href}" class="block px-3 py-3 rounded-xl ${active ? 'bg-paper-200 text-ink-900' : 'text-ink-700 hover:bg-paper-200'} font-display text-2xl">${item.label}</a>`;
    }).join('');

    return `
    ${preloaderHtml()}
    <header id="siteHeader" class="site-header sticky top-0 z-50">
        <nav class="max-w-[1480px] mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-2.5 group" aria-label="Windikate Studio home">
                <span class="w-10 h-10 rounded-full bg-ink-900 flex items-center justify-center transition-transform group-hover:rotate-[18deg]">
                    <svg viewBox="0 0 24 24" class="w-5 h-5 text-paper-100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 7l3 11 3-7 2 7 3-11"/>
                    </svg>
                </span>
                <span class="font-display text-[22px] tracking-tight">windikate<span class="text-brand-500">.</span></span>
            </a>
            <ul class="hidden lg:flex items-center gap-8">${desktop}</ul>
            <div class="flex items-center gap-3">
                <a href="contact.html" class="hidden sm:inline-flex btn-ink !py-2.5 !px-5 text-[14px]">Let’s talk<i class="bi bi-arrow-up-right"></i></a>
                <button id="mobileMenuBtn" class="lg:hidden text-2xl text-ink-700 hover:text-ink-900" aria-label="Open menu"><i class="bi bi-list"></i></button>
            </div>
        </nav>
        <div id="mobileMenu" class="hidden lg:hidden px-6 pb-5">
            <div class="bg-paper-100 hairline border rounded-3xl p-3 space-y-1 shadow-paper">
                ${mobile}
                <a href="contact.html" class="block px-3 py-3 rounded-xl bg-ink-900 text-paper-100 font-display text-2xl">Let’s talk →</a>
            </div>
        </div>
    </header>`;
}

function footerHtml() {
    return `
    ${siteContentClose()}
    <footer class="mt-section">
        <div class="ink-section rounded-t-[40px]">
            <div class="max-w-[1480px] mx-auto px-6 lg:px-10 pt-20 pb-12">
                <div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 items-end">
                    <div>
                        <div class="eyebrow mb-5">— Have an idea?</div>
                        <h2 class="font-display text-[clamp(40px,6vw,96px)] leading-[0.98] tracking-tight">Let’s build the<br/><em class="text-brand-300">next good thing.</em></h2>
                    </div>
                    <div class="space-y-4">
                        <p class="text-paper-200/80 text-lg leading-relaxed max-w-md">Pitch a project, ask a question, or send a cold hello. We read everything that hits the inbox.</p>
                        <a href="contact.html" class="inline-flex items-center gap-2 bg-paper-100 text-ink-900 rounded-full px-6 py-3.5 font-medium hover:bg-white transition-colors">hello@windikate.studio<i class="bi bi-arrow-up-right"></i></a>
                    </div>
                </div>

                <div class="mt-20 pt-10 border-t hairline grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
                    <div>
                        <div class="eyebrow mb-4">Studio</div>
                        <ul class="space-y-2 text-paper-200/80">
                            <li><a href="work.html"     class="hover:text-white">Work</a></li>
                            <li><a href="products.html" class="hover:text-white">Products</a></li>
                            <li><a href="about.html"    class="hover:text-white">About</a></li>
                            <li><a href="contact.html"  class="hover:text-white">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <div class="eyebrow mb-4">Products</div>
                        <ul class="space-y-2 text-paper-200/80">
                            <li><a href="products.html#windikate" class="hover:text-white">Windikate AI</a></li>
                            <li><a href="apercept.html"           class="hover:text-white">Apercept AI</a></li>
                            <li><a href="products.html#winschool" class="hover:text-white">Win School</a></li>
                        </ul>
                    </div>
                    <div>
                        <div class="eyebrow mb-4">Social</div>
                        <ul class="space-y-2 text-paper-200/80">
                            <li><a href="#" class="hover:text-white">Instagram</a></li>
                            <li><a href="#" class="hover:text-white">LinkedIn</a></li>
                            <li><a href="#" class="hover:text-white">Dribbble</a></li>
                            <li><a href="#" class="hover:text-white">GitHub</a></li>
                        </ul>
                    </div>
                    <div>
                        <div class="eyebrow mb-4">Legal</div>
                        <ul class="space-y-2 text-paper-200/80">
                            <li><a href="privacy.html"  class="hover:text-white">Privacy</a></li>
                            <li><a href="terms.html"    class="hover:text-white">Terms</a></li>
                            <li><a href="security.html" class="hover:text-white">Security</a></li>
                        </ul>
                    </div>
                </div>

                <div class="mt-14 pt-6 border-t hairline flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-paper-200/55 font-mono">
                    <div>© 2026 Windikate Studio — Dehradun · Bengaluru</div>
                    <div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Open for new projects</div>
                </div>
            </div>
        </div>
    </footer>`;
}
