/* ===============================================
   Windikate — Shared chrome (nav, footer, background)
   Injected via document.write so there is no FOUC.
   =============================================== */

const NAV_LINKS = [
    { key: 'product', label: 'Product', href: 'product.html' },
    { key: 'apercept', label: 'Apercept AI', href: 'apercept.html' },
    { key: 'customers', label: 'Customers', href: 'customers.html' },
    { key: 'pricing', label: 'Pricing', href: 'pricing.html' },
    { key: 'resources', label: 'Resources', href: 'resources.html', dropdown: true }
];

const RESOURCE_LINKS = [
    { label: 'Blog', href: 'resources.html#blog' },
    { label: 'Case Studies', href: 'customers.html#cases' },
    { label: 'Documentation', href: 'resources.html#docs' },
    { label: 'Help Center', href: 'resources.html#help' }
];

function backgroundLayers() {
    return `
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div class="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-700/20 blur-[120px]"></div>
        <div class="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full bg-brand-600/15 blur-[140px]"></div>
        <div class="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-900/20 blur-[100px]"></div>
    </div>
    <div class="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] bg-grid"></div>`;
}

function navHtml(activeKey) {
    const desktop = NAV_LINKS.map(item => {
        const active = item.key === activeKey;
        const cls = active ? 'text-white' : 'text-white/80 hover:text-white';
        if (item.dropdown) {
            return `
            <li class="relative group">
                <button class="flex items-center gap-1 ${cls} transition-colors">
                    ${item.label}
                    <i class="bi bi-chevron-down text-xs mt-0.5"></i>
                </button>
                <div class="absolute top-full left-0 mt-3 w-56 bg-ink-800 border border-white/10 rounded-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    ${RESOURCE_LINKS.map(r => `<a href="${r.href}" class="block px-3 py-2 text-sm rounded-lg hover:bg-white/5">${r.label}</a>`).join('')}
                </div>
            </li>`;
        }
        return `<li><a href="${item.href}" class="${cls} transition-colors">${item.label}</a></li>`;
    }).join('');

    const mobile = NAV_LINKS.map(item => {
        const active = item.key === activeKey;
        return `<a href="${item.href}" class="block px-3 py-2.5 rounded-lg ${active ? 'bg-white/5 text-white' : 'text-white/85 hover:bg-white/5'}">${item.label}</a>`;
    }).join('');

    return `
    <header id="siteHeader" class="relative z-50">
        <nav class="max-w-[1400px] mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-2.5 group" aria-label="Windikate home">
                <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
                    <svg viewBox="0 0 24 24" class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 7l3 11 3-7 2 7 3-11"/>
                    </svg>
                </span>
                <span class="text-xl font-semibold tracking-tight">windikate</span>
            </a>
            <ul class="hidden lg:flex items-center gap-9 text-[15px]">${desktop}</ul>
            <div class="flex items-center gap-2 lg:gap-5">
                <a href="login.html" class="hidden sm:inline-block text-[15px] text-white/80 hover:text-white px-3 py-2">Log in</a>
                <a href="demo.html" class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-[15px] font-medium px-5 py-2.5 rounded-xl shadow-glow transition-all hover:shadow-[0_0_40px_-5px_rgba(139,92,246,0.7)]">Book a Demo</a>
                <button id="mobileMenuBtn" class="lg:hidden text-2xl text-white/80 hover:text-white ml-2" aria-label="Open menu"><i class="bi bi-list"></i></button>
            </div>
        </nav>
        <div id="mobileMenu" class="hidden lg:hidden px-6 pb-4">
            <div class="bg-ink-800 border border-white/10 rounded-2xl p-4 space-y-1">
                ${mobile}
                <a href="login.html" class="block px-3 py-2.5 rounded-lg text-white/85 hover:bg-white/5">Log in</a>
            </div>
        </div>
    </header>`;
}

function footerHtml() {
    return `
    <footer class="border-t border-white/5 mt-16">
        <div class="max-w-[1400px] mx-auto px-6 lg:px-10 py-14">
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
                <div class="col-span-2 lg:col-span-2">
                    <a href="index.html" class="flex items-center gap-2.5 mb-4">
                        <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l3 11 3-7 2 7 3-11"/></svg>
                        </span>
                        <span class="text-lg font-semibold">windikate</span>
                    </a>
                    <p class="text-sm text-white/55 max-w-xs leading-relaxed">AI copilot for VC deal diligence. From pitch deck to partner-ready memo in minutes.</p>
                    <div class="flex items-center gap-3 mt-5">
                        <a href="#" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white" aria-label="X / Twitter"><i class="bi bi-twitter-x"></i></a>
                        <a href="#" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white" aria-label="LinkedIn"><i class="bi bi-linkedin"></i></a>
                        <a href="#" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white" aria-label="GitHub"><i class="bi bi-github"></i></a>
                    </div>
                </div>
                <div>
                    <div class="text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Product</div>
                    <ul class="space-y-2.5 text-sm text-white/65">
                        <li><a href="product.html" class="hover:text-white">Overview</a></li>
                        <li><a href="apercept.html" class="hover:text-white">Apercept AI</a></li>
                        <li><a href="pricing.html" class="hover:text-white">Pricing</a></li>
                        <li><a href="demo.html" class="hover:text-white">Book a Demo</a></li>
                    </ul>
                </div>
                <div>
                    <div class="text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Company</div>
                    <ul class="space-y-2.5 text-sm text-white/65">
                        <li><a href="customers.html" class="hover:text-white">Customers</a></li>
                        <li><a href="resources.html" class="hover:text-white">Resources</a></li>
                        <li><a href="resources.html#blog" class="hover:text-white">Blog</a></li>
                        <li><a href="mailto:hello@windikate.ai" class="hover:text-white">Contact</a></li>
                    </ul>
                </div>
                <div>
                    <div class="text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Legal</div>
                    <ul class="space-y-2.5 text-sm text-white/65">
                        <li><a href="privacy.html" class="hover:text-white">Privacy</a></li>
                        <li><a href="terms.html" class="hover:text-white">Terms</a></li>
                        <li><a href="security.html" class="hover:text-white">Security</a></li>
                        <li><a href="login.html" class="hover:text-white">Log in</a></li>
                    </ul>
                </div>
            </div>
            <div class="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/45">
                <div>© 2026 Windikate. All rights reserved.</div>
                <div class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    All systems operational
                </div>
            </div>
        </div>
    </footer>`;
}
