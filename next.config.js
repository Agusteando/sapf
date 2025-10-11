
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["bot.casitaapps.com", "casitaiedis.edu.mx"],
  },
  env: {
    STUDENT_API_URL: process.env.STUDENT_API_URL,
  },
};

module.exports = nextConfig;
