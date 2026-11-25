# Firebase rules for one shop

The files in this folder are the security rules for a single buying-desk site. They do not name a city or a Firebase project. Publish the same three files on every new shop project:

- `database.rules.json` goes in Realtime Database rules
- `firestore.rules` goes in Firestore rules
- `storage.rules` goes in Storage rules

`firebase.json` points at these files. `.firebaserc` still names the Little Rock project `gameday-buying-tracker`. Do not run `firebase deploy` from this repo for a new shop. That command would publish rules to Little Rock. Paste the rules in the new project's Firebase console instead. The Las Vegas steps are in `docs/LAS-VEGAS-SETUP.md`.
