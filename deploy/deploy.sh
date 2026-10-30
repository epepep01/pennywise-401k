#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL=C
umask 077

[[ $EUID -eq 0 ]] || { echo 'Run through the restricted sudo command.' >&2; exit 1; }
readonly repository=ghcr.io/epepep01/pennywise-401k
readonly state=/var/lib/pennywise-401k
readonly compose=/etc/pennywise-401k/compose.production.yaml
mkdir -p "$state"
exec 9>/run/lock/pennywise-401k-deploy.lock
flock -w 120 9 || { echo 'Another deployment holds the lock.' >&2; exit 1; }

previous=''
auth_dir=''
changed=0
run_image() {
  PENNYWISE_IMAGE="$1" docker compose --project-name pennywise-401k \
    --file "$compose" up --detach --no-build --pull never --no-deps app
}
healthy() {
  local attempt
  for attempt in {1..20}; do
    if curl --fail --silent --show-error --max-time 3 \
      http://127.0.0.1:3001/ >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}
finish() {
  local status=$?
  trap - EXIT
  if [[ $status -ne 0 && $changed -eq 1 && -n $previous ]]; then
    echo 'Deployment failed; restoring the previous local image.' >&2
    if run_image "$previous" && healthy; then
      echo 'Rollback healthy.' >&2
    else
      echo 'Rollback needs administrator attention.' >&2
    fi
  fi
  [[ -z $auth_dir ]] || rm -rf -- "$auth_dir"
  exit "$status"
}
trap finish EXIT

if [[ $# -eq 1 && $1 == --rollback ]]; then
  [[ -f $state/previous-image ]] || { echo 'No previous image recorded.' >&2; exit 1; }
  IFS= read -r image < "$state/previous-image"
  [[ $image =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
  docker image inspect "$image" >/dev/null
  revision=rollback
elif [[ $# -eq 0 ]]; then
  # The forced SSH command reads structured input, never a shell command.
  IFS= read -r revision
  IFS= read -r digest
  IFS= read -r registry_token
  [[ $revision =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit.' >&2; exit 1; }
  [[ $digest =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid image digest.' >&2; exit 1; }
  [[ -n $registry_token && ${#registry_token} -le 4096 ]] || exit 1
  image="$repository@$digest"
  auth_dir=$(mktemp -d /run/pennywise-401k-auth.XXXXXX)
  export DOCKER_CONFIG="$auth_dir"
  printf '%s' "$registry_token" | docker login ghcr.io --username epepep01 --password-stdin >/dev/null 2>&1
  unset registry_token
  docker pull "$image"
  actual_revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")
  [[ $actual_revision == "$revision" ]] || { echo 'Image revision mismatch.' >&2; exit 1; }
else
  echo 'Unsupported arguments.' >&2
  exit 1
fi

# Require the existing planner. Never touch the finance project or its database.
previous=$(docker inspect --format '{{.Image}}' pennywise-401k-app-1)
[[ $previous =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Planner image not found.' >&2; exit 1; }
new_id=$(docker image inspect --format '{{.Id}}' "$image")
[[ $new_id =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
changed=1
run_image "$image"
[[ $(docker inspect --format '{{.Image}}' pennywise-401k-app-1) == "$new_id" ]] || exit 1
healthy || { echo 'Planner health check failed.' >&2; exit 1; }
if [[ $previous != "$new_id" ]]; then
  printf '%s\n' "$previous" > "$state/previous-image.tmp"
  mv "$state/previous-image.tmp" "$state/previous-image"
fi
printf '%s\n%s\n' "$revision" "$new_id" > "$state/current.tmp"
mv "$state/current.tmp" "$state/current"
changed=0
printf 'Deployment healthy: %s\n' "$revision"
