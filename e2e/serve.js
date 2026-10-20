// Servidor para las pruebas E2E: base de datos nueva en e2e/.data con los
// gatitos y las cuentas de demostración, y el build de producción del cliente.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'e2e/.data');
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(path.join(root, 'client/dist/index.html'))) {
  execFileSync('npm', ['run', 'build', '--prefix', 'client'], { cwd: root, stdio: 'inherit' });
}

const env = { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'development', PUBLIC_URL: `http://localhost:${process.env.PORT}` };
execFileSync('node', ['scripts/seed-demo.js'], { cwd: path.join(root, 'server'), env, stdio: 'inherit' });
const server = spawn('node', ['src/index.js'], { cwd: path.join(root, 'server'), env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
