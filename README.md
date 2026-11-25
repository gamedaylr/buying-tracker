# GameDay buying desk

This is the counter tool for logging cards the shop buys from walk-in sellers. Staff sign in, log the buy, and print the slip. Managers use a separate desk for the money, the history, and the ID photos.

Older buys stay in the same place in the database. They show up in the manager desk even though they were logged before sign-in.

## What staff see

A staff login can log a buy and print or send the receipt. It cannot see the buy list, anyone else's buys, the daily totals, or the download button.

## What managers see

The buying screen has a **Manager desk** button. That desk has:

- Every buy, with search by date, seller, buyer, amount, payment method, cert number, or notes
- Edit, and remove. Removed buys can be restored. They are not erased.
- Daily, weekly, monthly, and all-time totals
- A people list, to add or disable logins
- Shop settings: name, cash percent, store-credit percent, ID rule, and approval amount
- Seller history, including a printout and a download
- An activity log of who logged, edited, approved, or removed a buy
- A cash alert when one seller's cash is over $10,000 in a day, and a spreadsheet you can keep for a reporting service later. The app does not send that file anywhere.

## Offers, approval, and slabs

The buy screen shows a cash offer and a store-credit offer from the comp and the percents in settings. The buy records which one the seller took. Store credit is a payment method.

A buy at or over the approval amount, or a percent higher than the cash or store-credit rate, is saved as pending. A manager can type their own email and password on the spot, or approve it later from the desk. There is no shared PIN.

Graded cards can have a grader and a cert number. PSA details are looked up from PSA's own API. Beckett, CGC, SGC, and TAG open that company's own lookup page. The app does not pull those pages in. If the slab does not match, it is flagged for a manager.

## One-time setup for Jim

Do these steps when you are ready to switch the live site. Until you publish the new rules, the current website keeps working. Publishing the rules turns off the old open database, so do the website and the rules in the same sitting.

1. Open [Firebase console](https://console.firebase.google.com/) and choose the project **gameday-buying-tracker**.
2. Go to **Build → Authentication → Sign-in method**. Click **Email/Password**, turn on the first switch (email and password), and save. Leave the second switch (email link) off.
3. Go to **Build → Firestore Database**. Click **Create database**. Choose **Standard edition** if it asks. Start in **production mode**. Pick the region closest to the shop and confirm. You do not need to add any data by hand.
4. Go to **Build → Storage**. Click **Get started**. If Google asks you to upgrade to the **Blaze** plan, that upgrade is required for photo storage. Blaze bills only if you go past the free amount; a shop's buy photos should stay inside the free tier, but read the plan before you confirm. Finish creating the bucket. You can leave the default rules for a moment; the next step replaces them.
5. Go to **Build → Realtime Database → Rules**. Open the file `firebase/database.rules.json` in this project, select all of it, paste it over everything in the rules box, and click **Publish**. The old site will stop saving buys at this moment.
6. Go to **Build → Firestore Database → Rules**. Open `firebase/firestore.rules`, paste it over the rules box, and click **Publish**. The first time you publish storage rules that mention Firestore, Google may ask you to allow Storage to read Firestore. Click **Allow** or **Grant access**. That only lets the security rules check who is a manager. It does not make photos public.
7. Go to **Build → Storage → Rules**. Open `firebase/storage.rules`, paste it over the rules box, and click **Publish**.
8. In Netlify, open this site's **Site configuration → Environment variables** and add:
   - `PSA_API_TOKEN` — from step 9
   - `IDENTITY_ENCRYPTION_KEY` — from step 10
   Then publish the new site (merge this pull request, or deploy this branch). Do this right after the rules, so the counter is not left on the old page.
9. PSA cert lookup: create a free PSA account, open [psacard.com/publicapi](https://www.psacard.com/publicapi), sign in, and generate an API token. Paste that token into the Netlify variable `PSA_API_TOKEN`. The free token allows about 100 lookups a day. The token stays on the server. It is not in the app. If the token is missing, staff can still open PSA's website.
10. ID numbers: on your computer, if Node is installed, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. If that is awkward, any password manager can generate a long random string and you can base64-encode 32 random bytes. Put the result in `IDENTITY_ENCRYPTION_KEY`. Do not email it around, and do not change it later or old ID numbers cannot be read. If this variable is missing, the ID photo still saves, but the ID number and date of birth are not stored.
11. Open the new site. You should see **Create the first manager**. Use your real email and a password you will remember. Do this immediately, before you share the link. That login can add everyone else.
12. Open **Manager desk → People** and add each employee. Choose **Staff** for people who only log buys. Choose **Manager** for people who should see money, history, and ID photos. Tell them the email and password. They can use **Forgot password** on the sign-in screen later.
13. Open **Manager desk → Settings** and set the cash percent, store-credit percent, the dollar amount that requires an ID, and the amount that needs your approval. The starting values are cash 70%, store credit 80%, ID at $250, and approval at $1,000. New buys are saved as bought, with no hold.

To stand up another shop, use a new Firebase project and a new Netlify site. The steps for the Las Vegas shop are in [docs/LAS-VEGAS-SETUP.md](docs/LAS-VEGAS-SETUP.md). Do not replace `public/gameday-logo.png` and do not change the Little Rock site's environment variables to rename a second shop. Each site still runs one shop. New buys are stamped with that site's shop id. This app does not take payments for the software.

## If something goes wrong

To turn the old website back on, publish these Realtime Database rules again and redeploy the previous site:

```json
{
  "rules": {
    "purchases": {
      ".read": true,
      ".write": true
    }
  }
}
```

If someone else created the first manager before you did, delete that user in **Authentication → Users**, delete the `users` and `meta` data in Realtime Database, delete the `users` and `meta` collections in Firestore, and create the manager again.

## Photos and IDs

Card photos, payment screenshots, and signatures are private. A staff member can upload them on a buy they are logging. They cannot browse other people's photos. ID photos can be viewed only by a manager. ID numbers and dates of birth are encrypted before they are stored, and only a manager can read them back.

Each card photo is stored as its own file with room for tags later. Tagging cards from the photo (for example finding every Charizard) is not built yet.
