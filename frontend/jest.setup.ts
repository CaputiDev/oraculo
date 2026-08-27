import '@testing-library/jest-dom';

// Polyfill para scrollIntoView no ambiente JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn();
