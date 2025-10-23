require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const streamifier = require('streamifier');
const sharp = require('sharp');

// Aplicar plugin stealth para evitar detección
puppeteer.use(StealthPlugin());

// Función para autorizar con Google Drive
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

// Función para subir archivo a Google Drive
async function uploadBufferToDrive(driveClient, folderId, fileName, buffer, mimeType) {
    const fileMetadata = {
        name: fileName,
        parents: [folderId],
    };

    const media = {
        mimeType: mimeType,
        body: streamifier.createReadStream(buffer),
    };

    try {
        const response = await driveClient.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
        });
        console.log(`✅ File uploaded to Google Drive: ${fileName} (ID: ${response.data.id})`);
        return response.data;
    } catch (error) {
        console.error('❌ Error uploading to Google Drive:', error.message);
        throw error;
    }
}

// Función principal de scraping
async function scrapeLosAndes(deviceType = 'desktop', capturasFolderId, visualizationType = null, jsonData = null) {
    console.log('🚀 Iniciando scraper de Los Andes...');
    console.log(`📱 Tipo de dispositivo: ${deviceType}`);
    if (visualizationType) {
        console.log(`🎨 Tipo de visualización: ${visualizationType}`);
    }
    if (jsonData) {
        console.log(`📄 Datos JSON recibidos para insertar imágenes`);
    }
    
    let browser;
    try {
        // Configuración de viewport según tipo de dispositivo
        const isMobile = deviceType === 'mobile';
        const viewportConfig = isMobile ? {
            width: 375,
            height: 812,
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
            isLandscape: false
        } : {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: true
        };

        // Configuración antibaneo de Puppeteer
        browser = await puppeteer.launch({
            headless: false, // Mostrar el navegador
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                `--window-size=${viewportConfig.width},${viewportConfig.height}`
            ],
            defaultViewport: viewportConfig,
            protocolTimeout: 180000, // 3 minutos
            ignoreHTTPSErrors: true,
            dumpio: false
        });

        const page = await browser.newPage();

        // Configuraciones adicionales antibaneo
        const userAgent = isMobile 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);
        
        // Ocultar webdriver
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Sobrescribir el objeto navigator.plugins
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
        });

        // Sobrescribir navigator.languages
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'languages', {
                get: () => ['es-AR', 'es', 'en-US', 'en'],
            });
        });

        // Configurar permisos
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://www.losandes.com.ar', ['geolocation', 'notifications']);

        console.log('🌐 Navegando a Los Andes...');
        
        // Navegar a la página con timeout extendido y manejo de errores
        try {
            await page.goto('https://www.losandes.com.ar/', {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });
            console.log('✅ Página cargada exitosamente');
        } catch (navError) {
            console.warn('⚠️ Error en navegación inicial, reintentando...');
            await page.goto('https://www.losandes.com.ar/', {
                waitUntil: 'load',
                timeout: 90000
            });
            console.log('✅ Página cargada en segundo intento');
        }

        // Esperar un poco para que todo cargue completamente
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Remover publicidad (aplica a todos los tipos de visualización y dispositivos)
        console.log('🧹 Removiendo publicidades...');
        await page.evaluate(() => {
            // Remover OneSignal dialog
            const oneSignal = document.querySelector('#onesignal-slidedown-dialog');
            if (oneSignal) oneSignal.remove();
            
            // Remover todos los iframes
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => iframe.remove());
            
            // Remover banners
            const banners = document.querySelectorAll('.banner.banner--align-center.banner--no-background');
            banners.forEach(banner => banner.remove());
            
            // Remover amp-sticky-ad
            const ampStickyAds = document.querySelectorAll('amp-sticky-ad');
            ampStickyAds.forEach(ad => ad.remove());
            
            // Remover Google Active View containers
            const googleContainers = document.querySelectorAll('.GoogleActiveViewInnerContainer');
            googleContainers.forEach(container => container.remove());
            
            // Remover banner content wrappers
            const bannerWrappers = document.querySelectorAll('.banner__content-wrapper');
            bannerWrappers.forEach(wrapper => wrapper.remove());
            
            // Remover tags <ins> (anuncios)
            const insElements = document.querySelectorAll('ins');
            insElements.forEach(ins => ins.remove());
            
            console.log('✅ Publicidades removidas');
        });
        
        console.log('✅ Publicidades removidas del DOM');

        // Si es tipo A desktop y hay datos JSON, insertar imágenes
        if (deviceType === 'desktop' && visualizationType === 'A' && jsonData) {
            console.log('🖼️ Insertando imágenes para visualización tipo A...');
            
            // Hacer scroll a 400px
            console.log('📜 Haciendo scroll a 400px...');
            await page.evaluate(() => {
                window.scrollTo(0, 400);
            });
            
            // Esperar un poco después del scroll
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Insertar imágenes en la página
            await page.evaluate((data) => {
                const navbarHeight = 68;
                
                // Obtener el elemento de referencia para imagen lateral
                const referenceElement = document.querySelector('.row.row--eq-height .col-12.col-md-9 .news-article--featured-listing-large-container');
                
                if (!referenceElement) {
                    console.error('❌ No se encontró el elemento de referencia para imagen lateral');
                    return;
                }
                
                const refRect = referenceElement.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                
                // Calcular espacio disponible debajo del navbar
                const availableHeight = viewportHeight - navbarHeight;
                
                // Insertar imagen lateral si existe
                if (data.imagenLateral) {
                    const imgLateral = document.createElement('img');
                    imgLateral.src = data.imagenLateral;
                    imgLateral.style.position = 'fixed';
                    imgLateral.style.left = (refRect.right + 30) + 'px';
                    imgLateral.style.zIndex = '9999';
                    imgLateral.id = 'inserted-imagen-lateral';
                    
                    // Cargar imagen para obtener dimensiones
                    imgLateral.onload = function() {
                        // Centrar verticalmente en el espacio disponible
                        const imgHeight = this.naturalHeight;
                        const topPosition = navbarHeight + (availableHeight - imgHeight) / 2;
                        this.style.top = topPosition + 'px';
                        console.log('✅ Imagen lateral insertada');
                    };
                    
                    document.body.appendChild(imgLateral);
                }
                
                // Insertar imagen ancho si existe
                if (data.imagenAncho) {
                    const rowElement = document.querySelector('.row.row--eq-height .col-12.col-md-9 .row.news-article-wrapper');
                    if (rowElement) {
                        const rowRect = rowElement.getBoundingClientRect();
                        
                        const imgAncho = document.createElement('img');
                        imgAncho.src = data.imagenAncho;
                        imgAncho.style.position = 'fixed';
                        imgAncho.style.top = (rowRect.bottom + 30) + 'px';
                        imgAncho.style.left = '50%';
                        imgAncho.style.transform = 'translateX(-50%)';
                        imgAncho.style.zIndex = '9999';
                        imgAncho.id = 'inserted-imagen-ancho';
                        
                        imgAncho.onload = function() {
                            console.log('✅ Imagen ancho insertada');
                        };
                        
                        document.body.appendChild(imgAncho);
                    }
                }
            }, jsonData);
            
            // Esperar a que las imágenes se carguen
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('✅ Imágenes insertadas correctamente');
        }

        console.log('📸 Tomando screenshot...');
        
        // Tomar screenshot
        const screenshotBuffer = await page.screenshot({
            type: 'png',
            fullPage: false // Solo la parte visible
        });

        console.log('🎨 Procesando imagen con barra de Chrome...');
        
        // Obtener metadata del screenshot original
        const screenshotMetadata = await sharp(screenshotBuffer).metadata();
        const screenshotWidth = screenshotMetadata.width;
        const screenshotHeight = screenshotMetadata.height;
        
        // Altura de la barra de Chrome
        const chromeBarHeight = 248;
        
        // Ruta de la barra de Chrome
        const chromeBarPath = path.join(__dirname, 'public', 'images', 'bar1.png');
        
        // Verificar que existe la imagen de la barra
        if (!fs.existsSync(chromeBarPath)) {
            console.warn('⚠️ No se encontró bar1.png, continuando sin barra...');
            var finalScreenshot = screenshotBuffer;
        } else {
            // Generar fecha y hora en formato "Mié 22 de oct. 10:24 p.m."
            const now = new Date();
            const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            
            const diaSemana = diasSemana[now.getDay()];
            const dia = now.getDate();
            const mes = meses[now.getMonth()];
            let horas = now.getHours();
            const minutos = String(now.getMinutes()).padStart(2, '0');
            const periodo = horas >= 12 ? 'p.m.' : 'a.m.';
            
            // Convertir a formato 12 horas
            if (horas > 12) horas -= 12;
            if (horas === 0) horas = 12;
            
            const fechaHora = `${diaSemana} ${dia} de ${mes}. ${horas}:${minutos} ${periodo}`;
            console.log(`🕐 Fecha y hora: ${fechaHora}`);
            
            // Escapar caracteres especiales para XML/SVG
            const escapedFechaHora = fechaHora
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            
            // Redimensionar la barra de Chrome al ancho exacto del screenshot
            // manteniendo el aspect ratio (solo ajustar el ancho)
            const resizedChromeBar = await sharp(chromeBarPath)
                .resize(screenshotWidth, null, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 1 }
                })
                .toBuffer();
            
            // Obtener la altura real de la barra redimensionada
            const resizedBarMetadata = await sharp(resizedChromeBar).metadata();
            const actualBarHeight = resizedBarMetadata.height;
            
            console.log(`📏 Barra redimensionada: ${screenshotWidth}x${actualBarHeight}px (original: 3022x248px)`);
            
            // Crear SVG con el texto de fecha y hora
            // Estilo de macOS: SF Pro Display, color #E5E5E5 (gris claro)
            const fontSize = Math.round(screenshotWidth * 0.0095); // ~18px para 1920px de ancho
            const textColor = '#E5E5E5';
            const textPadding = Math.round(screenshotWidth * 0.012); // ~23px para 1920px
            
            // Posicionar el texto en la parte negra superior de la barra
            // La parte negra ocupa aproximadamente los primeros 40px de los 248px originales
            // Proporcionalmente: 40/248 = 0.161 de la altura total
            const blackBarProportion = 0.161;
            const blackBarHeight = actualBarHeight * blackBarProportion;
            // Centrar verticalmente: mitad de la altura de la barra negra + mitad del tamaño de fuente
            const textVerticalPosition = Math.round((blackBarHeight / 2) + (fontSize / 2.5));
            
            const svgText = `<svg width="${screenshotWidth}" height="${actualBarHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <style type="text/css">
            .datetime {
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                font-size: ${fontSize}px;
                font-weight: 500;
                fill: ${textColor};
            }
        </style>
    </defs>
    <text x="${screenshotWidth - textPadding}" y="${textVerticalPosition}" class="datetime" text-anchor="end">${escapedFechaHora}</text>
</svg>`;
            
            const textOverlay = Buffer.from(svgText);
            
            // Crear una imagen nueva con altura aumentada (screenshot + barra de Chrome)
            const newHeight = screenshotHeight + actualBarHeight;
            
            // Combinar: barra de Chrome arriba + screenshot original desplazado abajo + texto
            var finalScreenshot = await sharp({
                create: {
                    width: screenshotWidth,
                    height: newHeight,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                }
            })
            .composite([
                { input: resizedChromeBar, top: 0, left: 0 },
                { input: textOverlay, top: 0, left: 0 },
                { input: screenshotBuffer, top: actualBarHeight, left: 0 }
            ])
            .png()
            .toBuffer();
            
            console.log('✅ Barra de Chrome con fecha y hora agregada al screenshot');
            console.log(`📐 Dimensiones finales: ${screenshotWidth}x${newHeight} (original: ${screenshotWidth}x${screenshotHeight})`);
        }

        // Generar nombre de archivo con timestamp, tipo de dispositivo y visualización
        // Formato: YYYY-MM-DD-HH-MM-SS-[tipo_visualizacion].png
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
        
        // Agregar tipo de visualización al nombre si está definido
        const visualizationSuffix = visualizationType ? `-${visualizationType}` : '';
        const fileName = `${timestamp}${visualizationSuffix}.png`;

        // Guardar localmente primero (opcional, para backup)
        const localPath = path.join(__dirname, 'screenshots', fileName);
        
        // Crear directorio si no existe
        if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
            fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
        }
        
        fs.writeFileSync(localPath, finalScreenshot);
        console.log(`✅ Screenshot guardado localmente: ${localPath}`);

        // Subir a Google Drive
        console.log('☁️  Subiendo a Google Drive...');
        const auth = await authorize();
        const driveClient = google.drive({ version: 'v3', auth });
        
        // ID de la carpeta de capturas en Drive
        const targetFolderId = capturasFolderId || "1pU3cEM7o0uzIvwSapmsF4YYX5lOiSYEs";
        
        const driveFile = await uploadBufferToDrive(
            driveClient,
            targetFolderId,
            fileName,
            finalScreenshot,
            'image/png'
        );

        console.log(`✅ Screenshot subido a Google Drive exitosamente!`);
        console.log(`📁 Drive ID: ${driveFile.id}`);
        console.log(`🔗 Link: ${driveFile.webViewLink}`);

        const result = {
            success: true,
            deviceType: deviceType,
            fileName: fileName,
            localPath: localPath,
            driveId: driveFile.id,
            driveLink: driveFile.webViewLink
        };
        
        // Agregar tipo de visualización si está definido
        if (visualizationType) {
            result.visualizationType = visualizationType;
        }
        
        return result;

    } catch (error) {
        console.error('❌ Error durante el scraping:', error);
        throw error;
    } finally {
        if (browser) {
            try {
                const pages = await browser.pages();
                await Promise.all(pages.map(page => page.close().catch(e => console.log('Error cerrando página:', e.message))));
                await browser.close();
                console.log('🔒 Browser cerrado correctamente');
            } catch (closeError) {
                console.warn('⚠️ Error al cerrar browser:', closeError.message);
                try {
                    await browser.process()?.kill('SIGKILL');
                } catch (killError) {
                    console.warn('⚠️ Error al forzar cierre:', killError.message);
                }
            }
        }
    }
}

module.exports = { scrapeLosAndes };
