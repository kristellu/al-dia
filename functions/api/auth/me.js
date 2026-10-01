import { json } from '../../../src/lib/http.js';
import { retentionWindow } from '../../../src/lib/time.js';

export const publicUser = (u) => ({
  username: u.username,
  displayName: u.display_name,
  role: u.role,
  retentionMonths: u.retention_months,
  mustChangePassword: !!u.must_change_password,
});

export function onRequestGet({ data }) {
  return json({ user: publicUser(data.user), window: retentionWindow(data.user.retention_months) });
}
