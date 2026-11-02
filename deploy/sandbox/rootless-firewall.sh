#!/usr/bin/env bash
# Egress rules for the rootless sandbox daemon. Its containers leave the
# host through slirp4netns as the operari-sandbox user, so DOCKER-USER never
# sees them; the OUTPUT chain with an owner match does.
#
#   sudo deploy/sandbox/rootless-firewall.sh            apply
#   sudo deploy/sandbox/rootless-firewall.sh --remove   drop
set -euo pipefail

USER_NAME="${OPERARI_SANDBOX_USER:-operari-sandbox}"
CHAIN="OPERARI-SANDBOX-OUT"
DENY=(
  0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 169.254.0.0/16 172.16.0.0/12
  192.0.0.0/24 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4
)
# shellcheck disable=SC2206
DENY+=(${OPERARI_SANDBOX_EXTRA_DENY:-})

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
UID_N=$(id -u "$USER_NAME")

unhook() {
  while iptables -D OUTPUT -m owner --uid-owner "$UID_N" -j "$CHAIN" 2>/dev/null; do :; done
  while ip6tables -D OUTPUT -m owner --uid-owner "$UID_N" -j DROP 2>/dev/null; do :; done
  iptables -F "$CHAIN" 2>/dev/null || true
  iptables -X "$CHAIN" 2>/dev/null || true
}

if [[ "${1:-}" == "--remove" ]]; then
  unhook
  exit 0
fi

mapfile -t HOST_IPS < <(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1)

unhook
iptables -N "$CHAIN"
iptables -A "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
# slirp4netns forwards container DNS to the host resolver (systemd-resolved
# on 127.0.0.53); every other loopback service (Postgres, Redis, published
# ports) stays out of reach.
iptables -A "$CHAIN" -o lo -d 127.0.0.53 -p udp --dport 53 -j RETURN
iptables -A "$CHAIN" -o lo -d 127.0.0.53 -p tcp --dport 53 -j RETURN
iptables -A "$CHAIN" -o lo -j DROP
iptables -A "$CHAIN" -d 127.0.0.0/8 -j DROP
for cidr in "${DENY[@]}" "${HOST_IPS[@]}"; do
  iptables -A "$CHAIN" -d "$cidr" -j DROP
done
iptables -A "$CHAIN" -j RETURN
iptables -I OUTPUT 1 -m owner --uid-owner "$UID_N" -j "$CHAIN"
ip6tables -I OUTPUT 1 -m owner --uid-owner "$UID_N" -j DROP 2>/dev/null || true

echo "egress for uid $UID_N ($USER_NAME): internet only"
