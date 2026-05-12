const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));
    const schemas = data.components?.schemas || data.definitions;

    let rodoSchema = schemas['CteSefazRodo'] || schemas['TRodo'];

    if (rodoSchema) {
        console.log("Keys found in Cte/TRodo:");
        console.log(Object.keys(rodoSchema.properties || {}));
    } else {
        const keys = Object.keys(schemas);
        console.log(keys.filter(k => k.toLowerCase().includes('rodo')));
    }
} catch(e) { console.error(e); }
