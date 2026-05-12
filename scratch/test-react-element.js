const React = require('react');

const originalElement = React.createElement('div', { className: 'test' }, 'Hello');
console.log('Original element $$typeof:', originalElement.$$typeof.toString());
console.log('Original element keys:', Object.keys(originalElement));
