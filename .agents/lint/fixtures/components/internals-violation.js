// Components must import a module's public surface, not a path inside it.
import { inner } from '../utils/deep/inner.js';
import { he } from '../i18n/locales/he.js';
export const C = () => [inner, he];
