// ============================================================
// MsLecturas — generarCert.js
// Genera certificados mkcert para HTTPS en red local
// Uso: node generarCert.js 192.168.1.100
// ============================================================
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ip = process.argv[2];
if (!ip) {
  console.error('Uso: node generarCert.js <IP_LOCAL>  (ej: node generarCert.js 192.168.1.100)');
  process.exit(1);
}

const certsDir = './certs';
if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir);

try {
  // Instalar CA raíz en el sistema (solo la primera vez)
  execSync('mkcert -install', { stdio: 'inherit' });

  // Generar cert para la IP local
  execSync(
    `mkcert -key-file ${certsDir}/key.pem -cert-file ${certsDir}/cert.pem ${ip} localhost 127.0.0.1`,
    { stdio: 'inherit' }
  );

  const caPath = execSync('mkcert -CAROOT').toString().trim();
  const rootCA = path.join(caPath, 'rootCA.crt');

  console.log('\n✓ Certificados generados en ./certs/');
  console.log(`\n📱 Para Android: instalá el archivo rootCA en el dispositivo:`);
  console.log(`   ${rootCA}`);
  console.log('\n   Pasos en Android:');
  console.log('   1. Copiá rootCA.crt al celular');
  console.log('   2. Ajustes → Seguridad → Instalar desde almacenamiento');
  console.log('   3. Seleccioná "Credencial de CA"\n');
} catch (err) {
  console.error('\n✗ Error. ¿Tenés mkcert instalado?');
  console.error('  Instalación: https://github.com/FiloSottile/mkcert#installation');
  process.exit(1);
}
