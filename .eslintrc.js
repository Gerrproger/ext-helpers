module.exports = {
  root: true,
  env: {
    es6: true,
    browser: true,
  },
  globals: {
    chrome: true,
  },
  parserOptions: {
    ecmaVersion: '2020',
  },
  extends: ['eslint:recommended'],
  rules: {
    indent: 'off',
    semi: ['error', 'always', { omitLastInOneLineBlock: true }],
    quotes: ['warn', 'single'],
    'template-curly-spacing': 'off',
    'no-prototype-builtins': 'off',
    'quote-props': ['warn', 'consistent-as-needed'],
    'object-shorthand': ['warn', 'properties'],
  },
};
