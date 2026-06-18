# OncoDB — Manual Security Actions

> Steps **you must do by hand**. All code-fixable items already applied.

---

## 🔴 Critical — Before Next Deploy

### 1. Rotate all secrets in `.env.clean`

File is on disk with LIVE credentials. Rotate every secret below, then update `.env.clean`.

| Secret | Where to rotate |
|--------|----------------|
| Firebase service account private key | GCP Console → IAM & Admin → Service Accounts → `firebase-adminsdk-fbsvc@ai-dms-2-ac2f5.iam.gserviceaccount.com` → Keys → Create new key, then delete old |
| Google Drive OAuth client secret | GCP Console → APIs & Services → Credentials → `OAuth 2.0 Client ID` → Regenerate secret |
| Google Drive refresh token | Revoke at https://myaccount.google.com/permissions (revoke OncoDB app access), then re-authorize |
| Gemini API keys (primary + secondary) | Google AI Studio → API Keys → Create new, delete old |

### 2. Deploy Firestore security rules

Client SDK (`src/lib/firebase.ts`) initializes Firestore with `getFirestore(app)`. Without rules, anyone with the Firebase API key reads/writes all patient data directly.

Create `firestore.rules` in repo root and deploy:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

```bash
firebase deploy --only firestore:rules
```

> **Why deny all?** All reads/writes go through the Express/Vercel backend. Direct client SDK access is not needed and would bypass auth.

---

## 🟡 This Week

### 3. Enable Firebase App Check

Prevents API key abuse from unauthorized clients (bots, scrapers, direct Firestore calls).

- Firebase Console → App Check → Register app → reCAPTCHA v3 or DeviceCheck
- Enforce on Firestore, Identity Toolkit, and Gemini APIs

### 4. Run `npm audit fix --force` and test

9 high-severity vulns remain in transitive deps (`@vercel/node`, `firebase-admin`):

```bash
npm audit fix --force
npm run build
npm run start  # test thoroughly
```

This upgrades `@vercel/node` and may break Vercel serverless functions. Test on staging first.

---

## 🟢 Next Sprint

### 5. Add `audit_log` Firestore index

For efficient audit log queries (filter by user, sort by time):

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "audit_log",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

```bash
firebase deploy --only firestore:indexes
```

### 6. Update patient UI consent field

The backend checks `patient.consent_ai_processing` before sending data to Gemini. Add this field to the patient form UI so clinicians can record consent:

- Location: `src/formManifest.ts` — add field to relevant section
- Label: "Consent to AI data processing (Gemini)"
- Type: boolean toggle
- Default: `false`

### 7. Review Firestore billing alerts

Set up budget alerts in GCP:
- Billing → Budgets & alerts → Create alert at $50/$100/$200
- Link to Pub/Sub notification for automated shutdown

---

## 📋 Quick Reference

```bash
# Verify Firestore rules are in place
firebase firestore:list  # should show no open access

# Check deployed security headers
curl -sI https://your-vercel-domain.vercel.app | grep -iE 'strict-transport|content-security|x-content-type'

# Verify audit logs are writing
firebase firestore:get audit_log  # should return entries

# Test rate limiting
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code} " https://your-api/auth-endpoint
done
# Expect 429 after ~60th request
```
