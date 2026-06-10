import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CiotEngine } from '@/lib/ciot/engine';
import { calculateMinimumFreight } from '@/lib/antt/calculator';
import { calculateRouteDistance } from '@/lib/location-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            vehicleId, 
            driverId, 
            vFrete, 
            vAdiantamento, 
            origem, 
            destino, 
            documentos,
            distanceKm,
            tipoOperacao,
            cargoType
        } = body;

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

        // 3. Resolver a distância da viagem para a validação do piso mínimo
        let finalDistance = parseFloat(distanceKm || '0');
        if (!finalDistance && origem && destino) {
            const routeResult = await calculateRouteDistance(db, origem, destino);
            if (routeResult) {
                finalDistance = routeResult.distanceKm;
            }
        }

        // 4. Calcular o Piso Mínimo de Frete ANTT
        let minFreightRes = null;
        if (finalDistance > 0 && vehicle.axles) {
            minFreightRes = await calculateMinimumFreight(finalDistance, vehicle as any, cargoType || 'Geral');
        }

        // 5. Validar o frete negociado com a ANTT (Resolução 6.078/2026)
        if (minFreightRes && minFreightRes.total > 0) {
            const valorFreteNum = Number(vFrete || 0);
            if (valorFreteNum < minFreightRes.total) {
                return NextResponse.json({ 
                    message: `A emissão do CIOT foi bloqueada automaticamente. O valor do frete negociado (R$ ${valorFreteNum.toFixed(2)}) está abaixo do piso mínimo legal obrigatório pela Resolução ANTT 6.078/2026 para esta rota (R$ ${minFreightRes.total.toFixed(2)} para ${finalDistance} km, tipo de carga: "${minFreightRes.cargoType}" e ${minFreightRes.axles} eixos).` 
                }, { status: 400 });
            }
        }

        // 6. Preparar dados para o Builder
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
            documentos: documentos ? documentos.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
            distanceKm: finalDistance,
            tipoOperacao: tipoOperacao || 'Carga Lotação',
            cargoType: cargoType || 'Geral',
            minFreightCalculated: minFreightRes ? minFreightRes.total : null
        };

        // 7. Acionar o Motor (Simulado por enquanto até ter o endpoint final)
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

        // 8. Salvar Histórico do CIOT
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
