#!/usr/bin/env bash

set -euo pipefail

codespace_display_name="${WAHA_CODESPACE_DISPLAY_NAME:-jasmine-evolution-test}"

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
gh codespace ssh -c "${codespace_name}" -- \
  'docker start jasmine-waha >/dev/null 2>&1 || true
   test "$(docker inspect --format "{{.State.Running}}" jasmine-waha 2>/dev/null)" = "true"
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
