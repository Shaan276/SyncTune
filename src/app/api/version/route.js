import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: '3.0.0',
    maintenance: false,
    features: { '3.0.0': ['Next.js App Router Native API Routes', 'Vercel Serverless Optimization'] }
  });
}
