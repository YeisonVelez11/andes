/**
 * Configuración compartida de Puppeteer para todo el proyecto
 */

const puppeteer = require('puppeteer');

// Timeouts reutilizables para Puppeteer (valores fijos)
const BROWSER_LAUNCH_TIMEOUT = 90000;   // 90s para que Chrome arranque en servidor
const BROWSER_PROTOCOL_TIMEOUT = 180000; // 180s para comandos del protocolo

/**
 * Configuración de viewport según tipo de dispositivo
 */
const VIEWPORT_CONFIGS = {
  desktop: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: true
  },
  mobile: {
    width: 400,
    height: 820,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  }
};

/**
 * User agents por tipo de dispositivo
 */
const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
};

/**
 * Lanza un navegador Puppeteer con configuración optimizada para Linux sin GUI
 * @param {string} [deviceType='desktop'] - Tipo de dispositivo: 'desktop' o 'mobile'
 * @param {Object} [options={}] - Opciones adicionales para puppeteer.launch()
 * @returns {Promise<Browser>} Instancia del navegador Puppeteer
 * @throws {Error} Si falla el lanzamiento del navegador
 * @example
 * const browser = await launchBrowser('mobile');
 * const page = await browser.newPage();
 */
async function launchBrowser(deviceType = 'desktop', options = {}) {
  const viewportConfig = VIEWPORT_CONFIGS[deviceType] || VIEWPORT_CONFIGS.desktop;
  
  const config = {
    headless: "true",
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
      `--window-size=${viewportConfig.width},${viewportConfig.height}`
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
    defaultViewport: viewportConfig,
    // Timeouts reutilizables
    timeout: BROWSER_LAUNCH_TIMEOUT,
    protocolTimeout: BROWSER_PROTOCOL_TIMEOUT,
    ...options
  };

  return await puppeteer.launch(config);
}

/**
 * Configura una página de Puppeteer con user agent y headers apropiados
 * @param {Page} page - Página de Puppeteer a configurar
 * @param {string} [deviceType='desktop'] - Tipo de dispositivo: 'desktop' o 'mobile'
 * @returns {Promise<void>}
 * @example
 * const page = await browser.newPage();
 * await configurePage(page, 'mobile');
 */
async function configurePage(page, deviceType = 'desktop') {
  const userAgent = USER_AGENTS[deviceType] || USER_AGENTS.desktop;
  
  await page.setUserAgent(userAgent);
  
  // Agregar header para ngrok
  await page.setExtraHTTPHeaders({
    'ngrok-skip-browser-warning': 'true'
  });
}

module.exports = {
  VIEWPORT_CONFIGS,
  USER_AGENTS,
  launchBrowser,
  configurePage
};
