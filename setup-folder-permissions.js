require('dotenv').config();
const { google } = require('googleapis');

// Script para transferir la propiedad de la carpeta a la Service Account

async function authorize() {
  const jwtClient = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
  );

  await jwtClient.authorize();
  console.log('✅ Successfully connected to Google Drive API.');
  return jwtClient;
}

async function setupFolderPermissions() {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });

    const folderId = "1LuybE4izyMOVB8I450DBC4ibhHab1KFJ";
    const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL;
    
    console.log(`\n📂 Configurando permisos para la carpeta...`);
    console.log(`   Carpeta ID: ${folderId}`);
    console.log(`   Service Account: ${serviceAccountEmail}\n`);

    // Intentar transferir la propiedad
    console.log('🔄 Intentando transferir propiedad a la Service Account...\n');
    
    try {
      // Primero, otorgar permisos de owner a la service account
      const permission = await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: 'owner',
          type: 'user',
          emailAddress: serviceAccountEmail
        },
        transferOwnership: true,
        supportsAllDrives: true
      });

      console.log('✅ ¡Propiedad transferida exitosamente!');
      console.log('   La Service Account ahora es propietaria de la carpeta.\n');
      console.log('🎉 Ahora puedes subir archivos sin problemas.\n');
      
    } catch (error) {
      if (error.message.includes('Cannot transfer ownership')) {
        console.log('❌ No se puede transferir la propiedad directamente.\n');
        console.log('📝 SOLUCIÓN ALTERNATIVA:\n');
        console.log('Debes hacer esto manualmente desde Google Drive:\n');
        console.log('1. Ve a Google Drive y busca la carpeta "imagenes"');
        console.log('2. Haz clic derecho → Compartir');
        console.log('3. Agrega este email como "Propietario":');
        console.log(`   ${serviceAccountEmail}`);
        console.log('4. Haz clic en "Transferir propiedad"\n');
        console.log('⚠️  IMPORTANTE: Solo el propietario actual puede transferir la propiedad.\n');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

setupFolderPermissions();
