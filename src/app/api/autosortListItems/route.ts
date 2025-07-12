
import { NextResponse } from 'next/server';
import { autosortListItems } from '@/ai/flows/autosortListItemsFlow';

export async function OPTIONS(request: Request) {
  console.log('[API /api/autosortListItems] Received OPTIONS request');
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
    const { listTitle, subitems } = await request.json();
    const result = await autosortListItems({ listTitle, subitems });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/autosortListItems] Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
