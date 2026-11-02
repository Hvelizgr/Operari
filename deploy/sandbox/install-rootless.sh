#!/usr/bin/env bash
# Phase 2 host setup: a rootless Docker daemon owned by an unprivileged
# system user, which only the sandbox-runner talks to. A container escape
# lands as that user, not as root, and the backend never sees a socket.
#
#   sudo deploy/sandbox/install-rootless.sh [--with-gvisor]
#
# Idempotent. Ubuntu 24.04 (AppArmor restricts unprivileged user
# namespaces, so rootlesskit gets its own profile). Afterwards:
#   sudo systemctl enable --now operari-sandbox-firewall.service
#   sudo -u operari-sandbox DOCKER_HOST=unix:///run/user/$(id -u operari-sandbox)/docker.sock \
#     deploy/sandbox/acceptance.sh
set -euo pipefail

USER_NAME="${OPERARI_SANDBOX_USER:-operari-sandbox}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WITH_GVISOR=false
[[ "${1:-}" == "--with-gvisor" ]] && WITH_GVISOR=true

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

echo "== packages"
apt-get update -qq
apt-get install -y -qq uidmap dbus-user-session slirp4netns docker-ce-rootless-extras >/dev/null

echo "== user $USER_NAME"
if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/var/lib/$USER_NAME" --shell /usr/sbin/nologin "$USER_NAME"
fi
UID_N=$(id -u "$USER_NAME")
if ! grep -q "^$USER_NAME:" /etc/subuid; then
  # Past the 165536+65536 range already handed to the first login user.
  usermod --add-subuids 296608-362143 --add-subgids 296608-362143 "$USER_NAME"
fi

echo "== apparmor profile for rootlesskit"
cat >/etc/apparmor.d/usr.bin.rootlesskit <<'EOF'
abi <abi/4.0>,
include <tunables/global>

"/usr/bin/rootlesskit" flags=(unconfined) {
  userns,
  include if exists <local/usr.bin.rootlesskit>
}
EOF
apparmor_parser -r /etc/apparmor.d/usr.bin.rootlesskit

if $WITH_GVISOR; then
  echo "== gVisor"
  if ! command -v runsc >/dev/null; then
    curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
      >/etc/apt/sources.list.d/gvisor.list
    apt-get update -qq
    apt-get install -y -qq runsc >/dev/null
  fi
  install -d -o "$USER_NAME" -g "$USER_NAME" "/var/lib/$USER_NAME/.config/docker"
  # Rootless daemons cannot manage cgroups for runsc; Docker still enforces
  # --memory/--pids-limit through its own cgroup delegation.
  cat >"/var/lib/$USER_NAME/.config/docker/daemon.json" <<'EOF'
{
  "runtimes": {
    "runsc": { "path": "/usr/bin/runsc", "runtimeArgs": ["--ignore-cgroups"] }
  }
}
EOF
  chown "$USER_NAME:$USER_NAME" "/var/lib/$USER_NAME/.config/docker/daemon.json"
fi

echo "== rootless dockerd for $USER_NAME (uid $UID_N)"
loginctl enable-linger "$USER_NAME"
systemctl start "user@$UID_N.service"
as_user() {
  sudo -u "$USER_NAME" \
    XDG_RUNTIME_DIR="/run/user/$UID_N" \
    DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$UID_N/bus" \
    DOCKER_HOST="unix:///run/user/$UID_N/docker.sock" \
    "$@"
}
if ! as_user systemctl --user is-active --quiet docker; then
  as_user dockerd-rootless-setuptool.sh install >/dev/null
fi
as_user systemctl --user enable --now docker >/dev/null 2>&1 || true
$WITH_GVISOR && as_user systemctl --user restart docker

for _ in $(seq 1 30); do
  as_user docker version >/dev/null 2>&1 && break
  sleep 1
done

echo "== sandbox network in the rootless daemon"
if ! as_user docker network inspect operari-sandbox >/dev/null 2>&1; then
  as_user docker network create \
    --opt com.docker.network.bridge.enable_icc=false \
    --label operari.sandbox=true operari-sandbox >/dev/null
fi

echo "== egress firewall unit"
install -m 0644 "$HERE/operari-sandbox-firewall.service" /etc/systemd/system/
sed -i "s#@HERE@#$HERE#g" /etc/systemd/system/operari-sandbox-firewall.service
systemctl daemon-reload

cat <<EOF

done. Next:
  sudo systemctl enable --now operari-sandbox-firewall.service
  sudo -u $USER_NAME DOCKER_HOST=unix:///run/user/$UID_N/docker.sock $HERE/acceptance.sh
  then in .env on this server:
    OPERARI_SANDBOX_UID=$UID_N
    OPERARI_SANDBOX_TOKEN=\$(openssl rand -hex 32)
  and start it: docker compose -f docker-compose.yml -f docker-compose.server.yml --profile sandbox up -d
EOF
