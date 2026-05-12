const fs = require('fs');
let content = fs.readFileSync('src/lib/sefaz/dacte-template.tsx', 'utf8');

// 1. Fix JSX pragma back to what it was
content = content.replace('/** @jsx React.createElement */', '/** @jsxImportSource react */');

// 2. Replace <LabelValue ... /> with {LabelValue({ ... })}
// The format is: <LabelValue label="TIPO DO CT-E" value={data.tipoCte} style={[s.flex1, s.boxNoBorderTop]} />
// Or: <LabelValue label="TIPO" value={data.tomador.tipo} style={{ width: 80 }} />
// Or without style: <LabelValue label="TIPO" value={data.tomador.tipo} />

const regex = /<LabelValue\s+label=(.*?)\s+value=(.*?)(?:\s+style=\{(.*?)\})?\s*\/>/g;

content = content.replace(regex, (match, label, value, style) => {
  let styleProp = style ? `, style: ${style}` : '';
  return `{LabelValue({ label: ${label}, value: ${value}${styleProp} })}`;
});

fs.writeFileSync('src/lib/sefaz/dacte-template.tsx', content);
console.log('Replaced LabelValue calls!');
