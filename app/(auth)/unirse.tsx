import { useState } from 'react';
import JoinClassScreen from '@features/dashboard/screens/JoinClassScreen';
import { pendingInvite } from '@features/dashboard/data/pendingInvite';

/** Student access gate. Consumes a pending invite code (from /join/{codigo}) once. */
export default function Unirse() {
  const [code] = useState(() => pendingInvite.consume() ?? undefined);
  return <JoinClassScreen code={code} />;
}
