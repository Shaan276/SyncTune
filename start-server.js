// SyncTune Next.js High-Availability Production Server Supervisor
const { spawn } = require('child_process');
const path = require('path');

process.env.PORT = '9998';
process.env.NEXT_TELEMETRY_DISABLED = '1';

// Prevent event loop exhaustion
setInterval(() => {}, 1000 * 60 * 60);

// Global exception guards
process.on('uncaughtException', (err) => {
  console.error('[SyncTune Supervisor UncaughtException]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SyncTune Supervisor UnhandledRejection]', reason);
});

let childProcess = null;

const fs = require('fs');

function startNext() {
  const hasBuild = fs.existsSync(path.join(__dirname, '.next', 'BUILD_ID'));
  const mode = hasBuild ? 'start' : 'dev';
  console.log(`[SyncTune Supervisor] Launching Next.js in ${mode} mode on port 9998...`);
  
  const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
  childProcess = spawn(process.execPath, [nextBin, mode, '-p', '9998'], {
    cwd: __dirname,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env
  });

  childProcess.on('error', (err) => {
    console.error('[SyncTune Supervisor] Process error:', err);
  });

  childProcess.on('exit', (code, signal) => {
    console.warn(`[SyncTune Supervisor] Server stopped (code: ${code}, signal: ${signal}). Auto-restarting in 1s...`);
    setTimeout(startNext, 1000);
  });
}

process.on('SIGINT', () => {
  if (childProcess) childProcess.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  if (childProcess) childProcess.kill();
  process.exit(0);
});

startNext();
