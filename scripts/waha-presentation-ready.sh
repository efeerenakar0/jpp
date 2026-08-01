#!/usr/bin/env bash

set -euo pipefail

codespace_display_name="${WAHA_CODESPACE_DISPLAY_NAME:-jasmine-evolution-test}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "${script_dir}/.." && pwd)"
watchdog_source="${project_dir}/infra/waha/session-watchdog.mjs"

if ! command -v gh >/dev/null 2>&1; then
  echo "Hata: GitHub CLI (gh) bulunamadı." >&2
  exit 1
fi

codespace_name="$(
  gh codespace list \
    --json name,displayName,repository \
    --jq ".[] | select(.displayName == \"${codespace_display_name}\" and .repository == \"efeerenakar0/jpp\") | .name" \
    | head -n 1
)"

if [ -z "${codespace_name}" ]; then
  echo "Hata: ${codespace_display_name} adlı WAHA Codespace bulunamadı." >&2
  exit 1
fi

echo "WhatsApp test gateway'i başlatılıyor (${codespace_name})..."
gh codespace cp -e -c "${codespace_name}" \
  "${watchdog_source}" 'remote:~/'

gh codespace ssh -c "${codespace_name}" -- \
  'docker start jasmine-waha >/dev/null 2>&1 || true
   test "$(docker inspect --format "{{.State.Running}}" jasmine-waha 2>/dev/null)" = "true"
   docker update --restart always jasmine-waha >/dev/null
   waha_runtime_key="$(
     docker inspect jasmine-waha \
       --format "{{range .Config.Env}}{{println .}}{{end}}" \
       | sed -n "s/^WAHA_API_KEY=//p" \
       | head -n 1
   )"
   test -n "${waha_runtime_key}"
   if docker inspect jasmine-waha-watchdog >/dev/null 2>&1; then
     docker start jasmine-waha-watchdog >/dev/null
     docker update --restart always jasmine-waha-watchdog >/dev/null
   else
     docker run -d \
       --name jasmine-waha-watchdog \
       --restart always \
       --network container:jasmine-waha \
       -e WAHA_API_KEY="${waha_runtime_key}" \
       -e WAHA_INTERNAL_URL=http://127.0.0.1:3000 \
       -e WAHA_WATCHDOG_INTERVAL_MS=15000 \
       -v /home/codespace/session-watchdog.mjs:/app/session-watchdog.mjs:ro \
       node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 \
       node /app/session-watchdog.mjs >/dev/null
   fi
   test "$(
     docker inspect --format "{{.State.Running}}" jasmine-waha-watchdog
   )" = "true"
   docker exec jasmine-waha node -e '"'"'
     fetch("http://127.0.0.1:3000/api/sessions?all=true", {
       headers: { "X-Api-Key": process.env.WAHA_API_KEY }
     }).then((response) => process.exit(response.ok ? 0 : 1))
       .catch(() => process.exit(1));
   '"'"''

gh codespace ports visibility 8080:public -c "${codespace_name}" >/dev/null

gateway_url="$(
  gh codespace ports -c "${codespace_name}" \
    --json sourcePort,browseUrl \
    --jq '.[] | select(.sourcePort == 8080) | .browseUrl' \
    | head -n 1
)"

if [ -z "${gateway_url}" ]; then
  echo "Hata: WAHA portu (8080) dışarı açılamadı." >&2
  exit 1
fi

http_status="$(
  curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' \
    --max-time 20 \
    "${gateway_url}/api/sessions?all=true"
)"

if [ "${http_status}" != "401" ] && [ "${http_status}" != "200" ]; then
  echo "Hata: WAHA yayın adresi beklenen yanıtı vermedi (HTTP ${http_status})." >&2
  exit 1
fi

echo "Hazır: WAHA çalışıyor, API korumalı ve QR bağlantısı erişilebilir."
echo "Panel: https://jpp-ufeb.vercel.app/fabrika/whatsapp"
