import React from 'react';
import { renderToFile, Document, Page, Text } from '@react-pdf/renderer';

const MyDoc = () => React.createElement(Document, null, 
  React.createElement(Page, null, 
    React.createElement(Text, null, 'Hello PDF World')
  )
);

async function run() {
  try {
    console.log('Generating PDF...');
    await renderToFile(React.createElement(MyDoc), './test.pdf');
    console.log('PDF generated successfully!');
  } catch (err) {
    console.error('Error generating PDF:', err);
  }
}

run();
