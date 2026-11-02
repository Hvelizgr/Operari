#!/usr/bin/env bash
# Creates the `operari-sandbox` Docker network and the firewall rules that
# make it internet-only: no private ranges, no cloud metadata, no host.
# Idempotent; run as root after Docker starts (see operari-sandbox-net.service).
#
#   sudo deploy/sandbox/setup-network.sh            create network + rules
#   sudo deploy/sandbox/setup-network.sh --remove   drop the rules
#
# Env overrides: OPERARI_SANDBOX_NETWORK, OPERARI_SANDBOX_SUBNET,
# OPERARI_SANDBOX_BRIDGE, OPERARI_SANDBOX_EXTRA_DENY (space-separated CIDRs).
set -euo pipefail

NET="${OPERARI_SANDBOX_NETWORK:-operari-sandbox}"
SUBNET="${OPERARI_SANDBOX_SUBNET:-172.30.250.0/24}"
BRIDGE="${OPERARI_SANDBOX_BRIDGE:-br-opsandbox}"
CHAIN="OPERARI-SANDBOX"
DENY=(
  0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12
  192.0.0.0/24 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4
)
# shellcheck disable=SC2206
DENY+=(${OPERARI_SANDBOX_EXTRA_DENY:-})

if [[ $EUID -ne 0 ]]; then
  echo "run as root (iptables needs it)" >&2
  exit 1
fi

unhook() {
  while iptables -D DOCKER-USER -i "$BRIDGE" -j "$CHAIN" 2>/dev/null; do :; done
  while iptables -D INPUT -i "$BRIDGE" -j DROP 2>/dev/null; do :; done
  while ip6tables -D FORWARD -i "$BRIDGE" -j DROP 2>/dev/null; do :; done
  iptables -F "$CHAIN" 2>/dev/null || true
  iptables -X "$CHAIN" 2>/dev/null || true
}

if [[ "${1:-}" == "--remove" ]]; then
  unhook
  echo "rules removed (network $NET left in place)"
  exit 0
fi

if ! docker network inspect "$NET" >/dev/null 2>&1; then
  docker network create \
    --driver bridge \
    --subnet "$SUBNET" \
    --opt com.docker.network.bridge.name="$BRIDGE" \
    --opt com.docker.network.bridge.enable_icc=false \
    --opt com.docker.network.bridge.enable_ip_masquerade=true \
    --label operari.sandbox=true \
    "$NET" >/dev/null
  echo "created network $NET ($SUBNET, bridge $BRIDGE)"
fi

actual_bridge=$(docker network inspect "$NET" \
  --format '{{index .Options "com.docker.network.bridge.name"}}')
if [[ "$actual_bridge" != "$BRIDGE" ]]; then
  echo "network $NET exists with bridge '$actual_bridge', expected '$BRIDGE'; recreate it" >&2
  exit 1
fi
if [[ "$(docker network inspect "$NET" --format '{{.EnableIPv6}}')" == "true" ]]; then
  echo "network $NET has IPv6 enabled; these rules only cover IPv4" >&2
  exit 1
fi

# The host's own public addresses are reached through INPUT, not FORWARD,
# so they are covered by the INPUT drop below; listed here as well for
# traffic that hairpins through another interface.
mapfile -t HOST_IPS < <(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1)

unhook
iptables -N "$CHAIN"
iptables -A "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
for cidr in "${DENY[@]}" "${HOST_IPS[@]}"; do
  iptables -A "$CHAIN" -d "$cidr" -j DROP
done
iptables -A "$CHAIN" -j RETURN

iptables -I DOCKER-USER 1 -i "$BRIDGE" -j "$CHAIN"
# Anything addressed to the host itself (sshd, ollama on 172.22.0.1, published
# ports via the bridge gateway) from the sandbox.
iptables -I INPUT 1 -i "$BRIDGE" -j DROP
ip6tables -I FORWARD 1 -i "$BRIDGE" -j DROP 2>/dev/null || true

echo "sandbox firewall ready on $BRIDGE: internet only"
