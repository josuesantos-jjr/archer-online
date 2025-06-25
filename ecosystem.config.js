module.exports = {
  apps: [
    {
      name: 'next-app',
      script: 'npm',
      args: 'start',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};