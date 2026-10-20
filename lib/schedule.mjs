const MINUTE = 60000, DAY = 86400000, WEEK = DAY * 7, OFFSET = 5 * 60 * MINUTE;
export const localDate = time => new Date(new Date(time).getTime() + OFFSET).toISOString().slice(0, 10);

// Window checks happen on the server for every request. No open browser or cron is needed.
export function windowFor(schedule, now) {
  const ms = new Date(now).getTime();
  const prefix = `${schedule.revision}:`;
  if (schedule.mode === "manual") {
    return { open: Boolean(schedule.manual_open), key: `${prefix}manual:${schedule.manual_start || "closed"}`,
      start: schedule.manual_start, end: null, next: null, mode: "manual" };
  }
  if (schedule.mode === "single") {
    const start = Date.parse(schedule.start_at), end = Date.parse(schedule.end_at);
    return { open: ms >= start && ms < end, key: `${prefix}single:${schedule.start_at}`,
      start: schedule.start_at, end: schedule.end_at,
      next: ms < start ? schedule.start_at : null, mode: "single" };
  }
  const local = new Date(ms + OFFSET);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET;
  const delta = (local.getUTCDay() - schedule.weekday + 7) % 7;
  let start = midnight - delta * DAY + schedule.minute * MINUTE;
  if (start > ms) start -= WEEK;
  const end = start + schedule.duration_minutes * MINUTE;
  return { open: ms >= start && ms < end, key: `${prefix}weekly:${new Date(start).toISOString()}`,
    start: new Date(start).toISOString(), end: new Date(end).toISOString(),
    next: new Date(start + WEEK).toISOString(), mode: "weekly" };
}
