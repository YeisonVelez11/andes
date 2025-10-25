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

module.exports = {
  getArgentinaDateString,
  getArgentinaDateTime,
  getArgentinaTimestamp
};
