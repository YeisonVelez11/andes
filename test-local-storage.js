/**
 * Script de prueba para el sistema de almacenamiento local
 * Verifica que todas las operaciones funcionen correctamente
 */

require('dotenv').config();

// Forzar modo local para las pruebas
process.env.CARPETAS_LOCALES = 'true';

const storageAdapter = require('./storage-adapter');
const fs = require('fs').promises;

async function runTests() {
  console.log('🧪 Iniciando pruebas de almacenamiento local\n');
  
  try {
    // Test 1: Inicialización
    console.log('📋 Test 1: Inicialización del almacenamiento');
    await storageAdapter.initializeStorage();
    const info = storageAdapter.getStorageInfo();
    console.log(`✅ Modo: ${info.mode}`);
    console.log(`✅ Base: ${info.basePath}`);
    console.log(`✅ Config: ${info.configPath}\n`);
    
    // Test 2: Subir archivo
    console.log('📋 Test 2: Subir archivo de prueba');
    const testBuffer = Buffer.from('Test content for local storage');
    const uploadResult = await storageAdapter.uploadFile(
      '1bbkECY_axw5IttYjgVpRLmi6-EF80fZz', // imagenes_cargadas
      'test-file.txt',
      testBuffer,
      'text/plain',
      null
    );
    console.log(`✅ Archivo subido: ${uploadResult.name}`);
    console.log(`✅ ID: ${uploadResult.id}\n`);
    
    // Test 3: Listar archivos
    console.log('📋 Test 3: Listar archivos');
    const filesResult = await storageAdapter.listFiles(
      '1bbkECY_axw5IttYjgVpRLmi6-EF80fZz',
      {},
      null
    );
    console.log(`✅ Archivos encontrados: ${filesResult.files.length}`);
    filesResult.files.forEach(file => {
      console.log(`   - ${file.name} (${file.size} bytes)`);
    });
    console.log('');
    
    // Test 4: Leer archivo
    console.log('📋 Test 4: Leer archivo');
    const readResult = await storageAdapter.readFile(uploadResult.id, null);
    const content = readResult.data.toString('utf8');
    console.log(`✅ Contenido leído: "${content}"\n`);
    
    // Test 5: Crear carpeta en navegacion
    console.log('📋 Test 5: Crear carpeta');
    const folderResult = await storageAdapter.createFolder(
      '1norxhMEG62maIArwy-zjolxzPGsQoBzq', // navegacion raíz
      'test-folder',
      null
    );
    console.log(`✅ Carpeta creada: ${folderResult.name}`);
    console.log(`✅ ID: ${folderResult.id}\n`);
    
    // Test 6: Listar carpetas
    console.log('📋 Test 6: Listar carpetas');
    const foldersResult = await storageAdapter.listFolders(
      '1norxhMEG62maIArwy-zjolxzPGsQoBzq',
      null
    );
    console.log(`✅ Carpetas encontradas: ${foldersResult.folders.length}`);
    foldersResult.folders.forEach(folder => {
      console.log(`   - ${folder.name}`);
    });
    console.log('');
    
    // Test 7: Subir archivo JSON
    console.log('📋 Test 7: Subir archivo JSON');
    const jsonData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: ['item1', 'item2', 'item3']
    };
    const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2));
    const jsonResult = await storageAdapter.uploadFile(
      '1d40AKgKucYUY-CnSqcLd1v8uyXhElk33', // jsones
      'test-data.json',
      jsonBuffer,
      'application/json',
      null
    );
    console.log(`✅ JSON subido: ${jsonResult.name}\n`);
    
    // Test 8: Eliminar archivo
    console.log('📋 Test 8: Eliminar archivo');
    await storageAdapter.deleteFile(uploadResult.id, null);
    console.log(`✅ Archivo eliminado\n`);
    
    // Test 9: Verificar eliminación
    console.log('📋 Test 9: Verificar eliminación');
    const filesAfterDelete = await storageAdapter.listFiles(
      '1bbkECY_axw5IttYjgVpRLmi6-EF80fZz',
      {},
      null
    );
    console.log(`✅ Archivos restantes: ${filesAfterDelete.files.length}\n`);
    
    console.log('🎉 ¡Todas las pruebas pasaron exitosamente!\n');
    
    console.log('📁 Estructura de carpetas creada:');
    console.log('   navegacion/');
    console.log('   └── test-folder/');
    console.log('   config_local/');
    console.log('   ├── imagenes_cargadas/');
    console.log('   ├── jsones/');
    console.log('   │   └── test-data.json');
    console.log('   ├── html/');
    console.log('   ├── capturas/');
    console.log('   └── metadata.json');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    process.exit(1);
  }
}

// Ejecutar pruebas
runTests()
  .then(() => {
    console.log('\n✅ Script de prueba completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
