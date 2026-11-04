# Terminal y runbooks en un ambiente cerrado; sudo solo por SSH a servidores propios

_Noviembre 2026. Basado en el código actual (`backend/src/terminal/`, `runbook/executors/`) y en una
verificación sobre el servidor de producción (hvelizgr.dev, kernel 6.8, Docker con runc)._

## Objetivo

1. **Terminal y pasos `shell` / `agent.cliSession`:** un ambiente cerrado por usuario. Puede instalar
   SDKs (pip, npm, Claude Code) y salir a internet, pero **no** puede: ser root de verdad, tocar el
   servidor, leer secretos de Operari, ni alcanzar la red interna (Postgres, Redis, otros sitios).
2. **SSH:** el único camino con privilegios (sudo), y solo hacia **servidores registrados como
   propios** por un admin, con huella de host fijada, comandos acotados y aprobación humana.

## Hallazgo: el runner `local` actual no es un sandbox

Verificado en producción con el usuario del backend (`expressjs`):

| Prueba | Resultado |
|---|---|
| `/proc/1/environ` (proceso del backend) | **legible**: `DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`, `OPERARI_SECRET_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_SECRET`… |
| Conexión a `postgres:5432`, `redis:6379` | **abierta** (red `operari_default`) |
| Conexión a `portfolio-web`, `pristex-proxy` | **abierta** (red `web`) |
| Internet | abierto |
| `sudo` | no existe (bien) |

La lista blanca de variables de `terminal-session.ts` no alcanza: el shell corre con el **mismo uid**
que `node dist/server.js` y lee su entorno por `/proc`. Con `ENCRYPTION_KEY` + `DATABASE_URL` se
descifran todas las credenciales de todos los workspaces. Por eso `OPERARI_LOCAL_SHELL_TENANTS`
volvió a `none` (2026-11-01).

`agent.cliSession` con Claude Code en modo "sin permisos" agrava esto: un repo o una página con
*prompt injection* puede pedirle que lea esas variables.

## Diseño propuesto

```
                 ┌──────────── servidor ─────────────────────────────────────────┐
navegador ──wss──┤ backend (sin docker.sock, sin secretos en el sandbox)          │
                 │    │  API mínima (unix socket o HTTP interno)                   │
                 │    ▼                                                            │
                 │ sandbox-runner  (usuario de sistema sin privilegios,           │
                 │                  Docker/Podman rootless + gVisor)              │
                 │    │ crea: 1 contenedor por sesión/paso                        │
                 │    ▼                                                            │
                 │ red "operari-sandbox" ──► proxy de egreso ──► internet         │
                 │   (sin ruta a 10/8, 172.16/12, 192.168/16, host, metadata)     │
                 └────────────────────────────────────────────────────────────────┘
pasos ssh ──► solo a hosts del registro "servidores propios" (huella fijada)
                └─► en el servidor: usuario deploy + forced command / sudoers acotado
```

### 1. Quién crea los contenedores: `sandbox-runner`

- **No** montar `/var/run/docker.sock` en el backend: el socket equivale a root del host (cualquiera
  que lo use puede lanzar un contenedor `--privileged` montando `/`).
- Un **socket-proxy** (p. ej. `tecnativa/docker-socket-proxy`) filtra endpoints pero no las opciones
  del `create`, así que tampoco alcanza solo.
- Recomendado: un servicio chico `sandbox-runner` que expone **4 operaciones** (`open`, `attach`,
  `resize`, `kill`) y arma él mismo la especificación del contenedor con valores fijos. El backend
  pide "abrí una sesión para el tenant X / usuario Y con imagen Z de la lista permitida"; nunca pasa
  flags.
- El runner usa **Docker rootless o Podman rootless** bajo un usuario de sistema sin sudo
  (`operari-sandbox`). Aunque alguien escape del contenedor, cae como ese usuario, no como root.
  El kernel 6.8 lo soporta (`max_user_namespaces=192545`), pero Ubuntu restringe user namespaces
  sin privilegios con AppArmor (`apparmor_restrict_unprivileged_userns=1`), así que hay que instalar
  el perfil de AppArmor de rootlesskit/podman o permitirlo para ese binario.

### 2. El contenedor de cada sesión

| Control | Valor | Por qué |
|---|---|---|
| Runtime | **gVisor** (`--runtime=runsc`) | kernel en espacio de usuario: un exploit del kernel no llega al host. Alternativa más fuerte y pesada: Kata / Firecracker (microVM). |
| Usuario | `--user 1000:1000`, sin `sudo` en la imagen | nada de root dentro. Si se quiere "sudo de mentira" para `apt`, vale solo con user namespaces (root del contenedor = usuario sin privilegios del host). |
| Capabilities | `--cap-drop=ALL` | |
| Escalada | `--security-opt no-new-privileges` (ya está) + seccomp por defecto + AppArmor `docker-default` | |
| Sistema de archivos | `--read-only`, `--tmpfs /tmp`, home en volumen por usuario | lo instalado persiste solo en `~` |
| Recursos | `--memory 1g --cpus 1 --pids-limit 256` (ya está), `--storage-opt size=5G` | evita llenar el disco o forkbombs |
| Red | `--network operari-sandbox` | ver punto 3 |
| Secretos | solo los que el usuario elige para esa sesión (p. ej. su `ANTHROPIC_API_KEY` del vault), por `-e`; **nunca** el entorno del backend | |
| Tiempo | idle timeout (ya está) + tope duro por sesión | |
| Auditoría | grabación asciicast + `terminal.opened/closed` (ya está) | |

El código actual del runner `docker` (`terminal-session.ts`) ya aplica memoria, CPU, pids,
`no-new-privileges` y volumen por usuario; faltan `cap-drop`, `read-only`, `--user`, gVisor y
la red aislada.

### 3. Red: internet sí, interno no

- Red Docker dedicada `operari-sandbox` (bridge, `enable_icc=false`), sin conectar a `web`,
  `operari_default` ni `pristex_default`.
- Reglas en la cadena `DOCKER-USER` (iptables/nftables) para el rango de esa red: **DROP** hacia
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (metadata), `100.64.0.0/10` y
  la IP pública del propio servidor; **ACCEPT** el resto.
- Opcional, más estricto: todo el egreso pasa por un **proxy con lista permitida** (p. ej.
  `smokescreen` de Stripe, o Squid): `pypi.org`, `files.pythonhosted.org`, `registry.npmjs.org`,
  `github.com`, `api.anthropic.com`, `api.openai.com`… Con modo "abierto" o "lista" por workspace.
- DNS: resolver propio que no resuelva nombres internos de Docker.

### 4. SSH con sudo solo a servidores propios

- **Registro de servidores** (nuevo modelo `Server`): host, puerto, usuario, **huella de la clave
  del host** (fijada; hoy `ssh.executor.ts` no la verifica) y la credencial a usar. Solo un admin del
  workspace lo da de alta, opcionalmente con verificación de propiedad (poner un token en
  `~/.operari-verify`).
- El paso `ssh` solo acepta `serverId` de ese registro. Hoy bloquea IPs privadas a nivel global
  (SSRF guard); para servidores registrados se permite su IP/hostname puntual, y nada más.
- **En el servidor**, el privilegio se acota ahí, no en Operari:
  - usuario dedicado (`operari-deploy`), clave con `command="…",restrict` en `authorized_keys`
    (lo que hace `~/bin/operari-ssh` hoy), o
  - `sudoers` con comandos exactos y `NOPASSWD`, p. ej.
    `operari-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart nginx, /usr/local/bin/deploy-*`.
  - Operari ejecuta `sudo -n` (no interactivo); **nunca** guarda la contraseña de sudo.
- Mejor que claves fijas: **certificados SSH de corta vida** (Vault SSH engine o `step-ca`)
  emitidos por run, con `force-command` y vencimiento de minutos.
- Todo paso marcado `privileged` exige un paso de **aprobación** antes (validado al guardar el
  runbook) y queda en la cadena de auditoría con el comando exacto y la salida.

### 5. Política por workspace (en vez de variables de entorno)

| Capacidad | Valor por defecto | Quién la cambia |
|---|---|---|
| Terminal / `shell` | sandbox (nunca `local`) | — |
| Egreso del sandbox | internet abierto, interno bloqueado | admin del workspace: "lista permitida" |
| `ssh` | solo servidores registrados | admin del workspace |
| Pasos privilegiados | requieren aprobación | admin de la instalación puede exigir 2 aprobadores |
| Runner `local` | **desactivado** salvo flag de instalación para self-host de un solo usuario | operador del servidor |

La **primera cuenta** de una instalación self-host puede recibir el rol de operador
automáticamente; las cuentas siguientes nunca reciben `local` por registrarse.

## Plan por fases

| Fase | Qué | Esfuerzo |
|---|---|---|
| 0 | ✅ Runner `local` desactivado en prod. Documentar el riesgo. | hecho |
| 1 | ✅ (2026-11-02; en prod lo cubre la fase 2). Endurecer el runner `docker` existente: `--cap-drop=ALL`, `--read-only`, `--user`, red `operari-sandbox` + reglas `DOCKER-USER`; tests de "no llega a postgres / no lee secretos". | 1–2 días |
| 2 | ✅ en prod (2026-11-02, acceptance 18/18 sobre el daemon rootless). `sandbox-runner` con Docker o Podman **rootless** + **gVisor**; backend sin socket. | 3–5 días |
| 3 | ✅ en prod (2026-11-04). Registro de servidores con huella fijada; `ssh` solo por `serverId`; aprobación obligatoria para `privileged`. | 2–3 días |
| 4 | ✅ en prod (2026-11-04); falta probar login con certificado y sudo con sudoers reales. Política por workspace en UI; proxy de egreso con lista permitida; certificados SSH de corta vida. | 1 semana |

## Pruebas de aceptación (deben fallar dentro del sandbox)

```sh
cat /proc/1/environ                       # no es el backend; no hay secretos de Operari
nc -z postgres 5432; nc -z redis 6379     # sin resolución / sin ruta
curl -m3 http://172.17.0.1 http://169.254.169.254   # bloqueado
curl -m3 http://167.86.107.48             # IP del propio servidor: bloqueada
sudo -n true; su -                        # no existe / no funciona
mount -t tmpfs x /mnt                     # Operation not permitted
```

y deben funcionar: `pip install anthropic`, `npm i -g @anthropic-ai/sdk`, `curl https://api.anthropic.com`.

## Estado de la fase 1 (2026-11-02)

- `backend/src/runbook/runners/sandbox-profile.ts`: flags comunes (`--cap-drop=ALL`,
  `no-new-privileges`, `--user 1000:1000`, `--read-only`, `/tmp` en tmpfs, `--pids-limit 256`) que
  usan el runner `docker` y la terminal. Las redes `bridge`, `host`, `default` y `container:*` se
  rechazan al arrancar.
- Runner `docker`: `network: open | allowlist` va a `operari-sandbox` (`OPERARI_SANDBOX_NETWORK`),
  nunca a `bridge`. `allowlist` todavía no filtra por host (fase 4).
- Terminal `docker`: red por defecto `operari-sandbox`; `HOME=/workspace` con `PATH`,
  `NPM_CONFIG_PREFIX` y caché de pip dentro del home. El volumen persistente se pasa a uid 1000 la
  primera vez que se usa en el proceso (chown recursivo si venía de antes con archivos de root).
- `deploy/sandbox/setup-network.sh` (root): crea la red (`br-opsandbox`, `172.30.250.0/24`, sin ICC)
  y la cadena `OPERARI-SANDBOX` en `DOCKER-USER` + `DROP` en `INPUT` desde el bridge. Hace falta
  `INPUT` porque el host escucha en sus propias IPs (sshd en `0.0.0.0:22`, ollama en
  `172.22.0.1:11434`) y ese tráfico no pasa por `FORWARD`. `operari-sandbox-net.service` lo reaplica
  después de cada arranque de Docker.
- `deploy/sandbox/acceptance.sh`: 17 pruebas. En el servidor, con la red creada y **sin** las
  reglas: 13/17; las 4 que fallan son justo las conexiones al host (172.17.0.1:22, 172.22.0.1:11434,
  gateway del bridge, IP pública). Con las reglas deben pasar las 17.

**Falta para usarlo en prod:** aplicar las reglas como root, y que el backend pueda lanzar
contenedores. Montarle `docker.sock` equivale a darle root del host; eso es la fase 2
(`sandbox-runner` rootless), así que prod sigue con `OPERARI_LOCAL_SHELL_TENANTS=none` hasta entonces.

## Estado de la fase 2 (2026-11-02)

- **Servicio** `backend/src/sandbox/` (`node dist/sandbox/main.js`, imagen `--target sandbox`):
  HTTP con token Bearer (≥ 32 caracteres, comparación en tiempo constante). Endpoints:
  `GET /v1/health`, `POST /v1/runs` (respuesta NDJSON con stdout/stderr y resultado),
  `POST /v1/runs/cancel`, `POST /v1/terminals`, `GET …/output` (NDJSON), `POST …/input`,
  `POST …/resize`, `DELETE …`. El cuerpo se valida con zod (`protocol.ts`): no acepta flags,
  volúmenes ni nombres de red. Las imágenes tienen que estar en `OPERARI_SANDBOX_IMAGES`. Topes:
  1 h, 2 GB, 2 CPU, 20 terminales y 20 runs simultáneos. Una terminal sin lector se mata a los 60 s
  (si el backend se cae, no quedan contenedores colgados).
- **Backend:** runner `sandbox` (`OPERARI_RUNNER=sandbox`, `OPERARI_SANDBOX_URL`,
  `OPERARI_SANDBOX_TOKEN`) para los pasos, y `RemotePty` para la terminal: implementa la misma
  interfaz que node-pty, encola lo tipeado antes de que abra y manda la entrada en orden. En ese
  modo el backend no carga node-pty ni ve ningún socket de Docker.
- **Host** (`deploy/sandbox/install-rootless.sh`, root): usuario de sistema `operari-sandbox`
  con subuids propios, perfil de AppArmor para `rootlesskit` (Ubuntu 24.04 restringe user
  namespaces), dockerd rootless con linger y la red `operari-sandbox` dentro de ese daemon.
  gVisor es opcional (`--with-gvisor`, `runsc --ignore-cgroups`).
- **Red en modo rootless:** los contenedores salen por slirp4netns como el usuario
  `operari-sandbox`, así que `DOCKER-USER` no los ve. `rootless-firewall.sh` filtra en `OUTPUT`
  con `-m owner`: deja pasar solo el DNS a `127.0.0.53`, y bloquea el resto de loopback, los
  rangos privados, la metadata y las IPs del host. IPv6 bloqueado.
- **Compose:** `docker-compose.sandbox.yml` agrega `sandbox-runner` (solo lectura, sin
  capabilities, uid del usuario rootless, solo la red interna `sandbox-control`) y pasa el
  backend a `OPERARI_RUNNER=sandbox`.
- **Tests:** `src/__tests__/sandbox/` levanta el servidor real por HTTP con Docker/PTY falsos:
  token, allowlist de imágenes, topes, streaming, cancelación, terminal de punta a punta,
  limpieza de huérfanas y sandbox caído.

**En prod (2026-11-02):** `install-rootless.sh` + `operari-sandbox-firewall.service`;
`acceptance.sh` contra el daemon rootless 18/18; overlay activo. Verificado desde el backend: el
paso corre como uid 1000, no ve secretos, `postgres` no resuelve, internet sí. Al arrancar, el
runner mata los contenedores de un proceso anterior y descarga las imágenes permitidas.
gVisor sin instalar.

## Estado de las fases 3 y 4 (2026-11-04)

- **Servidores** (`Server`, `/api/servers`): el admin escanea la clave del host, confirma la huella y
  registra. El paso `ssh` y el túnel del paso de base de datos usan `serverId`; la clave del host
  queda fijada (ssh2 `hostVerifier` o `known_hosts` de una línea con `StrictHostKeyChecking=yes`).
  Los campos host/usuario del paso se ignoran cuando hay `serverId`.
- **Privilegiados:** `sudo -n <comando>` (sin `sh -c`, para que las reglas exactas de sudoers sigan
  coincidiendo). Requiere que el servidor tenga sudo permitido y N aprobadores distintos en el run
  (al guardar: N pasos de aprobación en todo camino hacia el paso; al ejecutar: N `approvedBy`
  distintos). Evento `ssh.privileged` con el comando exacto, la huella y los aprobadores.
- **Política** (`/api/tenants/execution-policy`): `sshPolicy` (`registered` por defecto),
  `sandboxEgress` (`open`/`allowlist`/`none`), `egressAllowlist`, `privilegedApprovals` (1/2). Es un
  techo: un paso sin red sigue sin red. Si no se puede leer, el sandbox queda sin red.
- **Proxy de salida:** contenedor `operari-egress` en el daemon rootless (`node -e` en
  `node:20-alpine`, uid 1000, sin capabilities, solo lectura). Cada sandbox en modo lista tiene su
  propia red `--internal` /29 compartida solo con el proxy (una red compartida necesitaría ICC, y
  sin ICC tampoco llegarían al proxy). El grant (hosts + vencimiento) va firmado con HMAC en
  `HTTPS_PROXY`; el secreto cambia en cada arranque del runner. Solo 80/443, nunca IPs, y un nombre
  permitido que resuelve a una IP privada se rechaza.
- **Certificados:** CA ed25519 por workspace, cifrada con AAD del tenant. Por paso: clave nueva y
  certificado de 5 min (+1 min de desfase) para el usuario del servidor, `-O clear -O permit-pty`.
  Se usa el `ssh` del sistema porque ssh2 no soporta certificados de cliente.

