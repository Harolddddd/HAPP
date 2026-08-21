module.exports = {
  apps: [
    {
      name: 'happ-backend',
      cwd: '/var/www/happ/backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
