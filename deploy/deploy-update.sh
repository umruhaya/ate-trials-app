#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ate-trials-app}"
BUN_BIN="${BUN_BIN:-/root/.bun/bin/bun}"
PM2_BIN="${PM2_BIN:-/root/.bun/bin/pm2}"

if [[ "${EUID}" -ne 0 ]]; then
	echo "Run this script as root."
	exit 1
fi

export PATH="/root/.bun/bin:${PATH}"

cd "${APP_DIR}"
git pull --ff-only
"${BUN_BIN}" install --frozen-lockfile
"${BUN_BIN}" run build
APP_DIR="${APP_DIR}" BUN_BIN="${BUN_BIN}" "${PM2_BIN}" startOrReload ecosystem.config.cjs --env production
"${PM2_BIN}" save
