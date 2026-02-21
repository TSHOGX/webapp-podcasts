module.exports = {
  apps: [{
    name: 'podcasts-api',
    script: '.venv/bin/uvicorn',
    args: 'main:app --host 0.0.0.0 --port 12890',
    cwd: '/Users/xixi/Workspace/webapp/podcasts/apps/api',
    interpreter: 'none',
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://9878u908901829.vip.cpolar.cn',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_service_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      WHISPER_MODEL: 'mlx-community/whisper-large-v3-turbo',
      VERIFY_SSL: 'true'
    },
    log_file: '/Users/xixi/.pm2/logs/podcasts-api-out.log',
    error_file: '/Users/xixi/.pm2/logs/podcasts-api-error.log',
    out_file: '/Users/xixi/.pm2/logs/podcasts-api-out.log'
  }]
};
