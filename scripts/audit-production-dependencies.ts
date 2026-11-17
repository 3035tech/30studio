import { spawnSync } from 'node:child_process';

const temporaryPicomatchAdvisory =
  'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';

type AuditVia = string | { url?: string };

type AuditVulnerability = {
  severity?: string;
  via?: AuditVia[];
};

type AuditReport = {
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: {
    vulnerabilities?: Record<string, number>;
  };
};

export function isOnlyTemporaryPicomatchFinding(
  vulnerabilities: Record<string, AuditVulnerability>,
): boolean {
  const picomatch = vulnerabilities.picomatch;
  const micromatch = vulnerabilities.micromatch;
  const parcelWatcher = vulnerabilities['@parcel/watcher'];

  return (
    Boolean(picomatch) &&
    picomatch?.severity === 'high' &&
    picomatch.via?.length === 1 &&
    typeof picomatch.via[0] === 'object' &&
    picomatch.via[0].url === temporaryPicomatchAdvisory &&
    Boolean(micromatch) &&
    micromatch?.severity === 'high' &&
    micromatch.via?.length === 1 &&
    micromatch.via[0] === 'picomatch' &&
    Boolean(parcelWatcher) &&
    parcelWatcher?.severity === 'high' &&
    parcelWatcher.via?.length === 1 &&
    parcelWatcher.via[0] === 'micromatch'
  );
}

function main(): void {
  const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (audit.error || audit.status === null) {
    console.error('Could not run npm audit.');
    if (audit.error) console.error(audit.error.message);
    process.exitCode = 1;
    return;
  }

  let report: AuditReport;
  try {
    report = JSON.parse(audit.stdout) as AuditReport;
  } catch {
    console.error('Could not parse npm audit JSON output.');
    if (audit.stderr) console.error(audit.stderr.trim());
    process.exitCode = 1;
    return;
  }

  if (audit.status !== 0 && !report.vulnerabilities) {
    console.error('npm audit failed without a vulnerability report.');
    if (audit.stderr) console.error(audit.stderr.trim());
    process.exitCode = 1;
    return;
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const highOrCritical = Object.entries(vulnerabilities).filter(([, issue]) =>
    ['high', 'critical'].includes(issue.severity ?? ''),
  );

  if (highOrCritical.length === 0) {
    console.log('Production dependency audit passed.');
    return;
  }

  const temporaryExceptionApplies =
    isOnlyTemporaryPicomatchFinding(vulnerabilities) &&
    highOrCritical.every(([name]) =>
      ['picomatch', 'micromatch', '@parcel/watcher'].includes(name),
    );

  if (!temporaryExceptionApplies) {
    console.error('Production dependency audit found high or critical issues:');
    for (const [name, issue] of highOrCritical) {
      console.error(`- ${name}: ${issue.severity ?? 'unknown'}`);
    }
    process.exitCode = 1;
    return;
  }

  const counts = report.metadata?.vulnerabilities;
  console.warn(
    `Temporary exception: ${temporaryPicomatchAdvisory} is the only high-severity production advisory, reported through picomatch → micromatch → @parcel/watcher.`,
  );
  console.warn(
    `Audit totals: ${counts?.high ?? 0} high, ${counts?.critical ?? 0} critical. Remove this exception after the advisory is remediated upstream.`,
  );
}

if (process.argv[1]?.endsWith('audit-production-dependencies.ts')) {
  main();
}
