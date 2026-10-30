#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ $EUID -eq 0 && $# -eq 1 ]] || { echo 'Usage: sudo bash deploy/install.sh /path/to/deploy.pub' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
public_key=$(cat -- "$1")
[[ $public_key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || { echo 'Expected one Ed25519 public key.' >&2; exit 1; }
[[ $public_key != *$'\n'* ]] || exit 1
for command in docker curl flock useradd install visudo ssh-keygen; do command -v "$command" >/dev/null; done
bash -n "$source_dir/deploy.sh"
docker inspect pennywise-401k-app-1 >/dev/null
curl --fail --silent --max-time 5 http://127.0.0.1:3001/ >/dev/null

# Only this new account receives access to the fixed, root-owned deployment script.
if ! id pennywise-deploy >/dev/null 2>&1; then
  useradd --create-home --home-dir /var/lib/pennywise-401k-ssh --shell /bin/sh pennywise-deploy
fi
[[ $(getent passwd pennywise-deploy | cut -d: -f6) == /var/lib/pennywise-401k-ssh ]] || exit 1
[[ $(id -nG pennywise-deploy) == pennywise-deploy ]] || { echo 'Deploy account has unexpected groups.' >&2; exit 1; }
install -d -o root -g root -m 755 /etc/pennywise-401k /var/lib/pennywise-401k-ssh /var/lib/pennywise-401k-ssh/.ssh
install -d -o root -g root -m 700 /var/lib/pennywise-401k
install -o root -g root -m 755 "$source_dir/deploy.sh" /usr/local/sbin/deploy-pennywise-401k
install -o root -g root -m 644 "$source_dir/compose.production.yaml" /etc/pennywise-401k/compose.production.yaml
PENNYWISE_IMAGE=example.invalid/test:validation docker compose --file /etc/pennywise-401k/compose.production.yaml config --quiet

sudoers_tmp=$(mktemp)
trap 'rm -f "$sudoers_tmp"' EXIT
printf 'pennywise-deploy ALL=(root) NOPASSWD: /usr/local/sbin/deploy-pennywise-401k ""\n' > "$sudoers_tmp"
visudo --check --file "$sudoers_tmp"
install -o root -g root -m 440 "$sudoers_tmp" /etc/sudoers.d/pennywise-401k-deploy
printf 'restrict,command="sudo -n /usr/local/sbin/deploy-pennywise-401k" %s\n' "$public_key" > /var/lib/pennywise-401k-ssh/.ssh/authorized_keys
chown root:root /var/lib/pennywise-401k-ssh/.ssh/authorized_keys
chmod 644 /var/lib/pennywise-401k-ssh/.ssh/authorized_keys
chown root:root /var/lib/pennywise-401k-ssh
chmod 755 /var/lib/pennywise-401k-ssh
printf 'Restricted deployment account installed. Finance containers and Caddy were not changed.\n'
