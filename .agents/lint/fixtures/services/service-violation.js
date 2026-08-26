// services/ must not import context/. Expected: no-restricted-imports.
import { AuthContext } from '../context/AuthContext.js';
export const svc = () => AuthContext;
