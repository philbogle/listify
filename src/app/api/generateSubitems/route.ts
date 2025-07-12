
import { NextResponse } from 'next/server';
import { generateSubitems } from '@/ai/flows/generateSubitemsFlow';

export async function OPTIONS(request: Request) {
  console.log('[API /api/generateSubitems] Received OPTIONS request');
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
    const { listTitle, existingSubitems } = await request.json();
    const result = await generateSubitems({ listTitle, existingSubitems });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/generateSubitems] Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
