
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: "Esta rota está obsoleta. Use /api/customers/[id] em vez disso." }, { status: 410 });
}
export async function PUT() {
  return NextResponse.json({ message: "Esta rota está obsoleta. Use /api/customers/[id] em vez disso." }, { status: 410 });
}
export async function DELETE() {
  return NextResponse.json({ message: "Esta rota está obsoleta. Use /api/customers/[id] em vez disso." }, { status: 410 });
}
