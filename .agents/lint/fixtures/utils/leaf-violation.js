// Leaf layer must not import services/. Expected: no-restricted-imports.
import { thing } from '../services/thing.js';
export const useThing = () => thing;
