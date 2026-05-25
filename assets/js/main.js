/* ===============================================
   Windikate — Site-wide behaviors
   =============================================== */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {

        // AOS animations
        if (window.AOS) {
            AOS.init({ once: true, offset: 60, easing: 'ease-out-cubic', duration: 700 });
        }

        // Mobile menu
        const menuBtn = document.getElementById('mobileMenuBtn');
        const menu = document.getElementById('mobileMenu');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', () => {
                menu.classList.toggle('hidden');
                const open = !menu.classList.contains('hidden');
                menuBtn.innerHTML = open
                    ? '<i class="bi bi-x-lg"></i>'
                    : '<i class="bi bi-list"></i>';
                menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            });
        }

        // Sticky header behavior
        const header = document.getElementById('siteHeader');
        if (header) {
            const onScroll = () => {
                if (window.scrollY > 20) {
                    header.classList.add('bg-ink-950/80', 'backdrop-blur-lg', 'border-b', 'border-white/5', 'sticky', 'top-0');
                } else {
                    header.classList.remove('bg-ink-950/80', 'backdrop-blur-lg', 'border-b', 'border-white/5', 'sticky', 'top-0');
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }

        // Dashboard sidebar toggle (homepage)
        const dashSidebar = document.querySelectorAll('[data-dash-tab]');
        dashSidebar.forEach(btn => {
            btn.addEventListener('click', () => {
                dashSidebar.forEach(b => {
                    b.classList.remove('bg-white/5', 'text-white');
                    b.classList.add('text-white/60');
                    const i = b.querySelector('i');
                    if (i) i.classList.remove('text-brand-300');
                });
                btn.classList.add('bg-white/5', 'text-white');
                btn.classList.remove('text-white/60');
                const i = btn.querySelector('i');
                if (i) i.classList.add('text-brand-300');
            });
        });

        // FAQ accordion
        document.querySelectorAll('[data-faq]').forEach(item => {
            const trigger = item.querySelector('[data-faq-trigger]');
            const panel = item.querySelector('[data-faq-panel]');
            const icon = item.querySelector('[data-faq-icon]');
            if (!trigger || !panel) return;
            trigger.addEventListener('click', () => {
                const open = item.getAttribute('data-open') === 'true';
                item.setAttribute('data-open', open ? 'false' : 'true');
                panel.classList.toggle('hidden', open);
                if (icon) icon.classList.toggle('rotate-180', !open);
            });
        });

        // Pricing toggle (Monthly ↔ Annual)
        const billToggle = document.getElementById('billingToggle');
        if (billToggle) {
            billToggle.addEventListener('change', () => {
                const annual = billToggle.checked;
                document.querySelectorAll('[data-monthly]').forEach(el => el.classList.toggle('hidden', annual));
                document.querySelectorAll('[data-annual]').forEach(el => el.classList.toggle('hidden', !annual));
                document.querySelectorAll('[data-billing-label]').forEach(el => {
                    el.textContent = annual ? '/month, billed annually' : '/month';
                });
            });
        }

        // Form handling — demo, login, newsletter
        document.querySelectorAll('form[data-form]').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const type = form.getAttribute('data-form');
                const success = form.querySelector('[data-success]');
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin mr-2"></i>Sending...';
                }
                setTimeout(() => {
                    form.querySelectorAll('input, textarea, select, button').forEach(el => el.classList.add('opacity-50'));
                    if (success) success.classList.remove('hidden');
                    if (submitBtn) submitBtn.classList.add('hidden');
                    form.dispatchEvent(new CustomEvent('form-success', { detail: { type } }));
                }, 900);
            });
        });

        // Scroll reveal counters
        document.querySelectorAll('[data-count]').forEach(el => {
            const target = parseFloat(el.getAttribute('data-count'));
            const suffix = el.getAttribute('data-suffix') || '';
            const prefix = el.getAttribute('data-prefix') || '';
            const duration = 1200;
            let started = false;
            const io = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (e.isIntersecting && !started) {
                        started = true;
                        const start = performance.now();
                        const step = (now) => {
                            const p = Math.min(1, (now - start) / duration);
                            const eased = 1 - Math.pow(1 - p, 3);
                            const v = target * eased;
                            el.textContent = prefix + (target >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1)) + suffix;
                            if (p < 1) requestAnimationFrame(step);
                            else io.disconnect();
                        };
                        requestAnimationFrame(step);
                    }
                });
            }, { threshold: 0.4 });
            io.observe(el);
        });

        // Smooth in-page anchor scrolling
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            const id = a.getAttribute('href');
            if (id.length <= 1) return;
            a.addEventListener('click', (e) => {
                const target = document.querySelector(id);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    });
})();
