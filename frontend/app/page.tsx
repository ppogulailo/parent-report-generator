import { redirect } from 'next/navigation';

// English is the default language on EVERY open (primary rollout). A parent who
// wants Spanish switches manually via the language toggle (which navigates to
// /es); that applies for as long as they stay on /es, but the default is always
// English — we do NOT persist Spanish as the default across visits.
export default function RootPage() {
  redirect('/en');
}
