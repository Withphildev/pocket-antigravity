# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

If you discover a security vulnerability in Pocket Antigravity, **please do not open
a public issue.**

Report it privately via
[GitHub Security Advisories](https://github.com/L1M80/porta/security/advisories/new).

You will receive an acknowledgement within **48 hours** and a status
update within **7 days**.

## Scope

The following are in scope for security reports:

- Authentication or token leakage in the proxy
- Path traversal or unauthorized file access
- Cross-site scripting (XSS) in the web frontend
- CORS misconfiguration allowing unintended origins
- WebSocket hijacking or injection

Out of scope:

- Vulnerabilities in Antigravity itself (report to Google)
- Vulnerabilities in upstream dependencies (report to the dependency
  maintainer, then open a regular Issue here so we can update)
- Denial of service on a locally-bound proxy (local network trust model)
