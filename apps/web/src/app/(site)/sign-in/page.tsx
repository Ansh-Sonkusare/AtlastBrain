import type { Metadata } from 'next';
import { Signup } from '../signup/Signup';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return <Signup mode="sign-in" />;
}
