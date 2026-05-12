async function run() {
    const res = await fetch("https://api.nuvemfiscal.com.br/openapi/swagger.json");
    if(!res.ok) { console.log(res.status); return; }
    const swagger = await res.json();
    
    console.log("== IDE MDFE === ");
    const ide = swagger.components.schemas.MdfeSefazIde?.properties;
    if(ide) {
        for(let k in ide) {
            if(ide[k].type === "integer") console.log(k);
        }
    }
}
run();
