async function run() {
    const paths = [
        "/v1/cte",
        "/cte",
        "/cte/v1",
        "/v1/cte/emissao"
    ];

    for (const p of paths) {
        const u = `https://api.sandbox.nuvemfiscal.com.br${p}`;
        console.log("Testing:", u);
        const res = await fetch(u, { method: "POST" });
        console.log("Status:", res.status);
        if (!res.ok) {
            console.log("Body:", await res.text());
        }
        console.log("-------------------");
    }
}
run();
