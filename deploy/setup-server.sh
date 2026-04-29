#!/usr/bin/env bash
set -euo pipefail

APP_NAME="ate-trials-app"
DOMAIN="ate-trials.apps.umernaeem.com"
REPO_URL="https://github.com/umruhaya/ate-trials-app.git"
APP_DIR="/var/www/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"
BUN_BIN="/root/.bun/bin/bun"
PM2_BIN="/root/.bun/bin/pm2"

if [[ "${EUID}" -ne 0 ]]; then
	echo "Run this script as root."
	exit 1
fi

export PATH="/root/.bun/bin:${PATH}"

apt-get update
apt-get install -y curl git nodejs unzip nginx certbot python3-certbot-nginx

if [[ ! -x "${BUN_BIN}" ]]; then
	curl -fsSL https://bun.sh/install | bash
fi

"${BUN_BIN}" install -g pm2

if [[ ! -d "${APP_DIR}/.git" ]]; then
	mkdir -p "$(dirname "${APP_DIR}")"
	git clone "${REPO_URL}" "${APP_DIR}"
else
	git -C "${APP_DIR}" pull --ff-only
fi

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
	cp .env.example .env
fi

mkdir -p data
"${BUN_BIN}" install --frozen-lockfile
"${BUN_BIN}" run build

cp deploy/nginx/"${DOMAIN}.conf" "${NGINX_CONF}"
ln -sfn "${NGINX_CONF}" "${NGINX_ENABLED}"
nginx -t
systemctl enable --now nginx
systemctl reload nginx

APP_DIR="${APP_DIR}" BUN_BIN="${BUN_BIN}" "${PM2_BIN}" startOrReload ecosystem.config.cjs --env production
"${PM2_BIN}" save
env PATH="/root/.bun/bin:${PATH}" "${PM2_BIN}" startup systemd -u root --hp /root

certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect --register-unsafely-without-email
systemctl reload nginx

echo "Deployment complete: https://${DOMAIN}"
