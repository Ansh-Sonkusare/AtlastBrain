'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { APP_NAME } from '../../brand';
import { authFormAppearance } from '../../clerk-appearance';
import { Brand } from '../chrome';

// Hash routing keeps the multi-step flows on this one page, so no catch-all route is needed.
export function Signup({ mode }: { mode: 'sign-up' | 'sign-in' }) {
  const signup = mode === 'sign-up';

  return (
    <div className="auth">
      <section className="auth-l">
        <Link href="/" className="brand fade" style={{ alignSelf: 'flex-start' }}>
          <Brand />
        </Link>

        <div className="auth-mid">
          <div className="auth-box">
            <div>
              <h1 className="rise">{signup ? `Create your ${APP_NAME}` : 'Welcome back'}</h1>
              <p className="sub rise d1">{signup ? 'Takes 30 seconds. No card needed.' : 'Sign in to pick up where you left off.'}</p>
            </div>
            <div className="rise d2">
              {signup ? (
                <SignUp appearance={authFormAppearance} routing="hash" signInUrl="/sign-in" forceRedirectUrl="/onboarding" />
              ) : (
                <SignIn appearance={authFormAppearance} routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" />
              )}
            </div>
            <p className="swap rise d3">
              {signup ? 'Already have an account?' : 'New here?'}{' '}
              <Link href={signup ? '/sign-in' : '/signup'} style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#3F3B35' }}>{signup ? 'Sign in' : 'Create an account'}</Link>
            </p>
          </div>
        </div>

        <p className="legal fade">
          By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
        </p>
      </section>

      <aside className="auth-r" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
          <g className="float">
            <g stroke="#262420" strokeWidth="1.2" fill="none">
              <line className="edge" x1="300" y1="250" x2="170" y2="140" />
              <line className="edge" x1="300" y1="250" x2="440" y2="150" />
              <line className="edge" x1="300" y1="250" x2="190" y2="370" />
              <line className="edge" x1="300" y1="250" x2="430" y2="360" />
              <line className="edge" x1="170" y1="140" x2="80" y2="200" />
              <line className="edge" x1="440" y1="150" x2="530" y2="90" />
              <line className="edge" x1="190" y1="370" x2="110" y2="430" />
            </g>
            <g stroke="#C9974E" strokeWidth="1.6" fill="none">
              <line className="edge" x1="440" y1="150" x2="520" y2="230" style={{ animationDelay: '1s' }} />
              <line className="edge" x1="430" y1="360" x2="520" y2="420" style={{ animationDelay: '1.1s' }} />
            </g>
            <circle className="ping" cx="300" cy="250" r="18" fill="none" stroke="#C9974E" />
            <circle className="node" style={{ animationDelay: '.6s' }} cx="300" cy="250" r="18" fill="#C9974E" />
            <rect className="node" style={{ animationDelay: '.9s' }} x="158" y="128" width="24" height="24" rx="6" fill="#4F4A43" />
            <rect className="node" style={{ animationDelay: '.9s' }} x="428" y="138" width="24" height="24" rx="6" fill="#4F4A43" />
            <rect className="node" style={{ animationDelay: '.9s' }} x="178" y="358" width="24" height="24" rx="6" fill="#4F4A43" />
            <circle className="node" style={{ animationDelay: '.9s' }} cx="430" cy="360" r="11" fill="#8B9CFF" />
            <circle className="node" style={{ animationDelay: '1.2s' }} cx="80" cy="200" r="6" fill="#3F3A34" />
            <circle className="node" style={{ animationDelay: '1.2s' }} cx="530" cy="90" r="6" fill="#3F3A34" />
            <circle className="node" style={{ animationDelay: '1.2s' }} cx="110" cy="430" r="6" fill="#3F3A34" />
            <circle className="node" style={{ animationDelay: '1.2s' }} cx="520" cy="230" r="8" fill="#C9974E" />
            <circle className="node" style={{ animationDelay: '1.2s' }} cx="520" cy="420" r="8" fill="#C9974E" />
          </g>
        </svg>
        <div className="cap rise d3">
          <p>Every page you read, <span className="soft">connected to everything you know.</span></p>
          <p>Free for 50 saves a month.</p>
        </div>
      </aside>
    </div>
  );
}
