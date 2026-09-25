#!/usr/bin/env node
// MA HQ · configuration des notifications push (à lancer UNE seule fois).
// Crée la paire de clés VAPID et la range directement dans Netlify.
// La clé secrète n'est jamais affichée ni écrite sur le disque.
import { execFileSync } from 'node:child_process';
import webpush from 'web-push';

const netlify = (args, opts = {}) => execFileSync('netlify', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

let existing = '';
try { existing = netlify(['env:get', 'VAPID_PUBLIC_KEY']).trim(); } catch { /* pas encore configuré */ }
if (existing && !existing.includes('No value')) {
  console.log('✅ Les notifications sont déjà configurées sur Netlify.');
  console.log('   (Refaire la configuration couperait les notifications de tous les appareils déjà inscrits.)');
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
netlify(['env:set', 'VAPID_PUBLIC_KEY', publicKey]);
netlify(['env:set', 'VAPID_PRIVATE_KEY', privateKey]);
netlify(['env:set', 'VAPID_SUBJECT', 'mailto:contact@mabeautyplus.fr']);

console.log('✅ Clés de notifications créées et enregistrées sur Netlify.');
console.log('   Tu peux dire à Claude : « c’est fait ».');
