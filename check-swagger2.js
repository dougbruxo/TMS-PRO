async function run() {
    const res = await fetch("https://api.nuvemfiscal.com.br/openapi/swagger.json");
    const swagger = await res.json();
    const ide = swagger.components.schemas.CteSefazIde.properties;
    
    console.log("== IDE === ");
    for(let k in ide) {
        if(ide[k].type === "integer") console.log(k);
    }
    
    const toma3 = swagger.components.schemas.CteSefazToma3.properties;
    console.log("== TOMA3 === ");
    for(let k in toma3) {
        if(toma3[k].type === "integer") console.log(k);
    }

    const toma4 = swagger.components.schemas.CteSefazToma4?.properties;
    console.log("== TOMA4 === ");
    if(toma4){
        for(let k in toma4) {
            if(toma4[k].type === "integer") console.log(k);
        }
    }
}
run();
