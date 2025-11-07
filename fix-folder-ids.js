/**
 * Script para limpiar registros con carpeta_id incorrectos
 * Elimina todos los registros de hoy para que puedas volver a subirlos
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'campanas.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Limpiando registros de hoy...\n');

// Obtener fecha de hoy en Argentina
const today = new Date().toLocaleDateString('en-CA', { 
  timeZone: 'America/Argentina/Buenos_Aires' 
});

console.log(`📅 Fecha de hoy (Argentina): ${today}`);

// Ver qué registros hay
db.all(
  `SELECT id, device_type, carpeta_id, carpeta_nombre, campaign_date 
   FROM campanas 
   WHERE DATE(campaign_date) = ?`,
  [today],
  (err, rows) => {
    if (err) {
      console.error('❌ Error consultando:', err);
      return;
    }

    console.log(`\n📊 Registros encontrados: ${rows.length}\n`);
    
    rows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Device: ${row.device_type}`);
      console.log(`  Carpeta ID: ${row.carpeta_id}`);
      console.log(`  Carpeta Nombre: ${row.carpeta_nombre}`);
      console.log(`  Fecha: ${row.campaign_date}`);
      console.log('  ---');
    });

    // Eliminar registros
    db.run(
      `DELETE FROM campanas WHERE DATE(campaign_date) = ?`,
      [today],
      function(err) {
        if (err) {
          console.error('❌ Error eliminando:', err);
        } else {
          console.log(`\n✅ ${this.changes} registros eliminados`);
          console.log('\n💡 Ahora puedes volver a subir tu campaña con las carpetas correctas');
        }
        
        db.close();
      }
    );
  }
);
