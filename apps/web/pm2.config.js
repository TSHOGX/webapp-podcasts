module.exports = {
  apps: [{
    name: 'podcast-web',
    script: '/Users/xixi/Workspace/webapp/podcasts/node_modules/next/dist/bin/next',
    args: 'start --port 12889',
    cwd: '/Users/xixi/Workspace/webapp/podcasts/apps/web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 12889
    }
  }]
};