# SysZero · Operations Console

A responsive command center for experimenting with **system observability, incident response, network topology and detection rules**. Designed as a polished interactive simulation, not as a production monitoring agent.

> [!IMPORTANT]
> All telemetry, alert conditions, node status and system health shown here are **deterministic synthetic data** calculated in the browser. There are no live infrastructure integrations, privileged operations, servers, databases, third-party telemetry services, or paid APIs.

## What works

- **Command overview:** rolling synthetic utilization, throughput, latency, health, fleet status and incident queue.
- **Network topology:** 24 selectable nodes in four clusters, search, state filters, diagnostics and per-node load details.
- **Detection rules:** enable/disable CPU, latency and threat thresholds, adjust limits in real time, and reset defaults.
- **Analytics:** replayable scenario data, metrics timeline, individual signals and downloadable CSV.
- **Four scenarios:** nominal operations, traffic surge, thermal stress and security event.
- **Playback controls:** pause/resume, 1x/2x speed, reset and scenario switching.
- **Local preferences:** chosen scenario and detection rule settings persist in browser localStorage.

All controls are functional without creating accounts or granting permissions. Responsive layout supports phone, tablet and desktop. Reduced-motion preferences are respected.

## Stack

| Layer | Implementation | Cost |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, CSS, Recharts, Lucide | Free |
| Simulation | Deterministic browser-side JavaScript | Free |
| Hosting | Cloudflare Workers **Static Assets** on `*.workers.dev` | Free plan |
| CI/CD | GitHub Actions (push to `master`) | Free public repository minutes |
| Database | None | $0 |
| External services | None | $0 |

This is a **static-assets-only Worker**, so asset-serving requests do not count as billable Worker invocation requests. No Cloudflare billing upgrade is required for the intended free-tier use. Custom domains are optional; the free `workers.dev` subdomain is sufficient.

## Run locally

Requires Node.js 22+.

```bash
git clone https://github.com/amiddlebrook/SysZeroCool.git
cd SysZeroCool
npm ci
npm run dev
```

Open **http://localhost:3000**.

### Validate

```bash
npm run check
```

This runs TypeScript checking, Node's built-in test runner, then a production Vite build.

## Deploy to Cloudflare (no paid services)

1. Create or use a free [Cloudflare](https://dash.cloudflare.com/sign-up) account and enable your free Workers subdomain.
2. Create a Cloudflare API token with **Account → Workers Scripts → Edit** on the target account. Grant only the required permissions.
3. In this repository, open **Settings → Secrets and variables → Actions** and add the following **repository secrets**:
   - `CLOUDFLARE_API_TOKEN`: Cloudflare deploy token
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
4. Optional: create an Actions **repository variable** `CLOUDFLARE_WORKERS_SUBDOMAIN` containing your Workers subdomain name (without `.workers.dev`) so GitHub displays the correct environment URL.
5. Merge the restoration pull request into `master` or choose **Actions → SysZero · Validate & Deploy → Run workflow**.

Every pull request triggers typechecking, deterministic unit tests and build. Every push to `master` runs the same checks and automatically deploys `dist/` through the official `cloudflare/wrangler-action@v3`.

The hostname is normally `https://syszerocool.<your-subdomain>.workers.dev`. The exact hostname cannot be determined until Cloudflare deployment finishes. The workflow intentionally fails with a clear error if required secrets are absent; it never leaks the token into source control.

For a one-off local deployment after authenticating with Cloudflare, run:

```bash
npm run build
npx wrangler@latest deploy
```

### Configuration

`wrangler.toml` uses the native Workers Static Assets `[assets]` block and SPA navigation fallback. There is **no** Worker script and **no** runtime API. Vite bundles frontend dependencies locally: no CDN runtime or Gemini API key.

## Costs and limitations

- Static assets served by Workers are free under Cloudflare's published pricing. A Cloudflare account and deployment token are still required.
- GitHub Actions is free for this public repository under GitHub's published public-runner policy; quotas and platform terms can change.
- LocalStorage is per-browser, not a secure database or multi-user synchronization layer.
- No connection to real CPU metrics, firewalls or hardware exists. Production monitoring would require a separate authorized ingestion architecture, privacy controls and potentially additional budget.
- `*.workers.dev` is included; **buying a custom domain would not be free**.

## Directory layout

```text
App.tsx                     Responsive operations UI
styles.css                  UI design system + breakpoints
simulator.mjs               Reproducible scenario / incident engine
tests/simulator.test.mjs    Deterministic unit tests
wrangler.toml               Cloudflare Workers Static Assets
.github/workflows/cloudflare.yml  CI/CD
```

## Design intent

SysZero is meant to communicate useful information first: clear navigation, explicit demo status, responsive data views and functional controls. The original orbital HUD and fake production-connection banners were replaced because they obscured the application's actual capabilities.

MIT-compatible dependencies; repository licensing follows the repository's existing license (none is added by this restoration).
