/**
 * Configuración de PM2 para mantener la aplicación corriendo
 * PM2 es un process manager que mantiene la app viva y la reinicia si falla
 * 
 * IMPORTANTE: 
 * - Asegúrate de tener un archivo .env con las variables necesarias
 * - El puerto se toma de process.env.PORT (definido en .env) o usa 3000 por defecto
 * - Los cronjobs se configuran con crontab del sistema (ver setup-cron.sh)
 */

module.exports = {
  apps: [
    {
      // Aplicación principal (servidor web)
      name: 'andes-server',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Configuración de reinicio MUY conservadora para evitar conflictos de puerto
      max_restarts: 3,
      min_uptime: '10s',
      restart_delay: 10000, // Esperar 10 segundos entre reinicios
      kill_timeout: 10000, // Esperar 10 segundos antes de forzar kill
      listen_timeout: 30000, // Esperar 30 segundos para que el servidor escuche
      wait_ready: false, // No esperar señal ready
      autorestart: false // DESACTIVAR auto-reinicio para debug
    }
  ]
};
