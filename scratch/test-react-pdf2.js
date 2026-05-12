import { renderToStream, Document, Page, Text } from '@react-pdf/renderer';
import React from 'react';

async function test() {
  try {
    const nextEl = {
      $$typeof: Symbol.for('react.element'),
      type: Document,
      key: null,
      ref: "test", // This should trigger 284
      props: {
        children: {
          $$typeof: Symbol.for('react.element'),
          type: Page,
          key: null,
          ref: null,
          props: {
            children: "Hello"
          }
        }
      }
    };
    await renderToStream(nextEl);
    console.log("Success with string ref");
  } catch (e) {
    console.error("Failed string ref:", e.message);
  }
}
test();
