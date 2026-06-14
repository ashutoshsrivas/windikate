# Windikate · server deploy

Apache 2.4 reverse-proxy + Node 20 (PM2) + MariaDB + phpMyAdmin
on a single Ubuntu 22/24/26 EC2 box. Auto-deploys on every push to
`main` via GitHub Actions.

## Live URLs

| What | URL |
|---|---|
| Analysis app | `http://<ec2-host>/` |
| phpMyAdmin | `http://<ec2-host>/phpmyadmin` |
| API | `http://<ec2-host>/api/health` |

## Files in this folder

| File | Role |
|---|---|
| `provision.sh` | One-time server bootstrap. Installs everything, configures the DB, generates secrets, opens the firewall, starts services. Idempotent. |
| `deploy.sh` | Per-push deploy. Smart skip — only does what changed (npm install / next build / pm2 reload / apachectl reload). |
| `apache-windikate.conf` | Apache vhost. Reverse-proxies `/` → Next.js, `/api` + `/files` → Express, lets phpMyAdmin pass through. |
| `pm2-ecosystem.config.js` | PM2 process file for `windikate-api` + `windikate-web`. |
| `../.github/workflows/deploy.yml` | GitHub Actions — SSH to box, run `deploy.sh main`. |

## First-time bootstrap (manual, ~10 minutes)

1. **SSH into the box** with the PEM (which lives in
   `analysis-app/Windikate.pem` locally — gitignored):

   ```bash
   ssh -i analysis-app/Windikate.pem ubuntu@ec2-35-154-88-44.ap-south-1.compute.amazonaws.com
   ```

2. **Clone the repo + run provision**:

   ```bash
   sudo apt-get update && sudo apt-get install -y git
   git clone https://github.com/ashutoshsrivas/windikate.git /var/www/windikate
   bash /var/www/windikate/deploy/provision.sh
   ```

   The script will:
   - Add a 2 GB swap file
   - Install Node 20, Apache, PHP, MariaDB, phpMyAdmin, pm2
   - Generate random DB/JWT/phpMyAdmin passwords (saved to
     `/home/ubuntu/.windikate-secrets`, mode 600)
   - Apply the schema
   - Build the Next.js frontend
   - Start both services under pm2 and persist them across reboots
   - Configure UFW (SSH + HTTP only)

3. **Open port 80 in the AWS Security Group**.
   In the AWS Console → EC2 → Security Groups → the one attached to
   this instance → Inbound rules → Add `HTTP (80)` from `0.0.0.0/0`.
   The provision script can't do this — it requires AWS credentials.

4. **Wire up GitHub Actions for auto-deploy.**
   In <https://github.com/ashutoshsrivas/windikate/settings/secrets/actions>
   add:

   | Secret | Value |
   |---|---|
   | `EC2_HOST` | `ec2-35-154-88-44.ap-south-1.compute.amazonaws.com` |
   | `EC2_USER` | `ubuntu` |
   | `EC2_KEY` | paste the full contents of `Windikate.pem` (including the BEGIN/END lines) |

   Push anything to `main` and the workflow runs `deploy.sh` on the box.

## Reading the secrets later

```bash
ssh ubuntu@ec2 'cat ~/.windikate-secrets'
```

## Inspecting / debugging

```bash
pm2 list                   # both services running?
pm2 logs windikate-api     # tail Express logs
pm2 logs windikate-web     # tail Next.js logs
sudo tail -f /var/log/apache2/windikate-error.log

# DB shell as the app user
mariadb -u windikate -p windikate_analysis

# Manual deploy (skip Actions)
ssh ubuntu@ec2 'bash /var/www/windikate/deploy/deploy.sh main'
```

## What `provision.sh` does NOT do

Things you'll need eventually but aren't worth automating until you
actually need them:

- TLS / `https`. When you point a real domain at the EC2:
  `sudo apt install certbot python3-certbot-apache && sudo certbot --apache -d windikate.com`
- Backups. Run `mysqldump windikate_analysis` to S3 on cron.
- Log rotation for pm2 logs:
  `pm2 install pm2-logrotate`
