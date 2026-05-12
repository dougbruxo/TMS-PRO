import { renderToStream, Document, Page, Text } from '@react-pdf/renderer';
import React from 'react';

async function test() {
  try {
    const el = React.createElement(Document, null, React.createElement(Page, null, React.createElement(Text, null, "Hello")));
    const stream = await renderToStream(el);
    console.log("Success with pure React 18 element!");
    
    // Now simulate Next.js 15 element
    const nextEl = {
      $$typeof: Symbol.for('react.element'),
      type: Document,
      key: null,
      ref: null,
      props: {
        children: {
          $$typeof: Symbol.for('react.element'),
          type: Page,
          key: null,
          ref: null,
          props: {
            children: {
              $$typeof: Symbol.for('react.element'),
              type: Text,
              key: null,
              ref: null,
              props: { children: "Hello" }
            }
          }
        }
      }
    };
    const stream2 = await renderToStream(nextEl);
    console.log("Success with simulated element!");
  } catch (e) {
    console.error("Failed:", e);
  }
}
test();
