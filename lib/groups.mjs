// Called inside a transaction after checking the group's administrator.
// Users, credentials, sessions and other groups are never deleted here.
export function deleteGroupData(db, groupId, deletedAt, deletedBy) {
  const group = db.prepare("SELECT id,name FROM groups WHERE id=? AND deleted_at IS NULL").get(groupId);
  if (!group) throw new Error("GROUP_NOT_FOUND");
  db.prepare(`DELETE FROM store_observations WHERE revision_id IN
    (SELECT r.id FROM price_revisions r JOIN submissions s ON s.id=r.submission_id WHERE s.group_id=?)`).run(groupId);
  db.prepare("DELETE FROM price_revisions WHERE submission_id IN (SELECT id FROM submissions WHERE group_id=?)").run(groupId);
  for (const table of ["submissions", "product_change_requests", "assignments", "store_locations", "invites", "periods", "schedules", "audit_events", "memberships", "group_admins", "products"]) {
    db.prepare(`DELETE FROM ${table} WHERE group_id=?`).run(groupId);
  }
  // Retain an inaccessible tombstone so old tabs can never address a new group with the same ID.
  db.prepare("UPDATE groups SET deleted_at=?,deleted_by=?,archived=1 WHERE id=?").run(deletedAt, deletedBy, groupId);
}
