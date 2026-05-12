async function run() {
    const res = await fetch("https://api.nuvemfiscal.com.br/openapi/swagger.json");
    const swagger = await res.json();
    
    // Look at properties of CteSefazInfCte
    const infCte = swagger.components.schemas.CteSefazInfCte?.properties;
    if (infCte) {
        console.log("Keys in CteSefazInfCte:");
        console.log(Object.keys(infCte).filter(k => k.toLowerCase().includes('carga')));
        
        // Output all top level keys
        console.log("ALL KEYS: ", Object.keys(infCte));
    } else {
        console.log(Object.keys(swagger.components.schemas).filter(k => k.includes('CteSefaz')));
    }
}
run();
