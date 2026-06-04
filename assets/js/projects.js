/* Windikate · Studio — Project portfolio
   Source of truth for /work.html and the "selected work" strip
   on the homepage. Edit here and both pages update.

   Screenshots use thum.io (free, no auth). The fallback gradient
   is rendered via CSS until the image loads. */

const PROJECTS = [
    {
        slug: 'covahive', title: 'Covahive',
        category: 'Brand & Web', cat: 'brand',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'Identity, story and marketing site for a co-living studio building considered shared homes.',
        url: 'https://www.covahive.com/in/',
        accent: '#fef3c7'
    },
    {
        slug: 'style-statement', title: 'Style Statement',
        category: 'E-commerce', cat: 'brand',
        year: '2024', services: ['Brand', 'Web', 'Shopify'],
        summary: 'Direct-to-consumer fashion label — storefront, lookbooks, and a brand language that travels.',
        url: 'https://stylestatement.in/',
        accent: '#fce7f3'
    },
    {
        slug: 'pinnacle-square', title: 'Pinnacle Square',
        category: 'Real Estate · Platform', cat: 'realestate',
        year: '2024', services: ['Web', 'SaaS', 'Admin portal'],
        summary: 'Public marketing site plus a lead-and-inventory CRM behind it for a residential developer.',
        url: 'https://pinnaclesquare.in/',
        backend: 'https://manage.pinnaclesquare.in/',
        accent: '#ffe4e6'
    },
    {
        slug: 'herbocleanz', title: 'Herbocleanz',
        category: 'Brand · Wellness', cat: 'brand',
        year: '2023', services: ['Brand', 'Web'],
        summary: 'Modern packaging-led identity for a herbal wellness range. Calm, clinical, confidently green.',
        url: 'https://herbocleanz.com/',
        accent: '#d1fae5'
    },
    {
        slug: 'gaspbt', title: 'GasPBT',
        category: 'B2B · Industrial', cat: 'brand',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'Marketing site for a specialised industrial gas distributor — engineered to read trustworthy at a glance.',
        url: 'https://gaspbt.com/',
        accent: '#e0f2fe'
    },
    {
        slug: 'twizzle-media-house', title: 'Twizzle Media House',
        category: 'Creative · Media', cat: 'media',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'A media house presenting reels, films and brand stories — site built around the work, not the chrome.',
        url: 'https://twizzlemediahouse.com/',
        accent: '#fce7f3'
    },
    {
        slug: 'geu-iosdc', title: 'Graphic Era · IOSDC',
        category: 'EdTech · Platform', cat: 'edtech',
        year: '2024', services: ['Web', 'SaaS', 'Internal portal'],
        summary: 'Institute portal for student placements + RPMS admin for the placement office.',
        url: 'https://iosdc.geu.ac.in/',
        backend: 'https://rpms.geu.ac.in/',
        accent: '#ede9fe'
    },
    {
        slug: 'geu-doms', title: 'Graphic Era · DoMS',
        category: 'EdTech · Department', cat: 'edtech',
        year: '2024', services: ['Web', 'CMS'],
        summary: 'Department of Management Studies marketing site and admissions portal.',
        url: 'https://doms.geu.ac.in/',
        backend: 'https://doms.geu.ac.in/auth/login',
        accent: '#ede9fe'
    },
    {
        slug: 'ashutosh-srivastava', title: 'Ashutosh Srivastava',
        category: 'Personal Portfolio', cat: 'portfolio',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'A portfolio that reads like a magazine — quiet typography, loud projects.',
        url: 'https://ashutoshsrivastava.in/',
        accent: '#e0f2fe'
    },
    {
        slug: 'win-school', title: 'Win School LMS',
        category: 'Product · EdTech', cat: 'edtech',
        year: '2024', services: ['Product', 'Web', 'Engineering'],
        summary: 'A full learning management system for schools — student, faculty and parent flows under one roof.',
        url: 'https://windikate.com/winschool/',
        accent: '#d1fae5'
    },
    {
        slug: 'aman-dobriyal', title: 'Aman Dobriyal',
        category: 'Personal Portfolio', cat: 'portfolio',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'Developer portfolio with a case-study mindset — every project is its own story page.',
        url: 'https://amandobriyal.com/',
        accent: '#e0f2fe'
    },
    {
        slug: 'geu-exam-slot', title: 'Graphic Era · Exam Slot',
        category: 'EdTech · Internal tool', cat: 'edtech',
        year: '2023', services: ['Engineering', 'Internal tool'],
        summary: 'Exam scheduling and slot allocation tool used across departments.',
        url: 'https://exam-slot.geu.ac.in/login.php',
        accent: '#ede9fe'
    },
    {
        slug: 'property-films', title: 'Property Films',
        category: 'Film · Real Estate', cat: 'media',
        year: '2024', services: ['Direction', 'Production', 'Edit'],
        summary: 'Architecture and property films shot, scored and cut in-house.',
        url: 'https://drive.google.com/drive/folders/137QdpIlvy8zHPihPKvPjCtHVD97RhJKi?usp=share_link',
        external: true,
        accent: '#fce7f3'
    },
    {
        slug: 'kasa-heavens', title: 'Kasa Heavens',
        category: 'Real Estate', cat: 'realestate',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'Marketing site for a boutique real-estate brand — premium, restrained, image-led.',
        url: 'https://www.kasaheavens.com/',
        backend: 'https://amandobriyal.com/projects/kasaheavens',
        accent: '#ffe4e6'
    },
    {
        slug: 'the-scribes', title: 'The Scribes',
        category: 'Content · Brand', cat: 'brand',
        year: '2024', services: ['Brand', 'Web'],
        summary: 'A content studio site with an editorial soul — clear voice, generous whitespace.',
        url: 'https://www.thescribes.in/',
        backend: 'https://amandobriyal.com/projects/thescribes',
        accent: '#fef3c7'
    },
    {
        slug: 'service-desk', title: 'Service Desk',
        category: 'SaaS · Internal IT', cat: 'saas',
        year: '2023', services: ['Product', 'Engineering'],
        summary: 'Ticketing and IT service desk tool — clean queue UX, fast to triage, friendly to non-IT users.',
        url: 'https://amandobriyal.com/projects/servicedesk',
        accent: '#ede9fe'
    },
    {
        slug: 'hsconnect', title: 'HsConnect',
        category: 'Community · Web', cat: 'saas',
        year: '2024', services: ['Product', 'Web'],
        summary: 'A connection platform built for a focused community — directories, profiles and messaging.',
        url: 'https://hsconnect.in/',
        backend: 'https://amandobriyal.com/projects/hsconnect',
        accent: '#ede9fe'
    }
];

const CAT_LABEL = {
    brand:      'Brand & Web',
    saas:       'SaaS',
    edtech:     'EdTech',
    realestate: 'Real Estate',
    media:      'Media & Film',
    portfolio:  'Portfolio'
};

/* Generates a thum.io URL for any project. Adds a no-animate flag + a
   cached-for-7-days flag for snappy second loads. */
function projectScreenshot(url, w = 1200, h = 750) {
    const clean = url.replace(/^https?:\/\//, '');
    return `https://image.thum.io/get/width/${w}/crop/${h}/noanimate/maxAge/168/https://${clean}`;
}

/* Build a single work-card HTML block. featured=true uses a tall layout. */
function workCardHtml(p, featured = false) {
    const screenshotUrl = p.external ? null : projectScreenshot(p.url);
    const aspect = featured ? 'aspect-[16/11]' : 'aspect-[16/10]';
    const mediaInner = screenshotUrl
        ? `<img src="${screenshotUrl}" alt="${p.title} screenshot" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
        : `<div class="flex items-center justify-center w-full h-full"><i class="bi bi-film text-5xl text-ink-300"></i></div>`;

    const backendChip = p.backend
        ? `<a href="${p.backend}" target="_blank" rel="noreferrer" class="cat-chip hover:bg-ink-900 hover:text-paper-100 transition-colors" onclick="event.stopPropagation()"><i class="bi bi-database"></i>Backend</a>`
        : '';

    return `
    <a href="${p.url}" target="_blank" rel="noreferrer" data-cat="${p.cat}" class="work-card block group">
        <div class="work-card__media ${aspect}" style="background-color: ${p.accent}">
            ${mediaInner}
            <div class="work-card__overlay">
                <div class="text-xs font-mono uppercase tracking-wider opacity-80">${p.services.join(' · ')}</div>
                <div class="mt-2 text-base font-medium flex items-center gap-2">Visit site<i class="bi bi-arrow-up-right"></i></div>
            </div>
        </div>
        <div class="p-6 flex items-start justify-between gap-4">
            <div class="min-w-0">
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="cat-chip" data-cat="${p.cat}">${CAT_LABEL[p.cat]}</span>
                    <span class="text-xs font-mono text-ink-500">${p.year}</span>
                </div>
                <h3 class="font-display text-2xl tracking-tight leading-tight">${p.title}</h3>
                <p class="mt-1.5 text-sm text-ink-500 leading-relaxed">${p.summary}</p>
            </div>
            <div class="shrink-0 flex flex-col items-end gap-2">
                <span class="w-9 h-9 rounded-full border hairline-strong border flex items-center justify-center group-hover:bg-ink-900 group-hover:text-paper-100 group-hover:border-ink-900 transition-colors">
                    <i class="bi bi-arrow-up-right"></i>
                </span>
                ${backendChip}
            </div>
        </div>
    </a>`;
}
