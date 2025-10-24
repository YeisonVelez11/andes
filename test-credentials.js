require('dotenv').config();
const { google } = require('googleapis');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function testCredentials(clientEmail, privateKey, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}🔍 Probando: ${label}${colors.reset}`);
  console.log(`📧 Email: ${clientEmail}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!clientEmail || !privateKey) {
    console.log(`${colors.red}❌ Credenciales no configuradas${colors.reset}\n`);
    return false;
  }

  try {
    // Intentar autenticar
    console.log('1️⃣ Autenticando con Google...');
    const jwtClient = new google.auth.JWT(
      clientEmail,
      null,
      privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );

    await jwtClient.authorize();
    console.log(`${colors.green}   ✅ Autenticación exitosa${colors.reset}`);

    // Probar acceso a Drive
    console.log('\n2️⃣ Probando acceso a Google Drive API...');
    const drive = google.drive({ version: 'v3', auth: jwtClient });
    
    const aboutResponse = await drive.about.get({ fields: 'user' });
    console.log(`${colors.green}   ✅ API de Drive accesible${colors.reset}`);
    console.log(`   👤 Usuario: ${aboutResponse.data.user.displayName || 'Service Account'}`);

    // Probar acceso a carpeta de imágenes
    console.log('\n3️⃣ Probando acceso a carpeta de Imágenes...');
    const imagenesFolderId = "1W4gHrHDkAMFm4PjFdshrCR7W_zjrNm4r";
    try {
      const folderResponse = await drive.files.get({
        fileId: imagenesFolderId,
        fields: 'id, name, permissions'
      });
      console.log(`${colors.green}   ✅ Acceso a carpeta de Imágenes: ${folderResponse.data.name}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}   ❌ Sin acceso a carpeta de Imágenes${colors.reset}`);
      console.log(`   Error: ${error.message}`);
    }

    // Probar acceso a carpeta de JSONs
    console.log('\n4️⃣ Probando acceso a carpeta de JSONs...');
    const jsonesFolderId = "13c7NiE8Ftu-g6fxwaAD6PihOlDMWPapT";
    try {
      const folderResponse = await drive.files.get({
        fileId: jsonesFolderId,
        fields: 'id, name, permissions'
      });
      console.log(`${colors.green}   ✅ Acceso a carpeta de JSONs: ${folderResponse.data.name}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}   ❌ Sin acceso a carpeta de JSONs${colors.reset}`);
      console.log(`   Error: ${error.message}`);
    }

    // Intentar listar archivos en carpeta de imágenes
    console.log('\n5️⃣ Probando listar archivos en carpeta de Imágenes...');
    try {
      const filesResponse = await drive.files.list({
        q: `'${imagenesFolderId}' in parents and trashed=false`,
        pageSize: 5,
        fields: 'files(id, name)'
      });
      console.log(`${colors.green}   ✅ Puede listar archivos (${filesResponse.data.files.length} encontrados)${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}   ❌ No puede listar archivos${colors.reset}`);
      console.log(`   Error: ${error.message}`);
    }

    console.log(`\n${colors.green}✅ TODAS LAS PRUEBAS PASARON${colors.reset}\n`);
    return true;

  } catch (error) {
    console.log(`\n${colors.red}❌ ERROR: ${error.message}${colors.reset}`);
    
    if (error.message.includes('invalid_grant')) {
      console.log(`\n${colors.yellow}💡 Posible causa: Private key mal formateado${colors.reset}`);
      console.log('   Verifica que los saltos de línea estén como \\n');
    } else if (error.message.includes('403') || error.message.includes('404')) {
      console.log(`\n${colors.yellow}💡 Posible causa: Sin permisos en las carpetas${colors.reset}`);
      console.log('   Comparte las carpetas con este email de service account');
    } else if (error.message.includes('401')) {
      console.log(`\n${colors.yellow}💡 Posible causa: Credenciales inválidas${colors.reset}`);
      console.log('   Verifica el email y private key');
    }
    
    console.log('');
    return false;
  }
}

async function main() {
  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log('🔐 TEST DE CREDENCIALES DE GOOGLE DRIVE');
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  // Probar credenciales actuales (funcionando)
  const currentWorking = await testCredentials(
    process.env.GOOGLE_CLIENT_EMAIL,
    process.env.GOOGLE_PRIVATE_KEY,
    'CREDENCIALES ACTUALES (Funcionando)'
  );

  // Probar credenciales anteriores (comentadas)
  const previousWorking = await testCredentials(
    'andes-277@protean-keyword-475900-m4.iam.gserviceaccount.com',
    '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDiwR4xWY8VNurj\nnqgCG5Qn58qLcV1/TkvNY4QhT/Njc85tFKWWelIk7jYbJlhxS61v7PerxY4Jhy3o\nfrMVpgaASWmIl4npUuwe5L5WDnk93PALsjWJynn204WJvJUe1Y7J5UINglu6zIdS\nLq680Glb5CY+/SQodM84wOV2aijKXwn6NgViP232+vy01PYqawS92mDiEZ3yzaB0\n+a1qWBzaqZl1RKtgA6kPj7Uxfq2GvJhFsJCJrtkZhIERA3tXWHfbPuf7jS0KqkkM\nJ6Ye/5xQV+hdWP66Aryz4UeVzMpyainzEnXGc1GZ3LNoVQrszwHFEsegFwJf6+58\nmfGeDPiLAgMBAAECggEAOPbq7trg5yN0vtoMuvrSrXO9nmpMYr74rBBkETpUmpdt\nNFoLf1IbcMunLArmDRBF8ehGEBEBLcOX9OBffQDIgVHwATCQpN0AFILCjjv0mWX3\np/iNGqCTIz7gPUny7FwaEv5VKa+l+7eGB09S9nwk+8DFGu3dN4ygwlEzVBw3Qx9D\n/pSGb+eIwl07+N93YnTjw8AtjSgnud1i1Z7UmlvC09xuX3uDaL+cdGc/uDpsE48y\ndxTbcbtHu/SzMka7Bv0hYsZ844Yh1Yodgr1K9zhFugBl4XczlRM0YAbrlJGc5olz\n4iWW9Nam9XNDcqioqaCBoIMH++VdbhSQ/csd3jM3gQKBgQD1mmaUq2XPi9Bob3fE\naut1TMhi6vHREdypUoVHXjmhJaM7HzWdpuG72AQKrgV81Bny2oXF6+L+g82hYZMt\nHB/kcQFfgMBARXyL93XWRxf/I1jR/41tTPHfK5KFEgBwMsB7b3xH2t2HYOJ5XURo\nF6W7QFfiyjp4p6gH+gzutUXu/wKBgQDsWnQO328BCE4ubD7WqanBz4wgFyD34xnR\nRcGcoyBEu0GLbgmJDevb/QYBGVVMWCaoTnFoPmgxTGDOqNDgTcDHqU8zvK59YbpB\nPBVcle0ifUJC3rYYE6V98txjDSvc+6VKUm28EDGYRv/PeJdNNwpASHOb9T/oNGDG\nIZXJS4dCdQKBgCYkfn3kSIF9EzbE6PLGMB8dd5l1J2zyuzRIro4w4f5W3AzYgfkj\n67bCi44lDJEgV49RxKjCQ5SHX64Ke1LsJT/TFQWB91mD8R3DprdKfz2OfcLPT2WE\nJ6QjHjQwYYULPL1uyPxXz0OxFjsG8xK/aWu1SHDeO0p1rzDd8pg36s59AoGATquU\n8dZhJmDTVRRmniD/BinFJHFOYfRPhZ7IYRDTDs2ddYF83wepOCIyO29pOu4kf+UM\nTnxnRfF8T41VaTO4NT0fxcLJ+aXrzwbmvViSA+bZhVSIG99+ODv8K2QY84c3b1Oc\nfvqM53jKcQ5cnjDx0o/LG2A4k1vL0mcfak8fiHkCgYEAl5hXQRyHh7lD49UWWQfE\nxCma00y3ibN9XNc0IXjsL9kUHyVK2GPILpxdSPzyBCmtRmiWOBf8Ty8mcYYN7Z1J\nJCwmp/1/6MvY50khbJ3VRxStwSRP4bbhyLj50TigvnzElQvtJmDjOFdEkwNYxJfs\nelhHOvh0hIhqq2vc00k2dzw=\n-----END PRIVATE KEY-----\n',
    'CREDENCIALES ANTERIORES (A probar)'
  );

  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log('📊 RESUMEN');
  console.log(`${'='.repeat(60)}${colors.reset}\n`);
  console.log(`Cuenta actual: ${currentWorking ? colors.green + '✅ Funcionando' : colors.red + '❌ No funciona'}${colors.reset}`);
  console.log(`Cuenta anterior: ${previousWorking ? colors.green + '✅ Funcionando' : colors.red + '❌ No funciona'}${colors.reset}`);
  console.log('');
}

main();
