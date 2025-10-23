require('dotenv').config();
const { google } = require('googleapis');

// Script para transferir la propiedad de una carpeta a la Service Account

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

async function transferOwnership() {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });

    const folderId = "1LuybE4izyMOVB8I450DBC4ibhHab1KFJ";
    
    console.log(`\n📋 Información de la carpeta:`);
    
    // Obtener información de la carpeta
    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, owners, capabilities, driveId',
      supportsAllDrives: true
    });
    
    console.log(`   Nombre: ${folderInfo.data.name}`);
    console.log(`   ID: ${folderInfo.data.id}`);
    console.log(`   Propietario actual: ${folderInfo.data.owners?.[0]?.emailAddress || 'N/A'}`);
    console.log(`   ¿Es Shared Drive?: ${folderInfo.data.driveId ? 'Sí' : 'No'}`);
    
    if (folderInfo.data.driveId) {
      console.log('\n✅ Esta carpeta está en un Shared Drive. Debería funcionar correctamente.');
      console.log('   Asegúrate de que la Service Account tenga permisos de "Content Manager" o superior.');
      return;
    }

    console.log('\n⚠️  Esta carpeta NO está en un Shared Drive.');
    console.log('\n📝 Para solucionar el problema, tienes dos opciones:\n');
    console.log('1. OPCIÓN RECOMENDADA: Crear un Shared Drive');
    console.log('   - Ve a Google Drive → Shared drives → New shared drive');
    console.log('   - Agrega tu Service Account como miembro con permisos de Manager');
    console.log('   - Crea una carpeta dentro y actualiza el ID en server.js\n');
    console.log('2. OPCIÓN ALTERNATIVA: Usar OAuth 2.0 en lugar de Service Account');
    console.log('   - Requiere reconfigurar la autenticación');
    console.log('   - Permite usar carpetas personales\n');

    // Intentar listar permisos actuales
    console.log('📋 Permisos actuales de la carpeta:');
    const permissions = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id, emailAddress, role, type)',
      supportsAllDrives: true
    });
    
    permissions.data.permissions.forEach(perm => {
      console.log(`   - ${perm.emailAddress || perm.type}: ${perm.role}`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('storage quota')) {
      console.log('\n💡 SOLUCIÓN: Debes usar un Shared Drive.');
      console.log('   Las Service Accounts no pueden escribir en carpetas personales,');
      console.log('   incluso si están compartidas.\n');
    }
  }
}

transferOwnership();
