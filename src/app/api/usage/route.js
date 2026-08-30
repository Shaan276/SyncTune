import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    todayMB: 4.2,
    monthMB: 128.5,
    dataSavedMB: 482.0,
    bytes: 4404019
  });
}

export async function POST() {
  return NextResponse.json({ success: true });
}
