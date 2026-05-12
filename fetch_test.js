const fs = require('fs');

async function testFetch() {
  try {
    const response = await fetch('http://localhost:3000/api/dashboard/alerts');
    const text = await response.text();
    fs.writeFileSync('temp_api_output.json', text);
    console.log("Wrote API response to temp_api_output.json");
  } catch (err) {
    console.error(err);
  }
}
testFetch();
