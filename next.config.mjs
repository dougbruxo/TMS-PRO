import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@react-pdf/renderer'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'uploads.onecompiler.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      }
    ],
  },

  env: {},

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('mongodb-client-encryption');
    } else {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        child_process: false,
        dns: false,
        fs: false,
        net: false,
        tls: false,
        'fs/promises': false,
        'timers/promises': false,
      };
    }
    return config;
  },
};

export default withPWA(nextConfig);
