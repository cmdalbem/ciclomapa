/** Jest stub for static asset imports (png, svg, etc.). */
const React = require('react');

module.exports = {
  __esModule: true,
  default: 'test-file-stub',
  // SVGR `import { ReactComponent as X } from './file.svg'`
  ReactComponent: React.forwardRef(function SvgMock(props, ref) {
    return React.createElement('svg', { ...props, ref });
  }),
};
