import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect users to the login page by default
  redirect('/login');
}
