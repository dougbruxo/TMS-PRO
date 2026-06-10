
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET current visual theme settings (global for all users)
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('settings').findOne({ _id: 'visual-theme' });

    if (!doc) {
      // Return defaults if nothing saved yet
      return NextResponse.json({
        layoutMode: 'classic',
        themeVariables: null, // null = use CSS defaults
      });
    }

    const { _id, ...data } = doc;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Visual Theme GET Error:', error);
    return NextResponse.json(
      { message: `Erro ao buscar tema visual: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST to update visual theme settings (admin only, global for all users)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { layoutMode, themeVariables } = body;

    const { db } = await connectToDatabase();

    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (layoutMode !== undefined) {
      updateData.layoutMode = layoutMode;
    }
    if (themeVariables !== undefined) {
      updateData.themeVariables = themeVariables;
    }

    await db.collection('settings').updateOne(
      { _id: 'visual-theme' },
      { $set: updateData },
      { upsert: true }
    );

    return NextResponse.json({
      message: 'Tema visual atualizado com sucesso.',
      success: true,
    });
  } catch (error: any) {
    console.error('API Visual Theme POST Error:', error);
    return NextResponse.json(
      { message: `Erro ao atualizar tema visual: ${error.message}` },
      { status: 500 }
    );
  }
}
