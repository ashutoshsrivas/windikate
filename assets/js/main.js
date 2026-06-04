/* ============================================================
   Windikate · Studio — site-wide behaviour
   ============================================================ */
(function () {
    'use strict';

    /* ------------------------------------------------------------
     * Preloader — runs as early as possible (NOT waiting on DOMReady)
     * so we can mark resources the moment they finish loading.
     * Reveals the page when fonts + visible images are in.
     * ------------------------------------------------------------ */
    bootPreloader();

    function bootPreloader() {
        const start = performance.now();
        const FIRST_VISIT = !sessionStorage.getItem('wdk.seen');
        const MIN_SHOW = FIRST_VISIT ? 700 : 280;
        const MAX_SHOW = 5000;

        let bar, captionPct;
        let pct = 6;

        const setPct = p => {
            pct = Math.min(100, Math.max(pct, p));
            if (bar)        bar.style.width = pct + '%';
            if (captionPct) captionPct.textContent = pct >= 100 ? 'ready' : `loading · ${Math.round(pct)}%`;
        };

        // Slow heartbeat so the bar always feels alive even on a cached load
        const heartbeat = setInterval(() => setPct(pct + (pct < 70 ? 3 : 1)), 90);

        function attachToDom() {
            bar        = document.querySelector('#preloader .preloader__bar');
            captionPct = document.querySelector('[data-loader-pct]');
            setPct(pct);

            // Image progress
            const imgs = Array.from(document.images);
            const total = imgs.length + 2; // +fonts +DOMContentLoaded
            let done = 0;
            const bump = () => { done++; setPct(15 + (done / total) * 75); };

            if (document.readyState !== 'loading') bump();
            else document.addEventListener('DOMContentLoaded', bump, { once: true });

            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(bump).catch(bump);
            } else { bump(); }

            imgs.forEach(img => {
                if (img.complete) bump();
                else {
                    img.addEventListener('load',  bump, { once: true });
                    img.addEventListener('error', bump, { once: true });
                }
            });
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachToDom, { once: true });
        else attachToDom();

        function finish() {
            clearInterval(heartbeat);
            setPct(100);
            const elapsed = performance.now() - start;
            const wait = Math.max(0, MIN_SHOW - elapsed);
            setTimeout(() => {
                const overlay = document.getElementById('preloader');
                document.documentElement.classList.add('is-loaded');
                if (overlay) overlay.classList.add('is-done');
                sessionStorage.setItem('wdk.seen', '1');
                // Remove DOM node after fade completes (so it doesn't trap focus)
                if (overlay) setTimeout(() => overlay.remove(), 900);
            }, wait);
        }

        if (document.readyState === 'complete') finish();
        else window.addEventListener('load', finish, { once: true });
        setTimeout(finish, MAX_SHOW); // hard ceiling
    }

    /* ------------------------------------------------------------ */

    document.addEventListener('DOMContentLoaded', () => {

        if (window.AOS) AOS.init({ once: true, offset: 80, duration: 800, easing: 'ease-out-cubic', disable: 'mobile' });

        /* ------------------------------------------------------------
           Custom cursor — dot + ring, blend-difference for visibility,
           skipped on touch / coarse-pointer devices entirely.
           ------------------------------------------------------------ */
        const isFinePointer = matchMedia('(pointer: fine)').matches
                           && !matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (isFinePointer) {
            const dot  = document.querySelector('.cursor-dot');
            const ring = document.querySelector('.cursor-ring');
            if (dot && ring) {
                document.documentElement.classList.add('has-cursor');
                let mx = innerWidth / 2, my = innerHeight / 2;
                let rx = mx, ry = my;
                window.addEventListener('mousemove', e => {
                    mx = e.clientX; my = e.clientY;
                    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
                }, { passive: true });
                (function loop() {
                    rx += (mx - rx) * 0.18;
                    ry += (my - ry) * 0.18;
                    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
                    requestAnimationFrame(loop);
                })();
                const hoverSel = 'a, button, [data-cursor-hover], input, textarea, select, label';
                document.querySelectorAll(hoverSel).forEach(el => {
                    el.addEventListener('mouseenter', () => ring.classList.add('is-hover'));
                    el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
                });
                window.addEventListener('mousedown', () => ring.classList.add('is-active'));
                window.addEventListener('mouseup',   () => ring.classList.remove('is-active'));
                document.addEventListener('mouseleave', () => { dot.style.opacity = ring.style.opacity = '0'; });
                document.addEventListener('mouseenter', () => { dot.style.opacity = ring.style.opacity = '1'; });
            }
        }

        /* ------------------------------------------------------------
           Scroll progress — gradient bar fills as user scrolls.
           ------------------------------------------------------------ */
        const progressBar = document.querySelector('.scroll-progress__bar');
        if (progressBar) {
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                    const h = document.documentElement.scrollHeight - innerHeight;
                    progressBar.style.width = h > 0 ? (scrollY / h * 100) + '%' : '0%';
                    ticking = false;
                });
            }, { passive: true });
        }

        /* ------------------------------------------------------------
           Kinetic typography — wrap each whitespace-separated word in
           a masked span so it can rise from below on reveal. Run only
           on .kinetic containers so we don't shred random headings.
           ------------------------------------------------------------ */
        document.querySelectorAll('.kinetic h1, .kinetic h2').forEach(el => {
            if (el.dataset.split) return;
            el.dataset.split = '1';
            const walk = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    const tokens = node.textContent.split(/(\s+)/);
                    tokens.forEach(t => {
                        if (!t) return;
                        if (/^\s+$/.test(t)) frag.appendChild(document.createTextNode(t));
                        else {
                            const word = document.createElement('span');
                            word.className = 'word';
                            const inner = document.createElement('span');
                            inner.textContent = t;
                            word.appendChild(inner);
                            frag.appendChild(word);
                        }
                    });
                    node.parentNode.replaceChild(frag, node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'BR') return;

                    /* The .cycler element is a self-contained mini-component
                       (slot-machine word cycler). Wrap it in a .word so it
                       rides the reveal animation as ONE unit, but keep its
                       internal structure intact. */
                    if (node.classList && node.classList.contains('cycler')) {
                        const word = document.createElement('span');
                        word.className = 'word';
                        const inner = document.createElement('span');
                        inner.appendChild(node.cloneNode(true));
                        word.appendChild(inner);
                        node.parentNode.replaceChild(word, node);
                        return;
                    }

                    if (node.tagName === 'EM' || node.tagName === 'SPAN' || node.tagName === 'I') {
                        /* Treat the inline element itself as a single "word" so
                           its styling (italic, brand colour) stays intact during
                           the reveal animation. Preserve nested children (eg. a
                           decorative .scribble inside the italic word). */
                        const word = document.createElement('span');
                        word.className = 'word';
                        const useEm = node.tagName === 'EM' || node.tagName === 'I';
                        const inner = document.createElement(useEm ? 'em' : 'span');
                        if (node.className) inner.className = node.className;
                        if (!useEm && /italic|brand-italic|ital/.test(node.className || '')) {
                            inner.style.fontStyle = 'italic';
                        }
                        Array.from(node.childNodes).forEach(child => inner.appendChild(child.cloneNode(true)));
                        word.appendChild(inner);
                        node.parentNode.replaceChild(word, node);
                    } else {
                        Array.from(node.childNodes).forEach(walk);
                    }
                }
            };
            Array.from(el.childNodes).forEach(walk);
            // Assign --i for stagger delay
            el.querySelectorAll('.word').forEach((w, i) => w.style.setProperty('--i', i));
        });

        /* ------------------------------------------------------------
           Hero word-cycler · slot-machine cross-fade
           "software → films → tools → systems → loop"
           ------------------------------------------------------------ */
        document.querySelectorAll('.cycler').forEach(cycler => {
            const items = cycler.querySelectorAll(':scope > span');
            if (items.length < 2) return;
            items[0].classList.add('is-current');
            let idx = 0;
            const HOLD = 2400;
            setInterval(() => {
                const leaving = items[idx];
                idx = (idx + 1) % items.length;
                const entering = items[idx];
                leaving.classList.remove('is-current');
                leaving.classList.add('is-leaving');
                entering.classList.add('is-current');
                setTimeout(() => leaving.classList.remove('is-leaving'), 700);
            }, HOLD);
        });

        /* ------------------------------------------------------------
           Magnetic buttons — gently pull toward cursor on hover.
           ------------------------------------------------------------ */
        if (isFinePointer) {
            document.querySelectorAll('[data-magnet]').forEach(btn => {
                const STRENGTH = 0.22;
                btn.addEventListener('mousemove', e => {
                    const r = btn.getBoundingClientRect();
                    const dx = (e.clientX - (r.left + r.width / 2)) * STRENGTH;
                    const dy = (e.clientY - (r.top  + r.height / 2)) * STRENGTH;
                    btn.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
                    const inner = btn.querySelector('.magnet-inner');
                    if (inner) inner.style.transform = `translate3d(${dx * 0.3}px, ${dy * 0.3}px, 0)`;
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = '';
                    const inner = btn.querySelector('.magnet-inner');
                    if (inner) inner.style.transform = '';
                });
            });
        }

        /* ------------------------------------------------------------
           Reveal-up + mask-reveal on scroll.
           Replaces AOS for new .reveal-up / .reveal-mask elements.
           ------------------------------------------------------------ */
        const revealEls = document.querySelectorAll('.reveal-up, .reveal-mask');
        if (revealEls.length) {
            const io = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
            revealEls.forEach(el => io.observe(el));
        }


        // Fade in any image with data-fade or inside .work-card__media
        document.querySelectorAll('img[data-fade], .work-card__media img').forEach(img => {
            if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');
            else {
                img.addEventListener('load',  () => img.classList.add('is-loaded'), { once: true });
                img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
            }
        });

        // Mobile menu
        const btn = document.getElementById('mobileMenuBtn');
        const menu = document.getElementById('mobileMenu');
        if (btn && menu) {
            btn.addEventListener('click', () => {
                menu.classList.toggle('hidden');
                const open = !menu.classList.contains('hidden');
                btn.innerHTML = open ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';
                btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            });
        }

        // Sticky header — pin on scroll
        const header = document.getElementById('siteHeader');
        if (header) {
            const onScroll = () => header.classList.toggle('is-pinned', window.scrollY > 12);
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }

        // FAQ accordion
        document.querySelectorAll('[data-faq]').forEach(item => {
            const trigger = item.querySelector('[data-faq-trigger]');
            const panel   = item.querySelector('[data-faq-panel]');
            const icon    = item.querySelector('[data-faq-icon]');
            if (!trigger || !panel) return;
            trigger.addEventListener('click', () => {
                const open = item.getAttribute('data-open') === 'true';
                item.setAttribute('data-open', open ? 'false' : 'true');
                panel.classList.toggle('hidden', open);
                if (icon) icon.classList.toggle('rotate-45', !open);
            });
        });

        // Work filter (work.html)
        const filterBtns = document.querySelectorAll('[data-filter]');
        const items      = document.querySelectorAll('[data-cat]');
        if (filterBtns.length && items.length) {
            filterBtns.forEach(b => b.addEventListener('click', () => {
                filterBtns.forEach(x => x.classList.remove('is-active', 'bg-ink-900', 'text-paper-100'));
                filterBtns.forEach(x => x.classList.add('bg-paper-200', 'text-ink-700'));
                b.classList.add('is-active', 'bg-ink-900', 'text-paper-100');
                b.classList.remove('bg-paper-200', 'text-ink-700');
                const f = b.getAttribute('data-filter');
                items.forEach(it => it.classList.toggle('hidden', f !== 'all' && it.getAttribute('data-cat') !== f));
            }));
        }

        // Animated counters
        document.querySelectorAll('[data-count]').forEach(el => {
            const target = parseFloat(el.getAttribute('data-count'));
            const suffix = el.getAttribute('data-suffix') || '';
            const prefix = el.getAttribute('data-prefix') || '';
            let started = false;
            const io = new IntersectionObserver(entries => entries.forEach(e => {
                if (!e.isIntersecting || started) return;
                started = true;
                const start = performance.now();
                const step = now => {
                    const p = Math.min(1, (now - start) / 1200);
                    const eased = 1 - Math.pow(1 - p, 3);
                    const v = target * eased;
                    el.textContent = prefix + (target >= 100 ? Math.round(v).toLocaleString() : v.toFixed(0)) + suffix;
                    if (p < 1) requestAnimationFrame(step);
                    else io.disconnect();
                };
                requestAnimationFrame(step);
            }), { threshold: 0.4 });
            io.observe(el);
        });

        // Forms — handle submit gracefully without a backend
        document.querySelectorAll('form[data-form]').forEach(form => {
            form.addEventListener('submit', e => {
                e.preventDefault();
                const ok = form.querySelector('[data-success]');
                const submit = form.querySelector('button[type="submit"]');
                if (submit) { submit.disabled = true; submit.innerHTML = '<i class="bi bi-arrow-repeat animate-spin mr-2"></i>Sending'; }
                setTimeout(() => {
                    form.querySelectorAll('input, textarea, select, button').forEach(el => el.classList.add('opacity-50'));
                    if (ok) ok.classList.remove('hidden');
                    if (submit) submit.classList.add('hidden');
                }, 900);
            });
        });

        // Smooth anchor jumps
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            const href = a.getAttribute('href');
            if (href.length <= 1) return;
            a.addEventListener('click', e => {
                const t = document.querySelector(href);
                if (!t) return;
                e.preventDefault();
                t.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    });
})();
