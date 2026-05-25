/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        const api = process.env.API_BASE_URL || 'http://localhost:4000';
        return [
            { source: '/api/:path*', destination: `${api}/api/:path*` },
            { source: '/files/:path*', destination: `${api}/files/:path*` }
        ];
    }
};
module.exports = nextConfig;
