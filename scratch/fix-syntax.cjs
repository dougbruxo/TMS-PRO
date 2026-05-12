const fs = require('fs');
let content = fs.readFileSync('src/lib/sefaz/dacte-template.tsx', 'utf8');

// The file currently has `{LabelValue({ label: "...", value: {data.something}...})}`
// We need to fix `value: {something}` to `value: something`

content = content.replace(/value:\s*\{([^}]+)\}/g, 'value: $1');

fs.writeFileSync('src/lib/sefaz/dacte-template.tsx', content);
console.log('Fixed syntax error!');
