async function check() {
    console.log("Fetching Nuvem Fiscal OpenAPI Schema...");
    const url = "https://raw.githubusercontent.com/nuvem-fiscal/nuvemfiscal-openapi/main/schemas/cte.json";
    const res = await fetch(url);
    if (!res.ok) {
        console.log("Failed to fetch schema.");
        return;
    }
    const data = await res.json();
    console.log("Keys in paths:");
    console.log(Object.keys(data.paths).filter(p => p.includes("cte")));
}
check();
