#!/bin/bash
# HTTPS for the friends' API: a Let's Encrypt certificate for this server's IP address. IP addresses only get the 6-day
# "shortlived" kind, so the bralni-cert timer runs this twice a day and lego renews when about half the time is left.
#   ./cert.sh --install <IP>   first time: nginx site (nginx-bralni-mentor.conf), certificate, timer
#   ./cert.sh                  renew if due (what the timer runs)
set -euo pipefail
cd "$(dirname "$0")"
D=/etc/bralni-mentor LEGO=goacme/lego:v5.6.0
mkdir -p "$D/lego" "$D/cert" /var/www/bralni-acme

if [ "${1:-}" = --install ]; then
  IP="${2:?usage: ./cert.sh --install <IP>}"; echo "$IP" > "$D/ip"
  # a placeholder certificate so nginx can start before the real one arrives
  [ -f "$D/cert/fullchain.pem" ] || openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=$IP" \
    -keyout "$D/cert/key.pem" -out "$D/cert/fullchain.pem" 2>/dev/null
  sed "s/__IP__/$IP/g" nginx-bralni-mentor.conf > /etc/nginx/sites-available/bralni-mentor
  ln -sf /etc/nginx/sites-available/bralni-mentor /etc/nginx/sites-enabled/bralni-mentor
  nginx -t && systemctl reload nginx
  if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then ufw allow 8443/tcp; fi
  cat > /etc/systemd/system/bralni-cert.service <<EOF
[Unit]
Description=Bralni mentor: renew the HTTPS certificate of the friends' API
After=docker.service nginx.service
[Service]
Type=oneshot
ExecStart=$PWD/cert.sh
EOF
  cat > /etc/systemd/system/bralni-cert.timer <<'EOF'
[Unit]
Description=Bralni mentor: certificate renewal twice a day
[Timer]
OnCalendar=*-*-* 03,15:17:00
RandomizedDelaySec=20m
Persistent=true
[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload && systemctl enable --now bralni-cert.timer
fi

IP=$(cat "$D/ip")
docker run --rm -v "$D/lego:/data" -v /var/www/bralni-acme:/acme "$LEGO" run --path /data --accept-tos --domains "$IP" \
  --http --http.webroot /acme --profile shortlived --key-type ec256 --no-random-sleep
crt="$D/lego/certificates/$IP.crt" key="$D/lego/certificates/$IP.key"
if ! cmp -s "$crt" "$D/cert/fullchain.pem"; then
  install -m 600 "$key" "$D/cert/key.pem"; install -m 644 "$crt" "$D/cert/fullchain.pem"
  nginx -t && systemctl reload nginx
  echo "New certificate for $IP: $(openssl x509 -noout -enddate -in "$D/cert/fullchain.pem")"
fi
