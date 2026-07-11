import { Redirect, useLocalSearchParams } from 'expo-router';
import { pendingInvite } from '@features/dashboard/data/pendingInvite';

/**
 * Invite link /join/{codigo} (RQ-FN13). Stashes the code and bounces to the
 * resolver, which sends the user through login/onboarding as needed; the join
 * gate then consumes it and auto-joins. Works logged-in or logged-out.
 */
export default function InviteLink() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  if (codigo) pendingInvite.set(codigo);
  return <Redirect href="/" />;
}
