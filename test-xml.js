import {XMLParser} from 'fast-xml-parser';
import { readFileSync } from 'fs';

// Test with a mini version of the real NF-e XML structure
const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
<NFe>
<infNFe Id="NFe35260438025464000125550010000065491000410465" versao="4.00">
<det>
<nItem>1</nItem>
<prod>
<cEAN>7898932101024</cEAN>
<cProd>000003</cProd>
<qCom>60.0000</qCom>
<xProd>BOIADEIRO FRUTAS FD 3 KG</xProd>
</prod>
</det>
<det>
<nItem>2</nItem>
<prod>
<cEAN>7898932101031</cEAN>
<cProd>000004</cProd>
<qCom>50.0000</qCom>
<xProd>BOIADEIRO INSETOS FD 3 KG</xProd>
</prod>
</det>
<det>
<nItem>3</nItem>
<prod>
<cEAN>SEM GTIN</cEAN>
<cProd>000002</cProd>
<qCom>15.0000</qCom>
<xProd>BOIADEIRO MIX FD 3 KG</xProd>
</prod>
</det>
<ide><nNF>6549</nNF></ide>
<dest><CNPJ>24985404000140</CNPJ><xNome>TEST</xNome></dest>
<transp><vol><esp>PALETES</esp><qVol>13</qVol></vol></transp>
</infNFe>
</NFe>
</nfeProc>`;

console.log("=== Testing with real NF-e structure ===");

// Same config as production code
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (tagName) => {
        return ['det', 'rastro', 'vol', 'item', 'Item'].includes(tagName);
    }
});
const jsonObj = parser.parse(xml);
const infNFe = jsonObj?.nfeProc?.NFe?.infNFe || jsonObj?.NFe?.infNFe;

console.log('infNFe keys:', Object.keys(infNFe || {}));
console.log('infNFe.det type:', typeof infNFe?.det, 'isArray:', Array.isArray(infNFe?.det));

let detItems = infNFe?.det;
if (!Array.isArray(detItems)) {
    detItems = detItems ? [detItems] : [];
}

console.log('detItems.length:', detItems.length);
detItems.forEach((d, i) => {
    const prod = d?.prod;
    console.log(`  [${i}] nItem=${d?.nItem} prod keys:`, Object.keys(prod || {}), 'xProd:', prod?.xProd);
});
