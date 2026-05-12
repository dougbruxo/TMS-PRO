import { renderToStream, Document, Page, Text } from '@react-pdf/renderer';
import React from 'react';

async function test() {
  const tryRef = async (refVal) => {
    try {
      const nextEl = {
        $$typeof: Symbol.for('react.element'),
        type: Document,
        key: null,
        ref: refVal,
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
    } catch (e) {
      console.log("Ref:", typeof refVal === 'object' ? JSON.stringify(refVal) : typeof refVal, "-> Error", e.message.match(/invariant=(\d+)/)?.[1]);
    }
  };
  await tryRef({});
  await tryRef([]);
  await tryRef(123);
  await tryRef(Symbol());
  await tryRef({ current: "test" });
  await tryRef({ current: null });
}
test();
