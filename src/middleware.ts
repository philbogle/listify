// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define your allowed origins (whitelist)
const allowedOrigins = [
  'http://localhost:58155',          // Your local development origin
  'https://studio-ten.vercel.app',   // Your first production domain
  'https://flistify.vercel.app',    // Your second production domain
];

// Configure the matcher to apply this middleware to all API routes
export const config = {
  matcher: '/api/:path*',
};

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  console.log('Incoming Origin:', origin); // For debugging purposes

  // Allow the request if there's no origin (e.g., same-origin requests, direct server calls)
  // or if the origin is explicitly in our allowed list.
  if (!origin || allowedOrigins.includes(origin)) {
    const response = NextResponse.next(); // Continue to the API route handler

    // Set Access-Control-Allow-Origin to the *specific* origin that made the request.
    // This is crucial when Access-Control-Allow-Credentials is true.
    if (origin) { // Only set if an origin header was present
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // For OPTIONS (preflight) requests, return the response immediately
    // without proceeding to the API route, as preflights don't need a body.
    if (request.method === 'OPTIONS') {
      return response;
    }

    return response;
  }

  // If the origin is not allowed, return a 403 Forbidden response.
  // This explicitly blocks access from unauthorized domains.
  console.warn('Blocked origin:', origin); // For debugging purposes
  return new NextResponse(null, { status: 403, statusText: 'Forbidden' });
}