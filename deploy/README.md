# Automatic deployment

GitHub Actions tests the code, builds a Linux AMD64 image, and publishes it to `ghcr.io/epepep01/pennywise-401k`, tagged with the commit SHA. The production job deploys the immutable registry digest, not a mutable `latest` tag. The Droplet downloads the image rather than building it.

## One-time setup

The server administrator runs `sudo bash deploy/install.sh /path/to/deploy.pub` using the reviewed files in this directory and the dedicated Ed25519 public key. The installer creates only the `pennywise-deploy` account, its forced-command key, a narrowly scoped sudo rule, and root-owned files under `/etc/pennywise-401k`, `/usr/local/sbin`, and `/var/lib/pennywise-401k*`. It does not restart an app or edit Caddy. It requires the existing planner to be healthy first.

The production environment in GitHub must allow only the `main` branch. It holds `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, and the `DEPLOY_HOST` variable. The host key is obtained over the existing verified SSH connection; the workflow never blindly trusts `ssh-keyscan`. The private deployment key is separate from the personal administration key and grants no interactive shell, terminal, or forwarding access.

The repository variable `DEPLOY_ENABLED` starts as `false`. After installation, verify the forced command and enable the variable, then manually run CI on `main` for the first real deployment. Until then, image publishing can run but the deployment job is skipped. No server password belongs in GitHub or this repository.

## Normal releases

A push or merge to `main` triggers verification, image publishing, and deployment (when enabled). Pull requests only verify code and deployment scripts. A manual CI run on a non-main branch can test image publishing, but cannot deploy or access production environment secrets. Scheduled checks do not redeploy.

The deployment serializes updates, validates commit/digest inputs and the image revision label, logs in to GHCR with the job's temporary read-only token, pulls the image, and recreates only the `pennywise-401k` project's `app` service. Registry credentials are removed after the operation. Both applications retain their loopback ports: planner 3001, finance 3000.

A local HTTP check must succeed before the deployment is recorded. If replacement or the local health check fails, the script attempts to restore the preceding cached image and reports any rollback failure. A separate workflow check verifies public HTTPS; if only that check fails, investigate Caddy/DNS/network availability—the public check does not trigger an automatic rollback. Container replacement causes brief planner downtime. The finance app and its database are not part of this Compose project.

Root-owned deployment code is installed from reviewed source, not executed from a user-writable checkout during deployment. Changes to the server scripts or production Compose configuration require another administrator installation; normal application changes do not. Changing only files in the server's old source checkout does not change an image-based release.

## Recovery

On the server, run `sudo /usr/local/sbin/deploy-pennywise-401k --rollback` to restore the last cached image. This requires the administrator's sudo password; the Actions key cannot invoke arbitrary sudo arguments. Do not prune all unused images before confirming that a release works, because the preceding image is the immediate rollback copy. Check the deployed commit and image ID with `sudo cat /var/lib/pennywise-401k/current`.

Set the repository variable `DEPLOY_ENABLED=false` to stop new automatic deployments while investigating a failure. Existing containers continue running. This workflow does not apply Ubuntu updates, reboot the Droplet, or update the personal finance app.

## Verification

Run `bash -n deploy/deploy.sh deploy/install.sh`, validate `deploy/compose.production.yaml` with `PENNYWISE_IMAGE` set, and run the app's normal tests, lint, and build. Deployment tests run in an isolated image with mocked Docker and HTTP commands:

```sh
docker build --file deploy/Dockerfile.tests --tag planner-deploy-tests .
docker run --rm --network none planner-deploy-tests
```

No host directory or Docker socket is mounted into the test container. Tests cover successful release recording, credential cleanup, health-failure rollback, pull failure, revision mismatch, malicious input rejection, and manual cached-image rollback. The first authenticated deployment and the live rollback check still require the installed server account.
