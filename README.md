# openai-pages-proxy

## Request logs

`functions/_middleware.js` records every request handled by the Pages project,
including `/v1/*`, `/health`, static assets and 404 responses. Each structured
log contains the request method, path, query string, headers, Cloudflare client
metadata, response status and duration.

All request headers are logged with their original values, including
`authorization`, `cookie`, `x-api-key` and `x-proxy-token`. Anyone with access
to the logs may therefore be able to reuse these credentials. Request bodies
are not logged.

View live logs in Cloudflare under:

```text
Workers & Pages -> project -> Deployments -> deployment -> View details -> Functions
```

They can also be streamed with Wrangler:

```bash
npx wrangler pages deployment tail
```

Pages live logs are not retained. To store logs, configure these Pages
environment variables:

```text
LOG_ENDPOINT  External HTTP log collector endpoint
LOG_TOKEN     Optional bearer token stored as a secret
```

External delivery uses `context.waitUntil()` so it does not delay the proxied
response. `PROXY_TOKEN`, `LOG_TOKEN` and other credentials should be configured
as Cloudflare secrets rather than committed to this repository.
