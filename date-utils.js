/**
 * Utilidades para manejo de fechas en hora argentina
 * Zona horaria: America/Argentina/Buenos_Aires (UTC-3)
 */

/**
 * Obtiene la fecha actual en hora argentina en formato YYYY-MM-DD
 * @param {Date} date - Fecha a convertir (por defecto: fecha actual)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function getArgentinaDateString(date = new Date()) {
  const argentinaDate = new Date(
    date.toLocaleString('en-US', { 
      timeZone: 'America/Argentina/Buenos_Aires' 
    })
  );
  const year = argentinaDate.getFullYear();
  const month = String(argentinaDate.getMonth() + 1).padStart(2, '0');
  const day = String(argentinaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la fecha y hora actual en hora argentina
 * @param {Date} date - Fecha a convertir (por defecto: fecha actual)
 * @returns {Object} Objeto con componentes de fecha y hora
 */
function getArgentinaDateTime(date = new Date()) {
  const argentinaDate = new Date(
    date.toLocaleString('en-US', { 
      timeZone: 'America/Argentina/Buenos_Aires' 
    })
  );
  
  return {
    year: argentinaDate.getFullYear(),
    month: String(argentinaDate.getMonth() + 1).padStart(2, '0'),
    day: String(argentinaDate.getDate()).padStart(2, '0'),
    hours: String(argentinaDate.getHours()).padStart(2, '0'),
    minutes: String(argentinaDate.getMinutes()).padStart(2, '0'),
    seconds: String(argentinaDate.getSeconds()).padStart(2, '0'),
    date: argentinaDate
  };
}

/**
 * Obtiene timestamp completo en hora argentina (YYYY-MM-DD-HH-MM-SS)
 * @param {Date} date - Fecha a convertir (por defecto: fecha actual)
 * @returns {string} Timestamp en formato YYYY-MM-DD-HH-MM-SS
 */
function getArgentinaTimestamp(date = new Date()) {
  const dt = getArgentinaDateTime(date);
  return `${dt.year}-${dt.month}-${dt.day}-${dt.hours}-${dt.minutes}-${dt.seconds}`;
}

/**
 * Convierte una fecha YYYY-MM-DD a ISO string con hora de Argentina (medianoche)
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {string} ISO string con la fecha a medianoche en hora de Argentina
 */
function getArgentinaISOString(dateString) {
  // Crear fecha en hora de Argentina a las 00:00:00
  // Argentina está en UTC-3, entonces medianoche en Argentina (00:00) es 03:00 UTC del mismo día
  // Por ejemplo: 2025-11-05 00:00:00 Argentina = 2025-11-05 03:00:00 UTC
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Crear la fecha a las 12:00 del mediodía en Argentina para evitar problemas de zona horaria
  // Esto asegura que siempre se muestre el día correcto sin importar la zona horaria del navegador
  const utcDate = new Date(Date.UTC(year, month - 1, day, 15, 0, 0, 0)); // 15:00 UTC = 12:00 Argentina
  
  return utcDate.toISOString();
}

module.exports = {
  getArgentinaDateString,
  getArgentinaDateTime,
  getArgentinaTimestamp,
  getArgentinaISOString
};
