
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  // --- ADDED CORS HEADERS BELOW THIS LINE ---
  async headers() {
    return [
      {
        // Apply these headers to all API routes
        source: '/api/:path*',
        headers: [
          // This allows your client to send cookies or authorization headers
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          // IMPORTANT: Set this to the exact origin of your local frontend app
          // For production, you'd typically want to use an environment variable
          // or a more dynamic approach to set this to your actual production frontend URL.
          { key: 'Access-Control-Allow-Origin', value: 'https://flistify.vercel.app' },
          // Allowed HTTP methods for cross-origin requests. OPTIONS is crucial for preflight requests.
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          // Allowed request headers. Include any custom headers your frontend might send.
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

export default nextConfig;
