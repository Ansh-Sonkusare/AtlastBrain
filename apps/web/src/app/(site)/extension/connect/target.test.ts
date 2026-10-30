import { describe, expect, it } from 'vitest';
import { connectTarget } from './target';

const ID = 'abcdefghijklmnopabcdefghijklmnop';

describe('connectTarget', () => {
  it('uses the configured id over the link', () => {
    expect(connectTarget(ID, 'configured', true)).toBe('configured');
    expect(connectTarget(ID, 'configured', false)).toBe('configured');
  });

  it('never lets a link choose the receiver in production', () => {
    expect(connectTarget(ID, undefined, true)).toBeNull();
  });

  it('accepts only a well-formed id from the link in development', () => {
    expect(connectTarget(ID, undefined, false)).toBe(ID);
    expect(connectTarget('nope', undefined, false)).toBeNull();
    expect(connectTarget(null, undefined, false)).toBeNull();
  });
});
