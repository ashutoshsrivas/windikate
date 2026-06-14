// =====================================================================
// Windikate · PM2 process manifest
// =====================================================================
// Both Node services run under PM2 so they restart on crash and survive
// reboots (combined with `pm2 startup systemd`).
//
//   windikate-api    Express API · :4000
//   windikate-web    Next.js     · :3000
//
// pm2 startOrReload deploy/pm2-ecosystem.config.js --update-env
// =====================================================================

module.exports = {
    apps: [
        {
            name: 'windikate-api',
            cwd: '/var/www/windikate/analysis-app/backend',
            script: 'server.js',
            interpreter: 'node',
            env: { NODE_ENV: 'production' },
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '300M',
            error_file: '/home/ubuntu/.pm2/logs/api-error.log',
            out_file:   '/home/ubuntu/.pm2/logs/api-out.log',
            time: true
        },
        {
            name: 'windikate-web',
            cwd: '/var/www/windikate/analysis-app/frontend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start -p 3000',
            interpreter: 'node',
            env: { NODE_ENV: 'production', PORT: '3000' },
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '400M',
            error_file: '/home/ubuntu/.pm2/logs/web-error.log',
            out_file:   '/home/ubuntu/.pm2/logs/web-out.log',
            time: true
        }
    ]
};
