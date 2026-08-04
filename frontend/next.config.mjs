/** @type {import('next').NextConfig} */

const cdnDomain = process.env.NEXT_PUBLIC_CDN_URL
  ? process.env.NEXT_PUBLIC_CDN_URL.split('//')[1]
  : '202502-test-bucket.s3.ap-northeast-1.amazonaws.com';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: cdnDomain },
    ],
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then((m) => m.initOpenNextCloudflareForDev());
