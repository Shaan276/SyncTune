/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  images: {
    unoptimized: true,
    domains: ['i.ytimg.com', 'yt3.ggpht.com']
  }
};

module.exports = nextConfig;
