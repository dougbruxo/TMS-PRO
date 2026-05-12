async function run() {
    console.log("Fetching swagger...");
    const res = await fetch("https://api.nuvemfiscal.com.br/openapi/swagger.json");
    if (!res.ok) { console.log(res.status); return; }
    const swagger = await res.json();
    console.log("Searching for CteSefazIde...");
    // Find the definition for the 'ide' object inside CTe
    const ide = swagger.definitions?.CteSefazIde || swagger.components?.schemas?.CteSefazIde;
    if (ide) {
        console.log("cUF type:", ide.properties?.cUF?.type);
        console.log("mod type:", ide.properties?.mod?.type);
        console.log("indIEToma type:", ide.properties?.indIEToma?.type);
        console.log("retira type:", ide.properties?.retira?.type);
        console.log("tpEmis type:", ide.properties?.tpEmis?.type);
        console.log("tpServ type:", ide.properties?.tpServ?.type);
        console.log("cMunEnv type:", ide.properties?.cMunEnv?.type);
        console.log("modal type:", ide.properties?.modal?.type);
    } else {
        console.log("CteSefazIde not found. Let's look for definitions.");
        console.log(Object.keys(swagger.components.schemas).filter(k => k.includes('CteSefaz')));
    }
}
run();
