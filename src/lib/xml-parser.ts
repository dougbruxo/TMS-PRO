export interface ParsedItem {
  codigo: string;
  descricao: string;
  quantidade: number;
}

export interface ParsedNfeData {
  chNFe: string;
  nNF: string;
  vNF: number;
  pesoB: number;
  qVol: number;
  produtos: ParsedItem[];
  xProd?: string;
  esp?: string;
  nfeCfop?: string;
  emitente: {
    cnpjCpf: string;
    nome: string;
    ie: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    cMun: string;
  };
  destinatario: {
    cnpjCpf: string;
    nome: string;
    ie: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    cMun: string;
  };
}

export function parseNfeXml(xmlString: string): ParsedNfeData | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
    if (!infNFe && !xmlDoc.getElementsByTagName("nNF")[0]) return null;

    const chNFe = xmlDoc.getElementsByTagName("chNFe")[0]?.textContent || xmlDoc.getElementsByTagName("Id")[0]?.textContent?.replace('NFe', '') || '';
    const nNF = xmlDoc.getElementsByTagName("nNF")[0]?.textContent || '';
    
    // Totals and Volumes
    const vNF = xmlDoc.getElementsByTagName("vNF")[0]?.textContent || xmlDoc.getElementsByTagName("vProd")[0]?.textContent;
    const pesoB = xmlDoc.getElementsByTagName("pesoB")[0]?.textContent || xmlDoc.getElementsByTagName("qVol")[0]?.textContent;
    const qVol = xmlDoc.getElementsByTagName("qVol")[0]?.textContent;
    const xProd = xmlDoc.getElementsByTagName("xProd")[0]?.textContent || undefined;
    const esp = xmlDoc.getElementsByTagName("esp")[0]?.textContent || undefined;

    // Details / CFOP
    const detElements = xmlDoc.getElementsByTagName("det");
    const nfeCfop = detElements[0]?.getElementsByTagName("CFOP")[0]?.textContent || undefined;
    
    const produtos: ParsedItem[] = Array.from(detElements).map(det => {
      const prod = det.getElementsByTagName("prod")[0];
      return {
        codigo: prod?.getElementsByTagName("cProd")[0]?.textContent || '',
        descricao: prod?.getElementsByTagName("xProd")[0]?.textContent || '',
        quantidade: Number(prod?.getElementsByTagName("qCom")[0]?.textContent) || 1
      };
    }).filter(p => !!p.descricao);

    const extractParty = (tagName: string) => {
      const tag = xmlDoc.getElementsByTagName(tagName)[0];
      let cnpjCpf = '';
      let nome = '';
      let ie = '';
      let endereco = '';
      let cidade = '';
      let estado = '';
      let cep = '';
      let cMun = '';

      if (tag) {
        cnpjCpf = tag.getElementsByTagName('CNPJ')[0]?.textContent || tag.getElementsByTagName('CPF')[0]?.textContent || '';
        nome = tag.getElementsByTagName('xNome')[0]?.textContent || '';
        ie = tag.getElementsByTagName('IE')[0]?.textContent || '';
        const ender = tag.getElementsByTagName(tagName === 'emit' ? 'enderEmit' : 'enderDest')[0];
        if (ender) {
          const xLgr = ender.getElementsByTagName('xLgr')[0]?.textContent || '';
          const nro = ender.getElementsByTagName('nro')[0]?.textContent || '';
          const xBairro = ender.getElementsByTagName('xBairro')[0]?.textContent || '';
          
          endereco = `${xLgr}${nro ? `, ${nro}` : ''}${xBairro ? ` - ${xBairro}` : ''}`;
          cidade = ender.getElementsByTagName('xMun')[0]?.textContent || '';
          estado = ender.getElementsByTagName('UF')[0]?.textContent || '';
          cep = ender.getElementsByTagName('CEP')[0]?.textContent || '';
          cMun = ender.getElementsByTagName('cMun')[0]?.textContent || '';
        }
      }
      return { cnpjCpf, nome, ie, endereco, cidade, estado, cep, cMun };
    };

    return {
      errors: [], // adding this because ExpeditionRequestForm uses `parsed.errors`
      dadosNfe: { numero: nNF }, // adding this because ExpeditionRequestForm uses `parsed.dadosNfe.numero`
      produtos,
      chNFe,
      nNF,
      vNF: vNF ? Number(vNF) : 0,
      pesoB: pesoB ? Number(pesoB) : 0,
      qVol: qVol ? Number(qVol) : 0,
      xProd,
      esp,
      nfeCfop,
      emitente: extractParty('emit'),
      destinatario: extractParty('dest')
    };
  } catch (error: any) {
    console.error("Erro ao fazer parse do XML da NFe:", error);
    return { errors: [error.message], dadosNfe: { numero: '' }, produtos: [] } as any;
  }
}
