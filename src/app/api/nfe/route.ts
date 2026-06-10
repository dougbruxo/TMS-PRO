import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { NfeData } from '@/lib/types';

// Função para extrair dados do XML da NF-e
function parseNfeXml(xml: string): NfeData {
    // 1. Higieniza o XML contra caracteres especiais brutos (como '<' ou '&' soltos no texto)
    const sanitizedXml = xml
      .replace(/<(?!\/?([a-zA-Z_][a-zA-Z0-9_\-\:]*)|[?!])/g, '&lt;')
      .replace(/&(?!(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/gi, '&amp;');

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true, // Remove namespace prefixes so we don't worry about nfe: or ns2:
    });
    const jsonObj = parser.parse(xml);
    
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
    
    const nfeNode = findKey(jsonObj, 'infNFe');

    if (!nfeNode) {
        throw new Error("Estrutura do XML da NF-e inválida ou não reconhecida.");
    }
    
    const getSafeValue = (obj: any, path: string, defaultValue: string = 'N/A') => {
        return path.split('.').reduce((acc, part) => (acc && acc[part]) ? acc[part] : undefined, obj) || defaultValue;
    }

    const nfNumber = getSafeValue(nfeNode, 'ide.nNF');
    const volumeCount = getSafeValue(nfeNode, 'transp.vol.qVol', 1);

    const remetenteNode = nfeNode.emit;
    const remetente = getSafeValue(remetenteNode, 'xNome');
    const remetenteEnderecoNode = remetenteNode.enderEmit;
    const remetenteEndereco = [
        getSafeValue(remetenteEnderecoNode, 'xLgr'),
        getSafeValue(remetenteEnderecoNode, 'nro'),
        getSafeValue(remetenteEnderecoNode, 'xBairro'),
        getSafeValue(remetenteEnderecoNode, 'xMun'),
        getSafeValue(remetenteEnderecoNode, 'UF'),
        `CEP: ${getSafeValue(remetenteEnderecoNode, 'CEP')}`
    ].filter(Boolean).join(', ');

    const destinatarioNode = nfeNode.dest;
    const destinatario = getSafeValue(destinatarioNode, 'xNome');
    const destinatarioEnderecoNode = destinatarioNode.enderDest;
    const destinatarioEndereco = [
        getSafeValue(destinatarioEnderecoNode, 'xLgr'),
        getSafeValue(destinatarioEnderecoNode, 'nro'),
        getSafeValue(destinatarioEnderecoNode, 'xBairro'),
        getSafeValue(destinatarioEnderecoNode, 'xMun'),
        getSafeValue(destinatarioEnderecoNode, 'UF'),
        `CEP: ${getSafeValue(destinatarioEnderecoNode, 'CEP')}`
    ].filter(Boolean).join(', ');

    return {
        nfNumber: String(nfNumber),
        volumeCount: Number(volumeCount),
        remetente,
        remetenteEndereco,
        destinatario,
        destinatarioEndereco,
    };
}


// Endpoint para processar um XML via POST
export async function POST(request: Request) {
  try {
    const xmlContent = await request.text();
    if (!xmlContent) {
        return NextResponse.json({ message: 'Corpo da requisição está vazio.' }, { status: 400 });
    }
    const nfeData = parseNfeXml(xmlContent);
    return NextResponse.json(nfeData);

  } catch (error: any) {
    console.error('[API NFE POST Error]', error);
    return NextResponse.json({ message: `Erro ao processar o XML da NF-e: ${error.message}` }, { status: 500 });
  }
}

// Endpoint para buscar dados por chave de acesso via GET
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key || key.length !== 44) {
        return NextResponse.json({ message: 'Chave de acesso inválida ou não fornecida. A chave deve conter 44 dígitos.' }, { status: 400 });
    }
  
    try {
        const nfNumber = key.substring(25, 34);
        const cnpjEmitente = key.substring(6, 20);

        let remetenteNome = `REMETENTE DA NF ${nfNumber}`;
        let remetenteEndereco = `ENDEREÇO DO REMETENTE DA NF ${nfNumber}`;

        // Busca os dados do CNPJ do remetente
        const cnpjResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjEmitente}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (cnpjResponse.ok) {
            const cnpjData = await cnpjResponse.json();
            remetenteNome = cnpjData.razao_social || remetenteNome;
            remetenteEndereco = [
                cnpjData.descricao_tipo_de_logradouro,
                cnpjData.logradouro,
                cnpjData.numero,
                cnpjData.complemento,
                cnpjData.bairro,
                cnpjData.municipio,
                cnpjData.uf,
                `CEP: ${cnpjData.cep}`
            ].filter(Boolean).join(', ');
        }
        
        // Mantém dados do destinatário como placeholder, pois não podem ser extraídos da chave
        const destinatarioNome = `DESTINATÁRIO DA NF ${nfNumber}`;
        const destinatarioEndereco = `ENDEREÇO DO DESTINATÁRIO DA NF ${nfNumber}`;

        const nfeData: NfeData = {
            nfNumber: String(parseInt(nfNumber, 10)),
            volumeCount: 1, // Valor padrão, já que não pode ser extraído da chave
            remetente: remetenteNome,
            remetenteEndereco: remetenteEndereco,
            destinatario: destinatarioNome,
            destinatarioEndereco: destinatarioEndereco,
        };

        return NextResponse.json(nfeData);

    } catch (error: any) {
        console.error('[API NFE GET Error]', error);
        return NextResponse.json({ message: `Erro ao processar a chave da NF-e: ${error.message}` }, { status: 500 });
    }
}
