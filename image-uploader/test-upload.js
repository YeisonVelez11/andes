require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');

// Test simple de upload a Google Drive

async function authorize() {
  const jwtClient = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive'],
    process.env.GOOGLE_USER_EMAIL // Actuar en nombre de este usuario si está configurado
  );

  await jwtClient.authorize();
  console.log('✅ Successfully connected to Google Drive API.');
  return jwtClient;
}

async function testUpload() {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    
    const folderId = "16LB2Czrx6Fik82OMvRFcLEFQmqZPgn-D";
    
    // Primero verificar información de la carpeta
    console.log('\n📂 Verificando carpeta...');
    try {
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, driveId, capabilities, owners',
        supportsAllDrives: true
      });
      
      console.log(`   Nombre: ${folderInfo.data.name}`);
      console.log(`   ID: ${folderInfo.data.id}`);
      console.log(`   ¿Es Shared Drive?: ${folderInfo.data.driveId ? 'Sí ✅' : 'No ❌'}`);
      if (folderInfo.data.owners) {
        console.log(`   Propietario: ${folderInfo.data.owners[0]?.emailAddress || 'N/A'}`);
      }
      console.log('');
    } catch (err) {
      console.error('❌ Error al obtener info de carpeta:', err.message);
      return;
    }
    
    // Crear un archivo de prueba
    const testContent = 'Este es un archivo de prueba - ' + new Date().toISOString();
    const testFilePath = './test-file.txt';
    fs.writeFileSync(testFilePath, testContent);
    
    console.log('📤 Intentando subir archivo de prueba...\n');
    
    const fileMetadata = {
      name: 'test-upload-' + Date.now() + '.txt',
      parents: [folderId]
    };

    const media = {
      mimeType: 'text/plain',
      body: fs.createReadStream(testFilePath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    console.log('✅ ¡Archivo subido exitosamente!');
    console.log(`   Nombre: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Link: ${response.data.webViewLink}\n`);
    
    // Limpiar archivo temporal
    fs.unlinkSync(testFilePath);
    
    console.log('🎉 ¡La configuración funciona correctamente!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('storage quota')) {
      console.log('\n💡 Este error significa que la carpeta NO es un Shared Drive.');
      console.log('   Necesitas crear un Shared Drive o usar una cuenta de Google Workspace.\n');
    }
  }
}

testUpload();
