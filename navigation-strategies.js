/**
 * Estrategias de navegación y user agents para reintentos
 * Módulo compartido para scraper-losandes.js y server.js
 */

/**
 * Estrategias de navegación con diferentes timeouts y waitUntil
 * BASE_NAV_TIMEOUT es una constante reutilizable interna.
 */
const BASE_NAV_TIMEOUT = 60000; // 60s base

const NAVIGATION_STRATEGIES = [
  { waitUntil: "domcontentloaded", timeout: BASE_NAV_TIMEOUT, name: `domcontentloaded (${BASE_NAV_TIMEOUT/1000}s)` },
  { waitUntil: "domcontentloaded", timeout: BASE_NAV_TIMEOUT * 1.5, name: `domcontentloaded (${(BASE_NAV_TIMEOUT*1.5)/1000}s)` },
  { waitUntil: "load",           timeout: BASE_NAV_TIMEOUT * 1.5, name: `load (${(BASE_NAV_TIMEOUT*1.5)/1000}s)` }
];

/**
 * User agents alternativos para reintentos
 * El primero (null) usa el user agent por defecto configurado
 */
const ALTERNATIVE_USER_AGENTS = [
  null, // Usar el default
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

/**
 * Navega a una URL con múltiples estrategias de reintentos
 * @param {Object} page - Página de Puppeteer
 * @param {string} url - URL a navegar
 * @param {number} attempt - Número de intento actual (1-5)
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<void>}
 */
async function navigateWithStrategies(page, url, attempt, maxRetries) {
  // Proteger por si attempt supera la cantidad de estrategias disponibles
  const index = Math.min(Math.max(attempt - 1, 0), NAVIGATION_STRATEGIES.length - 1);
  const strategy = NAVIGATION_STRATEGIES[index];
  const strategyName = strategy.name || `${strategy.waitUntil} (${strategy.timeout/1000}s)`;
  console.log(`📡 Intento ${attempt}/${maxRetries} - Estrategia: ${strategyName}`);
  
  // Cambiar user agent en intentos posteriores
  if (attempt > 1 && ALTERNATIVE_USER_AGENTS[attempt - 1]) {
    console.log(`🔄 Cambiando user agent...`);
    await page.setUserAgent(ALTERNATIVE_USER_AGENTS[attempt - 1]);
  }
  
  await page.goto(url, {
    waitUntil: strategy.waitUntil,
    timeout: strategy.timeout,
  });
}

module.exports = {
  NAVIGATION_STRATEGIES,
  ALTERNATIVE_USER_AGENTS,
  navigateWithStrategies
};
