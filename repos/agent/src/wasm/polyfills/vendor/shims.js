if (typeof globalThis === 'undefined') {
  // @ts-ignore
  (this || self || global).globalThis = (this || self || global);
}

Math.random = () => 0.5
