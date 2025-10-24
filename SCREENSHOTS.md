# 📸 Generación de Screenshots

## Script automático para generar screenshots del día actual

### 🚀 Uso

#### **Opción 1: Con npm (recomendado)**
```bash
npm run screenshots
```

#### **Opción 2: Directamente con Node**
```bash
node generate-screenshots-today.js
```

#### **Opción 3: Como ejecutable**
```bash
./generate-screenshots-today.js
```

### 📋 Requisitos previos

1. **Servidor corriendo**: El servidor debe estar ejecutándose en `http://localhost:3000`
   ```bash
   npm run dev
   ```

2. **JSONs existentes**: Debe existir el archivo JSON del día actual (ej: `2025-10-23.json`) en Google Drive con las campañas a procesar.

### 🎯 ¿Qué hace el script?

1. ✅ Obtiene la fecha actual automáticamente
2. ✅ Llama al endpoint `/generate-screenshot` sin especificar fechas
3. ✅ El servidor procesa TODOS los registros del día actual (desktop y mobile)
4. ✅ Genera screenshots para cada campaña
5. ✅ Muestra un resumen detallado de los resultados

### 📊 Salida del script

```
🚀 Iniciando generación de screenshots...
📅 Fecha: 2025-10-23
🌐 Servidor: http://localhost:3000

📡 Estado: 200

✅ SUCCESS!

📊 8 screenshots generados exitosamente (4 desktop, 4 mobile) para 1 fecha(s)

🖥️  DESKTOP SCREENSHOTS:
  1. 2025-10-23-15-48-22-A.png
     Tipo: A
     Drive ID: 1abc123...
     Link: https://drive.google.com/file/d/1abc123.../view

  2. 2025-10-23-15-48-23-B.png
     Tipo: B
     Drive ID: 1def456...
     Link: https://drive.google.com/file/d/1def456.../view

  3. 2025-10-23-15-48-24-C.png
     Tipo: C
     Drive ID: 1ghi789...
     Link: https://drive.google.com/file/d/1ghi789.../view

  4. 2025-10-23-15-48-25-D.png
     Tipo: D
     Drive ID: 1jkl012...
     Link: https://drive.google.com/file/d/1jkl012.../view

📱 MOBILE SCREENSHOTS:
  1. 2025-10-23-15-48-30.png
     Drive ID: 1mno345...
     Link: https://drive.google.com/file/d/1mno345.../view

🎉 Proceso completado exitosamente!
```

### ⚠️ Errores comunes

#### **Error: ECONNREFUSED**
```
❌ Error de conexión: connect ECONNREFUSED 127.0.0.1:3000

Asegúrate de que el servidor esté corriendo en http://localhost:3000
Puedes iniciarlo con: npm run dev
```

**Solución**: Inicia el servidor primero:
```bash
npm run dev
```

#### **Error: No se encontró JSON**
```
⚠️ No se encontró JSON para 2025-10-23, saltando...
```

**Solución**: Sube las campañas del día actual primero usando la interfaz web.

### 🔧 Configuración

El script usa variables de entorno del archivo `.env`. Puedes configurar:

#### **Variables disponibles**:

```bash
# .env
PORT=3000                              # Puerto del servidor
HOST=localhost                         # Host del servidor
BASE_URL=http://localhost:3000         # URL completa (opcional)
```

#### **Configuración para producción**:

```bash
# .env (producción)
BASE_URL=https://tu-dominio.com
```

#### **Configuración para desarrollo local**:

```bash
# .env (local)
PORT=3000
HOST=localhost
# BASE_URL se construye automáticamente
```

Si no especificas las variables, usa valores por defecto:
- `HOST`: `localhost`
- `PORT`: `3000`
- `BASE_URL`: `http://localhost:3000`

### 🤖 Automatización con cron

Para ejecutar el script automáticamente todos los días a las 9:00 AM:

```bash
# Editar crontab
crontab -e

# Agregar esta línea
0 9 * * * cd /Users/yevelez/fury_4/andes/image-uploader && npm run screenshots >> /tmp/screenshots.log 2>&1
```

### 📝 Notas

- El script usa la fecha actual del sistema
- Genera screenshots tanto para desktop como para mobile
- Los screenshots se suben automáticamente a Google Drive
- El HTML de la página también se guarda (solo para fecha actual)

### 🆘 Soporte

Si encuentras algún problema:
1. Verifica que el servidor esté corriendo
2. Revisa los logs del servidor
3. Asegúrate de que exista el JSON del día actual
4. Verifica la conexión a Google Drive API
