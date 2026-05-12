import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

// POST to reset pricing settings to default
export async function POST(request: Request) {
    try {
      const { db } = await connectToDatabase();

      // Delete the existing pricing settings document
      const result = await db.collection('settings').deleteOne({ _id: 'pricing' });

      if (result.deletedCount === 0) {
        // If it didn't exist, that's also fine. The GET endpoint will seed it.
        return NextResponse.json({ message: "Nenhuma configuração para restaurar. O sistema irá criar uma nova na próxima carga.", success: true });
      }
      
      return NextResponse.json({ message: "Configurações de preço restauradas com sucesso.", success: true });

    } catch (error: any) {
        console.error('API Pricing Reset POST Error:', error);
        return NextResponse.json({ message: `Erro ao restaurar configurações de preço: ${error.message}` }, { status: 500 });
    }
}
