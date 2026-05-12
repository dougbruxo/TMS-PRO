
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import type { Company } from '@/lib/types';

/** Safely parse a response as JSON, returning null on failure */
async function safeJson(res: Response): Promise<any | null> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try { return await res.json(); } catch { return null; }
}

/** Build a friendly error message for non-ok responses */
async function friendlyError(res: Response): Promise<string> {
  if (res.status === 429) return 'Limite de consultas atingido (rate limit). Aguarde alguns segundos e tente novamente.';
  if (res.status === 404) return 'CNPJ não encontrado na base de dados.';
  const body = await safeJson(res);
  return body?.message || body?.detalhes || `Erro ${res.status} ao consultar CNPJ.`;
}

export async function GET(request: Request, context: { params: Promise<{ cnpj: string }> }) {
    const params = await context.params;
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split('/');
  const rawCnpj = parts.pop() || '';

  const cnpj = rawCnpj.replace(/[^\d]/g, '');

  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json({ message: 'CNPJ inválido.' }, { status: 400 });
  }

  const { db } = await connectToDatabase();

  // ISOLAMENTO: clientes não acessam dados internos da transportadora
  const authUser = getUserFromRequest(request);
  const isClientUser = authUser?.role === 'cliente' || authUser?.role === 'sub-cliente';

  try {
    // 1. Tentar base local (apenas admin/user)
    if (!isClientUser) {
      const localCustomer = await db.collection<Company>('customers').findOne({ cnpj });
      if (localCustomer) {
        const { _id, ...customerData } = localCustomer;
        return NextResponse.json({
          ...customerData,
          city: customerData.cidade,
          state: customerData.estado,
          fullAddress: customerData.endereco,
          codigo_ibge: customerData.codigo_ibge,
          source: 'local',
        });
      }
    }

    // 2. Tentar BrasilAPI
    const brasilApiRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DezLogApp/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    if (brasilApiRes?.ok) {
      const data = await brasilApiRes.json();
      const streetAddress = [data.descricao_tipo_de_logradouro, data.logradouro, data.numero]
        .filter(Boolean).join(' ');
      const fullAddress = [streetAddress, data.bairro, data.municipio, data.uf]
        .filter(Boolean).join(', ');

      return NextResponse.json({
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia || data.razao_social,
        endereco: fullAddress,
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        city: data.municipio,
        state: data.uf,
        cep: data.cep,
        cnpj: data.cnpj,
        telefone: data.ddd_telefone_1 || '',
        email: data.email || '',
        codigo_ibge: data.codigo_municipio_ibge,
        source: 'api',
      });
    }

    // Capturar o status da BrasilAPI para decidir o fallback
    const brasilApiStatus = brasilApiRes?.status ?? 0;

    // 3. Fallback: ReceitaWS (sempre tentar se a BrasilAPI falhar, pois bases podem divergir)
    if (true) {
      const receitaRes = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (receitaRes?.ok) {
        const data = await receitaRes.json();
        if (data.status !== 'ERROR') {
          const fullAddress = [data.logradouro, data.numero, data.bairro, data.municipio, data.uf]
            .filter(Boolean).join(', ');
          return NextResponse.json({
            razaoSocial: data.nome,
            nomeFantasia: data.fantasia || data.nome,
            endereco: fullAddress,
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            city: data.municipio,
            state: data.uf,
            cep: (data.cep || '').replace(/[^\d]/g, ''),
            cnpj: data.cnpj,
            telefone: data.telefone || '',
            email: data.email || '',
            codigo_ibge: null,
            source: 'api-fallback',
          });
        }
      }
    }

    // 4. Nenhum provedor respondeu — retornar erro amigável
    const errorMsg = brasilApiRes ? await friendlyError(brasilApiRes) : 'Serviço de CNPJ temporariamente indisponível.';
    return NextResponse.json({ message: errorMsg }, { status: brasilApiStatus || 503 });

  } catch (error: any) {
    console.error('Erro no proxy de CNPJ:', error);
    return NextResponse.json(
      { message: `Erro interno ao consultar CNPJ. Tente novamente em instantes.` },
      { status: 500 }
    );
  }
}
