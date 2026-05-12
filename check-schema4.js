const fs = require('fs');
const data = JSON.parse(fs.readFileSync('swagger.json'));
const norm = Object.keys(data.components?.schemas?.CteSefazInfCTeNorm?.properties || data.components?.schemas?.TInfCTeNorm?.properties || {});
console.log("Keys in infCTeNorm:", norm);

const infCte = Object.keys(data.components?.schemas?.CteSefazInfCte?.properties || data.components?.schemas?.TInfCte?.properties || {});
console.log("Keys in infCte:", infCte);
