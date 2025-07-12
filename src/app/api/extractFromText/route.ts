
import { NextResponse } from 'next/server';
import { extractListFromText } from '@/ai/flows/extractListFromTextFlow';

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
  return response;
}

export async function POST(request: Request) {
  try {
    const { dictatedText } = await request.json();

    if (!dictatedText) {
      return NextResponse.json({ error: 'dictatedText is required' }, { status: 400 });
    }

    const result = await extractListFromText({ dictatedText });
    const response = NextResponse.json(result);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (error: any) {
    console.error('[API /api/extractFromText] Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
