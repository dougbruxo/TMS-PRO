const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));
    console.log("Parsing schemas...");
    const schemas = data.components?.schemas || data.definitions;

    let infCteSchema = schemas['CteSefazInfCte'];
    if(!infCteSchema) {
        infCteSchema = schemas['TInfCte'];
    }

    if (infCteSchema) {
        console.log("Keys found in Cte/TInfCte:");
        console.log(Object.keys(infCteSchema.properties || {}));
    } else {
        const keys = Object.keys(schemas);
        console.log("No exact match. Similar schemas:");
        console.log(keys.filter(k => k.toLowerCase().includes('infcte') || k.toLowerCase().includes('carga')));
    }
} catch(e) { console.error(e); }
