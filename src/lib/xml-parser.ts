export interface ParsedItem {
  codigo: string;
  descricao: string;
  quantidade: number;
}

export interface ParsedNfeData {
  errors: string[];
  dadosNfe: { numero: string };
  chNFe: string;
  nNF: string;
  vNF: number;
  pesoB: number;
  qVol: number;
  produtos: ParsedItem[];
  xProd?: string;
  esp?: string;
  nfeCfop?: string;
  modFrete?: string;
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

function getElementsByTagNameIgnoreNamespace(parent: Document | Element, tagName: string): Element[] {
  const result: Element[] = [];
  const targetLower = tagName.toLowerCase();
  
  // 1. Try standard getElementsByTagName
  const elements = parent.getElementsByTagName(tagName);
  if (elements && elements.length > 0) {
    return Array.from(elements);
  }
  
  // 2. Try standard getElementsByTagNameNS with wildcard namespace
  try {
    const nsElements = parent.getElementsByTagNameNS("*", tagName);
    if (nsElements && nsElements.length > 0) {
      return Array.from(nsElements);
    }
  } catch (e) {}

  // 3. Fallback manual recursive traversal checking localName (ignoring case & prefixes)
  const allElements = parent.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const localName = el.localName || el.tagName.split(':').pop();
    if (localName && localName.toLowerCase() === targetLower) {
      result.push(el);
    }
  }
  
  return result;
}

function getFirstElementIgnoreNamespace(parent: Document | Element, tagName: string): Element | null {
  const list = getElementsByTagNameIgnoreNamespace(parent, tagName);
  return list.length > 0 ? list[0] : null;
}

export function parseNfeXml(xmlString: string): ParsedNfeData | null {
  try {
    // 1. Higieniza o XML contra caracteres especiais brutos (como '<' ou '&' soltos no texto de infCpl/obs)
    const sanitizedXml = xmlString
      .replace(/<(?!\/?([a-zA-Z_][a-zA-Z0-9_\-\:]*)|[?!])/g, '&lt;')
      .replace(/&(?!(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/gi, '&amp;');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(sanitizedXml, "text/xml");

    const infNFe = getFirstElementIgnoreNamespace(xmlDoc, "infNFe");
    const hasNNF = getFirstElementIgnoreNamespace(xmlDoc, "nNF");
    if (!infNFe && !hasNNF) return null;

    // Access key extraction
    const chNFeEl = getFirstElementIgnoreNamespace(xmlDoc, "chNFe");
    let chNFe = chNFeEl?.textContent || '';
    if (!chNFe) {
      const idEl = getFirstElementIgnoreNamespace(xmlDoc, "infNFe") || getFirstElementIgnoreNamespace(xmlDoc, "NFe");
      const idAttr = idEl?.getAttribute("Id") || idEl?.getAttribute("id");
      if (idAttr) {
        chNFe = idAttr.replace('NFe', '');
      }
    }
    
    const nNF = getFirstElementIgnoreNamespace(xmlDoc, "nNF")?.textContent || '';
    
    // Totals and Volumes
    const vNF = getFirstElementIgnoreNamespace(xmlDoc, "vNF")?.textContent || getFirstElementIgnoreNamespace(xmlDoc, "vProd")?.textContent;
    const pesoB = getFirstElementIgnoreNamespace(xmlDoc, "pesoB")?.textContent || getFirstElementIgnoreNamespace(xmlDoc, "qVol")?.textContent;
    const qVol = getFirstElementIgnoreNamespace(xmlDoc, "qVol")?.textContent;
    const xProd = getFirstElementIgnoreNamespace(xmlDoc, "xProd")?.textContent || undefined;
    const esp = getFirstElementIgnoreNamespace(xmlDoc, "esp")?.textContent || undefined;

    // Details / CFOP
    const detElements = getElementsByTagNameIgnoreNamespace(xmlDoc, "det");
    const nfeCfop = detElements[0] ? (getFirstElementIgnoreNamespace(detElements[0], "CFOP")?.textContent || undefined) : undefined;
    
    const produtos: ParsedItem[] = detElements.map(det => {
      const prod = getFirstElementIgnoreNamespace(det, "prod");
      return {
        codigo: prod ? (getFirstElementIgnoreNamespace(prod, "cProd")?.textContent || '') : '',
        descricao: prod ? (getFirstElementIgnoreNamespace(prod, "xProd")?.textContent || '') : '',
        quantidade: prod ? (Number(getFirstElementIgnoreNamespace(prod, "qCom")?.textContent) || 1) : 1
      };
    }).filter(p => !!p.descricao);

    const extractParty = (tagName: string) => {
      const tag = getFirstElementIgnoreNamespace(xmlDoc, tagName);
      let cnpjCpf = '';
      let nome = '';
      let ie = '';
      let endereco = '';
      let cidade = '';
      let estado = '';
      let cep = '';
      let cMun = '';

      if (tag) {
        cnpjCpf = getFirstElementIgnoreNamespace(tag, 'CNPJ')?.textContent || getFirstElementIgnoreNamespace(tag, 'CPF')?.textContent || '';
        nome = getFirstElementIgnoreNamespace(tag, 'xNome')?.textContent || '';
        ie = getFirstElementIgnoreNamespace(tag, 'IE')?.textContent || '';
        
        const enderTagName = tagName === 'emit' ? 'enderEmit' : 'enderDest';
        const ender = getFirstElementIgnoreNamespace(tag, enderTagName);
        if (ender) {
          const xLgr = getFirstElementIgnoreNamespace(ender, 'xLgr')?.textContent || '';
          const nro = getFirstElementIgnoreNamespace(ender, 'nro')?.textContent || '';
          const xBairro = getFirstElementIgnoreNamespace(ender, 'xBairro')?.textContent || '';
          
          endereco = `${xLgr}${nro ? `, ${nro}` : ''}${xBairro ? ` - ${xBairro}` : ''}`;
          cidade = getFirstElementIgnoreNamespace(ender, 'xMun')?.textContent || '';
          estado = getFirstElementIgnoreNamespace(ender, 'UF')?.textContent || '';
          cep = getFirstElementIgnoreNamespace(ender, 'CEP')?.textContent || '';
          cMun = getFirstElementIgnoreNamespace(ender, 'cMun')?.textContent || '';
        }
      }
      return { cnpjCpf, nome, ie, endereco, cidade, estado, cep, cMun };
    };

    const modFrete = getFirstElementIgnoreNamespace(xmlDoc, "modFrete")?.textContent || undefined;

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
      modFrete,
      emitente: extractParty('emit'),
      destinatario: extractParty('dest')
    };
  } catch (error: any) {
    console.error("Erro ao fazer parse do XML da NFe:", error);
    return { errors: [error.message], dadosNfe: { numero: '' }, produtos: [] } as any;
  }
}
