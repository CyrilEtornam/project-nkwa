# Nkwa Frontend — Deployment Guide (Amplify + CloudFront Backend)

**Architecture:**
```
User → Amplify (https://main.xxx.amplifyapp.com)
              ↓
   fetch("https://xxx.cloudfront.net") → CloudFront → EC2 :8000 (FastAPI)
```

Amplify hosts and auto-deploys the frontend. A CloudFront distribution wraps the EC2 backend in HTTPS — no Route 53, no custom domain, no certificates to manage.

**What you need before starting:**
- EC2 backend already running on port 8000
- The EC2 instance's **public DNS name** (not the IP) — find it in the EC2 console under **Public IPv4 DNS**. It looks like `ec2-54-218-53-26.us-west-2.compute.amazonaws.com`
- GitHub repo access

---

## Part 1 — Wrap the Backend in CloudFront (HTTPS)

CloudFront gives the EC2 backend a free `*.cloudfront.net` HTTPS URL. The frontend, served over HTTPS by Amplify, needs this to make API calls without being blocked by the browser.

### 1.1 Open CloudFront

Go to [https://console.aws.amazon.com/cloudfront/v4/home](https://console.aws.amazon.com/cloudfront/v4/home) → **Distributions** → **Create distribution**.

### 1.2 Choose distribution type

You will see two options. Choose **Single website or app** → **Next**.

### 1.3 Domain setup — skip

On the **Domain setup** screen (if it appears), leave it blank. We are not using a custom domain. Click **Next**.

### 1.4 Specify origin

On the **Specify origin** page:

- **Origin type**: Select **Web server (custom origin)**
- **Origin domain**: Enter your EC2 **public DNS name** — e.g., `ec2-54-218-53-26.us-west-2.compute.amazonaws.com`
  > Do not enter the raw IP address. CloudFront requires a DNS name.

Under **Settings**, choose **Customize origin settings**, then set:

| Field | Value |
|---|---|
| Protocol | **HTTP only** |
| HTTP port | **8000** |
| HTTPS port | 443 (leave default, unused) |
| Minimum origin SSL protocol | leave default |
| Response timeout | **60** seconds (pipeline takes up to 30s — default 30s is too tight) |
| Keep-alive timeout | 5 (default) |

Click **Next**.

### 1.5 Default cache behavior

Still on the same page or the next step, configure the cache behavior:

| Field | Value |
|---|---|
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| Cache policy | **CachingDisabled** (API responses must never be cached) |
| Origin request policy | **AllViewer** (forwards all headers, cookies, and query strings to EC2) |

### 1.6 Security protections

On the **Enable security protections** page — choose **No, skip this** for now (WAF adds cost). Click **Next**.

### 1.7 Review and create

Review the settings and click **Create distribution**.

The status will show **Deploying** — wait 3–5 minutes until it changes to **Enabled**.

### 1.8 Copy the CloudFront domain name

Once enabled, click into the distribution. Under the **General** tab, copy the **Distribution domain name** — it looks like:
```
https://d1abc123xyz.cloudfront.net
```
You will need this in Part 2.

### 1.9 Verify

```bash
curl https://d1abc123xyz.cloudfront.net/health
# Expected: {"status":"ok","timestamp":"..."}
```

If this works, the backend HTTPS setup is done.

> **If it times out:** Check the EC2 security group allows inbound TCP on port 8000 from `0.0.0.0/0`. CloudFront connects to EC2 from various AWS IP ranges so you can't narrow it to a single IP.

---

## Part 2 — Deploy the Frontend with AWS Amplify

### 2.1 Open Amplify

Go to **AWS Amplify** in the console → **Create new app**.

### 2.2 Connect GitHub

- Select **GitHub** as the source
- Click **Authorize** — a GitHub OAuth popup opens
- Select the `project-nkwa` repository
- Select branch: **main**
- Click **Next**

### 2.3 Configure build settings

Amplify may auto-detect the Vite app. If it does not, or if the root directory is wrong, click **Edit** on the build spec and paste this:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

### 2.4 Add the environment variable

Still on the build settings page, expand **Advanced settings**. Under **Environment variables** click **Add**:

| Variable name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://d1abc123xyz.cloudfront.net` |

Replace the CloudFront URL with the actual domain from Part 1 Step 1.8.

> This variable is baked into the JavaScript bundle at build time by Vite. It is **not** a runtime secret — it is visible in the built JS file, which is fine since it's a public API URL.

Click **Next** → **Save and deploy**.

Amplify clones the repo, runs the build, and deploys. First deploy takes 3–5 minutes. You get a live URL:
```
https://main.abcdefg.amplifyapp.com
```

Every push to `main` triggers a new automatic deploy from this point on.

### 2.5 Fix SPA page refresh (404 on reload)

By default, refreshing the page on any route other than `/` returns a 404. Fix this:

1. In Amplify → your app → **Rewrites and redirects** → **Manage redirects**
2. Add a new rule:

| Source | Target | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | **200 (Rewrite)** |

This rewrites all unknown paths to `index.html` so React handles the routing, while letting actual static files (JS, CSS, images) be served normally.

---

## Part 3 — Verify the full flow

1. Open `https://main.abcdefg.amplifyapp.com`
2. Tap the call button → choose a service → choose a language
3. Allow mic and location → speak → **Stop & Send**
4. Processing screen should load (~10–25 seconds) and transition to the result screen

**If the API call fails:**
- Open browser DevTools → **Network** tab
- Find the request to `https://d1abc123xyz.cloudfront.net/api/v1/calls/initiate`
- Check the **Response** tab for the error detail
- Common cause: CloudFront response timeout hit — confirm you set it to 60 seconds in Part 1 Step 1.4

---

## Part 4 — Updating the frontend after code changes

Push to `main` — Amplify detects it and redeploys automatically. No manual steps.

**If you change `VITE_API_BASE_URL` or any env variable:**
1. Amplify → your app → **Environment variables** → update the value
2. Amplify → **Deployments** tab → **Redeploy this version**

---

## Summary

| Service | Role |
|---|---|
| **AWS Amplify** | Builds from GitHub, hosts frontend over HTTPS, auto-deploys on push |
| **CloudFront** | Wraps EC2 in HTTPS, gives a `*.cloudfront.net` URL for API calls |
| **EC2** | Runs the FastAPI/uvicorn backend — no changes needed |

No Route 53. No custom domain. No ACM certificates. No ALB.
