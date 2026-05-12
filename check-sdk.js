async function run() {
    const res = await fetch("https://raw.githubusercontent.com/nuvem-fiscal/nuvemfiscal-sdk-node/main/src/api/ctes-api.ts");
    if (!res.ok) { console.log(res.status); return; }
    const txt = await res.text();
    console.log(txt.split('\n').filter(l => l.includes("nuvemfiscal") || l.includes('http')).join('\n'));
}
run();
