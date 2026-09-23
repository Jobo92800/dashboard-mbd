import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const git = (cmd: string) => {
  try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
};

/**
 * Numéro de version unique par mise en ligne (commit + heure de construction).
 * Publié dans /version.json : l'appli ouverte le compare au sien pour proposer
 * d'actualiser quand une nouvelle version est en ligne.
 */
const builtAt = new Date().toISOString();
const commit = (process.env.COMMIT_REF || git('rev-parse HEAD')).slice(0, 7);
const version = `${commit || 'local'}-${builtAt}`;
const note = git('log -1 --pretty=%s');

const versionFile = (): Plugin => ({
  name: 'mahq-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, note, builtAt }) });
  },
});

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5190 },
});
