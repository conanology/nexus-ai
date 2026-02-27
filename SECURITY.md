# Security Policy

## Supported Versions
Use the latest main branch for security fixes.

## Reporting a Vulnerability
Please do not open public issues for security vulnerabilities.

1. Contact the maintainer privately.
2. Include reproduction steps, impact, and proposed mitigation.
3. If credentials are exposed, rotate first, then report.

## Secrets Handling
- Never commit live tokens/credentials.
- Use environment variables and cloud secret managers.
- Run secret scan before push: `pnpm run scan:secrets`.
