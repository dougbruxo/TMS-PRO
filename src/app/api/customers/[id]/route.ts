import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { db } = await connectToDatabase();
    if (!ObjectId.isValid(id)) return NextResponse.json({}, { status: 400 });
    const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
    if (!customer) {
      const clientCompany = await db.collection('client_companies').findOne({ _id: new ObjectId(id) });
      if (clientCompany) {
        const { _id, ...rest } = clientCompany;
        return NextResponse.json({
          id: _id.toHexString(),
          razaoSocial: clientCompany.razaoSocial || clientCompany.nome || '',
          cnpj: clientCompany.cnpj || '',
          nomeFantasia: clientCompany.nomeFantasia || '',
          inscricaoEstadual: clientCompany.inscricaoEstadual || '',
          email: clientCompany.email || '',
          telefone: clientCompany.telefone || '',
          code: clientCompany.code || `B2B-${_id.toHexString().slice(-5).toUpperCase()}`,
          ...rest
        }, { status: 200 });
      }
      return NextResponse.json({ message: "Cliente não encontrado." }, { status: 404 });
    }
    const { _id, ...rest } = customer;
    return NextResponse.json({ id: _id.toHexString(), ...rest }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Erro ao buscar cliente." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    
    const updates = await request.json();
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de cliente inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    delete updates._id;

    const result = await db.collection('customers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Cliente atualizado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Customer PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar cliente: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de cliente inválido" }, { status: 400 });
    }
      
    const { db } = await connectToDatabase();
    
    const result = await db.collection('customers').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Cliente apagado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Customer DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar cliente: ${error.message}` }, { status: 500 });
  }
}
