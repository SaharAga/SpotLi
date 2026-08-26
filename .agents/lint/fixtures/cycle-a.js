// Half of a deliberate cycle. Expected: import/no-cycle.
import { b } from './cycle-b.js';
export const a = () => b;
