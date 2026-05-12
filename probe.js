const clientId = "QYXqLJjXhEbgQ4xwWrTze";
const clientSecret = "6KG51dxmV7GDQseDwlesYg94Qf684MxagDX3Llez";

async function run() {
    const authRes = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            audience: "https://api.sandbox.nuvemfiscal.com.br",
            scope: "cte mdfe"
        }).toString()
    });

    const authData = await authRes.json();
    if (!authRes.ok) { console.error(authData); return; }
    
    console.log("Token OK. len=", authData.access_token.length);

    const paths = [
        "/v1/cte", 
        "/v1/cte/", 
        "/v1/cte/emissao",
        "/cte", 
        "/v1/nfe", 
        "/v1/empresas"
    ];

    for (const p of paths) {
        const u = `https://api.sandbox.nuvemfiscal.com.br${p}`;
        console.log("POST:", u);
        const res = await fetch(u, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${authData.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ ambiente: "homologacao" })
        });
        
        console.log(res.status, await res.text());
    }
}
run();
