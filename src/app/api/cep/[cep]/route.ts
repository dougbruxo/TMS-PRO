
import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ cep: string }> }) {
    const params = await context.params;
  // WORKAROUND for potential issue with params object in some Next.js versions.
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split('/');
  const rawCep = parts.pop() || '';
  
  const cep = rawCep.replace(/[^\d]/g, '');

  if (!cep || cep.length !== 8) {
    return NextResponse.json({ message: 'CEP deve ter 8 dígitos.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ message: errorData.message || `Erro ao consultar CEP na BrasilAPI.` }, { status: response.status });
    }
    
    const data = await response.json();

    const addressInfo = {
      city: data.city,
      state: data.state,
      fullAddress: [data.street, data.neighborhood].filter(Boolean).join(', '),
      cep: data.cep,
    };

    return NextResponse.json(addressInfo);

  } catch (error: any) {
    console.error('Erro no proxy de CEP:', error);
    return NextResponse.json({ message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
