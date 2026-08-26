// Allowed: a sibling leaf, and a third-party package whose SUBPATH happens to
// contain a layer name. Neither may be reported.
import { CARRIERS } from '../types/carriers.js';
import { useX } from 'some-lib/hooks/useX';
import { Button } from '@scope/ui/components/Button';
export const ok = [CARRIERS, useX, Button];
