# uaeroots.com — operations runbook

Secret rotation, backup restore, incident response. Written 3 August 2026.

These are the three things a security assessment asks for first and the three
this project has never had. None is urgent on a normal day. All three are only
useful if written down before they are needed, because each is executed under
time pressure by one person with no second opinion available.

**Sole operator: Nasser.** There is no on-call rota, no second pair of hands and
no escalation path. Every procedure below assumes that and is written to be
followed alone.

---

## 1. Secret rotation

### What secrets exist

Read from the environment by `server/index.js` and `src/lib/firebase.js`:

| secret | where | rotating it costs |
|---|---|---|
| `JWT_SECRET` | Render env | every session ends at once |
| `ENCRYPTION_KEY` | Render env | **destroys data unless re-encrypted first** |
| `DATABASE_URL` | Render env, Neon | brief downtime on redeploy |
| `TWILIO_AUTH_TOKEN` | Render env, Twilio | phone login down until updated |
| `TWILIO_ACCOUNT_SID` | Render env | identifier, not a secret |
| `TWILIO_VERIFY_SID` | Render env | identifier, not a secret |
| `VITE_FIREBASE_API_KEY` | Render env, Firebase | public by design; restrict, do not hide |
| Firebase service account | Render env | Google sign-in down until updated |

`ALLOWED_ORIGINS`, `NODE_ENV`, `PORT`, `SINGLE_SESSION`, `DEBUG_LOGS` are
configuration, not secrets.

Both environments have their own values. Rotate staging first, always — it is
the only rehearsal available.

### JWT_SECRET — easy, disruptive, do it first

Every token is signed with it. Change it and every existing token fails
verification, so everyone is signed out immediately. No data is at risk.

1. Generate: `openssl rand -base64 48`, or any 48+ random bytes.
2. Render → the service → Environment → replace `JWT_SECRET` → save.
3. Render redeploys automatically. Sign in again on both a Google and a phone
   account.

The startup guard at `server/index.js:40` exits the process if `JWT_SECRET` is
missing, so a typo that empties it fails loudly rather than running unprotected.
A guard at line 87 also refuses to start if `ENCRYPTION_KEY` equals
`JWT_SECRET` — do not set them to the same value while rotating.

Nobody loses anything. They sign in again. Rotate this one on a schedule.

### ENCRYPTION_KEY — dangerous, and it needs the previous-key fallback

`people.phone` and `people.email` are AES-256-GCM sealed under a key derived
from this value. The plaintext exists nowhere else. **Changing this variable
without the procedure below permanently destroys both fields for every person in
every tree.**

`people.identification_number` is also a sealed column, but it is empty on both
databases and no code reads or writes it — the field was retired on 3 August
because no form could ever set it. Nothing to re-encrypt there.

`ENCRYPTION_KEY_PREVIOUS` exists for exactly this. While it is set, reads accept
either key and writes always use the new one.

1. **Take a database branch first.** Neon → Branches → create from the current
   state. This is the only way back.
2. Copy the current `ENCRYPTION_KEY` value somewhere safe. You will need it.
3. Render → Environment → add `ENCRYPTION_KEY_PREVIOUS` = the OLD value, and set
   `ENCRYPTION_KEY` = a new random value. Save both together, in one edit, so
   only one redeploy happens.
   *If they are saved separately the service restarts in between with a new key
   and no fallback, and every read fails until the second save lands.*
   The server refuses to start if the two are identical, which catches the
   mistake of pasting the same value twice.
4. Verify: sign in, open a person who has a phone or email recorded, confirm the
   value displays. That read went through the fallback.
5. **Re-encrypt everything.** Until this is done the old key is still required.
   Rows re-encrypt themselves when edited, but rows nobody edits never will.
   With production at 75 people this is small enough to do deliberately rather
   than build tooling for — decide the mechanism at the time, and note that the
   previous auto-executing migration script was deleted in August 2026 for good
   reason: it ran on import, with no CLI guard.
6. When every row is re-encrypted, remove `ENCRYPTION_KEY_PREVIOUS`. Verify
   again. The fallback is now gone and the old key is dead.

Do not skip step 1. Do not leave step 6 undone — a rotation that never finishes
means two live keys indefinitely, which is worse than one.

### DATABASE_URL

Neon → the branch → Connection details → reset the password. Copy the new
connection string, keeping `?sslmode=verify-full&channel_binding=require` — TLS
verification depends on it, and `server/db.js` sets `rejectUnauthorized: true`
so both mechanisms must agree.

Update `DATABASE_URL` in Render. The service restarts and reconnects. Expect a
few seconds of failed requests.

### TWILIO_AUTH_TOKEN

Twilio console → Account → API keys & tokens → rotate the auth token. Update
Render. Test by requesting an SMS code. Phone login is down between the two
steps, so do it when nobody is signing in.

Note `TWILIO_VERIFY_SID` — the code reads this name, not
`TWILIO_VERIFY_SERVICE_SID`. An earlier attempt at the phone-link endpoint
failed because it invented the longer name.

### Firebase

The API key is **not** a secret — it ships in the client bundle and is meant to.
It is protected by referrer restrictions, not by concealment. Two things must
stay in the allowed list or sign-in breaks:

- `simple-spa-3b39b.firebaseapp.com/*` — the auth domain still shown during
  sign-in
- `uae-roots-staging.onrender.com` — staging was blocked once by a
  referrer-restricted key that production did not have

If a service account key is ever added, rotate it through Firebase console →
Project settings → Service accounts → generate a new private key, update Render,
then delete the old key from the console.

### After any rotation

Confirm all three login paths still work: Google, phone, email. Two of the three
have broken independently before.

---

## 2. Backup and restore

**Tested 4 August 2026.** Branch from staging at a point one hour back, staging
pointed at it, app exercised, staging returned. Measured:

| | |
|---|---|
| **Recovery time — data** | ~4 minutes from starting the branch to the rows being queryable |
| **Recovery point** | 1 person and 2 relationships lost per hour (229 → 228 people, 318 → 316 relationships) |
| **Data integrity** | clean. 7 users, all trees present |
| **Does the app run on it?** | **NO — not until the schema is brought forward** |

That last row is the finding, and it is the reason this test was worth doing.

**The restored branch would not serve logins.** The snapshot predated the
`ALTER TABLE users ADD COLUMN current_session_id` run earlier the same day.
Drizzle builds its select list from `shared/schema.js`, so every read of `users`
asked for a column that was not there and returned 500 — the identical failure
that took production down for days in July, arriving this time through a restore.

Fixed in one statement against the branch, after which login worked immediately
with no redeploy:

```sql
ALTER TABLE users ADD COLUMN current_session_id text;
```

**So "we have backups" was true and would still have left a dead site.** A
restore returns DATA to a point in time; it also returns the SCHEMA to that point,
and the code has moved on. Any restore to a point before a migration needs that
migration re-applied. Step 5 below is not optional.

### Still not known

- The exact retention window on the current plan. The branch-creation dialog
  shows the range it will allow — **read it there** rather than trusting a number
  written here, since it varies by plan and has changed over time.

### The procedure — re-run annually, and after any schema change

1. Neon → **staging** branch → create a branch from a timestamp roughly an hour
   ago. Branching is instant and does not touch the original.
2. Copy the new branch's connection string.
3. Point the **staging** Render service at it: replace `DATABASE_URL`, save,
   let it redeploy.
4. Sign in. Open the tree. Check row counts against what you expect:
   ```sql
   SELECT
     (SELECT COUNT(*) FROM people)        AS people,
     (SELECT COUNT(*) FROM relationships) AS rels,
     (SELECT COUNT(*) FROM users)         AS users;
   ```
5. **Write down** how long steps 1–4 took and how much data the hour-old branch
   was missing. Those two numbers are your recovery time and recovery point.
   Without them, "we have backups" is an assumption.
5. **Reconcile the schema.** Run the check below against the restored branch and
   compare it to `shared/schema.js`. Every column the file declares must exist;
   re-apply any migration the snapshot predates. Skipping this is how a
   successful restore still produces a site that cannot log anyone in.
6. Point staging back at its own branch. Delete the test branch — or set
   auto-delete when creating it, which is safer than remembering.

Never run this against production. Branch from production if you want a
realistic size, but attach it to the **staging** service.

### Schema is separate

A restored database can still be wrong if the code moved on. After any restore,
run the schema check and diff against `shared/schema.js`:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

Production ran for days with `users.token_version` missing and login broken
because nothing compared the two.

---

## 3. Incident response

### The legal position is genuinely unclear — get advice

**Flagging this as unresolved rather than guessing.** The UAE PDPL (Federal
Decree-Law No. 45 of 2021) requires a controller to report a personal data
breach to the UAE Data Office. Article 9 defers the timing and procedure to
Executive Regulations. Whether those Executive Regulations are in force is
something published sources flatly contradict each other on: some cite Cabinet
Decision 111/2023, others Cabinet Decision 33/2024, others say they were issued
in 2026, and others — including DLA Piper as of January 2025 and a source citing
the Chambers Global Practice Guide 2026 — say they remain unpublished. Several
sites assert a firm 72-hour deadline while disagreeing on which instrument
created it.

**Do not rely on this document for the deadline.** Confirm with a UAE-qualified
lawyer, or the UAE Data Office directly, and write the answer here. Until then,
assume the shortest timeline any source claims (72 hours from becoming aware)
and act accordingly — being early is not a violation.

Also unresolved: the app stores UAE residents' personal data in Neon's
**eu-central-1 (Frankfurt)** region. Whether that satisfies PDPL cross-border
transfer requirements is a legal question, not a technical one, and the privacy
policy does not currently state where data is held. Same advice.

### What counts as a breach here

Any of: the database accessed by someone other than the operator; `JWT_SECRET`
or `ENCRYPTION_KEY` exposed; a user's account accessed by another person; the
Render or Neon or Firebase console compromised; personal data sent somewhere it
should not go.

Note the class this project has already produced: **PII in the Render logs.**
Nine `console.log` calls printed every person's name, birth date, birth place,
profession, phone and email in plaintext, for months. No id numbers: that field
has never been enterable, which lowers the sensitivity of the disclosure but does
not remove it. That was fixed
on 1 August 2026, but the historical log data still exists for whatever Render's
retention window is. If that window is long, this is worth treating as a
disclosure and asking the lawyer about.

### First hour

1. **Write down the time you became aware.** Any deadline runs from here, and
   nobody remembers accurately afterwards.
2. **Contain.** Depending on what happened:
   - Sessions compromised → set `SINGLE_SESSION=true` and rotate `JWT_SECRET`.
     Every token dies immediately.
   - Database credentials exposed → reset the Neon password now, update
     `DATABASE_URL`.
   - `ENCRYPTION_KEY` exposed → rotate per section 1. Slow; start it early.
   - Console access compromised → change the account password and enable or
     re-enrol MFA on Render, Neon, Firebase and the domain registrar.
3. **Preserve evidence before changing anything else.** `audit_logs` is the only
   record of who did what:
   ```sql
   SELECT * FROM audit_logs
   WHERE created_at > now() - interval '7 days'
   ORDER BY created_at DESC;
   ```
   Export it. Note that a 90-day cleanup runs on every server start, so the
   window is finite. Also capture the Render logs for the period.
4. **Do not delete anything** to tidy up. Deleting evidence is worse than the
   incident.

### Assessment

Answer these in writing before notifying anyone:

- What data, for how many people?

  **A phone number now appears in exactly ONE place: `auth_identities.identity_value`,
  where it is a credential.** Until 26 August 2026 a phone-login account's
  `users.id` WAS the phone number, so every column storing a user id carried one
  in plaintext — `audit_logs`, `deletions`, `trees`, none of which has a foreign
  key marking it as personal data. Those five accounts were migrated to opaque
  uuids and the columns verified clean on both databases.

  Full inventory, verified 26 August 2026:

  | table.column | holds | production | staging |
  |---|---|---|---|
  | `people` | names, dates, birth places, professions | all rows | all rows |
  | `people.phone` / `.email` | **AES-256-GCM sealed** | — | — |
  | `auth_identities.identity_value` | phone or email, **unencrypted** | 5 phone | 4 phone |
  | `users.id` | opaque uuid or Firebase uid | 0 phone | 0 phone |
  | `audit_logs.user_id` | opaque id | 0 phone | 0 phone |
  | `deletions.deleted_by` | opaque id | 0 phone | 0 phone |
  | `trees.created_by` | opaque id | 0 phone | 0 phone |
  | `edit_history.user_id` | opaque id | 0 — table empty | 0 |

  **Do not assume this stays true.** The rule that keeps it true is that
  `users.id` is always opaque; anything that reintroduces a credential as a key
  puts the number back into every one of those columns at once.

  Two audit rows on production hold `sms-unmatched` in place of a mistyped
  number that never belonged to an account — redacted 26 August rather than
  left as the only plaintext number in the table.

  `deletions.people` / `.people_after` are jsonb snapshots of deleted people and
  carry the same fields as `people`, including birth dates and birth places, in
  the clear. The `phone`/`email` fields inside them stay **sealed**: the snapshot
  is taken from a raw `db.select()` and from `.returning()`, both of which are
  ciphertext, and decryption happens afterwards into a separate response object.
  Verified in code (`recordUndo`, server/index.js ~579), NOT in data — no
  production snapshot currently holds a phone or email, so there was nothing to
  inspect. Re-check with a real row before relying on it under pressure.

  `edit_history` is empty on both databases and its write path was removed. It
  once held 1,034 PII-bearing rows on production.

- Was it encrypted at rest? Names, dates, birth places, professions and
  relationships are **not**. Only `people.phone` and `people.email` are. The
  account holder's own phone and email are not encrypted anywhere — login has to
  look them up, and the id itself is the number.
- Is it still exposed?
- Who was affected — account holders, or family members who never signed up?
  Most people in a tree never consented to being in it. That is the harder half
  of the notification question.

### Notification

Once the lawyer has confirmed the timeline, write it here.

**UAE Data Office** — nature of the breach, categories and approximate number of
people affected, likely consequences, measures taken.

#### Two populations, and only one of them is reachable

The people whose data is held fall into two groups, and the difference decides
the entire procedure:

- **Account holders.** Every one is reachable. Verified 26 August 2026 on
  production: 7 accounts, of which 5 have a verified phone identity and no email
  address — reachable by SMS only. Counts drift; re-run the query rather than
  quoting this number.
- **Family members in the trees.** Names, birth dates, birth places,
  professions — and **no contact details of any kind**. There is no email, no
  phone, no address for them anywhere in the database. This is not a gap in the
  procedure; it is a fact about the data. They cannot be contacted directly, and
  no tooling will change that.

#### Channel 1 — account holders, direct

Reach every account holder. Two mechanisms, because one does not cover everyone:

```sql
SELECT id, provider, email
FROM users
ORDER BY created_at;
```

- **Email**, where `email` is present — from the support address.
- **SMS via Twilio**, for accounts where `email IS NULL`. The number is in
  `auth_identities.identity_value` where `identity_type = 'phone'` — it is NO
  LONGER the `users.id`, so this needs a join rather than reading the id. Keep it to one line pointing at the
  public notice: Arabic SMS segments at 70 characters and a disclosure written as
  a text message fragments into something nobody reads.

#### Channel 2 — family members, through the account holder

This is the only route that exists to them, so the account-holder message must
carry it. **A notice that only says "your data was affected" will not work** —
the account holder will not think to tell anyone else, and the people actually
in the tree will never learn of it.

The message must state, explicitly:

- what was held about the people they added — names, birth dates, birth places,
  professions, relationships;
- that those people were affected too;
- that uaeroots holds no contact details for them and cannot reach them;
- that the account holder is the only one who can pass it on.

Write that paragraph into the template BEFORE it is needed. Under time pressure
it is the part that gets dropped.

#### Channel 3 — public notice

A page on uaeroots.com stating what happened, what data was involved, and how to
request removal. This is how someone who hears about it secondhand — a family
member who was never a user — can find out what was held about them and act on
it. Costs nothing to write at the time and is the only channel that reaches
someone who is not in contact with the account holder.

#### Removal requests from people who were never users

Someone who never signed up may ask to be taken off a tree. Today that arrives
as an email to support and is handled manually, by one person, with no record
kept. That is workable at 8 accounts and will not be at 800.

At minimum, log each request: who asked, which tree and person id, what was
done, when. Note that the requester cannot be authenticated — they have no
account — so identity has to be established some other way, and the account
holder has a competing interest in the same row.

**Open, and a question for the lawyer, not a technical one.** The working
position is that the account holder decided to enter that data and carries
responsibility for having done so. That position is NOT confirmed: uaeroots
defines the fields, holds the data, and is the only party that can physically
delete or correct it, which is the pattern a regulator generally reads as
controller rather than processor. Ask specifically:

> Where a user enters personal data about third parties who never registered, is
> the platform operator a controller or a processor for that data, and does
> notifying the account holder discharge any breach-notification duty toward
> those third parties?

Recorded as a working position pending that answer — deliberately not written
down as settled, because a documented decision not to notify reads far worse
after an incident than an open question does.

### After

Write down what happened, what was done, and what would have caught it earlier.
Add the detection to the working notes in the handoff. The `token_version`
outage went unnoticed for days because nothing was watching — most incidents
here will be found by accident unless something changes.

---

## What none of this covers

There is no monitoring and no alerting. No uptime check, no error-rate alarm,
no notification when the server starts refusing logins. Production login was
broken for days in July 2026 and was discovered only because someone tried to
sign in.

That gap makes every procedure above slower than it needs to be, because the
clock starts when a human notices. A single uptime check hitting
`/health` would be the cheapest improvement available to this project.
