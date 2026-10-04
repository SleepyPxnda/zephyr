# Zephyr

Webanwendung zum Planen von Reit-Choreografien (Kür, Quadrille) zur Musik: Wege mehrerer Pferde auf dem Grundriss einer Reithalle zeichnen, zeitlich auf einer Zeitleiste zur Musik anordnen, gemeinsam live bearbeiten und abspielen.

Nuxt 4 · PostgreSQL 16 · S3-kompatibler Objektspeicher · Anmeldung über Discord (Freigabe durch den Admin).

Fachliche Beschreibung: [`SPEC.md`](SPEC.md) · Umsetzungsstand: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)

## Voraussetzungen

- Docker mit Compose
- Eine Discord-Anwendung (<https://discord.com/developers/applications>) für den Login: Client-ID und -Secret, unter „OAuth2 → Redirects“ die Adresse `…/auth/discord` eintragen
- Ein S3-Bucket, z. B. Hetzner Object Storage (privat; die Anwendung setzt beim Start selbst eine CORS-Regel für Lesezugriffe)
- Für die Entwicklung zusätzlich Node.js 22 und pnpm (`corepack enable`)

## Entwicklung

```bash
cp .env.example .env          # Werte eintragen, mindestens SUPER_ADMIN_DISCORD_ID und S3
pnpm install
docker compose -f docker/compose.dev.yml up -d                     # Postgres
# lokales S3 statt extern: docker compose -f docker/compose.dev.yml --profile garage up -d
pnpm db:migrate && pnpm db:seed
pnpm dev                      # http://localhost:3000
```

Ohne Discord anmelden (nur `pnpm dev`, nur über localhost): `http://localhost:3000/auth/dev-login?username=<SUPER_ADMIN_DISCORD_ID>`, Demo-Nutzerin: `anna`.

| Befehl            | Zweck                                                   |
| ----------------- | ------------------------------------------------------- |
| `pnpm check`      | Lint, Typecheck, Formatierung – muss vor jedem Commit grün sein |
| `pnpm format`     | Formatierung mit Prettier schreiben                     |
| `pnpm db:generate`| Migration aus dem geänderten Schema erzeugen            |
| `pnpm test:core`  | vorhandene Tests der Fachlogik (`packages/core`)        |

## Betrieb

Die Produktion läuft mit [`docker/compose.prod.yml`](docker/compose.prod.yml): die Anwendung (Node 22 mit ffmpeg) und PostgreSQL 16. Objektspeicher ist ein externer S3. TLS übernimmt ein Reverse Proxy, den du selbst vor die Anwendung stellst.

### Einrichten

1. Repository auf den Server klonen und `.env` aus `.env.example` anlegen:
   - `POSTGRES_PASSWORD`: zufälliges Passwort (nur Buchstaben und Ziffern, es landet in der Verbindungs-URL); `DATABASE_URL` setzt die Compose-Datei selbst
   - `S3_*`: Endpunkt, Region, Bucket und Schlüssel; für Hetzner `S3_FORCE_PATH_STYLE=false`
   - `NUXT_SESSION_PASSWORD`: mindestens 32 zufällige Zeichen (`openssl rand -hex 32`)
   - `NUXT_OAUTH_DISCORD_CLIENT_ID`, `NUXT_OAUTH_DISCORD_CLIENT_SECRET`
   - `NUXT_OAUTH_DISCORD_REDIRECT_URL=https://<deine-domain>/auth/discord` (genauso in der Discord-Anwendung eintragen)
   - `SUPER_ADMIN_DISCORD_ID`: deine Discord-Nutzer-ID; dieses Konto ist immer aktiv und Admin
   - optional `DISCORD_WEBHOOK_URL` für Hinweise auf neue Zugangsanfragen, `APP_PORT` (Standard 3000)
2. Starten:

   ```bash
   docker compose -f docker/compose.prod.yml --env-file .env up -d --build
   ```

   Beim Start spielt die Anwendung alle ausstehenden Migrationen ein und legt fehlende Grunddaten an (Admin-Konto, Gangarten, Halle mit Platzhaltermaßen). Erst danach beantwortet sie Anfragen; schlägt das fehl, beendet sie sich und Docker startet sie neu.
3. Reverse Proxy mit TLS auf `http://127.0.0.1:3000` zeigen lassen. Er muss WebSockets durchreichen (Live-Bearbeitung unter `/ws/plans/…`) und `X-Forwarded-Host`/`X-Forwarded-Proto` setzen. Beispiel Caddy:

   ```
   zephyr.example.org {
   	reverse_proxy 127.0.0.1:3000
   }
   ```

   Die Anwendung setzt Cookies nur über HTTPS; ohne TLS ist keine Anmeldung möglich.
4. Mit dem Discord-Konto aus `SUPER_ADMIN_DISCORD_ID` anmelden. Unter „Einstellungen“ Hallenbild und -maße sowie die Gangarten pflegen, unter „Nutzer“ offene Anfragen freigeben.

### Aktualisieren

```bash
git pull
docker compose -f docker/compose.prod.yml --env-file .env up -d --build
```

Migrationen laufen beim Start automatisch.

### Fertiges Image statt eigenem Build

Die GitHub Action [`image.yml`](.github/workflows/image.yml) baut das Image `ghcr.io/sleepypxnda/zephyr`, sobald auf GitHub ein Release veröffentlicht wird. Ein Release `v1.2.3` erhält die Tags `1.2.3`, `1.2` und `latest`, ein Pre-Release (z. B. `v1.3.0-rc.1`) nur sein eigenes Versions-Tag. Auf dem Server reichen dann `compose.prod.yml` und `.env`, ohne Quellcode:

```bash
docker compose -f docker/compose.prod.yml --env-file .env pull app
docker compose -f docker/compose.prod.yml --env-file .env up -d --no-build
```

Ein anderes Tag wählt `ZEPHYR_IMAGE` in `.env`, z. B. `ZEPHYR_IMAGE=ghcr.io/sleepypxnda/zephyr:1.2.3`. Ist das Paket auf GitHub privat, vorher `docker login ghcr.io` mit einem Token mit `read:packages`.

### Überwachen

- `GET /api/health` antwortet `200 {"status":"ok"}`, solange die Datenbank erreichbar ist, sonst `503`. Docker nutzt das als Healthcheck (`docker compose … ps`).
- Logs: `docker compose -f docker/compose.prod.yml logs -f app`. Die Anwendung schreibt eine JSON-Zeile je Ereignis (`time`, `level`, `msg`, ggf. `err` mit Stacktrace).
- Gelöschte Pläne werden nach 30 Tagen täglich um 03:00 endgültig entfernt.

### Sicherung

Backups richtet der Betreiber selbst ein, z. B. täglich:

```bash
docker compose -f docker/compose.prod.yml exec -T postgres pg_dump -U zephyr zephyr | gzip > zephyr-$(date +%F).sql.gz
```

Dazu den S3-Bucket (Musik, Bilder) mit den Mitteln des Anbieters sichern.

## Lizenz

[MIT](LICENSE)
