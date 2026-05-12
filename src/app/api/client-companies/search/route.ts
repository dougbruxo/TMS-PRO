import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.length < 2) {
      return NextResponse.json({ companies: [] });
    }

    const { db } = await connectToDatabase();

    // Clean up CNPJ query to allow searching with or without punctuation
    const qClean = q.replace(/[^\d]/g, '');

    const query: any = {
      $or: [
        { razaoSocial: { $regex: q, $options: 'i' } },
        { nomeFantasia: { $regex: q, $options: 'i' } }
      ]
    };

    if (qClean.length > 0) {
      query.$or.push({ cnpj: { $regex: qClean, $options: 'i' } });
      query.$or.push({ cnpj: { $regex: q, $options: 'i' } });
    }

    const companies = await db.collection('client_companies')
      .find(query)
      .limit(20)
      .project({ _id: 1, razaoSocial: 1, nomeFantasia: 1, cnpj: 1 })
      .toArray();

    return NextResponse.json({
      companies: companies.map(c => ({
        id: c._id.toString(),
        razaoSocial: c.razaoSocial,
        nomeFantasia: c.nomeFantasia,
        cnpj: c.cnpj
      }))
    });

  } catch (error: any) {
    console.error('Error searching client companies:', error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}
