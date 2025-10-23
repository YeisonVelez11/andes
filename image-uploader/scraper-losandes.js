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
            
            // Solo fecha para la barra (sin hora)
            const fecha = `${diaSemana} ${dia} de ${mes}.`;
            console.log(`📅 Fecha para barra: ${fecha}`);
            
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
