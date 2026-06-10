import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { v4 as uuidv4 } from 'uuid';
import { XMLParser } from 'fast-xml-parser';
import { logStockMovement } from '@/lib/stock-logs';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    // Fetch all stock items to export
    const items = await db.collection('stock_items').find({}).toArray();

    // Construct simple XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<StockExport>\n`;
    items.forEach(item => {
        xml += `  <Item>\n`;
        xml += `    <SKU>${item.sku || ''}</SKU>\n`;
        xml += `    <Name>${item.name || ''}</Name>\n`;
        xml += `    <Quantity>${item.quantity || 0}</Quantity>\n`;
        xml += `    <Position>${item.positionName || ''}</Position>\n`;
        xml += `    <CompanyId>${item.companyId || ''}</CompanyId>\n`;
        xml += `    <CompanyName>${item.companyName || ''}</CompanyName>\n`;
        xml += `    <NFNumber>${item.nfNumber || ''}</NFNumber>\n`;
        xml += `    <Batch>${item.batch || ''}</Batch>\n`;
        xml += `    <ExpirationDate>${item.expirationDate || ''}</ExpirationDate>\n`;
        xml += `  </Item>\n`;
    });
    xml += `</StockExport>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="estoque_export_${new Date().toISOString().slice(0, 10)}.xml"`
      }
    });

  } catch (error) {
    console.error('Failed to export stock XML:', error);
    return NextResponse.json({ message: 'Erro ao gerar XML', error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'admin' && user.role !== 'user')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ message: 'Arquivo XML não encontrado' }, { status: 400 });
    }

    const text = await file.text();
    // 1. Higieniza o XML contra caracteres especiais brutos (como '<' ou '&' soltos no texto)
    const sanitizedXml = text
      .replace(/<(?!\/?([a-zA-Z_][a-zA-Z0-9_\-\:]*)|[?!])/g, '&lt;')
      .replace(/&(?!(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/gi, '&amp;');

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true, // Adicionado para remover os prefixos de namespace de forma compatível
        isArray: (tagName) => {
            // Force these tags to always be parsed as arrays, even when there's only one element
            return ['det', 'rastro', 'vol', 'item', 'Item'].includes(tagName);
        }
    });
    const jsonObj = parser.parse(sanitizedXml);

    // Encontra de forma robusta e recursiva o nó infNFe no objeto
    const findKey = (obj: any, keyName: string): any => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj[keyName]) return obj[keyName];
        for (const k of Object.keys(obj)) {
            const res = findKey(obj[k], keyName);
            if (res) return res;
        }
        return null;
    }

    // Extract NFe data
    const infNFe = findKey(jsonObj, 'infNFe');
    if (!infNFe) {
        return NextResponse.json({ message: 'XML não contém uma NF-e válida' }, { status: 400 });
    }

    const nfNumber = infNFe.ide?.nNF || '';
    const dest = infNFe.dest;
    let rawCnpj = dest?.CNPJ || dest?.CPF || '';
    let cnpj = String(rawCnpj);
    if (cnpj.length < 14 && dest?.CNPJ) {
         cnpj = cnpj.padStart(14, '0');
    } else if (cnpj.length < 11 && dest?.CPF) {
         cnpj = cnpj.padStart(11, '0');
    }
    let companyName = dest?.xNome || '';
    let companyId = '';

    const { db } = await connectToDatabase();

    // Proteção contra importação duplicada
    if (nfNumber) {
        const existingBatch = await db.collection('receiving_batches').findOne({ nfNumber: String(nfNumber) });
        if (existingBatch) {
            const importDate = new Date(existingBatch.importedAt).toLocaleDateString('pt-BR');
            return NextResponse.json({
                message: `NF-e ${nfNumber} já foi importada em ${importDate}. Exclua o lote existente antes de reimportar.`,
                existingBatchId: existingBatch._id.toHexString()
            }, { status: 409 });
        }
    }

    const manualCompanyId = formData.get('companyId');

    if (cnpj) {
        let company = null;
        if (manualCompanyId) {
             company = await db.collection('client_companies').findOne({ _id: new ObjectId(manualCompanyId as string) });
        } else {
             const cleanCnpj = cnpj.replace(/\D/g, '');
             let formattedCnpj = cleanCnpj;
             if (cleanCnpj.length === 14) {
                 formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
             } else if (cleanCnpj.length === 11) {
                 formattedCnpj = cleanCnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
             }
             
             company = await db.collection('client_companies').findOne({ 
                 $or: [
                     { cnpj: cleanCnpj },
                     { cnpj: formattedCnpj }
                 ]
             });
        }

        if (company) {
            if (!manualCompanyId && !company.isDefault) {
                // If the found company is not the default (it's a branch), find the default (matriz)
                const mainCompany = await db.collection('client_companies').findOne({ userId: company.userId, isDefault: true });
                if (mainCompany) {
                    return NextResponse.json({
                        message: `O CNPJ do destinatário (${cnpj}) pertence a uma filial de ${mainCompany.razaoSocial}. Deseja vincular esta NF à matriz (${mainCompany.cnpj}) ou manter na filial específica?`,
                        requiresBranchMapping: true,
                        branchCompany: { id: company._id.toString(), razaoSocial: company.razaoSocial, cnpj: company.cnpj },
                        mainCompany: { id: mainCompany._id.toString(), razaoSocial: mainCompany.razaoSocial, cnpj: mainCompany.cnpj }
                    }, { status: 400 });
                }
            }
            companyId = company._id.toString();
            companyName = company.nomeFantasia || company.razaoSocial;
        } else if (!manualCompanyId) {
            return NextResponse.json({ 
                message: `O CNPJ do destinatário (${cnpj}) não está cadastrado em nenhum portal B2B. Selecione manualmente o cliente vinculado a esta Nota Fiscal.`,
                requiresClientMapping: true,
                cnpj: cnpj,
                destName: dest?.xNome || ''
            }, { status: 400 });
        } else {
             return NextResponse.json({ message: 'Cliente selecionado inválido.' }, { status: 400 });
        }
    } else {
         return NextResponse.json({ message: 'A Nota Fiscal não possui um CNPJ de destinatário válido.' }, { status: 400 });
    }

    // Extract <esp> (espécie) from vol tag — PALETES, VOLUMES, CAIXAS, etc.
    const transp = infNFe.transp;
    let unitType = 'VOLUMES'; // default
    let nfQVol = 0;
    if (transp) {
        const volArr = transp.vol;
        if (volArr && volArr.length > 0) {
            const volData = volArr[0]; // always an array now
            const esp = (volData.esp || '').toString().toUpperCase().trim();
            if (esp.includes('PALETE') || esp.includes('PALLET')) {
                unitType = 'PALETES';
            } else if (esp.includes('CAIXA')) {
                unitType = 'CAIXAS';
            } else if (esp.includes('UNIDADE')) {
                unitType = 'UNIDADES';
            }
            nfQVol = parseInt(volData.qVol || '0', 10);
        }
    }

    let detItems: any[] = infNFe.det;
    // Guard: should always be array but ensure it
    if (!Array.isArray(detItems)) {
        detItems = detItems ? [detItems] : [];
    }
    console.log(`[XML Import] NF ${nfNumber}: ${detItems.length} <det> elements found in XML`);


    const itemsParams = detItems.map((det: any, idx: number) => {
        const prod = det?.prod;
        if (!prod) {
            console.warn(`[XML Import] det[${idx}] (nItem=${det?.nItem}) has no <prod> — skipping`);
            return null;
        }
        const rastro = prod.rastro;
        
        // Handle multiple rastros or single one
        let batch = '';
        let expirationDate = '';
        if (rastro) {
            // rastro is now always an array (isArray config)
            const rastroArr = Array.isArray(rastro) ? rastro : [rastro];
            batch = rastroArr[0]?.nLote || '';
            expirationDate = rastroArr[0]?.dVal || '';
        }

        return {
            sku: prod.cProd || 'S/N',
            name: prod.xProd || '',
            quantity: parseFloat(prod.qCom || '0'),
            nfNumber,
            companyId,
            companyName,
            batch,
            expirationDate
        };
    }).filter((item: any) => item && item.name);
    console.log(`[XML Import] NF ${nfNumber}: ${itemsParams.length} items after filter`);

    if (itemsParams.length === 0) {
        return NextResponse.json({ message: 'Nenhum item válido encontrado no XML da NF-e' }, { status: 400 });
    }

    // Upsert the RECEBIMENTO staging position
    let receivingPos = await db.collection('stock_positions').findOne({ name: 'RECEBIMENTO' });
    if (!receivingPos) {
        const resPos = await db.collection('stock_positions').insertOne({
            name: 'RECEBIMENTO',
            status: 'Ocupado',
            updatedAt: new Date().toISOString()
        });
        receivingPos = { _id: resPos.insertedId, name: 'RECEBIMENTO', status: 'Ocupado' };
    } else {
        await db.collection('stock_positions').updateOne(
            { _id: receivingPos._id },
            { $set: { status: 'Ocupado', updatedAt: new Date().toISOString(), occupiedAt: new Date().toISOString() } }
        );
    }

    // Create items with status "Em Conferência" instead of directly available
    const newItems = itemsParams.map((ip: any) => ({
        ...ip,
        positionId: receivingPos!._id.toString(),
        positionName: receivingPos!.name,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        xmlId: file.name,
        importSource: 'nfe_xml',
        status: 'Em Conferência',
        unitType,
        quantityNf: ip.quantity, // Salvar quantidade original da NF para conferência
    }));

    const result = await db.collection('stock_items').insertMany(newItems);
    
    // Collect inserted IDs
    const insertedIds: string[] = [];
    for (let i = 0; i < result.insertedCount; i++) {
        insertedIds.push(result.insertedIds[i].toString());
    }

    // Create ReceivingBatch record
    const batchDoc = {
        nfNumber,
        companyId,
        companyName,
        unitType,
        nfQVol,
        totalItemsNf: itemsParams.length,
        totalItemsReal: itemsParams.length,
        status: 'Pendente',
        importedAt: new Date().toISOString(),
        xmlFileName: file.name,
        items: insertedIds,
        importedBy: user.username,
    };
    const batchResult = await db.collection('receiving_batches').insertOne(batchDoc);
    const batchId = batchResult.insertedId.toString();

    // Update items with batchId reference
    for (const itemId of insertedIds) {
        await db.collection('stock_items').updateOne(
            { _id: result.insertedIds[insertedIds.indexOf(itemId)] },
            { $set: { receivingBatchId: batchId } }
        );
    }

    // Log movements for each item
    for (let i = 0; i < result.insertedCount; i++) {
        const itemId = result.insertedIds[i].toString();
        const item = newItems[i];
        await logStockMovement(db, { id: itemId, sku: item.sku, name: item.name, companyId: item.companyId, companyName: item.companyName }, {
            type: 'ENTRY',
            quantity: item.quantity,
            toPositionId: item.positionId,
            toPositionName: item.positionName,
            reason: `Entrada via XML NF-e ${nfNumber} (Em Conferência)`,
            user: user as any
        });
    }

    return NextResponse.json({ 
        message: 'NF-e importada com sucesso. Itens aguardando conferência.', 
        insertedCount: newItems.length,
        batchId,
        unitType,
        requiresPalletConfig: unitType === 'PALETES'
    });

  } catch (error) {
    console.error('Failed to process XML:', error);
    return NextResponse.json({ message: 'Erro ao processar arquivo XML', error: String(error) }, { status: 500 });
  }
}
