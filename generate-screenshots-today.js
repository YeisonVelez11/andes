#!/usr/bin/env node

/**
 * Script para generar screenshots del día actual
 * Llama al endpoint /generate-screenshot sin especificar fechas
 * El servidor automáticamente usará la fecha actual
 */

require('dotenv').config();
const axios = require('axios');
const { getArgentinaDateString } = require('./date-utils');

// Configuración desde variables de entorno o valores por defecto
const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;

// Obtener fecha actual en hora argentina
const todayString = getArgentinaDateString();

console.log('🚀 Iniciando generación de screenshots...');
console.log(`📅 Fecha: ${todayString}`);
console.log(`🌐 Servidor: ${BASE_URL}`);
console.log('');

// Función principal
async function generateScreenshots() {
  try {
    // Realizar petición POST
    const response = await axios.post(`${BASE_URL}/generate-screenshot`, {
      // targetDates se omite para que use fecha actual por defecto
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutos de timeout (screenshots pueden tardar)
    });

    const data = response.data;

    console.log(`📡 Estado: ${response.status}`);
    console.log('');

    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log('');
      console.log(`📊 ${data.message}`);
      console.log('');

      const totalScreenshots = (data.data.desktop?.length || 0) + (data.data.mobile?.length || 0);

      if (totalScreenshots === 0) {
        console.log('ℹ️  No se encontraron campañas para el día de hoy.');
        console.log('📄 Sin embargo, el HTML de la página web fue capturado exitosamente.');
        console.log('');
      } else {
        // Mostrar detalles de desktop
        if (data.data.desktop && data.data.desktop.length > 0) {
          console.log('🖥️  DESKTOP SCREENSHOTS:');
          data.data.desktop.forEach((screenshot, index) => {
            if (screenshot.success) {
              console.log(`  ${index + 1}. ${screenshot.fileName}`);
              console.log(`     Tipo: ${screenshot.visualizationType || 'N/A'}`);
              console.log(`     Drive ID: ${screenshot.driveFileId}`);
              console.log(`     Link: ${screenshot.webViewLink}`);
              console.log('');
            } else {
              console.log(`  ${index + 1}. ❌ Error: ${screenshot.error}`);
              console.log('');
            }
          });
        }

        // Mostrar detalles de mobile
        if (data.data.mobile && data.data.mobile.length > 0) {
          console.log('📱 MOBILE SCREENSHOTS:');
          data.data.mobile.forEach((screenshot, index) => {
            if (screenshot.success) {
              console.log(`  ${index + 1}. ${screenshot.fileName}`);
              console.log(`     Drive ID: ${screenshot.driveFileId}`);
              console.log(`     Link: ${screenshot.webViewLink}`);
              console.log('');
            } else {
              console.log(`  ${index + 1}. ❌ Error: ${screenshot.error}`);
              console.log('');
            }
          });
        }
      }

      console.log('🎉 Proceso completado exitosamente!');
      process.exit(0);
    } else {
      console.log('❌ ERROR!');
      console.log('');
      console.log(`Error: ${data.error}`);
      if (data.details) {
        console.log(`Detalles: ${data.details}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    
    // Mostrar stack trace completo para debugging
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');

    if (error.code === 'ECONNREFUSED') {
      console.error('No se pudo conectar con el servidor.');
      console.error(`Asegúrate de que el servidor esté corriendo en ${BASE_URL}`);
      console.error('Puedes iniciarlo con: npm run dev');
    } else if (error.response) {
      // El servidor respondió con un error
      console.error(`Estado: ${error.response.status}`);
      console.error('Respuesta:', error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      console.error('Timeout: La petición tardó demasiado.');
      console.error('Los screenshots pueden tardar varios minutos en generarse.');
    } else {
      console.error('Error desconocido:', error);
    }

    process.exit(1);
  }
}

// Ejecutar
generateScreenshots();
