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
      // Número máximo de reinicios en 1 minuto antes de dejar la app como errored
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
