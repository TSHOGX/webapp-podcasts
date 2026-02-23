module.exports = {
  apps: [{
    name: 'podcast-api',
    script: 'main.py',
    interpreter: 'uv run python',
    cwd: '/Users/xixi/Workspace/webapp/podcasts/apps/api',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      PYTHONUNBUFFERED: '1',
      PORT: 12890
    }
  }]
};