import { renderToStream, Document, Page, Text } from '@react-pdf/renderer';
import React from 'react';

async function test() {
    try {
      const el = React.createElement(Document, null, 
        React.createElement(Page, null, 
          React.createElement(Text, null, 123)
        )
      );
      await renderToStream(el);
      console.log("Success with number child");
    } catch (e) {
      console.error("Number child error:", e.message);
    }
}
test();
