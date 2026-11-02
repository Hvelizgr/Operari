#!/usr/bin/env bash
# Acceptance tests for the sandbox (docs/sandbox-research.md). Starts a
# container with the same flags the docker runner and terminal use and
# checks what must fail and what must work. Needs only the docker group.
#
#   deploy/sandbox/acceptance.sh [image]
set -uo pipefail

IMAGE="${1:-${OPERARI_TERMINAL_IMAGE:-python:3.12-alpine}}"
NET="${OPERARI_SANDBOX_NETWORK:-operari-sandbox}"
HOST_IP="${OPERARI_SANDBOX_HOST_IP:-$(ip -4 -o addr show scope global | awk '$2 !~ /^(docker|br-)/ {print $4; exit}' | cut -d/ -f1)}"
GATEWAY="$(docker network inspect "$NET" --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null)"

if ! docker network inspect "$NET" >/dev/null 2>&1; then
  echo "network $NET missing: run sudo deploy/sandbox/setup-network.sh" >&2
  exit 1
fi

pass=0
fail=0
# shellcheck disable=SC2016
run() {
  # shellcheck disable=SC2086
  docker run --rm ${OPERARI_SANDBOX_RUNTIME:+--runtime $OPERARI_SANDBOX_RUNTIME} \
    --cap-drop=ALL --security-opt no-new-privileges --user 1000:1000 \
    --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m,mode=1777 \
    --tmpfs /workspace:rw,exec,nosuid,nodev,size=256m,uid=1000,gid=1000 \
    -e HOME=/workspace -w /workspace \
    --pids-limit 256 --memory 512m --cpus 1 \
    --network "$NET" "$IMAGE" sh -c "$1" </dev/null >/dev/null 2>&1
}
# Probes run inside the sandbox, so they use the shell's /dev/tcp-free tools:
# python is in the default image; nc/wget from busybox otherwise.
tcp() { echo "python3 -c 'import socket,sys; socket.create_connection((\"$1\",$2),timeout=3)'"; }

must_fail() {
  if run "$2"; then
    echo "FAIL  $1"
    fail=$((fail + 1))
  else
    echo "ok    $1"
    pass=$((pass + 1))
  fi
}
must_work() {
  if run "$2"; then
    echo "ok    $1"
    pass=$((pass + 1))
  else
    echo "FAIL  $1"
    fail=$((fail + 1))
  fi
}

echo "image $IMAGE, network $NET, runtime ${OPERARI_SANDBOX_RUNTIME:-default}, gateway $GATEWAY, host $HOST_IP"
must_fail "no Operari secrets in the environment" \
  'env | grep -Eq "DATABASE_URL|ENCRYPTION_KEY|JWT_SECRET|OPERARI_SECRET_KEY"'
must_fail "pid 1 is not the backend" 'tr "\\0" " " </proc/1/cmdline | grep -q "^node "'
must_fail "postgres name does not resolve" "$(tcp postgres 5432)"
must_fail "redis name does not resolve" "$(tcp redis 6379)"
must_fail "operari_default network (172.19.0.1:5432)" "$(tcp 172.19.0.1 5432)"
must_fail "docker0 gateway (172.17.0.1:22)" "$(tcp 172.17.0.1 22)"
must_fail "ollama on the web bridge (172.22.0.1:11434)" "$(tcp 172.22.0.1 11434)"
must_fail "own bridge gateway ($GATEWAY:22)" "$(tcp "$GATEWAY" 22)"
must_fail "host public IP ($HOST_IP:22)" "$(tcp "$HOST_IP" 22)"
must_fail "cloud metadata (169.254.169.254:80)" "$(tcp 169.254.169.254 80)"
must_fail "no docker socket inside" '[ -S /var/run/docker.sock ] || [ -S /run/docker.sock ]'
must_fail "root inside the container" '[ "$(id -u)" = 0 ]'
must_fail "sudo" 'sudo -n true'
must_fail "mount" 'mount -t tmpfs x /tmp/m'
must_fail "write to the root filesystem" 'touch /etc/x'
must_work "write to the home" 'touch ~/x && mkdir -p ~/.local'
must_work "HTTPS to the internet (api.anthropic.com)" "$(tcp api.anthropic.com 443)"
must_work "pip install --user" 'pip install -q --user --no-cache-dir six'

echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
