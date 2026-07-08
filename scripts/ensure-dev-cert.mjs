#!/usr/bin/env node
// Bootstraps a local self-signed HTTPS certificate for the Vite dev server (see vite.config.ts).
// Runs automatically as the `predev` step of `npm run dev`. Requires `openssl` on PATH.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const certDir = fileURLToPath(new URL('../.certs', import.meta.url))
const keyFile = `${certDir}/dev-key.pem`
const certFile = `${certDir}/dev-cert.pem`

if (!existsSync(keyFile) || !existsSync(certFile)) {
  mkdirSync(certDir, { recursive: true })
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-days',
      '825',
      '-keyout',
      keyFile,
      '-out',
      certFile,
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'inherit' },
  )
  console.log(`Generated a self-signed dev certificate in ${certDir}/`)
}
