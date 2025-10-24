require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

// Script para generar token de OAuth 2.0

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

async function generateToken() {
  console.log('\n🔐 Generador de Token OAuth 2.0 para Google Drive\n');
  
  // Verificar si existe el archivo de credenciales
  if (!fs.existsSync('credentials.json')) {
    console.error('❌ Error: No se encontró el archivo credentials.json');
    console.log('\n📝 Pasos para obtener credentials.json:\n');
    console.log('1. Ve a https://console.cloud.google.com/');
    console.log('2. Selecciona tu proyecto');
    console.log('3. Ve a "APIs & Services" → "Credentials"');
    console.log('4. Clic en "+ CREATE CREDENTIALS" → "OAuth client ID"');
    console.log('5. Tipo: "Desktop app" o "Web application"');
    console.log('6. Descarga el JSON y guárdalo como "credentials.json" en esta carpeta\n');
    return;
  }

  const credentials = JSON.parse(fs.readFileSync('credentials.json'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  // Para credenciales web sin redirect_uris configurado, usar urn:ietf:wg:oauth:2.0:oob
  const redirectUri = redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob';
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('📋 Autoriza esta app visitando esta URL:\n');
  console.log(authUrl);
  console.log('\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Ingresa el código de autorización que obtuviste: ', async (code) => {
    rl.close();
    
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      // Guardar el token
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      console.log('\n✅ Token guardado en', TOKEN_PATH);
      console.log('\n🎉 ¡Listo! Ahora puedes usar OAuth 2.0 con tu aplicación.\n');
      
      // Mostrar información para el .env
      console.log('📝 Agrega estas líneas a tu archivo .env:\n');
      console.log(`GOOGLE_CLIENT_ID=${client_id}`);
      console.log(`GOOGLE_CLIENT_SECRET=${client_secret}`);
      console.log(`GOOGLE_REDIRECT_URI=${redirect_uris[0]}`);
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      
    } catch (error) {
      console.error('\n❌ Error al obtener el token:', error.message);
    }
  });
}

generateToken();
