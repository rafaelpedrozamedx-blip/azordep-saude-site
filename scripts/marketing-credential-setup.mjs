#!/usr/bin/env node
/* For Rafael to run manually in his own private Terminal. No network or git writes. */
import { randomBytes,scryptSync } from 'node:crypto';
import { stdin as input } from 'node:process';
if (!input.isTTY) {
 console.error('Execute em um Terminal privado interativo, nao em CI ou automacao.');
 process.exit(2);
}
const password=randomBytes(27).toString('base64url');
const salt=randomBytes(16).toString('hex');
const hash=scryptSync(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1}).toString('hex');
const session=randomBytes(48).toString('base64url');
console.log('\nAZORDEP /MARKETING — CREDENCIAIS NOVAS (PRODUCAO)\n');
console.log('USUARIO: admin');
console.log('SENHA FORTE: '+password);
console.log('\nAdicionar como variaveis Environment Variables (Production) ao Vercel azordep-saude-oficial:');
console.log('MARKETING_ADMIN_SCRYPT='+salt+':'+hash);
console.log('MARKETING_SESSION_SECRET='+session);
console.log('\nGuarde a senha no gerenciador de senhas. Nao a envie no chat, Bridge ou GitHub.');
