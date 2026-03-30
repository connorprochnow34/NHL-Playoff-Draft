/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.nhle.com",
        pathname: "/logos/**",
      },
    ],
  },
};

export default nextConfig;
