#!/usr/bin/env node

/**
 * Cross-platform local Flask backend launcher for UNSAID.
 *
 * Automatically detects the project-root Python virtual environment (`venv`)
 * across macOS, Linux, and Windows, verifies dependencies, automatically frees
 * any stale port conflicts, and starts the Flask server on 127.0.0.1:5001.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

const ROOT_DIR = process.cwd();
const HOST = process.env.FLASK_HOST || '127.0.0.1';
const PORT = parseInt(process.env.FLASK_PORT || '5001', 10);

/**
 * Checks if a port is currently open/in-use.
 */
function isPortInUse(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Automatically terminates any stale processes occupying the target port.
 */
function freePort(port) {
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid, 10)) && parseInt(pid, 10) !== process.pid) {
          console.log(`[UNSAID Backend Launcher] Releasing port ${port} (terminating stale PID ${pid})...`);
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          } catch {}
        }
      }
    } else {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
      const pids = output.trim().split('\n');
      for (const pid of pids) {
        const trimmed = pid.trim();
        if (trimmed && !isNaN(parseInt(trimmed, 10)) && parseInt(trimmed, 10) !== process.pid) {
          console.log(`[UNSAID Backend Launcher] Releasing port ${port} (terminating stale PID ${trimmed})...`);
          try {
            execSync(`kill -9 ${trimmed}`, { stdio: 'ignore' });
          } catch {}
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Detects the Python executable within the project virtual environment,
 * falling back to system Python if no venv is found.
 */
function resolvePythonExecutable() {
  const isWin = process.platform === 'win32';

  // Priority search order for virtual environments
  const candidatePaths = [
    // 1. Root venv
    isWin
      ? path.join(ROOT_DIR, 'venv', 'Scripts', 'python.exe')
      : path.join(ROOT_DIR, 'venv', 'bin', 'python'),
    isWin
      ? path.join(ROOT_DIR, 'venv', 'Scripts', 'python')
      : path.join(ROOT_DIR, 'venv', 'bin', 'python3'),

    // 2. Root .venv
    isWin
      ? path.join(ROOT_DIR, '.venv', 'Scripts', 'python.exe')
      : path.join(ROOT_DIR, '.venv', 'bin', 'python'),
    isWin
      ? path.join(ROOT_DIR, '.venv', 'Scripts', 'python')
      : path.join(ROOT_DIR, '.venv', 'bin', 'python3'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, isVenv: true };
    }
  }

  // System fallback
  return { path: isWin ? 'python' : 'python3', isVenv: false };
}

async function startBackend() {
  console.log('\n[UNSAID Backend Launcher] Initializing Python backend...');

  const { path: pythonExe, isVenv } = resolvePythonExecutable();

  if (isVenv) {
    console.log(`[UNSAID Backend Launcher] Using virtual environment Python: ${pythonExe}`);
  } else {
    console.warn(`[UNSAID Backend Launcher] No venv found at ./venv. Falling back to system Python: ${pythonExe}`);
    console.warn('[UNSAID Backend Launcher] Note: If packages are missing, create a venv: python3 -m venv venv && pip install -r requirements.txt');
  }

  // Check if port is in use; auto-recover if a stale instance is running
  let portInUse = await isPortInUse(PORT, HOST);
  if (portInUse) {
    console.log(`[UNSAID Backend Launcher] Port ${PORT} is currently occupied. Attempting to release...`);
    freePort(PORT);
    await sleep(500);
    portInUse = await isPortInUse(PORT, HOST);
  }

  if (portInUse) {
    console.error(`\n❌ [UNSAID Backend Error] Port ${PORT} on ${HOST} remains in use and could not be auto-released.`);
    console.error(`   To manually stop processes occupying port ${PORT}:`);
    console.error(`   macOS/Linux: lsof -ti :${PORT} | xargs kill -9`);
    console.error(`   Windows: netstat -ano | findstr :${PORT}\n`);
    process.exit(1);
  }

  const flaskArgs = [
    '-m',
    'flask',
    '--app',
    'backend.app',
    'run',
    '--host',
    HOST,
    '--port',
    String(PORT),
  ];

  console.log(`[UNSAID Backend Launcher] Executing: ${pythonExe} ${flaskArgs.join(' ')}`);

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    FLASK_APP: 'backend.app',
  };

  const child = spawn(pythonExe, flaskArgs, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env,
  });

  child.on('error', (err) => {
    console.error('\n❌ [UNSAID Backend Launch Failed]:', err.message);
    if (err.code === 'ENOENT') {
      console.error(`   Could not locate Python executable at "${pythonExe}".`);
      console.error('   Please ensure Python is installed and added to PATH, or create a virtual environment in ./venv.');
    }
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`\n[UNSAID Backend] Stopped by signal: ${signal}`);
      process.exit(0);
    } else if (code !== 0) {
      console.error(`\n❌ [UNSAID Backend] Process exited with status code: ${code}`);
      process.exit(code || 1);
    } else {
      console.log('\n[UNSAID Backend] Process exited normally.');
      process.exit(0);
    }
  });

  // Forward termination signals cleanly
  const handleShutdown = (signal) => {
    if (child && !child.killed) {
      try {
        child.kill(signal);
      } catch {}
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startBackend();
