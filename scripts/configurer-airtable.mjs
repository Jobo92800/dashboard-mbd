#!/usr/bin/env node
// MA HQ · branchement du tableau de bord sur Airtable (à lancer une seule fois).
// Demande le jeton Airtable (caché à l'écran), vérifie qu'il lit bien
// « CRM 2026 › Prospects Master », puis le range dans Netlify. Il n'est écrit nulle part ailleurs.
import { execFileSync } from 'node:child_process';
import readline from 'node:readline';

const BASE = 'appNML7rJEKiWkuVg';
const TABLE = 'tblgCdNITlPy74Z5G';

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    rl.question(question, (v) => { rl.close(); process.stdout.write('\n'); resolve(v.trim()); });
  });
}

const token = await askHidden('Colle ton jeton Airtable (il ne s’affiche pas) puis Entrée : ');
if (!token.startsWith('pat')) {
  console.log('❌ Ce n’est pas un jeton Airtable (il commence par « pat »). Rien n’a été enregistré.');
  process.exit(1);
}
const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?maxRecords=1`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.log(`❌ Airtable refuse ce jeton (${res.status}). Vérifie qu’il a le droit « data.records:read » et l’accès à la base « CRM 2026 ». Rien n’a été enregistré.`);
  process.exit(1);
}
execFileSync('netlify', ['env:set', 'AIRTABLE_TOKEN', token], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('✅ Jeton vérifié et enregistré sur Netlify. Tu peux dire à Claude : « c’est fait ».');
