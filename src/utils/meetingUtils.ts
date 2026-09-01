/**
 * Helper to check if an ID string matches a base series or meeting ID
 */
export const getBaseMeetingId = (idStr: string): string => {
  if (!idStr) return "";
  const clean = idStr.replace(/^m-hist-/, "").replace(/^att_/, "").replace(/^att_missed_/, "");
  const parts = clean.split("-");
  if (parts.length > 2 && parts[0] === "meet" && parts[1] === "series") {
    return `series-${parts[2]}`;
  }
  return clean.replace(/-\d{4}-\d{2}-\d{2}$/, "");
};

/**
 * Clean title for fuzzy comparison
 */
export const cleanMeetingTitle = (title: string): string => {
  if (!title) return "";
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
};

/**
 * Helper to normalize any date parameter (string, array, or ISO string) into YYYY-MM-DD
 */
export const normalizeDateStr = (d: any): string => {
  if (!d) return "";
  if (Array.isArray(d)) {
    if (d.length === 0) return "";
    return normalizeDateStr(d[0]);
  }
  if (typeof d !== "string") return "";
  const s = d.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return s;
};

/**
 * Robust matching between an attendance log and a meeting/occurrence object.
 */
export const isMatchingLogForMeeting = (log: any, targetMeeting: any, targetDateParam?: string): boolean => {
  if (!log || !targetMeeting) return false;

  const lMeetingId = String(log.meetingId || "").toLowerCase().trim();
  const lParentId = String(log.parentMeetingId || log.seriesId || "").toLowerCase().trim();
  const lTitle = String(log.meetingTitle || log.title || "").toLowerCase().trim();
  const lLogId = String(log.id || "").toLowerCase().trim();

  const mId = String(targetMeeting.id || "").toLowerCase().trim();
  const mMeetingId = String(targetMeeting.meetingId || "").toLowerCase().trim();
  const mSeriesId = String(
    targetMeeting.seriesId ||
      targetMeeting.parentMeetingId ||
      targetMeeting.recurringSeriesId ||
      "",
  ).toLowerCase().trim();
  const mTitle = String(targetMeeting.title || targetMeeting.meetingTitle || "").toLowerCase().trim();

  // If both log and targetMeeting specify a date (or targetDateParam), ensure they match!
  const targetDateRaw =
    targetDateParam ||
    targetMeeting.occurrenceDate ||
    targetMeeting.date ||
    targetMeeting.meetingDate ||
    (Array.isArray(targetMeeting.meetingDates) && targetMeeting.meetingDates.length === 1 ? targetMeeting.meetingDates[0] : "");
  const logDateRaw = log.meetingDate || log.date || (log.timestamp ? String(log.timestamp).substring(0, 10) : "");

  const targetDate = normalizeDateStr(targetDateRaw);
  const logDate = normalizeDateStr(logDateRaw);

  if (targetDate && logDate && targetDate !== logDate) {
    return false;
  }

  // Exact ID / Series ID / Parent ID matches
  if (lMeetingId && (lMeetingId === mId || lMeetingId === mMeetingId || lMeetingId === mSeriesId)) return true;
  if (lParentId && (lParentId === mId || lParentId === mMeetingId || lParentId === mSeriesId)) return true;
  if (mId && (mId === lMeetingId || mId === lParentId)) return true;
  if (mMeetingId && (mMeetingId === lMeetingId || mMeetingId === lParentId)) return true;
  if (mSeriesId && (mSeriesId === lMeetingId || mSeriesId === lParentId)) return true;

  // Base ID matches (e.g., stripping date suffixes from occurrence IDs)
  const lBase = getBaseMeetingId(lMeetingId) || getBaseMeetingId(lParentId);
  const mBase = getBaseMeetingId(mId) || getBaseMeetingId(mMeetingId) || getBaseMeetingId(mSeriesId);

  if (lBase && mBase && lBase === mBase) return true;

  // Structured Log ID match (e.g. att_meet_1_... or att_missed_meet_1_...)
  if (mId && (lLogId.startsWith(`att_${mId}_`) || lLogId.startsWith(`att_missed_${mId}_`))) return true;
  if (mMeetingId && (lLogId.startsWith(`att_${mMeetingId}_`) || lLogId.startsWith(`att_missed_${mMeetingId}_`))) return true;
  if (mSeriesId && (lLogId.startsWith(`att_${mSeriesId}_`) || lLogId.startsWith(`att_missed_${mSeriesId}_`))) return true;
  if (mBase && (lLogId.startsWith(`att_${mBase}_`) || lLogId.startsWith(`att_missed_${mBase}_`))) return true;

  // Title matches (Exact normalized title match ONLY to prevent cross-meeting pollution)
  if (lTitle && mTitle) {
    const cleanL = cleanMeetingTitle(lTitle);
    const cleanM = cleanMeetingTitle(mTitle);
    if (cleanL && cleanM && cleanL === cleanM) return true;
  }

  return false;
};

/**
 * Robust matching between an attendance log, a meeting/occurrence object, and a user profile.
 */
export const isMatchingLogForMeetingAndUser = (log: any, targetMeeting: any, profile: any, targetDateParam?: string): boolean => {
  if (!log || !profile) return false;
  if (!isMatchingLogForMeeting(log, targetMeeting, targetDateParam)) return false;

  const lUserId = String(log.userId || "").toLowerCase().trim();
  const lUsername = String(log.username || "").toLowerCase().trim();
  const lEmail = String(log.userEmail || log.email || "").toLowerCase().trim();
  const lFullName = String(log.fullName || "").toLowerCase().trim();

  const pProfId = String(profile.id || "").toLowerCase().trim();
  const pUsername = String(profile.username || "").toLowerCase().trim();
  const pEmail = String(profile.email || "").toLowerCase().trim();
  const pUid = String(profile.uid || "").toLowerCase().trim();
  const pFullName = String(profile.fullName || "").toLowerCase().trim();

  if (lUserId && (lUserId === pProfId || lUserId === pUid || lUserId === pUsername)) return true;
  if (pProfId && (pProfId === lUserId || pProfId === lUsername)) return true;
  if (lUsername && pUsername && lUsername === pUsername) return true;
  if (lEmail && pEmail && lEmail === pEmail) return true;
  if (lFullName && pFullName && lFullName === pFullName) return true;

  return false;
};

/**
 * Robust check if an attendance record belongs to the given user profile.
 */
export const isMatchingUser = (log: any, profile: any): boolean => {
  if (!log || !profile) return false;
  const lUserId = String(log.userId || "").toLowerCase().trim();
  const lUsername = String(log.username || "").toLowerCase().trim();
  const lEmail = String(log.userEmail || log.email || "").toLowerCase().trim();
  const lFullName = String(log.fullName || "").toLowerCase().trim();

  const pProfId = String(profile.id || "").toLowerCase().trim();
  const pUsername = String(profile.username || "").toLowerCase().trim();
  const pEmail = String(profile.email || "").toLowerCase().trim();
  const pUid = String(profile.uid || "").toLowerCase().trim();
  const pFullName = String(profile.fullName || "").toLowerCase().trim();

  if (lUserId && (lUserId === pProfId || lUserId === pUid || lUserId === pUsername)) return true;
  if (pProfId && (pProfId === lUserId || pProfId === lUsername)) return true;
  if (lUsername && pUsername && lUsername === pUsername) return true;
  if (lEmail && pEmail && lEmail === pEmail) return true;
  if (lFullName && pFullName && lFullName === pFullName) return true;

  return false;
};

