// SyncTune Next.js High-Availability Production Server Supervisor
const { spawn } = require('child_process');
const path = require('path');

process.env.PORT = '9998';
process.env.NEXT_TELEMETRY_DISABLED = '1';

function startNext() {
  console.log('[SyncTune Supervisor] Launching Next.js on port 9998...');
  
  const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', '9998'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (err) => {
    console.error('[SyncTune Supervisor] Process error:', err);
  });

  child.on('exit', (code, signal) => {
    console.warn(`[SyncTune Supervisor] Server stopped (code: ${code}, signal: ${signal}). Auto-restarting in 1s...`);
    setTimeout(startNext, 1000);
  });
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

startNext();
