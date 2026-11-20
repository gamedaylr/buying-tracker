export function plainError(error) {
  const code = (error && (error.code || error.message)) || '';
  const text = String(code);
  if (/configuration-not-found/i.test(text)) {
    return 'Sign-in is not turned on yet. Email/password has to be enabled in Firebase before anyone can log in.';
  }
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/i.test(text)) {
    return 'That email or password is not right.';
  }
  if (/email-already-in-use/i.test(text)) {
    return 'That email already has a login.';
  }
  if (/weak-password|password/i.test(text) && /6/.test(text)) {
    return 'Use a password of at least 6 characters.';
  }
  if (/too-many-requests/i.test(text)) {
    return 'Too many tries. Wait a minute and try again.';
  }
  if (/PERMISSION_DENIED|permission_denied|Permission denied/i.test(text)) {
    return 'The database refused that. If the new site was just published, the security rules may not be published yet.';
  }
  if (/network|offline|failed to fetch/i.test(text)) {
    return 'The network request failed. Check the connection and try again.';
  }
  if (error && error.message && !/firebase/i.test(error.message)) return error.message;
  return 'Something went wrong. Try again, and if it keeps happening ask a manager.';
}
