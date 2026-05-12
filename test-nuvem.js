const clientId = "QYXqLJjXhEbgQ4xwWrTze";
const clientSecret = "6KG51dxmV7GDQseDwlesYg94Qf684MxagDX3Llez";

async function run() {
    console.log("1. Autenticando...");
    const authRes = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "cte mdfe"
        }).toString()
    });

    if (!authRes.ok) {
        console.error("Auth Fail:", await authRes.text());
        return;
    }
    const authData = await authRes.json();
    console.log("Bearer acquired:", authData.access_token.substring(0, 10) + "...");

    console.log("2. Disparando CTe Sandbox...");
    const res = await fetch("https://api.sandbox.nuvemfiscal.com.br/v1/cte", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${authData.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ infCte: { ide: { cUF: "SP", tpAmb: 2, mod: "57" } } })
    });

    console.log("Status:", res.status);
    console.log("Body:", await res.text());
}

run();
