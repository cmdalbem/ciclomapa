module.exports = {
  root: true,
  extends: ['react-app', 'prettier'],
  rules: {
    'react/prop-types': ['warn', { skipUndeclared: false }],
  },
};
