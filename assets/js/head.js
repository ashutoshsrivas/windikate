/* Shared <head> resources — emitted via document.write so every page is DRY. */
function pageHead(title, description) {
    return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-10 -8 110 80'%3E%3Crect x='-10' y='-8' width='110' height='80' rx='12' fill='%230c0a09'/%3E%3Cg fill='%23faf8f2'%3E%3Cpath d='M0 0 L12 0 L12 50 Q12 52 14 52 L26 52 Q28 52 28 50 L28 0 L40 0 L40 50 Q40 64 26 64 L14 64 Q0 64 0 50 Z'/%3E%3Cpath d='M50 0 L62 0 L62 50 Q62 52 64 52 L76 52 Q78 52 78 50 L78 0 L90 0 L90 50 Q90 64 76 64 L64 64 Q50 64 50 50 Z'/%3E%3C/g%3E%3C/svg%3E" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght,SOFT,WONK@9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />
    <link href="https://unpkg.com/aos@2.3.4/dist/aos.css" rel="stylesheet" />
    <script src="assets/js/tailwind.config.js"><\/script>
    <link rel="stylesheet" href="assets/css/style.css" />`;
}

function pageScripts() {
    return `
    <script src="https://unpkg.com/aos@2.3.4/dist/aos.js"><\/script>
    <script src="assets/js/main.js"><\/script>`;
}
