# Sandbox for shell steps and the terminal

Why and threat model: [`docs/sandbox-research.md`](../../docs/sandbox-research.md).

```
backend ──HTTP + token──► sandbox-runner ──► rootless dockerd (user operari-sandbox)
 (no docker socket)        (fixed profile,       └─► containers: uid 1000, no caps,
                            image allowlist)           read-only, network operari-sandbox
                                                       egress: OUTPUT owner-match rules
```

The backend only describes a step ("run this command, with or without network")
or asks for a terminal. Every container flag is set by the sandbox-runner, so
a compromised backend can't get more than a sandboxed container. A container
escape lands as `operari-sandbox` (a system user without sudo), not as root.

## Phase 1 only (rootful Docker, network rules)

Hardened flags plus an internet-only network on the existing daemon. On its own
this doesn't let the production backend use Docker safely, because the backend
would need `docker.sock`.

```sh
sudo deploy/sandbox/setup-network.sh
sudo cp deploy/sandbox/operari-sandbox-net.service /etc/systemd/system/
sudo systemctl enable --now operari-sandbox-net.service
deploy/sandbox/acceptance.sh            # expect 18/18
```

## Phase 2 (rootless daemon + sandbox-runner)

```sh
sudo deploy/sandbox/install-rootless.sh            # add --with-gvisor for runsc
sudo systemctl enable --now operari-sandbox-firewall.service
U=$(id -u operari-sandbox)
sudo -u operari-sandbox DOCKER_HOST=unix:///run/user/$U/docker.sock \
  deploy/sandbox/acceptance.sh                      # expect 18/18
```

Then add to `.env` on the server:

```sh
OPERARI_SANDBOX_UID=<id -u operari-sandbox>
OPERARI_SANDBOX_GID=<id -g operari-sandbox>
OPERARI_SANDBOX_TOKEN=<openssl rand -hex 32>
# OPERARI_SANDBOX_RUNTIME=runsc      # only after --with-gvisor and a passing acceptance run
```

and bring the stack up with the overlay:

```sh
docker compose -f docker-compose.yml -f docker-compose.server.yml \
  -f docker-compose.sandbox.yml up -d --build
```

Once the sandbox runner is on, `OPERARI_LOCAL_SHELL_TENANTS` no longer applies:
every workspace runs shell steps and terminals inside the sandbox.

### gVisor

`--with-gvisor` installs `runsc` and registers it with the rootless daemon,
run with `--ignore-cgroups` because a rootless daemon can't hand cgroups to
runsc. Rootless Docker combined with runsc is the least-tested setup here, so
run the acceptance tests under runsc before turning it on:
`sudo -u operari-sandbox DOCKER_HOST=… OPERARI_SANDBOX_RUNTIME=runsc deploy/sandbox/acceptance.sh`.

## Environment (sandbox-runner)

| Variable                                      | Default           |                                                 |
| --------------------------------------------- | ----------------- | ----------------------------------------------- |
| `OPERARI_SANDBOX_TOKEN`                       | —                 | required, ≥ 32 chars, same value in the backend |
| `OPERARI_SANDBOX_LISTEN`                      | `0.0.0.0:4100`    | or a unix socket path                           |
| `OPERARI_SANDBOX_IMAGES`                      | `alpine:3.20`     | comma list; first one is the default for steps  |
| `OPERARI_SANDBOX_TERMINAL_IMAGE`              | first image       |                                                 |
| `OPERARI_SANDBOX_NETWORK`                     | `operari-sandbox` | `bridge`/`host`/`container:*` are refused       |
| `OPERARI_SANDBOX_RUNTIME`                     | —                 | e.g. `runsc`                                    |
| `OPERARI_SANDBOX_MAX_TERMINALS` / `_MAX_RUNS` | 20 / 20           | global caps                                     |
| `DOCKER_HOST`                                 | —                 | the rootless daemon's socket                    |
