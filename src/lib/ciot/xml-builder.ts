
/**
 * XML Builder para CIOT (ANTT) - Versão 2026
 * Gera o envelope SOAP e o corpo do XML para integração direta.
 */

export interface CiotXmlDados {
    usuario: string;
    senha: string;
    rntrcEmitente: string;
    cpfCnpjContratado: string;
    nomeContratado: string;
    valorFrete: number;
    valorAdiantamento: number;
    origemIBGE: string;
    destinoIBGE: string;
    placa: string;
    documentos: string[]; // Chaves de CT-e/NF-e
}

export function buildCiotXml(dados: CiotXmlDados): string {
    const dataEmissao = new Date().toISOString();
    
    // Gerar lista de documentos (CT-e/NF-e)
    const docsXml = dados.documentos.map(chave => `
        <documento>
            <tipo>1</tipo> <!-- 1 para CT-e -->
            <chave>${chave}</chave>
        </documento>
    `).join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RegistrarOperacaoTransporte xmlns="http://antt.gov.br/ciot">
      <request>
        <cabecalho>
          <usuario>${dados.usuario}</usuario>
          <senha>${dados.senha}</senha>
          <versao>1.0.0</versao>
        </cabecalho>
        <corpo>
          <rntrcEmitente>${dados.rntrcEmitente}</rntrcEmitente>
          <contratado>
            <documento>${dados.cpfCnpjContratado}</documento>
            <nome>${dados.nomeContratado}</nome>
          </contratado>
          <viagem>
            <origem>${dados.origemIBGE}</origem>
            <destino>${dados.destinoIBGE}</destino>
            <dataInicio>${dataEmissao}</dataInicio>
            <veiculo>
              <placa>${dados.placa}</placa>
            </veiculo>
          </viagem>
          <valores>
            <total>${dados.valorFrete.toFixed(2)}</total>
            <adiantamento>${dados.valorAdiantamento.toFixed(2)}</adiantamento>
          </valores>
          <documentosTransporte>
            ${docsXml}
          </documentosTransporte>
        </corpo>
      </request>
    </RegistrarOperacaoTransporte>
  </soap:Body>
</soap:Envelope>`;
}
