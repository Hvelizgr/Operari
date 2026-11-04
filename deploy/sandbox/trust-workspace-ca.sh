#!/usr/bin/env bash
# Lets a workspace reach this server with Operari's short-lived SSH
# certificates, as a dedicated user with one sudo rule.
#
#   sudo deploy/sandbox/trust-workspace-ca.sh <ca.pub> [user] [sudo-command]
#
# <ca.pub>      the workspace CA (Settings → Servers → Show CA)
# user          default operari-deploy; certificates are issued for this name
# sudo-command  absolute path allowed with sudo -n, default /usr/bin/id
#
# Every change is validated before it takes effect (sshd -t, visudo -c), so
# a mistake leaves sshd and sudo as they were.
set -euo pipefail

CA_FILE="${1:?usage: $0 <ca.pub> [user] [sudo-command]}"
USER_NAME="${2:-operari-deploy}"
SUDO_CMD="${3:-/usr/bin/id}"

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
if ! grep -qE '^ssh-ed25519 [A-Za-z0-9+/=]+ operari-ca-' "$CA_FILE"; then
  echo "$CA_FILE does not look like an Operari workspace CA" >&2
  exit 1
fi
if [[ ! "$USER_NAME" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; then
  echo "invalid user name: $USER_NAME" >&2
  exit 1
fi
if [[ "$SUDO_CMD" != /* || ! -x "$SUDO_CMD" ]]; then
  echo "sudo command must be an absolute path to an executable: $SUDO_CMD" >&2
  exit 1
fi

echo "== user $USER_NAME"
if ! id "$USER_NAME" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USER_NAME" >/dev/null
fi

echo "== trust the workspace CA"
install -m 0644 "$CA_FILE" /etc/ssh/operari_ca.pub
conf=/etc/ssh/sshd_config.d/operari.conf
previous=$(cat "$conf" 2>/dev/null || true)
echo 'TrustedUserCAKeys /etc/ssh/operari_ca.pub' >"$conf"
if ! sshd -t; then
  echo "sshd rejected the config; restoring" >&2
  if [[ -n "$previous" ]]; then printf '%s\n' "$previous" >"$conf"; else rm -f "$conf"; fi
  exit 1
fi
systemctl reload ssh

echo "== sudo rule"
rule=/etc/sudoers.d/operari-$USER_NAME
tmp=$(mktemp)
echo "$USER_NAME ALL=(root) NOPASSWD: $SUDO_CMD" >"$tmp"
if visudo -cf "$tmp" >/dev/null; then
  install -m 0440 "$tmp" "$rule"
else
  echo "sudoers rule rejected" >&2
  rm -f "$tmp"
  exit 1
fi
rm -f "$tmp"

echo "done: $USER_NAME accepts certificates from $(awk '{print $3}' "$CA_FILE") and may sudo -n $SUDO_CMD"
