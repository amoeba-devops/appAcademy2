#!/usr/bin/env bash
# app-academy — Staging server one-time bootstrap.
# Run ONCE on the staging host (appacademy@125.133.49.165).
#
#   ssh appacademy@125.133.49.165
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/.../staging-setup.sh)"
#
# Or, if already cloned: cd ~/app-academy && scripts/staging-setup.sh
#
# This script is interactive — it will prompt for:
#   · sudo password (multiple times)
#   · GitHub deploy key registration confirmation
#   · .env.staging secret values
set -euo pipefail

REPO_URL_SSH="git@github.com:amoeba-devops/appAcademy2.git"
REPO_DIR="$HOME/app-academy"
BACKUP_TAG="pm2-backup-$(date +%Y%m%d-%H%M%S)"
DEPLOY_KEY="$HOME/.ssh/github_deploy_tpi"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31mXX %s\033[0m\n' "$*" >&2; exit 1; }

# --- 0. Preflight --------------------------------------------------------
say "Preflight checks"
[[ "$(uname -s)" == "Linux" ]] || die "Must run on the staging Linux host."
command -v curl >/dev/null || die "curl not found."
command -v git  >/dev/null || die "git not found."

# --- 1. Backup existing PM2 deployment ----------------------------------
say "1. Snapshot existing pm2 apps + stop them"
if command -v pm2 >/dev/null && pm2 pid tac-backend >/dev/null 2>&1; then
    pm2 save --force || true
    pm2 stop all || true
    pm2 delete all || true
fi

# --- 2. Stop + disable native Redis -------------------------------------
say "2. Disable native redis-server.service"
sudo systemctl stop redis-server 2>/dev/null || true
sudo systemctl disable redis-server 2>/dev/null || true

# --- 3. Install Docker --------------------------------------------------
if ! command -v docker >/dev/null; then
    say "3. Install Docker Engine + Compose plugin"
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
    warn "You were added to the 'docker' group — log out + back in before the"
    warn "deploy script can run without sudo. Subsequent 'docker' calls in"
    warn "THIS session will still need sudo."
else
    say "3. Docker already installed — skipping install."
fi

# --- 4. Rename previous rsync'd app directory ---------------------------
if [[ -d "$REPO_DIR" && ! -d "$REPO_DIR/.git" ]]; then
    say "4. Move previous non-git directory → $REPO_DIR.$BACKUP_TAG"
    mv "$REPO_DIR" "$REPO_DIR.$BACKUP_TAG"
elif [[ -d "$REPO_DIR/.git" ]]; then
    say "4. $REPO_DIR already a git repo — leaving alone."
fi

# --- 5. Deploy key --------------------------------------------------------
if [[ ! -f "$DEPLOY_KEY" ]]; then
    say "5. Generate GitHub deploy key ($DEPLOY_KEY)"
    ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -N '' -C "staging-tpi-amoeba-site"
    cat >> "$HOME/.ssh/config" <<EOF

Host github.com-deploy
  HostName github.com
  User git
  IdentityFile $DEPLOY_KEY
  IdentitiesOnly yes
EOF
fi

say "Public key (register this on GitHub → repo Settings → Deploy keys):"
echo
cat "$DEPLOY_KEY.pub"
echo
read -rp "Press ENTER after you have added this key to the GitHub repo as a deploy key with read-only access..."

ssh -o StrictHostKeyChecking=accept-new -T git@github.com-deploy 2>&1 | head -3 || true

# --- 6. Clone repo -------------------------------------------------------
if [[ ! -d "$REPO_DIR/.git" ]]; then
    say "6. Clone repo via deploy key"
    CLONE_URL="${REPO_URL_SSH/git@github.com/git@github.com-deploy}"
    git clone "$CLONE_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"

# --- 7. .env.staging -----------------------------------------------------
ENV_FILE="$REPO_DIR/docker/staging/.env.staging"
if [[ ! -f "$ENV_FILE" ]]; then
    say "7. Generate .env.staging with fresh random secrets"
    cp docker/staging/.env.staging.example "$ENV_FILE"
    sed -i "s|REPLACE_ME_JWT_SECRET|$(openssl rand -base64 48 | tr -d '/+=')|"                   "$ENV_FILE"
    sed -i "s|REPLACE_ME_NEXTAUTH_SECRET|$(openssl rand -base64 48 | tr -d '/+=')|"              "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    say "Generated $ENV_FILE (chmod 600) — review before first deploy."
else
    say "7. $ENV_FILE already exists — leaving alone."
fi

# --- 8. Data directories -------------------------------------------------
say "8. Create volume dirs"
mkdir -p "$REPO_DIR/data/postgres-acm" "$REPO_DIR/data/redis" "$REPO_DIR/data/minio"

# --- 9. Install nginx site ----------------------------------------------
say "9. Install nginx site (tpi.amoeba.site)"
sudo cp docker/staging/nginx-tpi.conf /etc/nginx/sites-available/tpi.amoeba.site
sudo rm -f /etc/nginx/sites-enabled/tdi.amoeba.site
sudo ln -sf /etc/nginx/sites-available/tpi.amoeba.site /etc/nginx/sites-enabled/tpi.amoeba.site
sudo nginx -t
sudo systemctl reload nginx

say "Bootstrap complete."
cat <<EOF

Next step:
  cd $REPO_DIR
  scripts/deploy-staging.sh

After the first deploy, verify:
  curl -sI http://tpi.amoeba.site/

Previous pm2 deployment snapshot: $REPO_DIR.$BACKUP_TAG
EOF
