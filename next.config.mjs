/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Node-only mail/IMAP/zip libraries stay out of the webpack bundle.
    serverComponentsExternalPackages: ["imapflow", "mailparser", "nodemailer", "@prisma/client"],
  },
};
export default nextConfig;
