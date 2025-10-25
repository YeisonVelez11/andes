require('dotenv').config();
const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const streamifier = require('streamifier');
const sharp = require('sharp');

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
async function scrapeLosAndes(deviceType = 'desktop', capturasFolderId, visualizationType = null, jsonData = null, targetDate = null) {
    console.log('🚀 Iniciando scraper de Los Andes...');
    console.log(`📱 Tipo de dispositivo: ${deviceType}`);
    if (targetDate) {
        console.log(`📅 Fecha objetivo: ${targetDate}`);
    }
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
            width: 400,
            height: 820,
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

        // Configuración antibaneo de Puppeteer (compatible con Linux sin GUI)
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--single-process",
                "--no-zygote",
                `--window-size=${viewportConfig.width},${viewportConfig.height}`
            ],
            headless: "true",
            executablePath:
              process.env.NODE_ENV === "production"
                ? process.env.PUPPETEER_EXECUTABLE_PATH
                : puppeteer.executablePath(),
            defaultViewport: viewportConfig,
        });

        const page = await browser.newPage();

        // Configuraciones adicionales antibaneo
        const userAgent = isMobile 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);
        
        // Agregar header para ngrok
        await page.setExtraHTTPHeaders({
            'ngrok-skip-browser-warning': 'true'
        });
        
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

        // Si hay una fecha objetivo, cargar HTML guardado en lugar de la página en vivo
        if (targetDate) {
            console.log(`📂 Cargando HTML guardado para la fecha: ${targetDate}`);
            
            try {
                // Conectar con Google Drive
                const driveClient = google.drive({ version: 'v3', auth: await authorize() });
                const htmlFolderId = '1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49';
                const fileName = `${targetDate}_${deviceType}.html`;
                
                console.log(`🔍 Buscando archivo: ${fileName}`);
                
                // Buscar el archivo HTML
                const fileList = await driveClient.files.list({
                    q: `name='${fileName}' and '${htmlFolderId}' in parents and trashed=false`,
                    fields: 'files(id, name)',
                    spaces: 'drive'
                });
                
                if (fileList.data.files.length === 0) {
                    console.warn(`⚠️ No se encontró HTML para ${targetDate}, cargando página en vivo...`);
                    throw new Error('HTML no encontrado');
                }
                
                const fileId = fileList.data.files[0].id;
                console.log(`✅ Archivo encontrado: ${fileName} (ID: ${fileId})`);
                
                // Descargar el contenido del HTML
                const response = await driveClient.files.get(
                    { fileId: fileId, alt: 'media' },
                    { responseType: 'text' }
                );
                
                const htmlContent = response.data;
                console.log(`📄 HTML descargado (${htmlContent.length} caracteres)`);
                
                // Cargar el HTML en la página
                await page.setContent(htmlContent, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                
                // Esperar a que los estilos se apliquen
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Forzar aplicación de estilos mobile si es necesario
                if (isMobile) {
                    await page.evaluate(() => {
                        // Forzar que el body tenga la clase mobile
                        document.body.classList.add('home-mobile');
                        document.body.classList.remove('home-desktop');
                        
                        // Ocultar elementos desktop y mostrar elementos mobile
                        const desktopElements = document.querySelectorAll('[class*="--desktop"]');
                        desktopElements.forEach(el => {
                            el.style.display = 'none';
                        });
                        
                        const mobileElements = document.querySelectorAll('[class*="--mobile"]');
                        mobileElements.forEach(el => {
                            el.style.display = '';
                        });
                        
                        // Disparar evento resize
                        window.dispatchEvent(new Event('resize'));
                        // Forzar reflow
                        document.body.offsetHeight;
                    });
                    
                    console.log('🔄 Estilos mobile forzados en HTML histórico');
                }
                
                // Esperar otro momento para que los cambios se apliquen
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('✅ HTML histórico cargado exitosamente');
                console.log(`📱 Viewport configurado: ${isMobile ? 'Mobile' : 'Desktop'} (${viewportConfig.width}x${viewportConfig.height})`);
                
            } catch (htmlError) {
                console.error(`❌ Error cargando HTML histórico: ${htmlError.message}`);
                console.log('🌐 Fallback: Cargando página en vivo...');
                
                // Fallback a página en vivo
                await page.goto('https://www.losandes.com.ar/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 90000
                });
                console.log('✅ Página en vivo cargada como fallback');
            }
        } else {
            console.log('🌐 Navegando a Los Andes (página en vivo)...');
            
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
            
            // Hacer scroll a 200px
            console.log('📜 Haciendo scroll a 200px...');
            await page.evaluate(() => {
                window.scrollTo(0, 250);
            });
            
            // Esperar un poco después del scroll
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Insertar imágenes en la página
            const insertResult = await page.evaluate((data) => {
                return new Promise((resolve) => {
                    const navbarHeight = 68;
                    const results = {
                        lateral: { found: false, inserted: false, error: null },
                        ancho: { found: false, inserted: false, error: null }
                    };
                    
                    // Obtener el elemento de referencia para imagen lateral
                    const referenceElement = document.querySelector('.row.row--eq-height .col-12.col-md-9 .news-article--featured-listing-large-container');
                    
                    if (!referenceElement) {
                        results.lateral.error = 'No se encontró el elemento de referencia';
                        console.error('❌ No se encontró el elemento de referencia para imagen lateral');
                        console.log('Intentando selector alternativo...');
                        
                        // Intentar selector alternativo
                        const altElement = document.querySelector('.row.row--eq-height .col-12.col-md-9');
                        if (altElement) {
                            console.log('✅ Encontrado selector alternativo');
                            results.lateral.found = true;
                            results.lateral.refRect = altElement.getBoundingClientRect();
                        }
                    } else {
                        results.lateral.found = true;
                        results.lateral.refRect = referenceElement.getBoundingClientRect();
                        console.log('✅ Elemento de referencia encontrado:', results.lateral.refRect);
                    }
                    
                    const refRect = results.lateral.refRect;
                    const viewportHeight = window.innerHeight;
                    const availableHeight = viewportHeight - navbarHeight;
                    
                    let imagesLoaded = 0;
                    const totalImages = (data.imagenLateral ? 1 : 0) + (data.imagenAncho ? 1 : 0);
                    
                    function checkComplete() {
                        if (imagesLoaded >= totalImages) {
                            resolve(results);
                        }
                    }
                    
                    // Insertar imagen lateral si existe
                    if (data.imagenLateral && refRect) {
                        // Buscar el elemento de referencia para posicionamiento
                        const targetElement = document.querySelector('.simple-news-column-without-image.simple-news-column-without-image--with-title');
                        
                        const imgLateral = document.createElement('img');
                        imgLateral.crossOrigin = 'anonymous';
                        imgLateral.src = data.imagenLateral;
                        imgLateral.style.position = 'absolute';
                        imgLateral.style.left = (refRect.right + 25 + window.scrollX) + 'px';
                        imgLateral.style.zIndex = '9999';
                        imgLateral.id = 'inserted-imagen-lateral';
                        
                        imgLateral.onload = function() {
                            let topPosition;
                            
                            if (targetElement) {
                                // Posicionar a 5px del bottom del elemento target
                                const targetRect = targetElement.getBoundingClientRect();
                                topPosition = targetRect.bottom + 5 + window.scrollY;
                                console.log('✅ Elemento target encontrado, posicionando a 5px de su bottom');
                            } else {
                                // Fallback: centrado vertical (comportamiento anterior)
                                const imgHeight = this.height;
                                topPosition = navbarHeight + (availableHeight - imgHeight) / 2 + window.scrollY;
                                console.log('⚠️ Elemento target no encontrado, usando posición centrada');
                            }
                            
                            this.style.top = topPosition + 'px';
                            results.lateral.inserted = true;
                            results.lateral.position = { left: this.style.left, top: this.style.top };
                            console.log('✅ Imagen lateral insertada en:', this.style.left, this.style.top);
                            imagesLoaded++;
                            checkComplete();
                        };
                        
                        imgLateral.onerror = function() {
                            results.lateral.error = 'Error al cargar imagen';
                            console.error('❌ Error al cargar imagen lateral');
                            imagesLoaded++;
                            checkComplete();
                        };
                        
                        document.body.appendChild(imgLateral);
                    } else {
                        if (!data.imagenLateral) imagesLoaded++;
                    }
                    
                    // Insertar imagen ancho si existe
                    if (data.imagenAncho) {
                        const rowElement = document.querySelector('.row.row--eq-height .col-12.col-md-9 .row.news-article-wrapper');
                        if (rowElement) {
                            results.ancho.found = true;
                            const rowRect = rowElement.getBoundingClientRect();
                            results.ancho.refRect = rowRect;
                            
                            const imgAncho = document.createElement('img');
                            imgAncho.crossOrigin = 'anonymous';
                            imgAncho.src = data.imagenAncho;
                            imgAncho.style.position = 'absolute';
                            imgAncho.style.top = (rowRect.bottom + 30 + window.scrollY) + 'px';
                            imgAncho.style.left = '50%';
                            imgAncho.style.transform = 'translateX(-50%)';
                            imgAncho.style.zIndex = '9999';
                            imgAncho.id = 'inserted-imagen-ancho';
                            
                            imgAncho.onload = function() {
                                results.ancho.inserted = true;
                                results.ancho.position = { left: this.style.left, top: this.style.top };
                                
                                // Agregar margin-bottom al rowElement del tamaño de la imagen + 20px
                                const imgHeight = this.height;
                                const marginBottom = (imgHeight ) + 30;
                                rowElement.style.marginBottom = marginBottom + 'px';
                                
                                console.log('✅ Imagen ancho insertada en:', this.style.left, this.style.top);
                                console.log('📏 Margin-bottom agregado al elemento:', marginBottom + 'px', '(imagen:', imgHeight + 'px + 20px)');
                                
                                imagesLoaded++;
                                checkComplete();
                            };
                            
                            imgAncho.onerror = function() {
                                results.ancho.error = 'Error al cargar imagen';
                                console.error('❌ Error al cargar imagen ancho');
                                imagesLoaded++;
                                checkComplete();
                            };
                            
                            document.body.appendChild(imgAncho);
                        } else {
                            results.ancho.error = 'No se encontró el elemento .row.news-article-wrapper';
                            console.error('❌ No se encontró el elemento para imagen ancho');
                            imagesLoaded++;
                            checkComplete();
                        }
                    } else {
                        imagesLoaded++;
                    }
                    
                    // Timeout de seguridad
                    setTimeout(() => {
                        resolve(results);
                    }, 5000);
                });
            }, jsonData);
            
            console.log('📊 Resultado de inserción de imágenes:', JSON.stringify(insertResult, null, 2));
            
            // Esperar a que las imágenes se carguen completamente
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✅ Proceso de inserción de imágenes completado');
        }

        // Si es tipo B desktop y hay datos JSON, insertar imagen lateral
        if (deviceType === 'desktop' && visualizationType === 'B' && jsonData) {
            console.log('🖼️ Insertando imágenes para visualización tipo B...');
            
            // Obtener la posición del elemento de referencia y hacer scroll
            const scrollPosition = await page.evaluate(() => {
                const referenceElement = document.querySelector('.row.news-article__small-listing-with-grouper-cont');
                if (!referenceElement) {
                    console.error('❌ No se encontró el elemento de referencia para tipo B');
                    return null;
                }
                
                const rect = referenceElement.getBoundingClientRect();
                const scrollTop = window.scrollY + rect.top - 150;
                
                console.log('📍 Elemento encontrado, scrollTop calculado:', scrollTop);
                return scrollTop;
            });
            
            if (scrollPosition !== null) {
                console.log(`📜 Haciendo scroll a ${scrollPosition}px...`);
                await page.evaluate((scrollPos) => {
                    window.scrollTo(0, scrollPos);
                }, scrollPosition);
                
                // Esperar un poco después del scroll
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Insertar imagen lateral
                const insertResult = await page.evaluate((data) => {
                    return new Promise((resolve) => {
                        const results = {
                            lateral: { found: false, inserted: false, error: null }
                        };
                        
                        // Obtener el elemento de referencia
                        const referenceElement = document.querySelector('.row.news-article__small-listing-with-grouper-cont');
                        
                        if (!referenceElement) {
                            results.lateral.error = 'No se encontró el elemento de referencia';
                            console.error('❌ No se encontró el elemento de referencia para imagen lateral');
                            resolve(results);
                            return;
                        }
                        
                        results.lateral.found = true;
                        const refRect = referenceElement.getBoundingClientRect();
                        results.lateral.refRect = refRect;
                        console.log('✅ Elemento de referencia encontrado:', refRect);
                        
                        // Insertar imagen lateral si existe
                        if (data.imagenLateral) {
                            const imgLateral = document.createElement('img');
                            imgLateral.crossOrigin = 'anonymous';
                            imgLateral.src = data.imagenLateral;
                            imgLateral.style.position = 'absolute';
                            imgLateral.style.left = (refRect.right + 30 + window.scrollX) + 'px';
                            imgLateral.style.top = (refRect.top + window.scrollY) + 'px';
                            imgLateral.style.zIndex = '9999';
                            imgLateral.id = 'inserted-imagen-lateral-b';
                            
                            imgLateral.onload = function() {
                                results.lateral.inserted = true;
                                results.lateral.position = { left: this.style.left, top: this.style.top };
                                console.log('✅ Imagen lateral insertada en:', this.style.left, this.style.top);
                                resolve(results);
                            };
                            
                            imgLateral.onerror = function() {
                                results.lateral.error = 'Error al cargar imagen';
                                console.error('❌ Error al cargar imagen lateral');
                                resolve(results);
                            };
                            
                            document.body.appendChild(imgLateral);
                        } else {
                            resolve(results);
                        }
                        
                        // Timeout de seguridad
                        setTimeout(() => {
                            resolve(results);
                        }, 5000);
                    });
                }, jsonData);
                
                console.log('📊 Resultado de inserción de imágenes tipo B:', JSON.stringify(insertResult, null, 2));
                
                // Esperar a que las imágenes se carguen completamente
                await new Promise(resolve => setTimeout(resolve, 3000));
                console.log('✅ Proceso de inserción de imágenes tipo B completado');
            }
        }

        // Si es tipo C desktop y hay datos JSON, insertar imagen top
        if (deviceType === 'desktop' && visualizationType === 'C' && jsonData) {
            console.log('🖼️ Insertando imágenes para visualización tipo C...');
            
            // Hacer scroll a 0px (top de la página)
            console.log('📜 Haciendo scroll a 0px (top)...');
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            
            // Esperar un poco después del scroll
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Agregar margin-top al body para tipo C
            console.log('📐 Agregando margin-top: 100px al body...');
            await page.evaluate(() => {
                document.body.style.setProperty('margin-top', '100px', 'important');
            });
            
            // Esperar un momento para que se aplique el estilo
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Insertar imagen top centrada horizontalmente
            const insertResult = await page.evaluate((data) => {
                return new Promise((resolve) => {
                    const results = {
                        top: { found: false, inserted: false, error: null }
                    };
                    
                    // Insertar imagen top si existe
                    if (data.imagenTop) {
                        const imgTop = document.createElement('img');
                        imgTop.crossOrigin = 'anonymous';
                        imgTop.src = data.imagenTop;
                        imgTop.style.position = 'fixed'; // Usar fixed para que no se vea afectada por el margin del body
                        imgTop.style.left = '50%';
                        imgTop.style.transform = 'translateX(-50%)';
                        imgTop.style.top = '0px'; // Mantener en el top real
                        imgTop.style.zIndex = '9999';
                        imgTop.id = 'inserted-imagen-top-c';
                        
                        imgTop.onload = function() {
                            results.top.inserted = true;
                            results.top.position = { left: this.style.left, top: this.style.top };
                            console.log('✅ Imagen top insertada en:', this.style.left, this.style.top);
                            resolve(results);
                        };
                        
                        imgTop.onerror = function() {
                            results.top.error = 'Error al cargar imagen';
                            console.error('❌ Error al cargar imagen top');
                            resolve(results);
                        };
                        
                        document.body.appendChild(imgTop);
                    } else {
                        results.top.error = 'No hay imagen top en los datos';
                        resolve(results);
                    }
                    
                    // Timeout de seguridad
                    setTimeout(() => {
                        resolve(results);
                    }, 5000);
                });
            }, jsonData);
            
            console.log('📊 Resultado de inserción de imágenes tipo C:', JSON.stringify(insertResult, null, 2));
            
            // Esperar a que las imágenes se carguen completamente
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✅ Proceso de inserción de imágenes tipo C completado');
        }

        // Si es tipo D desktop y hay datos JSON, crear overlay con imagen ITT
        if (deviceType === 'desktop' && visualizationType === 'D' && jsonData) {
            console.log('🖼️ Insertando imágenes para visualización tipo D...');
            
            // Quitar scroll del html y body
            console.log('🚫 Quitando scroll de html y body...');
            await page.evaluate(() => {
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                console.log('✅ Scroll removido de html y body');
            });
            
            // Hacer scroll a 0px
            console.log('📜 Haciendo scroll a 0px...');
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            
            // Esperar un poco después del scroll
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Leer la imagen x_itt.png y convertirla a base64
            const xIconPath = path.join(__dirname, 'public', 'images', 'x_itt.png');
            const xIconBuffer = fs.readFileSync(xIconPath);
            const xIconBase64 = `data:image/png;base64,${xIconBuffer.toString('base64')}`;
            console.log('📷 Imagen x_itt cargada como base64');
            
            // Crear overlay con background gris e imágenes
            const insertResult = await page.evaluate((data, xIconSrc) => {
                return new Promise((resolve) => {
                    const results = {
                        overlay: { created: false, error: null },
                        itt: { inserted: false, error: null },
                        closeIcon: { inserted: false, error: null }
                    };
                    
                    try {
                        // Crear overlay con background gris
                        const overlay = document.createElement('div');
                        overlay.id = 'itt-overlay';
                        overlay.style.position = 'fixed';
                        overlay.style.top = '0';
                        overlay.style.left = '0';
                        overlay.style.width = '100vw';
                        overlay.style.height = '100vh';
                        overlay.style.backgroundColor = 'rgba(51, 51, 51, 0.85)';
                        overlay.style.zIndex = '99999';
                        overlay.style.display = 'flex';
                        overlay.style.justifyContent = 'center';
                        overlay.style.alignItems = 'center';
                        
                        document.body.appendChild(overlay);
                        results.overlay.created = true;
                        console.log('✅ Overlay creado con opacidad 0.85');
                        
                        // Contenedor para la imagen ITT y el icono X
                        const imageContainer = document.createElement('div');
                        imageContainer.style.position = 'relative';
                        imageContainer.style.maxWidth = '90%';
                        imageContainer.style.maxHeight = '90%';
                        imageContainer.style.display = 'flex';
                        imageContainer.style.justifyContent = 'center';
                        imageContainer.style.alignItems = 'center';
                        
                        overlay.appendChild(imageContainer);
                        
                        // Insertar imagen ITT centrada si existe
                        if (data.itt) {
                            const imgITT = document.createElement('img');
                            imgITT.crossOrigin = 'anonymous';
                            imgITT.src = data.itt;
                            imgITT.style.maxWidth = '100%';
                            imgITT.style.maxHeight = '100%';
                            imgITT.style.objectFit = 'contain';
                            imgITT.id = 'inserted-imagen-itt';
                            
                            imgITT.onload = function() {
                                results.itt.inserted = true;
                                console.log('✅ Imagen ITT insertada y centrada');
                                
                                // Obtener posición de la imagen ITT
                                const imgRect = this.getBoundingClientRect();
                                console.log('📍 Posición imagen ITT:', imgRect);
                                
                                // Insertar icono X en la esquina superior derecha de la imagen ITT
                                const closeIcon = document.createElement('img');
                                closeIcon.src = xIconSrc;
                                closeIcon.style.position = 'fixed';
                                closeIcon.style.zIndex = '100001';
                                closeIcon.style.cursor = 'pointer';
                                closeIcon.id = 'close-icon-itt';
                                
                                // Agregar al body
                                document.body.appendChild(closeIcon);
                                
                                closeIcon.onload = function() {
                                    const iconWidth = this.width;
                                    const iconHeight = this.height;
                                    
                                    // Reducir el tamaño del icono al 70% (más pequeño)
                                    const scaleFactor = 0.5;
                                    const scaledWidth = iconWidth * scaleFactor;
                                    const scaledHeight = iconHeight * scaleFactor;
                                    
                                    this.style.width = scaledWidth + 'px';
                                    this.style.height = scaledHeight + 'px';
                                    
                                    // Posicionar: 10px arriba del top de la imagen ITT
                                    // y alineado con el borde derecho de la imagen (5px desde el borde)
                                    this.style.top = (imgRect.top - 10 - scaledHeight) + 'px';
                                    this.style.left = ((imgRect.right - 5 - scaledWidth)  + 10 )+ 'px';
                                    
                                    results.closeIcon.inserted = true;
                                    console.log('✅ Icono X insertado en:', this.style.left, this.style.top);
                                    console.log('📏 Tamaño icono escalado:', scaledWidth + 'x' + scaledHeight);
                                    resolve(results);
                                };
                                
                                closeIcon.onerror = function() {
                                    results.closeIcon.error = 'Error al cargar icono X';
                                    console.error('❌ Error al cargar icono X');
                                    resolve(results);
                                };
                            };
                            
                            imgITT.onerror = function() {
                                results.itt.error = 'Error al cargar imagen ITT';
                                console.error('❌ Error al cargar imagen ITT');
                                resolve(results);
                            };
                            
                            imageContainer.appendChild(imgITT);
                        } else {
                            results.itt.error = 'No hay imagen ITT en los datos';
                            resolve(results);
                        }
                        
                    } catch (error) {
                        results.overlay.error = error.message;
                        console.error('❌ Error creando overlay:', error);
                        resolve(results);
                    }
                    
                    // Timeout de seguridad
                    setTimeout(() => {
                        resolve(results);
                    }, 5000);
                });
            }, jsonData, xIconBase64);
            
            console.log('📊 Resultado de inserción de imágenes tipo D:', JSON.stringify(insertResult, null, 2));
            
            // Esperar a que las imágenes se carguen completamente
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✅ Proceso de inserción de imágenes tipo D completado');
        }
        
        // ============================================================
        // MOBILE - TIPO A: IMAGEN ANCHO
        // ============================================================
        if (isMobile && visualizationType === 'A') {
            console.log('🖼️ Insertando imagen ancho para mobile tipo A...');
            
            // Buscar el elemento .simple-news-column-without-image--mobile y hacer scroll al top
            const scrollPosition = await page.evaluate(() => {
                const targetElement = document.querySelector('.simple-news-column-without-image--mobile');
                if (!targetElement) {
                    console.error('❌ No se encontró el elemento .simple-news-column-without-image--mobile');
                    return null;
                }
                
                const rect = targetElement.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                // Scroll al top del elemento
                return rect.top + scrollTop;
            });
            
            if (scrollPosition !== null) {
                console.log(`📜 Haciendo scroll a ${scrollPosition}px...`);
                await page.evaluate((scrollPos) => {
                    window.scrollTo(0, scrollPos);
                }, scrollPosition);
                
                // Esperar a que se complete el scroll
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Insertar imagen ancho
                const insertResult = await page.evaluate((data) => {
                    return new Promise((resolve) => {
                        const results = {
                            ancho: { found: false, inserted: false, error: null, position: {} }
                        };
                        
                        try {
                            const targetElement = document.querySelector('.simple-news-column-without-image--mobile');
                            
                            if (!targetElement) {
                                results.ancho.error = 'No se encontró el elemento .simple-news-column-without-image--mobile';
                                resolve(results);
                                return;
                            }
                            
                            results.ancho.found = true;
                            
                            if (data.imagenAncho) {
                                const imgAncho = document.createElement('img');
                                imgAncho.src = data.imagenAncho;
                                imgAncho.style.position = 'fixed';
                                imgAncho.style.zIndex = '9999';
                                imgAncho.style.maxWidth = '100%';
                                imgAncho.style.height = 'auto';
                                imgAncho.style.display = 'block';
                                
                                imgAncho.onload = function() {
                                    // Obtener la altura natural de la imagen ancho
                                    const imgHeight = this.naturalHeight;
                                    
                                    
                                    // Obtener la posición del elemento target
                                    const rect = targetElement.getBoundingClientRect();
                                    
                                    // Agregar margin-bottom al elemento usando la altura natural
                                    targetElement.style.marginBottom = (imgHeight + 20) +'px';
                                    
                                    // Posicionar imagen: debajo del elemento desde el top de la imagen
                                    this.style.left = '50%';
                                    this.style.transform = 'translateX(-50%)';
                                    this.style.top = (rect.bottom )+ 'px';
                                    
                                    // Agregar la imagen al DOM
                                    document.body.appendChild(this);
                                    
                                    results.ancho.inserted = true;
                                    results.ancho.position = {
                                        left: this.style.left,
                                        top: this.style.top,
                                        marginBottom: imgHeight + 'px'
                                    };
                                    
                                    console.log('✅ Imagen ancho insertada en mobile tipo A');
                                    console.log('📏 Margin-bottom agregado al elemento:', imgHeight + 'px');
                                    console.log('📍 Posición top de la imagen:', rect.bottom + 'px');
                                    resolve(results);
                                };
                                
                                imgAncho.onerror = function() {
                                    results.ancho.error = 'Error al cargar imagen ancho';
                                    console.error('❌ Error al cargar imagen ancho');
                                    resolve(results);
                                };
                            } else {
                                results.ancho.error = 'No hay imagen ancho en los datos';
                                resolve(results);
                            }
                        } catch (error) {
                            results.ancho.error = error.message;
                            console.error('❌ Error insertando imagen ancho:', error);
                            resolve(results);
                        }
                        
                        // Timeout de seguridad
                        setTimeout(() => {
                            resolve(results);
                        }, 5000);
                    });
                }, jsonData);
                
                console.log('📊 Resultado de inserción mobile tipo A:', JSON.stringify(insertResult, null, 2));
                
                // Esperar a que la imagen se cargue completamente
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log('✅ Proceso de inserción mobile tipo A completado');
            } else {
                console.log('⚠️ No se pudo hacer scroll al elemento mobile');
            }
        }
        
        // ============================================================
        // MOBILE - TIPO C: OVERLAY CON ITT (IGUAL QUE DESKTOP D)
        // ============================================================
        if (isMobile && visualizationType === 'C') {
            console.log('🖼️ Insertando overlay con ITT para mobile tipo C (igual que Desktop D)...');
            
            // Remover scroll de html y body
            await page.evaluate(() => {
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                console.log('✅ Scroll removido de html y body');
            });
            
            // Hacer scroll a 0px
            console.log('📜 Haciendo scroll a 0px...');
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            
            // Esperar un poco después del scroll
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Leer la imagen x_itt.png y convertirla a base64
            const xIconPath = path.join(__dirname, 'public', 'images', 'x_itt.png');
            const xIconBuffer = fs.readFileSync(xIconPath);
            const xIconBase64 = `data:image/png;base64,${xIconBuffer.toString('base64')}`;
            console.log('📷 Imagen x_itt cargada como base64');
            
            console.log("*********** jsonData antes de page.evaluate:", jsonData);
            // Crear overlay con background gris e imágenes
            const insertResult = await page.evaluate((data, xIconSrc) => {
                return new Promise((resolve) => {
                    console.log('🔍 Dentro de page.evaluate - data recibido:', data);
                    console.log('🔍 data.itt:', data.itt);
                    
                    const results = {
                        overlay: { created: false, error: null },
                        itt: { inserted: false, error: null },
                        closeIcon: { inserted: false, error: null }
                    };
                    
                    try {
                        // Crear overlay con background gris
                        const overlay = document.createElement('div');
                        overlay.id = 'itt-overlay';
                        overlay.style.position = 'fixed';
                        overlay.style.top = '0';
                        overlay.style.left = '0';
                        overlay.style.width = '100vw';
                        overlay.style.height = '100vh';
                        overlay.style.backgroundColor = 'rgba(51, 51, 51, 0.85)';
                        overlay.style.zIndex = '99999';
                        overlay.style.display = 'flex';
                        overlay.style.justifyContent = 'center';
                        overlay.style.alignItems = 'center';
                        
                        document.body.appendChild(overlay);
                        results.overlay.created = true;
                        console.log('✅ Overlay creado con opacidad 0.85');
                        
                        // Contenedor para la imagen ITT y el icono X
                        const imageContainer = document.createElement('div');
                        imageContainer.style.position = 'relative';
                        imageContainer.style.maxWidth = '90%';
                        imageContainer.style.maxHeight = '90%';
                        imageContainer.style.display = 'flex';
                        imageContainer.style.justifyContent = 'center';
                        imageContainer.style.alignItems = 'center';
                        
                        overlay.appendChild(imageContainer);
                        
                        // Insertar imagen ITT centrada si existe
                        if (data.itt) {
                            const imgITT = document.createElement('img');
                            imgITT.crossOrigin = 'anonymous';
                            imgITT.src = data.itt;
                            imgITT.style.maxWidth = '100%';
                            imgITT.style.maxHeight = '100%';
                            imgITT.style.objectFit = 'contain';
                            imgITT.id = 'inserted-imagen-itt';
                            
                            imgITT.onload = function() {
                                results.itt.inserted = true;
                                console.log('✅ Imagen ITT insertada y centrada');
                                
                                // Obtener posición de la imagen ITT
                                const imgRect = this.getBoundingClientRect();
                                console.log('📍 Posición imagen ITT:', imgRect);
                                
                                // Insertar icono X en la esquina superior derecha de la imagen ITT
                                const closeIcon = document.createElement('img');
                                closeIcon.src = xIconSrc;
                                closeIcon.style.position = 'fixed';
                                closeIcon.style.zIndex = '100001';
                                closeIcon.style.cursor = 'pointer';
                                closeIcon.id = 'close-icon-itt';
                                
                                // Agregar al body
                                document.body.appendChild(closeIcon);
                                
                                closeIcon.onload = function() {
                                    const iconWidth = this.width;
                                    const iconHeight = this.height;
                                    
                                    // Reducir el tamaño del icono al 50%
                                    const scaleFactor = 0.5;
                                    const scaledWidth = iconWidth * scaleFactor;
                                    const scaledHeight = iconHeight * scaleFactor;
                                    
                                    this.style.width = scaledWidth + 'px';
                                    this.style.height = scaledHeight + 'px';
                                    
                                    // Posicionar: 10px arriba del top de la imagen ITT
                                    // y alineado con el borde derecho de la imagen (5px desde el borde)
                                    this.style.top = (imgRect.top - 10 - scaledHeight) + 'px';
                                    this.style.left = ((imgRect.right - 5 - scaledWidth) + 10) + 'px';
                                    
                                    results.closeIcon.inserted = true;
                                    console.log('✅ Icono X insertado en:', this.style.left, this.style.top);
                                    console.log('📏 Tamaño icono escalado:', scaledWidth + 'x' + scaledHeight);
                                    resolve(results);
                                };
                                
                                closeIcon.onerror = function() {
                                    results.closeIcon.error = 'Error al cargar icono X';
                                    console.error('❌ Error al cargar icono X');
                                    resolve(results);
                                };
                            };
                            
                            imgITT.onerror = function() {
                                results.itt.error = 'Error al cargar imagen ITT';
                                console.error('❌ Error al cargar imagen ITT');
                                resolve(results);
                            };
                            
                            imageContainer.appendChild(imgITT);
                        } else {
                            results.itt.error = 'No hay imagen ITT en los datos';
                            resolve(results);
                        }
                        
                    } catch (error) {
                        results.overlay.error = error.message;
                        console.error('❌ Error creando overlay:', error);
                        resolve(results);
                    }
                    
                    // Timeout de seguridad
                    setTimeout(() => {
                        resolve(results);
                    }, 5000);
                });
            }, jsonData, xIconBase64);
            
            console.log('📊 Resultado de inserción mobile tipo C:', JSON.stringify(insertResult, null, 2));
            
            // Esperar a que las imágenes se carguen completamente
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✅ Proceso de inserción mobile tipo C completado');
        }
        
        // ============================================================
        // MOBILE - TIPO B: IMAGEN ANCHO Y ZÓCALO
        // ============================================================
        if (isMobile && visualizationType === 'B') {
            console.log('🖼️ Insertando imagenAncho y zócalo para mobile tipo B...');
            
            // Hacer scroll al bottom del elemento .simple-news-column-without-image--mobile ANTES de insertar imágenes
            const scrollPosition = await page.evaluate(() => {
                const targetElement = document.querySelector('.simple-news-column-without-image--mobile');
                if (!targetElement) {
                    console.error('❌ No se encontró el elemento .simple-news-column-without-image--mobile');
                    return null;
                }
                
                const rect = targetElement.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                // Scroll al bottom del elemento
                return rect.bottom + scrollTop;
            });
            
            if (scrollPosition !== null) {
                console.log(`📜 Haciendo scroll al bottom del elemento: ${scrollPosition}px...`);
                await page.evaluate((scrollPos) => {
                    window.scrollTo(0, scrollPos - 200);
                }, scrollPosition);
                
                // Esperar a que se complete el scroll
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log('✅ Scroll completado');
            }
            
            // Leer la imagen x.png y convertirla a base64
            const xIconPath = path.join(__dirname, 'public', 'images', 'x.png');
            let xIconBase64 = null;
            if (fs.existsSync(xIconPath)) {
                const xIconBuffer = fs.readFileSync(xIconPath);
                xIconBase64 = `data:image/png;base64,${xIconBuffer.toString('base64')}`;
                console.log('📷 Imagen x.png cargada como base64');
            }
            
            // Insertar imagenAncho y zócalo
            const insertResult = await page.evaluate((data, xIcon) => {
                return new Promise((resolve) => {
                    const results = {
                        ancho: { found: false, inserted: false, error: null },
                        zocalo: { found: false, inserted: false, error: null }
                    };
                    
                    try {
                        const targetElement = document.querySelector('.simple-news-column-without-image--mobile');
                        
                        if (!targetElement) {
                            results.ancho.error = 'No se encontró el elemento .simple-news-column-without-image--mobile';
                            results.zocalo.error = 'No se encontró el elemento .simple-news-column-without-image--mobile';
                            resolve(results);
                            return;
                        }
                        
                        results.ancho.found = true;
                        results.zocalo.found = true;
                        
                        let imagesLoaded = 0;
                        const totalImages = (data.imagenAncho ? 1 : 0) + (data.zocalo ? 1 : 0);
                        
                        function checkComplete() {
                            if (imagesLoaded >= totalImages) {
                                resolve(results);
                            }
                        }
                        
                        // 1. Insertar imagenAncho debajo del elemento
                        if (data.imagenAncho) {
                            const imgAncho = document.createElement('img');
                            imgAncho.src = data.imagenAncho;
                            imgAncho.style.position = 'fixed';
                            imgAncho.style.zIndex = '9999';
                            imgAncho.style.maxWidth = '100%';
                            imgAncho.style.height = 'auto';
                            imgAncho.style.display = 'block';
                            imgAncho.id = 'inserted-imagen-ancho';
                            
                            imgAncho.onload = function() {
                                const imgHeight = this.naturalHeight;
                                const rect = targetElement.getBoundingClientRect();
                                
                                // Agregar margin-bottom al elemento del tamaño de imagenAncho
                                targetElement.style.marginBottom = (imgHeight + 20) + 'px';
                                console.log(`📏 Margin-bottom agregado al elemento: ${imgHeight}px`);
                                
                                // Posicionar debajo del elemento
                                this.style.left = '50%';
                                this.style.transform = 'translateX(-50%)';
                                this.style.top = rect.bottom + 'px';
                                
                                document.body.appendChild(this);
                                
                                results.ancho.inserted = true;
                                console.log('✅ ImagenAncho insertada en mobile tipo B');
                                imagesLoaded++;
                                checkComplete();
                            };
                            
                            imgAncho.onerror = function() {
                                results.ancho.error = 'Error al cargar imagenAncho';
                                console.error('❌ Error al cargar imagenAncho');
                                imagesLoaded++;
                                checkComplete();
                            };
                        } else {
                            imagesLoaded++;
                        }
                        
                        // 2. Insertar zócalo al final de la página visible (bottom) con background blanco
                        if (data.zocalo) {
                            // Crear contenedor con background blanco
                            const zocaloContainer = document.createElement('div');
                            zocaloContainer.style.position = 'fixed';
                            zocaloContainer.style.bottom = '0px';
                            zocaloContainer.style.padding = '10px 0px 20px 0px';
                            zocaloContainer.style.left = '0px';
                            zocaloContainer.style.width = '100%';
                            zocaloContainer.style.backgroundColor = 'white';
                            zocaloContainer.style.zIndex = '9999';
                            zocaloContainer.style.display = 'flex';
                            zocaloContainer.style.justifyContent = 'center';
                            zocaloContainer.style.alignItems = 'center';
                            zocaloContainer.id = 'zocalo-container';
                            
                            const imgZocalo = document.createElement('img');
                            imgZocalo.src = data.zocalo;
                            imgZocalo.style.maxWidth = '100%';
                            imgZocalo.style.height = 'auto';
                            imgZocalo.style.display = 'block';
                            imgZocalo.id = 'inserted-zocalo';
                            
                            imgZocalo.onload = function() {
                                // Agregar imagen al contenedor
                                zocaloContainer.appendChild(this);
                                document.body.appendChild(zocaloContainer);
                                
                                // Agregar icono X en la esquina superior derecha del zócalo
                                if (xIcon) {
                                    // Esperar un momento para que el DOM se actualice
                                    setTimeout(() => {
                                        const xIconImg = document.createElement('img');
                                        xIconImg.src = xIcon;
                                        xIconImg.style.position = 'fixed';
                                        xIconImg.style.zIndex = '10000';
                                        xIconImg.style.width = '25px';
                                        xIconImg.style.height = '25px';
                                        
                                        const zocaloRect = imgZocalo.getBoundingClientRect();
                                        // Posicionar a la derecha de la página y 25px más arriba
                                        xIconImg.style.right = '5px'; // A la derecha de la página
                                        xIconImg.style.top = (zocaloRect.top - 25) + 'px'; // 5px más arriba (era -20, ahora -25)
                                        
                                        document.body.appendChild(xIconImg);
                                        console.log('✅ Icono X agregado al zócalo (derecha de la página, 25px más arriba)');
                                        console.log(`📍 Posición icono X: right=5px, top=${zocaloRect.top - 25}px`);
                                    }, 100);
                                }
                                
                                results.zocalo.inserted = true;
                                console.log('✅ Zócalo insertado al final de la página visible con background blanco');
                                imagesLoaded++;
                                checkComplete();
                            };
                            
                            imgZocalo.onerror = function() {
                                results.zocalo.error = 'Error al cargar zócalo';
                                console.error('❌ Error al cargar zócalo');
                                imagesLoaded++;
                                checkComplete();
                            };
                        } else {
                            imagesLoaded++;
                        }
                        
                        // Timeout de seguridad
                        setTimeout(() => {
                            resolve(results);
                        }, 5000);
                        
                    } catch (error) {
                        results.top.error = error.message;
                        results.zocalo.error = error.message;
                        console.error('❌ Error insertando imágenes:', error);
                        resolve(results);
                    }
                });
            }, jsonData, xIconBase64);
            
            console.log('📊 Resultado de inserción mobile tipo B:', JSON.stringify(insertResult, null, 2));
            
            // Esperar a que las imágenes se carguen completamente
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('✅ Proceso de inserción mobile tipo B completado');
        }

        console.log('📸 Tomando screenshot...');
        
        // Tomar screenshot
        const screenshotBuffer = await page.screenshot({
            type: 'png',
            fullPage: false // Solo la parte visible
        });

        // Variable para el screenshot final
        var finalScreenshot = screenshotBuffer;
        
        // Solo agregar barra de Chrome para desktop
        if (!isMobile) {
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
                finalScreenshot = screenshotBuffer;
            } else {
            // Generar fecha y hora en formato "Mié 22 de oct. 10:24 p.m."
            // Si hay targetDate (fecha pasada), usar esa fecha en lugar de la actual
            const dateToUse = targetDate ? new Date(targetDate + 'T00:00:00') : new Date();
            const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            
            const diaSemana = diasSemana[dateToUse.getDay()];
            const dia = dateToUse.getDate();
            const mes = meses[dateToUse.getMonth()];
            
            // Solo fecha para la barra (sin hora)
            const fecha = `${diaSemana} ${dia} de ${mes}.`;
            console.log(`📅 Fecha para barra: ${fecha}${targetDate ? ' (fecha histórica)' : ''}`);
            
            // Escapar caracteres especiales para XML/SVG
            const escapedFecha = fecha
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
            const textVerticalPosition = Math.round((blackBarHeight / 2) + (fontSize / 2.5)) + 10;
            
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
    <text x="${screenshotWidth - textPadding}" y="${textVerticalPosition}" class="datetime" text-anchor="end">${escapedFecha}</text>
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
            .png({
                compressionLevel: 9,
                quality: 90,
                effort: 10
            })
            .toBuffer();
            
            console.log('✅ Barra de Chrome con fecha y hora agregada al screenshot');
            console.log(`📐 Dimensiones finales: ${screenshotWidth}x${newHeight} (original: ${screenshotWidth}x${screenshotHeight})`);
            }
        } else {
            console.log('📱 Mobile: agregando navegador_full.png y screenshot');
            
            // Obtener metadata del screenshot original
            const screenshotMetadata = await sharp(screenshotBuffer).metadata();
            const screenshotWidth = screenshotMetadata.width;
            const screenshotHeight = screenshotMetadata.height;
            
            // Ruta de la imagen navegador_full.png
            const navegadorFullPath = path.join(__dirname, 'public', 'images', 'navegador_full.png');
            
            // Verificar que exista la imagen
            if (!fs.existsSync(navegadorFullPath)) {
                console.warn('⚠️ No se encontró navegador_full.png, continuando sin navegador...');
                finalScreenshot = screenshotBuffer;
            } else {
            
            console.log(`📏 Screenshot mobile original: ${screenshotWidth}x${screenshotHeight}px`);
            
            // Cargar navegador_full.png en su tamaño original
            const navegadorFullBuffer = await sharp(navegadorFullPath).toBuffer();
            const navegadorFullMetadata = await sharp(navegadorFullBuffer).metadata();
            const navegadorFullWidth = navegadorFullMetadata.width;
            const navegadorFullHeight = navegadorFullMetadata.height;
            
            console.log(`📏 Navegador_full (original): ${navegadorFullWidth}x${navegadorFullHeight}px`);
            
            // Generar fecha para agregar sobre navegador_full
            const dateToUse = targetDate ? new Date(targetDate + 'T00:00:00') : new Date();
            const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            
            const diaSemana = diasSemana[dateToUse.getDay()];
            const dia = dateToUse.getDate();
            const mes = meses[dateToUse.getMonth()];
            
            const fecha = `${diaSemana} ${dia} de ${mes}.`;
            console.log(`📅 Fecha para navegador mobile: ${fecha}${targetDate ? ' (fecha histórica)' : ''}`);
            
            // Escapar caracteres especiales para XML/SVG
            const escapedFecha = fecha
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            
            // Crear SVG con el texto de fecha
            const fontSize = Math.round(navegadorFullWidth * 0.008); // Reducido de 0.0095 a 0.008
            const textColor = '#E5E5E5';
            const textPadding = Math.round(navegadorFullWidth * 0.012);
            
            // Posicionar el texto en la parte superior (barra negra de Chrome)
            const textVerticalPosition = 20; // Subido 10px (de 30 a 20)
            
            const svgText = `<svg width="${navegadorFullWidth}" height="${navegadorFullHeight}" xmlns="http://www.w3.org/2000/svg">
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
    <text x="${navegadorFullWidth - textPadding}" y="${textVerticalPosition}" class="datetime" text-anchor="end">${escapedFecha}</text>
</svg>`;
            
            const textOverlay = Buffer.from(svgText);
            
            // Redimensionar el screenshot a un tamaño fijo de 400x820px
            const finalScreenshotWidth = 400;
            const finalScreenshotHeight = 820;
            
            const finalScreenshotBuffer = await sharp(screenshotBuffer)
                .resize(finalScreenshotWidth, finalScreenshotHeight, {
                    fit: 'fill'
                })
                .toBuffer();
            
            console.log(`📏 Screenshot redimensionado a tamaño fijo: ${finalScreenshotWidth}x${finalScreenshotHeight}px`);
            
            // Calcular posición para centrar el screenshot en la mitad de navegador_full
            // y luego moverlo 170px a la izquierda y 70px hacia abajo
            const screenshotLeft = Math.round((navegadorFullWidth - finalScreenshotWidth) / 2) - 170;
            const screenshotTop = Math.round((navegadorFullHeight - finalScreenshotHeight) / 2) + 50;
            
            console.log(`📍 Screenshot posicionado (170px izq, 70px abajo del centro): left=${screenshotLeft}px, top=${screenshotTop}px`);
            
            // Combinar navegador_full con el screenshot y la fecha encima
            var finalScreenshot = await sharp(navegadorFullBuffer)
            .composite([
                { input: textOverlay, top: 0, left: 0 }, // Texto de fecha encima
                { input: finalScreenshotBuffer, top: screenshotTop, left: screenshotLeft } // Screenshot posicionado
            ])
            .png({
                compressionLevel: 9,
                quality: 90,
                effort: 10
            })
            .toBuffer();
            
            console.log('✅ Navegador_full y screenshot mobile combinados');
            console.log(`📐 Dimensiones finales: ${navegadorFullWidth}x${navegadorFullHeight}`);
            }
        }

        // Generar nombre de archivo con timestamp en hora argentina
        // Formato: YYYY-MM-DD-HH-MM-SS-[tipo_visualizacion]-[deviceType].png
        const now = new Date();
        
        // Convertir a hora argentina (America/Argentina/Buenos_Aires)
        const argentinaDate = new Date(now.toLocaleString('en-US', { 
            timeZone: 'America/Argentina/Buenos_Aires' 
        }));
        
        // Si hay targetDate (fecha pasada), usar esa fecha en lugar de la actual
        let year, month, day;
        if (targetDate) {
            const targetDateObj = new Date(targetDate + 'T00:00:00');
            year = targetDateObj.getFullYear();
            month = String(targetDateObj.getMonth() + 1).padStart(2, '0');
            day = String(targetDateObj.getDate()).padStart(2, '0');
        } else {
            year = argentinaDate.getFullYear();
            month = String(argentinaDate.getMonth() + 1).padStart(2, '0');
            day = String(argentinaDate.getDate()).padStart(2, '0');
        }
        
        // Usar hora argentina para el timestamp
        const hours = String(argentinaDate.getHours()).padStart(2, '0');
        const minutes = String(argentinaDate.getMinutes()).padStart(2, '0');
        const seconds = String(argentinaDate.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
        
        // Agregar tipo de visualización y deviceType al nombre
        const visualizationSuffix = visualizationType ? `-${visualizationType}` : '';
        const deviceSuffix = `-${deviceType}`;
        const fileName = `${timestamp}${visualizationSuffix}${deviceSuffix}.png`;

        // ============================================================
        // GUARDADO LOCAL DESHABILITADO
        // ============================================================
        // Los screenshots NO se guardan en disco local.
        // Se suben directamente a Google Drive desde memoria.
        // ============================================================
        
        // COMENTADO: Guardar localmente (ya no se usa)
        // const localPath = path.join(__dirname, 'screenshots', fileName);
        // 
        // // Crear directorio si no existe
        // if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
        //     fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
        // }
        // 
        // fs.writeFileSync(localPath, finalScreenshot);
        // console.log(`✅ Screenshot guardado localmente: ${localPath}`);

        // Subir a Google Drive (directamente desde memoria)
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

        return {
            success: true,
            deviceType: deviceType,
            fileName: fileName,
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
