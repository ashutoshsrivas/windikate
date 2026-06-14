# Wiring Bedrock AI into Windikate Analysis

The intelligence layer runs deterministic mock services by default. When
Bedrock is enabled and reachable, `questionGenerator` (and later
`memoBuilder`, `apercept`, `competitorIntel`) call Claude on Bedrock for
real, deviation-aware output. Mocks remain as a graceful fallback if the
call fails — the app never breaks.

## What you need

1. An AWS account (`ashutoshsrivas@…` already owns the EC2 box)
2. Model access enabled on **at least one Claude model** in Bedrock
3. Either:
   - **IAM role attached to the EC2** (recommended — no secrets to rotate), or
   - **IAM user with an access key** (paste into `.env`)

## Step 1 · Enable Claude in Bedrock (one-time, ~2 min)

Bedrock requires an explicit access request per model. Even on your own
account, calling Claude with no access enabled returns
`AccessDeniedException`.

1. Open <https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess>
   (or pick a different region — but `us-east-1` has the broadest model
   menu and inference profiles).
2. Click **Manage model access** → **Modify model access**.
3. Tick at least one Claude model. Recommendations in order of cost vs.
   quality:
   - **Claude Sonnet 4.5** — best balance of quality + cost
   - **Claude Haiku 4.5** — cheapest, very fast, "good enough" for most
     questions
   - **Claude Opus 4.7** — top quality, ~5× the cost of Sonnet
4. Submit. Status flips from **Available to request → In progress →
   Access granted** in seconds for Anthropic models.

## Step 2 · Auth (pick ONE path)

### Path A · IAM Role on the EC2 box (recommended for production)

No long-lived credentials anywhere on the server.

1. In the AWS Console, IAM → **Roles** → Create role.
   - Trusted entity: **AWS service** → EC2.
   - Permissions: attach a policy with this statement:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
         "Resource": "*"
       }]
     }
     ```
     (Tighten `Resource` to specific model ARNs once you've picked one.)
   - Name it `windikate-bedrock`.
2. EC2 → Instances → select the Windikate box → **Actions → Security →
   Modify IAM role** → attach `windikate-bedrock`.
3. On the box, **leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   blank** in `.env`. The SDK auto-picks up the instance role.

### Path B · IAM user access key (works anywhere, simpler to set up)

1. IAM → **Users** → Add user → e.g. `windikate-bedrock`.
2. Attach the same JSON policy above (or `AmazonBedrockLimitedAccess`
   managed policy as a quick start).
3. **Security credentials** → Create access key → **Application running
   outside AWS**.
4. Copy the **Access key ID** and **Secret access key** somewhere safe.

## Step 3 · Configure the app

### Locally (dev)

Edit `analysis-app/backend/.env`:

```ini
BEDROCK_ENABLED=true
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0

# Only if you're on Path B (access key)
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart: `npm run dev` (backend) — the `bedrockClient` will start
serving real model calls.

### On EC2

```bash
ssh ubuntu@ec2-35-154-88-44.ap-south-1.compute.amazonaws.com
cd /var/www/windikate/analysis-app/backend
sudo nano .env
# Set BEDROCK_ENABLED=true, AWS_REGION, BEDROCK_MODEL_ID, and (Path B)
# AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY

pm2 reload windikate-api
pm2 logs windikate-api --lines 20
```

## Step 4 · Verify

Hit the API with the demo account:

```bash
TOKEN=$(curl -s -X POST http://<host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@windikate.com","password":"Windikate@2026"}' | jq -r .token)

echo "%PDF-1.4 fake" > /tmp/d.pdf
curl -s -X POST http://<host>/api/analyses \
  -H "Authorization: Bearer $TOKEN" \
  -F 'company_name=Acme Bedrock' -F 'stage=Series A' \
  -F 'deck=@/tmp/d.pdf;type=application/pdf' | jq '.questions[:3]'
```

When Bedrock is wired correctly, the questions read materially better
than the template ones — context-aware, with the specific deviation
numbers quoted back at the founder.

Watch the logs:

```bash
pm2 logs windikate-api --lines 50 | grep -i bedrock
```

A successful call leaves no log line (silent on the happy path).
A failed call logs:
`[questionGenerator] Bedrock failed, falling back to templates: <reason>`

Common errors:
- `AccessDeniedException` — model access not enabled (Step 1)
- `ValidationException · model not found` — wrong `BEDROCK_MODEL_ID` or
  wrong region. Inference profile IDs (`us.anthropic.…`) only work in
  US regions; for `eu-central-1` use `eu.anthropic.…`.
- `UnrecognizedClientException` — bad/expired access key (Path B)
- `expired security token` — IAM role didn't attach yet, give it 30 s

## Cost notes

- `us.anthropic.claude-sonnet-4-5-…` · ~$3 input / $15 output per M tokens
- `us.anthropic.claude-haiku-4-5-…` · ~$1 / $5 per M tokens
- One question-generation call ≈ 1.5 k input + 500 output tokens →
  Sonnet ≈ $0.012 per analysis; Haiku ≈ $0.004 per analysis.

## Rolling out to more services

The same `bedrockClient` helper is ready for the other services:

| Service | Why this is a good AI fit |
|---|---|
| `memoBuilder.js` | Big quality win — Claude writes much better IC memos than templates |
| `apercept.js` | Multi-persona simulation is exactly what LLMs do well |
| `competitorIntel.js` | Needs tool-use / web search — slightly more work |
| `schemaMapper.js` | Needs PDF parsing first; pair with a deck-text extractor |

To upgrade a service: import `bedrockClient`, wrap the existing function
in `if (bedrock.isAvailable()) try { … } catch { /* fall back */ }`.
