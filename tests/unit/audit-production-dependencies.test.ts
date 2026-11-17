import assert from 'node:assert/strict';
import test from 'node:test';
import { isOnlyTemporaryPicomatchFinding } from '../../scripts/audit-production-dependencies';

const allowedFinding: Record<
  string,
  { severity: string; via: (string | { url: string })[] }
> = {
  picomatch: {
    severity: 'high',
    via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' }],
  },
  micromatch: { severity: 'high', via: ['picomatch'] },
  '@parcel/watcher': { severity: 'high', via: ['micromatch'] },
};

test('allows only the approved picomatch advisory dependency chain', () => {
  assert.equal(isOnlyTemporaryPicomatchFinding(allowedFinding), true);
});

test('allows watcher reports that link directly to the same picomatch advisory', () => {
  const vulnerabilities = structuredClone(allowedFinding);
  vulnerabilities['@parcel/watcher'].via = ['picomatch'];
  delete vulnerabilities.micromatch;

  assert.equal(isOnlyTemporaryPicomatchFinding(vulnerabilities), true);
});

test('rejects a different high-severity advisory on picomatch', () => {
  const vulnerabilities = structuredClone(allowedFinding);
  vulnerabilities.picomatch.via = [
    { url: 'https://github.com/advisories/GHSA-different' },
  ];

  assert.equal(isOnlyTemporaryPicomatchFinding(vulnerabilities), false);
});

test('rejects an additional advisory in the dependency chain', () => {
  const vulnerabilities = structuredClone(allowedFinding);
  vulnerabilities.micromatch.via.push({
    url: 'https://github.com/advisories/GHSA-different',
  });

  assert.equal(isOnlyTemporaryPicomatchFinding(vulnerabilities), false);
});
