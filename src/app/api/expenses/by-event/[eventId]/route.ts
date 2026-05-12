
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function DELETE(request: Request, context: { params: Promise<{ eventId: string }> }) {
    const params = await context.params;
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const eventId = parts.pop() || '';

    if (!eventId) {
      return NextResponse.json({ message: 'ID do evento é obrigatório.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('expenses').deleteOne({ operationalEventId: eventId });

    if (result.deletedCount === 0) {
      // Not finding an expense is acceptable (the event may not have had one)
      return NextResponse.json({ message: 'Nenhuma despesa encontrada para este evento.' }, { status: 200 });
    }

    return NextResponse.json({ message: 'Despesa associada ao evento removida com sucesso.' }, { status: 200 });
  } catch (error: any) {
    console.error('API Expenses by-event DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao remover despesa: ${error.message}` }, { status: 500 });
  }
}
