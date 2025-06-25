/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  webpack: (config, { isServer, webpack }) => {
    config.externals.push({
      'pm2': 'commonjs pm2',
      'blessed': 'commonjs blessed',
      'term.js': 'commonjs term.js',
      'pty.js': 'commonjs pty.js',
      'pm2-deploy': 'commonjs pm2-deploy',
    });

    // Adiciona uma regra para transpilar arquivos .ts em src/backend
    config.module.rules.push({
      test: /\.ts$/,
      include: /src\/backend/, // Inclui apenas o diretório src/backend
      use: [
        {
          loader: 'ts-loader',
          options: {
            transpileOnly: true, // Acelera a compilação, mas desativa a verificação de tipo
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;