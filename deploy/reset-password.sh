#!/usr/bin/env bash
# Sets a new password for an Operari account directly in production, for
# when the reset email cannot be sent (no RESEND_API_KEY). Also clears the
# failed-login counter and any lockout. The password is read without echo
# and passed to the container on stdin, so it never shows up in the shell
# history or in `ps`.
#
#   ./deploy/reset-password.sh you@example.com
set -euo pipefail

email="${1:?usage: $0 <email>}"
read -rsp "New password for ${email}: " pw; echo
read -rsp "Repeat: " pw2; echo
[ "$pw" = "$pw2" ] || { echo "Passwords do not match" >&2; exit 1; }
[ "${#pw}" -ge 8 ] || { echo "At least 8 characters" >&2; exit 1; }

printf '%s' "$pw" | docker exec -i -e EMAIL="$email" operari-backend node -e '
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
let pw = "";
process.stdin.on("data", d => (pw += d)).on("end", async () => {
  const prisma = new PrismaClient();
  const res = await prisma.user.updateMany({
    where: { email: process.env.EMAIL },
    data: {
      passwordHash: await bcrypt.hash(pw, 12),
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastFailedLoginAt: null,
    },
  });
  console.log(res.count ? "Password updated." : "No account with that email.");
  await prisma.$disconnect();
});'
