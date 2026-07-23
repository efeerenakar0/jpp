const { spawn, execSync } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

let tunnelProcess = null;
let currentTunnelUrl = '';

function log(msg) {
  console.log(`[Tunnel Watchdog ${new Date().toLocaleTimeString('tr-TR')}]: ${msg}`);
}

async function checkTunnelHealth() {
  if (!currentTunnelUrl) return false;
  try {
    const res = await fetch(`${currentTunnelUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=jasmine_secret_verify_token&hub.challenge=health_check`, {
      timeout: 3000
    });
    const text = await res.text();
    return res.ok && text.includes('health_check');
  } catch (e) {
    return false;
  }
}

function startTunnel() {
  log('Starting fresh Cloudflare Tunnel process...');
  try {
    execSync('pkill -f cloudflared', { stdio: 'ignore' });
  } catch (e) {}

  tunnelProcess = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://127.0.0.1:3000'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  tunnelProcess.stderr.on('data', (data) => {
    const str = data.toString();
    const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && match[0] !== currentTunnelUrl) {
      currentTunnelUrl = match[0];
      log(`🟢 NEW LIVE TUNNEL URL: ${currentTunnelUrl}/api/whatsapp/webhook`);
    }
  });

  tunnelProcess.on('exit', (code) => {
    log(`Tunnel exited with code ${code}. Restarting automatically...`);
    currentTunnelUrl = '';
    setTimeout(startTunnel, 2000);
  });
}

// Initial start
startTunnel();

// Keep-alive watchdog loop every 10 seconds
setInterval(async () => {
  if (currentTunnelUrl) {
    const isHealthy = await checkTunnelHealth();
    if (isHealthy) {
      log(`✅ Tunnel is Healthy: ${currentTunnelUrl}`);
    } else {
      log(`⚠️ Tunnel connection failed health check! Re-initiating tunnel...`);
      try {
        if (tunnelProcess) tunnelProcess.kill();
      } catch (e) {}
    }
  }
}, 10000);
