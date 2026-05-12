/**
 * DezLog Fiscal Engine — XML Digital Signer (XMLDSIG)
 * 
 * Assina o XML do CT-e com o certificado digital A1 (ICP-Brasil).
 * 
 * Padrão: W3C XML-Signature Syntax and Processing (XMLDSig)
 * Algoritmos: RSA-SHA1 (exigido pela SEFAZ)
 * Canonicalização: Exclusive XML Canonicalization (exc-c14n)
 * 
 * O nó <Signature> é inserido como filho direto de <CTe>,
 * após o nó <infCte>.
 */

/**
 * DezLog Fiscal Engine — XML Digital Signer (XMLDSIG)
 * 
 * Assina o XML do CT-e com o certificado digital A1 (ICP-Brasil).
 * Utiliza o pacote padrão xml-crypto que respeita 100% as regras da W3C.
 */

const { SignedXml } = require('xml-crypto');

/**
 * Assina o XML do CT-e com o certificado A1.
 */
export function signCteXml(
  xml: string,
  privateKeyPem: string,
  certificateBase64: string
): string {
  return signNode(xml, 'infCte', privateKeyPem, certificateBase64);
}

/**
 * Assina um evento (cancelamento, CC-e, encerramento, etc.)
 */
export function signEventoXml(
  xml: string,
  privateKeyPem: string,
  certificateBase64: string
): string {
  return signNode(xml, 'infEvento', privateKeyPem, certificateBase64);
}

/**
 * Assina um MDF-e.
 */
export function signMdfeXml(
  xml: string,
  privateKeyPem: string,
  certificateBase64: string
): string {
  return signNode(xml, 'infMDFe', privateKeyPem, certificateBase64);
}

/**
 * Lógica central para usar xml-crypto
 */
function signNode(
  xml: string,
  targetNodeName: string,
  privateKeyPem: string,
  certificateBase64: string
): string {
  // A SEFAZ exige que a declaração <?xml ...?> não venha na assinatura final enviada pelo SOAP
  // mas o SignedXml pode se perder se o XPath não bater com o root namespace.
  
  const cleanCert = certificateBase64
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n/g, '')
    .replace(/\s/g, '')
    .trim();

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    getKeyInfoContent: () => {
      // Retorna o conteúdo interno da tag <KeyInfo>
      return `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`;
    }
  });
  
  sig.addReference({
    xpath: `//*[local-name(.)='${targetNodeName}']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
  });

  // O comportamento padrão do xml-crypto (quando omitimos 'location') é
  // adicionar o nó <Signature> como o último filho do elemento raiz (CTe, eventoCTe, MDFe).
  // Isso garante a ordem correta exigida pela SEFAZ:
  // <CTe> -> <infCte> -> <infCTeSupl> -> <Signature>
  sig.computeSignature(xml);
  
  let signedXml = sig.getSignedXml();
  
  // Remover a declaração XML no inicio pois o SOAP não aceita declaração XML dupla
  signedXml = signedXml.replace(/<\?xml[^>]*\?>\s*/, '');
  
  return signedXml;
}

