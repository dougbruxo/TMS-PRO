import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: "Esta rota está obsoleta. Use /api/customers em vez disso." }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ message: "Esta rota está obsoleta. Use /api/customers em vez disso." }, { status: 410 });
}