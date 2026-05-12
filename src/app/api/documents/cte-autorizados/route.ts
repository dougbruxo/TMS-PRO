import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

/**
 * GET /api/documents/cte-autorizados
 * Retorna CT-e autorizados que ainda não possuem um MDF-e vinculado.
 * Usado para seleção na tela de emissão do MDF-e.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // Buscar CT-e autorizados sem MDF-e
    const ctes = await db.collection('issued_documents')
      .find({
        type: 'CTE',
        status: { $in: ['autorizado', 'concluido', 'sucesso', 'autorizado sefaz'] },
      })
      .sort({ dataEmissao: -1 })
      .limit(200)
      .toArray();

    // Buscar chaves de CT-e já incluídas em MDF-e
    const mdfes = await db.collection('issued_documents')
      .find({
        type: 'MDFE',
        status: { $in: ['autorizado', 'concluido', 'sucesso', 'autorizado sefaz'] },
      })
      .project({ chavesCte: 1 })
      .toArray();

    const chavesMdfVinculadas = new Set<string>(
      mdfes.flatMap((m: any) => m.chavesCte || [])
    );

    const result = ctes.map((doc: any) => ({
      _id: doc._id.toHexString(),
      numeroCte: doc.numeroCte,
      serie: doc.serie,
      chaveAcesso: doc.chaveAcesso,
      remetenteNome: doc.remetenteNome,
      destinatarioNome: doc.destinatarioNome,
      valorServico: doc.valorServico,
      peso: doc.peso,
      cidadeOrigem: doc.cidadeOrigem,
      ufOrigem: doc.ufOrigem,
      cidadeDestino: doc.cidadeDestino,
      ufDestino: doc.ufDestino,
      dataEmissao: doc.dataEmissao,
      vinculado: chavesMdfVinculadas.has(doc.chaveAcesso),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Erro ao buscar CT-e autorizados:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar CT-e autorizados.', error: error.message },
      { status: 500 }
    );
  }
}
