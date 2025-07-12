
import { NextResponse } from 'next/server';
import { extractListFromImage } from '@/ai/flows/extractListFromImageFlow';

export async function POST(request: Request) {
  try {
    const { imageDataUri } = await request.json();

    if (!imageDataUri) {
      return NextResponse.json({ error: 'imageDataUri is required' }, { status: 400 });
    }

    const result = await extractListFromImage({ imageDataUri });
    const response = NextResponse.json(result);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (error: any) {
    console.error('[API /api/extractFromImage] Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
