require('dotenv').config();
const { google } = require('googleapis');

// IDs de las carpetas
const IMAGENES_FOLDER_ID = "1W4gHrHDkAMFm4PjFdshrCR7W_zjrNm4r";
const JSONES_FOLDER_ID = "13c7NiE8Ftu-g6fxwaAD6PihOlDMWPapT";

// Emails de las service accounts
const SERVICE_ACCOUNTS = [
  process.env.GOOGLE_CLIENT_EMAIL, // Cuenta actual (funcionando)
  // Agrega aquí el email de la cuenta anterior comentada en .env
  // Ejemplo: "otra-cuenta@proyecto.iam.gserviceaccount.com"
];

async function authorize() {
  const jwtClient = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
  );

  await jwtClient.authorize();
  console.log('✅ Autenticado con Google Drive API');
  return jwtClient;
}

async function shareFolder(drive, folderId, email, folderName) {
  try {
    // Verificar si ya tiene acceso
    const existingPermissions = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id, emailAddress, role)'
    });

    const alreadyShared = existingPermissions.data.permissions.find(
      p => p.emailAddress === email
    );

    if (alreadyShared) {
      console.log(`   ℹ️  ${email} ya tiene acceso a ${folderName} (${alreadyShared.role})`);
      return;
    }

    // Compartir carpeta con permisos de escritor
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: 'user',
        role: 'writer', // Puede ser 'writer' o 'owner'
        emailAddress: email
      },
      sendNotificationEmail: false
    });

    console.log(`   ✅ ${email} ahora tiene acceso a ${folderName}`);
  } catch (error) {
    console.error(`   ❌ Error compartiendo ${folderName} con ${email}:`, error.message);
  }
}

async function listCurrentPermissions(drive, folderId, folderName) {
  try {
    const response = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id, emailAddress, role, type)'
    });

    console.log(`\n📋 Permisos actuales de ${folderName}:`);
    response.data.permissions.forEach(perm => {
      const email = perm.emailAddress || `${perm.type} (sin email)`;
      console.log(`   - ${email}: ${perm.role}`);
    });
  } catch (error) {
    console.error(`   ❌ Error listando permisos de ${folderName}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Script para compartir carpetas de Drive con múltiples service accounts\n');

  // Validar que hay emails para compartir
  const validEmails = SERVICE_ACCOUNTS.filter(email => email && email.includes('@'));
  
  if (validEmails.length === 0) {
    console.error('❌ No hay emails de service accounts configurados');
    console.log('\n📝 Edita este archivo y agrega los emails en el array SERVICE_ACCOUNTS');
    return;
  }

  console.log('📧 Service accounts a configurar:');
  validEmails.forEach(email => console.log(`   - ${email}`));
  console.log('');

  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });

    // Listar permisos actuales
    await listCurrentPermissions(drive, IMAGENES_FOLDER_ID, 'Carpeta de Imágenes');
    await listCurrentPermissions(drive, JSONES_FOLDER_ID, 'Carpeta de JSONs');

    console.log('\n🔄 Compartiendo carpetas...\n');

    // Compartir carpeta de imágenes con todas las cuentas
    console.log('📁 Carpeta de Imágenes:');
    for (const email of validEmails) {
      await shareFolder(drive, IMAGENES_FOLDER_ID, email, 'Imágenes');
    }

    // Compartir carpeta de JSONs con todas las cuentas
    console.log('\n📁 Carpeta de JSONs:');
    for (const email of validEmails) {
      await shareFolder(drive, JSONES_FOLDER_ID, email, 'JSONs');
    }

    console.log('\n✅ Proceso completado');
    
    // Listar permisos finales
    await listCurrentPermissions(drive, IMAGENES_FOLDER_ID, 'Carpeta de Imágenes');
    await listCurrentPermissions(drive, JSONES_FOLDER_ID, 'Carpeta de JSONs');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
