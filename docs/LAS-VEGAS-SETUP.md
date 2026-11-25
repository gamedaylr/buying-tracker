# Las Vegas buying desk

This is a separate website for the Las Vegas shop. It has its own logins and its own buys. It does not use the Little Rock site at [gameday-buying-tracker.netlify.app](https://gameday-buying-tracker.netlify.app), and it does not use the Firebase project named `gameday-buying-tracker`.

Do not change environment variables on the Little Rock Netlify site. Do not open the Little Rock Firebase project while you do these steps. Do not run `firebase deploy` from this repo. The file `.firebaserc` still points at Little Rock, so that command would change the live Little Rock database.

The name on the Las Vegas site is exactly:

**Gameday Las Vegas Buying Tracker**

That is the browser tab, the home-screen name, the sign-in screen, the header, the printed 4x6 label, and the receipt. Copy it as it is written here, including the spelling `Gameday`.

Build the site from the Git branch that contains this file. That branch is `cursor/las-vegas-shop-copy-1ea2` until this work is on `main`. Leave the Little Rock site on its current branch.

## 1. Create the Firebase project

1. Open [Firebase console](https://console.firebase.google.com/).
2. Click **Add project**. Name it something you will recognize, such as `gameday-las-vegas-buying`. You can turn Google Analytics off. This app does not use it.
3. Stay in that new project for the rest of this section. If the project id at the top is `gameday-buying-tracker`, stop. That is Little Rock.

### Email and password sign-in

4. Go to **Build → Authentication → Sign-in method**.
5. Click **Email/Password**. Turn on the first switch (email and password). Leave the second switch (email link) off. Save.

You will add the Las Vegas website address to **Authentication → Settings → Authorized domains** after Netlify gives you the address. That is in section 4, after the site is deployed. Sign-in fails until that domain is on the list.

### Realtime Database

The buys, staff list, sellers, and shop settings live here.

6. Go to **Build → Realtime Database → Create database**.
7. Pick a United States region. Start in **locked mode**.
8. Open the **Data** tab and copy the database URL shown there. It looks like `https://YOUR-PROJECT-default-rtdb.firebaseio.com`, or a regional host if Firebase shows one. Paste it into a note. You will put it in `REACT_APP_FIREBASE_DATABASE_URL`. Do not invent this URL.

### Firestore

Staff roles for photo rules are stored here. You do not add any records by hand.

9. Go to **Build → Firestore Database → Create database**.
10. Choose **Standard edition** if it asks. Start in **production mode**. Pick a United States region and confirm.

### Storage

Card photos, ID photos, and signatures live here.

11. Go to **Build → Storage → Get started**.
12. If Google asks you to upgrade to the **Blaze** plan, that upgrade is required for photo storage. Blaze bills only if you go past the free amount. A shop's buy photos should stay inside the free tier, but read the plan before you confirm.
13. Finish creating the bucket. You can leave the default rules for a moment. The next section replaces them.

### Web app config

14. Click the gear → **Project settings**.
15. Under **Your apps**, click the web icon (`</>`). Nickname it `Las Vegas buying desk`. Do not set up Firebase Hosting. Register the app.
16. Copy the `firebaseConfig` block. You need every one of these fields:

| Config field | Environment variable |
| --- | --- |
| `apiKey` | `REACT_APP_FIREBASE_API_KEY` |
| `authDomain` | `REACT_APP_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `REACT_APP_FIREBASE_PROJECT_ID` |
| `storageBucket` | `REACT_APP_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `REACT_APP_FIREBASE_APP_ID` |
| Database URL from step 8 | `REACT_APP_FIREBASE_DATABASE_URL` |

The database URL is often missing from that copied block if the database was created later. Use the URL you copied from the Realtime Database data tab. The bucket is whichever of `appspot.com` or `firebasestorage.app` the config shows. Copy it. Do not retype it from memory.

## 2. Publish the rules

These rules work on any new Firebase project. They are not tied to Little Rock. Publish them only in the Las Vegas project.

1. **Build → Realtime Database → Rules**. Open `firebase/database.rules.json` in this repo, select all of it, paste it over the rules box, and click **Publish**.
2. **Build → Firestore Database → Rules**. Open `firebase/firestore.rules`, paste it over the rules box, and click **Publish**. If Google asks you to let Storage read Firestore, click **Allow**. That only lets the rules check who is a manager. It does not make photos public.
3. **Build → Storage → Rules**. Open `firebase/storage.rules`, paste it over the rules box, and click **Publish**.

There is a short note in `firebase/README.md`. Do not deploy these rules with the Firebase CLI from this folder.

## 3. Create the Netlify site

1. In Netlify, click **Add new site → Import an existing project**. Choose the same Git repository as Little Rock.
2. Do not pick the existing site `gameday-buying-tracker`.
3. Branch: `cursor/las-vegas-shop-copy-1ea2` (or `main` after this file is on `main`).
4. If it asks for the build, use build command `npm run build` and publish directory `build`. The repo's `netlify.toml` already says that.
5. Choose a new site name, such as `gameday-las-vegas-buying-tracker`. The address will be `that-name.netlify.app`. It must not be `gameday-buying-tracker.netlify.app`.

Netlify may start a deploy immediately. If the variables below are not saved yet, that first deploy still points at Little Rock. Let it finish, add the variables, then run **Deploys → Trigger deploy → Deploy site**. Do not create a login on a deploy that is missing the variables.

### Variables you must set

Open **Site configuration → Environment variables → Add a variable**. For each one, include every scope Netlify offers (production, deploy previews, and branch deploys), with the same value. A preview that is missing these variables would open the Little Rock database.

Set these before you trigger the real deploy. The `REACT_APP_` values are copied into the website when it builds. Changing one later requires another deploy.

| Variable | Value to enter |
| --- | --- |
| `REACT_APP_FIREBASE_API_KEY` | `apiKey` from the new web app |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `authDomain` from the new web app |
| `REACT_APP_FIREBASE_PROJECT_ID` | `projectId` from the new web app |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | `storageBucket` from the new web app |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` from the new web app |
| `REACT_APP_FIREBASE_APP_ID` | `appId` from the new web app |
| `REACT_APP_FIREBASE_DATABASE_URL` | Realtime Database URL from step 8 |
| `REACT_APP_SHOP_NAME` | `Gameday Las Vegas Buying Tracker` |
| `REACT_APP_APP_TITLE` | `Gameday Las Vegas Buying Tracker` |
| `REACT_APP_SHOP_SHORT_NAME` | `Gameday Las Vegas Buying Tracker` |
| `REACT_APP_SHOP_ID` | `gameday-las-vegas` |
| `IDENTITY_ENCRYPTION_KEY` | A new random key. See below. |
| `PSA_API_TOKEN` | A PSA API token for this shop. See below. |

`REACT_APP_SHOP_NAME`, `REACT_APP_APP_TITLE`, and `REACT_APP_SHOP_SHORT_NAME` are all the same words: `Gameday Las Vegas Buying Tracker`. `REACT_APP_SHOP_ID` is the internal id `gameday-las-vegas`. It is not the title and it is not a login.

The same `REACT_APP_FIREBASE_` variables are what the website and the server checks (PSA lookup and ID numbers) use. You do not enter them twice.

`IDENTITY_ENCRYPTION_KEY`: on your computer, if Node is installed, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Put that new string in the variable. Do not copy the Little Rock key. Do not email it. Do not change it later, or old ID numbers on this Las Vegas site cannot be read. If it is missing, the ID photo still saves, but the ID number and date of birth are not stored.

`PSA_API_TOKEN`: create a free PSA account, open [psacard.com/publicapi](https://www.psacard.com/publicapi), and generate a token. The free token allows about 100 lookups a day. The token stays on the server. If it is missing, staff can still open PSA's website. Do not paste the Little Rock token here unless you mean for both shops to share that PSA quota.

### Leave these unset

Unset means "same as Little Rock." Do not set them to a blank value. Do not add them at all unless you want a different choice.

| Variable | If you leave it unset |
| --- | --- |
| `REACT_APP_SHOP_LOCATION_LABEL` | New buys start as `In Shop` |
| `REACT_APP_SHOP_TAGLINE` | The line under the shop name is `Buying desk` |
| `REACT_APP_SHOP_ACCENT_COLOR` | Receipts and buttons use `#ed1c24` |
| `REACT_APP_SHOP_LOGO_URL` | The site shows the GameDay logo file already in the repo |

Do not replace `public/gameday-logo.png` or `src/gameday-logo.png` in the repo. The next Little Rock deploy would pick up that change. For a Las Vegas logo, host the image at an `https://` address and set `REACT_APP_SHOP_LOGO_URL` to that address, then redeploy.

Do not set `REACT_APP_USE_EMULATORS` on Netlify.

The `REACT_APP_FIREBASE_` values and the shop name end up in the public website file. That is how this app talks to Firebase. `IDENTITY_ENCRYPTION_KEY` and `PSA_API_TOKEN` stay on the server. Do not put those two in a chat.

## 4. Create your manager login

Do this yourself, on the new site, after a deploy that includes the variables.

1. Open the new Netlify address.
2. The browser tab must say **Gameday Las Vegas Buying Tracker**. The sign-in screen must show that same name.
3. If the tab says **GameDay buying desk**, stop. Do not create a login and do not type your Little Rock password. That deploy is still the Little Rock app. Check the variables, trigger a new deploy, and wait until it finishes.
4. If the page says the Firebase settings are incomplete, stop and set every `REACT_APP_FIREBASE_` variable, then redeploy. A half-set site will not open Little Rock, and it will not open Las Vegas either.
5. You should see **Create the first manager**. The shop name is already **Gameday Las Vegas Buying Tracker**. Leave it.
6. Enter your name, your email, and a password you will remember. Click **Create manager login**.
7. That login exists only in the Las Vegas Firebase project. It does not get Little Rock's staff or Little Rock's buys.

Then:

8. In Firebase, go to **Authentication → Settings → Authorized domains** and add the new site's hostname only, such as `gameday-las-vegas-buying-tracker.netlify.app`. No `https://`. If sign-in says the domain is unauthorized, this is the missing step.
9. Open **Manager desk → People** and add the Las Vegas staff. **Staff** can log buys. **Manager** can see money, history, and ID photos.
10. Open **Manager desk → Settings** if you want different cash percent, store-credit percent, ID amount, or approval amount. The starting values are cash 70%, store credit 80%, ID at $250, and approval at $1,000. Leave the shop name as **Gameday Las Vegas Buying Tracker**.

The printed label uses that shop name as text. The receipt uses it under the logo. A buy with no location typed in is stored as **In Shop**.

## 5. Confirm Little Rock did not change

Open [gameday-buying-tracker.netlify.app](https://gameday-buying-tracker.netlify.app). The tab should still say **GameDay buying desk**, and your existing Little Rock login should still open the Little Rock buys. Las Vegas buys do not show up there.

If someone else creates the first Las Vegas manager before you do, delete that user in the **Las Vegas** project's **Authentication → Users**, delete `users` and `meta` in that project's Realtime Database, delete the `users` and `meta` collections in that project's Firestore, and create the manager again. Do not delete anything in `gameday-buying-tracker`.
