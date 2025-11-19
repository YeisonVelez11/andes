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
      // Configuración de reinicio más conservadora
      max_restarts: 5,
      min_uptime: '5s',
      restart_delay: 3000, // Esperar 3 segundos entre reinicios
      kill_timeout: 5000, // Esperar 5 segundos antes de forzar kill
      listen_timeout: 10000, // Esperar 10 segundos para que el servidor escuche
      // No reiniciar si hay error de puerto ocupado
      exp_backoff_restart_delay: 100
    }
  ]
};
