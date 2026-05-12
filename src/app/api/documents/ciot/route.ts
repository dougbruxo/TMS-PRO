
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CiotEngine } from '@/lib/ciot/engine';
import { buildCiotXml } from '@/lib/ciot/xml-builder';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { vehicleId, driverId, vFrete, vAdiantamento, origem, destino, documentos } = body;

        const { db } = await connectToDatabase();

        // 1. Buscar Dados do Emitente (Tenant)
        const settings = await db.collection('system_settings').findOne({ type: 'ambiente_sefaz' });
        const company = await db.collection('settings').findOne({ type: 'company_data' });

        if (!settings?.ciotUser || !settings?.ciotPassword) {
            return NextResponse.json({ message: 'Configurações de CIOT não encontradas. Vá em Configurações > Emissão Fiscal.' }, { status: 400 });
        }

        // 2. Buscar Veículo e Motorista
        const vehicle = await db.collection('fleet').findOne({ _id: new ObjectId(vehicleId) });
        const driver = await db.collection('drivers').findOne({ _id: new ObjectId(driverId) });

        if (!vehicle || !driver) {
            return NextResponse.json({ message: 'Veículo ou motorista não encontrado.' }, { status: 404 });
        }

        // 3. Preparar dados para o Builder
        const xmlDados = {
            usuario: settings.ciotUser,
            senha: settings.ciotPassword,
            rntrcEmitente: company?.rntrc || '00000000', // RNTRC da transportadora
            cpfCnpjContratado: driver.cpf,
            nomeContratado: driver.name,
            valorFrete: Number(vFrete),
            valorAdiantamento: Number(vAdiantamento),
            origemIBGE: origem,
            destinoIBGE: destino,
            placa: vehicle.plate,
            documentos: documentos.split(',').map((s: string) => s.trim()).filter(Boolean)
        };

        // 4. Acionar o Motor (Simulado por enquanto até ter o endpoint final)
        const engine = new CiotEngine();
        const result = await engine.emitir({
            tenantId: 'global', // Adaptar para multi-tenant real depois
            driverId,
            vehicleId,
            vFrete: xmlDados.valorFrete,
            vAdiantamento: xmlDados.valorAdiantamento,
            cMunOrigem: origem,
            cMunDestino: destino,
            documentos: xmlDados.documentos
        });

        // 5. Salvar Histórico do CIOT
        await db.collection('ciots').insertOne({
            ...xmlDados,
            ciot: result.ciot,
            protocolo: result.protocol,
            emissao: new Date(),
            status: 'AUTORIZADO'
        });

        return NextResponse.json({ 
            message: 'CIOT Gerado com sucesso!', 
            ciot: result.ciot,
            protocolo: result.protocol 
        });

    } catch (error: any) {
        console.error("Erro na emissão do CIOT:", error);
        return NextResponse.json({ message: 'Erro interno ao gerar CIOT: ' + error.message }, { status: 500 });
    }
}
