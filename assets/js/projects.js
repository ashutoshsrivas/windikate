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
    },

    /* ----- Content & film work shipped through Twizzle Media House
       (which is itself a Windikate project — see twizzle-media-house above) */
    {
        slug: 'cribapp', title: 'CribApp',
        category: 'Brand Film · App', cat: 'media',
        year: '2024', services: ['Brand Film', 'Product Shoot'],
        summary: 'Brand films and product cinematography for a next-gen housing app.',
        url: 'https://cribapp.com/',
        accent: '#dbeafe'
    },
    {
        slug: 'lemon-lessons', title: 'Lemon Lessons with Anusha',
        category: 'Podcast · Content', cat: 'media',
        year: '2024', services: ['Podcast', 'Production', 'Edit'],
        summary: 'Episode-driven podcast and short-form content for an education creator’s flagship series.',
        url: 'https://twizzlemediahouse.com/podcast.html',
        accent: '#fef3c7'
    },
    {
        slug: 'lysto-gg', title: 'Lysto GG',
        category: 'Gaming · Content', cat: 'media',
        year: '2024', services: ['Brand Film', 'Esports Coverage'],
        summary: 'Esports and gaming content for an India-first competitive gaming platform.',
        url: 'https://lysto.gg/',
        accent: '#ddd6fe'
    },
    {
        slug: 'wealthup', title: 'Wealthup',
        category: 'Fintech · Film', cat: 'media',
        year: '2024', services: ['Brand Film', 'Explainer'],
        summary: 'Brand films and animated explainers for a personal-finance learning platform.',
        url: 'https://wealthup.in/',
        accent: '#d1fae5'
    },
    {
        slug: 'mocha-lights', title: 'Mocha Lights',
        category: 'Product · Lifestyle', cat: 'media',
        year: '2024', services: ['Product Shoot', 'Lifestyle Film'],
        summary: 'Product films and lifestyle visuals for a premium lighting brand.',
        url: 'https://mochalights.com/',
        accent: '#fde68a'
    },
    {
        slug: 'acquis-compliance', title: 'Acquis Compliance',
        category: 'B2B · Corporate Film', cat: 'media',
        year: '2024', services: ['Corporate Film', 'Event Coverage'],
        summary: 'Corporate films and event coverage for a B2B compliance leader.',
        url: 'https://acquiscompliance.com/',
        accent: '#e5e7eb'
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

/* Generates a thum.io URL for any project. Smaller width keeps each
   render fast; thum.io caches for 7 days via maxAge. */
function projectScreenshot(url, w = 900, h = 560) {
    const clean = url.replace(/^https?:\/\//, '');
    return `https://image.thum.io/get/width/${w}/crop/${h}/noanimate/maxAge/168/https://${clean}`;
}

/* Build a single editorial project row.
 * Used on the homepage (Selected Work strip) and on /work.html.
 * Designed to read beautifully with no images — screenshot is a
 * delightful hover detail, not a load-bearing element. */
function projectRowHtml(p, index = 1) {
    const screenshotUrl = p.external ? null : projectScreenshot(p.url, 480, 304);
    const image = screenshotUrl
        ? `<img src="${screenshotUrl}" alt="${p.title}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fade onerror="this.remove()" />`
        : '';

    return `
    <a href="${p.url}" target="_blank" rel="noreferrer" data-cat="${p.cat}" class="proj-row" style="--accent: ${p.accent}">
        <span class="proj-row__num">${String(index).padStart(2, '0')}</span>
        <div class="proj-row__title">
            <h3>${p.title}</h3>
            <p>${p.summary}</p>
        </div>
        <div class="proj-row__meta">
            <span class="cat-chip" data-cat="${p.cat}">${CAT_LABEL[p.cat]}</span>
            <span class="proj-row__year">${p.year}</span>
        </div>
        <div class="proj-row__preview" aria-hidden="true">
            <div class="proj-row__preview-inner">${p.title}${image}</div>
        </div>
        <span class="proj-row__arrow"><i class="bi bi-arrow-right"></i></span>
    </a>`;
}

/* Legacy alias — anywhere we still call workCardHtml(), give them rows.
   Lets us roll out incrementally without breaking other pages. */
function workCardHtml(p, _featured, index = null) {
    return projectRowHtml(p, index || 1);
}
