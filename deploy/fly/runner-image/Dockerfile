# Reference runner image for the Fly Machine sidecar.
#
# The image just needs to put `operari-tee` on $PATH and ship its
# dependencies (sh, sed, mktemp, openssl, curl). Operators can
# extend this image — pip-install Python, install kubectl, etc. —
# and FlyMachineRunner will keep working as long as `operari-tee`
# stays callable.
#
# Build:
#   docker build -t ghcr.io/operari/runner:latest -f deploy/fly/runner-image/Dockerfile deploy/fly/runner-image
#
# Push to a registry Fly can pull from, then point OPERARI_RUNNER_IMAGE
# at the resulting tag.

FROM alpine:3.20

# `curl` for the chunk POSTs, `openssl` for HMAC signing,
# `coreutils` for a POSIX-friendly `mktemp` (busybox's diverges
# slightly).
RUN apk add --no-cache curl openssl coreutils

COPY operari-tee.sh /usr/local/bin/operari-tee
RUN chmod +x /usr/local/bin/operari-tee

# No CMD/ENTRYPOINT — FlyMachineRunner sets `init.exec` itself
# (`['operari-tee', '<user command>']`).
