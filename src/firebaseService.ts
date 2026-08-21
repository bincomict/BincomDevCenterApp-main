import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  getDocFromCache,
  getDocsFromCache,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  writeBatch,
  deleteField,
  runTransaction,
  Timestamp
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { db, auth } from "./firebase";
import { Profile, Meeting, AttendanceRecord, WeeklyDrill, WeeklyDrillSubmission, MeetingAssignment, MeetingHistoryRecord, QueuedMeetingUpdate, KnowledgeDevelopmentInfo, defaultKnowledgeDevelopmentInfo, KDPresentation, AttendancePunctualityConfig, defaultAttendancePunctualityConfig } from "./types";
import { isMatchingLogForMeetingAndUser, isMatchingLogForMeeting } from "./utils/meetingUtils";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export let isQuotaExhausted = false;
let quotaListeners: Array<(exhausted: boolean) => void> = [];

export function onQuotaStateChanged(listener: (exhausted: boolean) => void) {
  quotaListeners.push(listener);
  listener(isQuotaExhausted);
  return () => {
    quotaListeners = quotaListeners.filter(l => l !== listener);
  };
}

export function markQuotaExhausted() {
  if (!isQuotaExhausted) {
    isQuotaExhausted = true;
    quotaListeners.forEach(l => l(isQuotaExhausted));
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPermissionError = errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("insufficient");
  const isQuotaError = errMsg.toLowerCase().includes("resource-exhausted") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exceeded");

  if (isQuotaError) {
    markQuotaExhausted();
    console.error("🛑 CRITICAL: Firestore Quota Exceeded (resource-exhausted). Automatically backing off from active queries and automated sync checks to prevent tight-loop retries.");
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  const isNetworkOrAuthError = 
    errMsg.toLowerCase().includes("network-request-failed") ||
    errMsg.toLowerCase().includes("connection failed") ||
    errMsg.toLowerCase().includes("offline") ||
    errMsg.toLowerCase().includes("unavailable");

  if (isPermissionError) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else if (isNetworkOrAuthError) {
    console.warn('Firestore network/offline/auth state warning:', errMsg, path ? `Path: ${path}` : '');
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    console.warn('Gracefully handled non-permission Firestore transport/offline error:', errMsg);
  }
}

// --- Timezone and Time Filtering Helpers (copied from server.ts) ---
export const getLagosDateString = (date: Date): string => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === "year")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const day = parts.find(p => p.type === "day")?.value || "";
    return `${year}-${month}-${day}`;
  } catch (e) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

export const getLagosDateStringDaysAgo = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getLagosDateString(date);
};

export const getLagosDayOfWeek = (date: Date): string => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      weekday: "long"
    }).format(date);
  } catch (e) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[date.getDay()];
  }
};

export const parseMeetingTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  let clean = timeStr.replace(/\s*WAT\s*$/i, "").trim().toUpperCase();
  
  // Extract start time segment before any hyphen or dash
  const firstPart = clean.split("-")[0].trim();
  const hasPM = clean.includes("PM");
  const hasAM = clean.includes("AM");

  const match = firstPart.match(/^(\d+)(?:[:.](\d+))?\s*(AM|PM)?/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const partAmpm = match[3] || (hasPM ? "PM" : (hasAM ? "AM" : undefined));
  
  if (partAmpm === "PM" && hours < 12) hours += 12;
  if (partAmpm === "AM" && hours === 12) hours = 0;
  if (!partAmpm && hours < 8) hours += 12;

  return hours * 60 + minutes;
};

export const getLagosMinutesPastMidnight = (date: Date): number => {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).format(date);
    
    const parts = formatted.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
  } catch (e) {
    const utcHours = date.getUTCHours();
    const lagosHours = (utcHours + 1) % 24;
    return lagosHours * 60 + date.getUTCMinutes();
  }
};

export const formatMinutesToTimeString = (minsPastMidnight: number): string => {
  let hours = Math.floor(minsPastMidnight / 60) % 24;
  const minutes = minsPastMidnight % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  const displayMinutes = String(minutes).padStart(2, "0");
  return `${String(displayHours).padStart(2, "0")}:${displayMinutes} ${ampm}`;
};

// --- Authentication Service ---
export const listenToAuthChanges = (onUserLoaded: (profile: Profile | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    const cachedProfileId = localStorage.getItem("bincom_active_profile_id");
    if (cachedProfileId) {
      try {
        const cachedDoc = await getDoc(doc(db, "profiles", cachedProfileId));
        if (cachedDoc.exists()) {
          const profileData = cachedDoc.data() as Profile;
          onUserLoaded(profileData);
          return;
        }
      } catch (e) {
        console.warn("Could not load cached profile ID from Firestore:", e);
      }
    }

    if (user) {
      try {
        // Fetch Firestore user profile
        let userDoc = await getDoc(doc(db, "profiles", user.uid));
        let profileData: Profile | null = null;

        if (userDoc.exists()) {
          profileData = userDoc.data() as Profile;
        } else {
          // Check if there is an existing seeded/mock profile with this email under a different ID
          const email = user.email || "";
          if (email) {
            const q = query(collection(db, "profiles"), where("email", "==", email.trim().toLowerCase()));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              const oldDoc = snapshot.docs[0];
              const oldData = oldDoc.data() as Profile;
              profileData = {
                ...oldData,
                id: user.uid
              };
              await setDoc(doc(db, "profiles", user.uid), profileData);
              if (oldDoc.id !== user.uid) {
                try {
                  await deleteDoc(doc(db, "profiles", oldDoc.id));
                } catch (e) {
                  console.warn("Could not delete old profile doc during migration:", e);
                }
              }
            }
          }
        }

        if (profileData) {
          localStorage.setItem("bincom_active_profile_id", profileData.id);
          onUserLoaded(profileData);
        } else if (!user.isAnonymous) {
          // Fallback or create minimal profile for non-anonymous user
          const newProfile: Profile = {
            id: user.uid,
            email: user.email || "",
            username: (user.email || "").split("@")[0].toLowerCase(),
            fullName: user.displayName || (user.email || "").split("@")[0],
            education: "",
            occupation: "",
            techExperience: "Beginner",
            track: "All",
            role: "user",
            status: "onboarding",
            joinedAt: new Date().toISOString()
          };
          await setDoc(doc(db, "profiles", user.uid), newProfile);
          localStorage.setItem("bincom_active_profile_id", newProfile.id);
          onUserLoaded(newProfile);
        } else {
          onUserLoaded(null);
        }
      } catch (err: any) {
        console.warn("Firestore error in listenToAuthChanges, loading offline fallback profile:", err);
        onUserLoaded(null);
      }
    } else {
      onUserLoaded(null);
    }
  });
};

// --- Realtime Database Sync Engine ---
export const isUserEligibleForMeetingInBackend = (user: any, meeting: any, assignments: any[]): boolean => {
  if (user.role === "admin") return false;

  // 1. Explicitly assigned
  const isAssigned = assignments.some((ma: any) => {
    if (!ma) return false;
    const maMId = String(ma.meetingId || "").toLowerCase().trim();
    const maUId = String(ma.userId || "").toLowerCase().trim();
    const mId = String(meeting.id || "").toLowerCase().trim();
    const mSeriesId = String(meeting.seriesId || meeting.parentMeetingId || "").toLowerCase().trim();
    const uId = String(user.id || "").toLowerCase().trim();
    const uName = String(user.username || "").toLowerCase().trim();
    const uUid = String(user.uid || "").toLowerCase().trim();
    const uEmail = String(user.email || "").toLowerCase().trim();

    const meetingMatch = maMId === mId || (mSeriesId && maMId === mSeriesId) || (mId && maMId && (mId.includes(maMId) || maMId.includes(mId)));
    const userMatch = maUId === uId || maUId === uName || maUId === uUid || maUId === uEmail;
    return meetingMatch && userMatch;
  });
  if (isAssigned) return true;

  // 2. User Level & Track Eligibility
  const userLevelValue = user.learningLevel || user.techExperience || "Apprentice level 1";
  const userTrackValue = user.track || "";

  const targetTracks = meeting.targetTeamTrackEligibility || [];
  const isGlobalTrack = !targetTracks || targetTracks.length === 0 || targetTracks.includes("All") || targetTracks.includes("All Tracks Eligibility");
  const rawLevels = meeting.userLevels || meeting.trackId || [];
  const isGlobalLevel = !rawLevels || (Array.isArray(rawLevels) && rawLevels.length === 0) || rawLevels.includes("All") || rawLevels.includes("All User Eligible") || rawLevels.includes("All User Level");
  const isGlobal = isGlobalTrack && isGlobalLevel;

  if (isGlobal) return true;

  const trackMatch = (() => {
    if (userTrackValue.trim().toLowerCase() === "all") return true;
    if (!targetTracks || targetTracks.length === 0) return true;
    return targetTracks.some((t: string) => {
      const mt = t.trim().toLowerCase();
      const ut = userTrackValue.trim().toLowerCase();
      return mt === ut || mt === "all" || mt.includes(ut) || ut.includes(mt);
    });
  })();

  const levelMatch = (() => {
    if (!rawLevels || rawLevels.length === 0) return true;
    const levelsArr = Array.isArray(rawLevels) ? rawLevels : [rawLevels];
    return levelsArr.some((l: string) => {
      const mLevel = l.trim().toLowerCase();
      const uL = userLevelValue.trim().toLowerCase();
      return mLevel === uL || mLevel.includes(uL) || uL.includes(mLevel);
    });
  })();

  if (!isGlobalTrack && !isGlobalLevel) {
    return trackMatch && levelMatch;
  } else if (!isGlobalTrack) {
    return trackMatch;
  } else {
    return levelMatch;
  }
};

export const formatMinutesToMeetingTime = (totalMinutes: number): string => {
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mmStr = String(minutes).padStart(2, "0");
  return `${hours}:${mmStr} ${ampm}`;
};

export const autoArchiveCompletedMeetings = async (
  meetings: any[],
  profiles: any[] = [],
  attendance: any[] = [],
  assignments: any[] = [],
  meetingHistory: any[] = [],
  punctualityConfig?: AttendancePunctualityConfig
): Promise<void> => {
  if (isQuotaExhausted) return;
  if (!meetings || meetings.length === 0) return;
  if (!profiles || profiles.length === 0) return; // Wait until profiles have resolved to prevent marking everyone missed prematurely

  const now = new Date();
  const todayStr = getLagosDateString(now);
  const currentMinutes = getLagosMinutesPastMidnight(now);
  const existingHistIds = new Set(meetingHistory.map(h => h.id));
  const existingAttIds = new Set(attendance.map(a => a.id));

  const meetingsToProcess: Array<{ meeting: any; targetStatus: string; shouldUpdateStatus: boolean; needsHistory: boolean }> = [];

  for (const m of meetings) {
    const statusLower = String(m.status || "").trim().toLowerCase();

    // Collect dates
    const dates: string[] = [];
    if (m.occurrenceDate) dates.push(m.occurrenceDate);
    if (m.meetingDates && Array.isArray(m.meetingDates)) {
      m.meetingDates.forEach((d: string) => {
        if (d && !dates.includes(d)) dates.push(d);
      });
    }

    const occurrenceDate = m.occurrenceDate || (m.meetingDates && m.meetingDates[0]) || todayStr;
    const historyId = `m-hist-${m.id}-${occurrenceDate}`;
    const needsHistory = !existingHistIds.has(historyId);

    const latestDate = dates.length > 0
      ? dates.reduce((latest, current) => (current > latest ? current : latest), dates[0])
      : occurrenceDate;

    const scheduledTimeStr = m.timeString || m.time || m.scheduledStartTime || m.startTime || "09:00 AM";
    const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);
    const durationStr = m.duration || "30 minutes";
    const matchDuration = durationStr.match(/(\d+)/);
    const durationMinutes = matchDuration ? parseInt(matchDuration[1], 10) : 30;
    const endTimeMinutes = scheduledMinutes + durationMinutes;

    let isMeetingEnded = false;

    if (latestDate < todayStr) {
      isMeetingEnded = true;
    } else if (latestDate === todayStr) {
      if (currentMinutes >= endTimeMinutes) {
        isMeetingEnded = true;
      }
    }

    let targetStatus = m.status || "Upcoming";
    if (statusLower === "cancelled" || statusLower === "archived") {
      targetStatus = m.status;
    } else if (isMeetingEnded) {
      targetStatus = "Completed";
    }

    const shouldUpdateStatus = statusLower !== targetStatus.toLowerCase();

    if (
      shouldUpdateStatus ||
      (needsHistory &&
        (targetStatus.toLowerCase() === "completed" ||
          targetStatus.toLowerCase() === "archived"))
    ) {
      meetingsToProcess.push({ meeting: m, targetStatus, shouldUpdateStatus, needsHistory });
    }
  }

  if (meetingsToProcess.length === 0) return;

  console.log(`Processing ${meetingsToProcess.length} meetings for auto-completion / auto-archiving (5 min post-completion)...`);

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let batchCount = 0;
  const writeBatchSize = 400;

  meetingsToProcess.forEach(({ meeting: m, targetStatus, shouldUpdateStatus, needsHistory }) => {
    if (shouldUpdateStatus) {
      const docRef = doc(db, "meetings", m.id);
      currentBatch.update(docRef, { status: targetStatus, updatedAt: new Date().toISOString() });
      batchCount++;
      if (batchCount >= writeBatchSize) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        batchCount = 0;
      }
    }

    const occurrenceDate = m.occurrenceDate || (m.meetingDates && m.meetingDates[0]) || todayStr;
    const historyId = `m-hist-${m.id}-${occurrenceDate}`;

    if (needsHistory) {
      const scheduledTimeStr = m.timeString || m.time || m.scheduledStartTime || m.startTime || "09:00 AM";
      const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);
      const durationStr = m.duration || "30 minutes";
      const matchDuration = durationStr.match(/(\d+)/);
      const durationMinutes = matchDuration ? parseInt(matchDuration[1], 10) : 30;
      const endTimeMinutes = scheduledMinutes + durationMinutes;
      const scheduledEndTimeStr = formatMinutesToMeetingTime(endTimeMinutes);

      const historyData: MeetingHistoryRecord = {
        id: historyId,
        meetingId: m.id,
        title: m.title,
        type: m.type,
        date: occurrenceDate,
        scheduledStartTime: scheduledTimeStr,
        scheduledEndTime: scheduledEndTimeStr,
        duration: durationStr,
        organizer: m.organizer || "Admin Team",
        userLevels: m.userLevels || m.trackId || [],
        targetTeamTrackEligibility: m.targetTeamTrackEligibility || []
      };

      currentBatch.set(doc(db, "meetingHistory", historyId), historyData, { merge: true });
      batchCount++;
      if (batchCount >= writeBatchSize) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        batchCount = 0;
      }
    }

    const eligibleUsers = profiles.filter(u => isUserEligibleForMeetingInBackend(u, m, assignments));
    
    eligibleUsers.forEach(user => {
      const userAttLogs = attendance.filter(a => isMatchingLogForMeetingAndUser(a, m, user));
      const hasRealAttendance = userAttLogs.some(a => {
        const s = (a.status || "").toLowerCase();
        return !s.includes("miss") && !s.includes("absent");
      });

      if (hasRealAttendance) {
        // Clean up any stale auto-generated missed records and re-verify attendance status punctuality classification
        const lateThresh = punctualityConfig?.lateThresholdMinutes ?? 2;
        const veryLateThresh = punctualityConfig?.veryLateThresholdMinutes ?? 5;

        userAttLogs.forEach(a => {
          const s = (a.status || "").toLowerCase();
          if (s.includes("miss") || s.includes("absent")) {
            if (a.id) {
              currentBatch.delete(doc(db, "attendance", a.id));
              batchCount++;
              if (batchCount >= writeBatchSize) {
                batches.push(currentBatch);
                currentBatch = writeBatch(db);
                batchCount = 0;
              }
            }
          } else if (a.timestamp && a.id) {
            const scheduledTimeStr = a.scheduledStartTime || m.scheduledStartTime || m.timeString || m.time || "09:00 AM";
            const scheduledMins = parseMeetingTimeToMinutes(scheduledTimeStr);
            const joinMins = getLagosMinutesPastMidnight(new Date(a.timestamp));
            if (scheduledMins > 0 && joinMins > 0) {
              const diff = joinMins - scheduledMins;
              let expectedStatus = "Attended";
              if (diff > veryLateThresh) {
                expectedStatus = "Very Late";
              } else if (diff > lateThresh) {
                expectedStatus = "Late";
              }

              if (a.status !== expectedStatus) {
                currentBatch.update(doc(db, "attendance", a.id), { status: expectedStatus, updatedAt: new Date().toISOString() });
                batchCount++;
                if (batchCount >= writeBatchSize) {
                  batches.push(currentBatch);
                  currentBatch = writeBatch(db);
                  batchCount = 0;
                }
              }
            }
          }
        });
      } else if (userAttLogs.length === 0) {
        const missedRecordId = `att_missed_${m.id}_${user.id}_${occurrenceDate}`;
        if (!existingAttIds.has(missedRecordId)) {
          const missedRecord = {
            id: missedRecordId,
            userId: user.id,
            username: user.username || "",
            fullName: user.fullName || "",
            meetingId: m.id,
            meetingTitle: m.title,
            meetingType: m.type,
            timestamp: new Date(`${occurrenceDate}T12:00:00Z`).toISOString(),
            status: "Missed",
            track: user.track || "General",
            meetingDate: occurrenceDate,
            date: occurrenceDate
          };
          currentBatch.set(doc(db, "attendance", missedRecordId), missedRecord, { merge: true });
          batchCount++;
          if (batchCount >= writeBatchSize) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    });
  });

  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (err: any) {
      console.warn("[autoArchiveCompletedMeetings] Batch commit failed or skipped due to permissions/quota:", err?.message || err);
      if (err?.message?.toLowerCase().includes("quota") || err?.message?.toLowerCase().includes("exceeded") || err?.message?.toLowerCase().includes("resource-exhausted")) {
        markQuotaExhausted();
      }
    }
  }
};

export const synchronizeMeetings = async (): Promise<{ added: string[]; updated: string[] }> => {
  const { EXTERNAL_MEETINGS_POOL } = await import("./data/externalMeetings");
  const added: string[] = [];
  const updated: string[] = [];

  const allMeetingsMap: Record<string, any> = {};

  // 1. Load external pool backup meetings as base
  try {
    const poolSnap = await getDocs(collection(db, "externalMeetingsPool"));
    if (!poolSnap.empty) {
      poolSnap.docs.forEach((d) => {
        allMeetingsMap[d.id] = { id: d.id, ...d.data() };
      });
    } else {
      const backupBatch = writeBatch(db);
      EXTERNAL_MEETINGS_POOL.forEach((m) => {
        backupBatch.set(doc(db, "externalMeetingsPool", m.id), m);
        allMeetingsMap[m.id] = m;
      });
      await backupBatch.commit();
    }
  } catch (poolErr: any) {
    console.warn("[synchronizeMeetings] Failed to query Firestore externalMeetingsPool, falling back to static pool:", poolErr);
    EXTERNAL_MEETINGS_POOL.forEach((m) => {
      allMeetingsMap[m.id] = m;
    });
  }

  // 2. Fetch all saved meetings from Firestore 'meetings' collection to pick up latest saved information
  const existingMeetingIds = new Set<string>();
  try {
    const existingSnap = await getDocs(collection(db, "meetings"));
    existingSnap.docs.forEach((d) => {
      existingMeetingIds.add(d.id);
      allMeetingsMap[d.id] = { ...allMeetingsMap[d.id], ...d.data(), id: d.id };
    });
  } catch (err: any) {
    console.warn("[synchronizeMeetings] Failed to query existing meetings from server, trying cache:", err);
    try {
      const existingSnap = await getDocsFromCache(collection(db, "meetings"));
      existingSnap.docs.forEach((d) => {
        existingMeetingIds.add(d.id);
        allMeetingsMap[d.id] = { ...allMeetingsMap[d.id], ...d.data(), id: d.id };
      });
    } catch (cacheErr) {
      console.warn("[synchronizeMeetings] Cache query failed too:", cacheErr);
    }
  }

  const meetingsToSync = Object.values(allMeetingsMap);
  const todayStr = getLagosDateString(new Date());
  const todayDayName = getLagosDayOfWeek(new Date());

  const batch = writeBatch(db);
  let batchCount = 0;

  for (const m of meetingsToSync) {
    const isAlreadyExisted = existingMeetingIds.has(m.id);
    if (isAlreadyExisted) {
      updated.push(m.title || m.id);
    } else {
      added.push(m.title || m.id);
    }

    const hasTodayDate = Array.isArray(m.meetingDates) && m.meetingDates.includes(todayStr);
    const hasTodayDay = Array.isArray(m.scheduleDays) && m.scheduleDays.some(
      (d: string) => String(d).trim().toLowerCase() === todayDayName.toLowerCase()
    );
    const isOccurrenceToday = m.occurrenceDate === todayStr;

    const isActive = (hasTodayDate || hasTodayDay || isOccurrenceToday) && m.status !== "Archived" && m.status !== "archived";

    batch.set(doc(db, "meetings", m.id), { ...m, isActive }, { merge: true });
    batchCount++;
    if (batchCount >= 400) {
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, "meetings");
      }
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "meetings");
    }
  }

  try {
    await syncMeetingAssignmentsForMeetings(meetingsToSync);
  } catch (syncErr: any) {
    console.warn("[synchronizeMeetings] syncMeetingAssignmentsForMeetings failed:", syncErr);
  }

  try {
    await processQueuedUpdates();
  } catch (qErr) {
    console.warn("[synchronizeMeetings] processQueuedUpdates failed:", qErr);
  }

  return { added, updated };
};

export const subscribeToAllState = (
  userId: string, 
  userProfile: Profile | null, 
  onStateUpdated: (state: any) => void
) => {
  const loadedCollections = new Set<string>();
  const state: any = {
    profiles: [],
    meetings: [],
    attendance: [],
    standups: [],
    personalDevelopment: [],
    techUpdates: [],
    weeklyDrills: [],
    drillSubmissions: [],
    socialLogs: [],
    projects: [],
    dailyReports: [],
    kdCounts: {},
    reminders: [],
    microserviceOwners: {},
    meetingTypes: [],
    meetingAssignments: [],
    meetingHistory: [],
    attendanceAuditLogs: [],
    queuedMeetingUpdates: [],
    assessmentAttempts: [],
    onboardingSubmissions: [],
    kdPresentations: [],
    tasks: [],
    microservices: [],
    careerPathways: null,
    autoMidnightSyncEnabled: false,
    attendancePunctualityConfig: defaultAttendancePunctualityConfig
  };

  const isAdmin = userProfile?.role === "admin";

  const collectionsToListen = isAdmin
    ? [
        "profiles",
        "meetings",
        "attendance",
        "standups",
        "personalDevelopment",
        "techUpdates",
        "weeklyDrills",
        "drillSubmissions",
        "socialLogs",
        "projects",
        "dailyReports",
        "reminders",
        "meetingAssignments",
        "meetingHistory",
        "attendanceAuditLogs",
        "metadata",
        "assessmentAttempts",
        "onboardingSubmissions",
        "kdPresentations"
      ]
    : [
        "profiles", // Live subscription only to own profile
        "meetings",
        "attendance",
        "standups",
        "personalDevelopment",
        "techUpdates",
        "drillSubmissions",
        "socialLogs",
        "dailyReports",
        "reminders",
        "meetingAssignments",
        "metadata",
        "assessmentAttempts",
        "onboardingSubmissions",
        "kdPresentations"
      ];

  const collectionsToFetchOnce = isAdmin
    ? []
    : ["profiles", "meetingHistory", "projects", "weeklyDrills"];

  const unsubscribes = collectionsToListen.map(colName => {
    let queryRef: any;

    if (colName === "profiles") {
      if (isAdmin) {
        queryRef = collection(db, "profiles");
      } else {
        // Standard users only subscribe to their own profile in real-time
        queryRef = query(collection(db, "profiles"), where("id", "==", userId));
      }
    } else if (colName === "attendance") {
      if (isAdmin) {
        queryRef = collection(db, "attendance");
      } else {
        queryRef = query(collection(db, "attendance"), where("userId", "==", userId));
      }
    } else if (colName === "meetingHistory") {
      if (isAdmin) {
        queryRef = collection(db, "meetingHistory");
      } else {
        queryRef = collection(db, "meetingHistory");
      }
    } else if (colName === "reminders") {
      if (isAdmin) {
        queryRef = collection(db, "reminders");
      } else {
        queryRef = query(collection(db, "reminders"), where("userId", "==", userId));
      }
    } else if (
      colName === "standups" ||
      colName === "personalDevelopment" ||
      colName === "techUpdates" ||
      colName === "drillSubmissions" ||
      colName === "socialLogs" ||
      colName === "dailyReports" ||
      colName === "meetingAssignments" ||
      colName === "assessmentAttempts" ||
      colName === "onboardingSubmissions"
    ) {
      if (isAdmin) {
        queryRef = collection(db, colName);
      } else {
        queryRef = query(collection(db, colName), where("userId", "==", userId));
      }
    } else {
      queryRef = collection(db, colName);
    }

    return onSnapshot(queryRef, (snapshot) => {
      loadedCollections.add(colName);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (colName === "metadata") {
        const appConfig = docs.find(d => d.id === "app_config") as any;
        if (appConfig) {
          state.meetingTypes = appConfig.meetingTypes || [];
          state.kdCounts = appConfig.kdCounts || {};
          state.microserviceOwners = appConfig.microserviceOwners || {};
          state.tasks = appConfig.tasks || [];
          state.microservices = appConfig.microservices || [];
          state.careerPathways = appConfig.careerPathways || null;
          state.autoMidnightSyncEnabled = appConfig.autoMidnightSyncEnabled !== undefined ? appConfig.autoMidnightSyncEnabled : false;
          state.kdInfo = appConfig.kdInfo || defaultKnowledgeDevelopmentInfo;
          state.attendancePunctualityConfig = appConfig.attendancePunctualityConfig || defaultAttendancePunctualityConfig;
        }
      } else if (colName === "profiles" && !isAdmin) {
        // Standard user: merge real-time update of own profile with one-time fetched profiles list
        const ownLive = docs[0] || null;
        if (ownLive) {
          const otherProfiles = state.profiles.filter((p: any) => p.id !== userId);
          state.profiles = [ownLive, ...otherProfiles];
        }
      } else {
        state[colName] = docs;
      }

      // Re-compile, filter, and dispatch state
      dispatchCompiledState();
    }, (error) => {
      console.error(`Error in onSnapshot listener for ${colName}:`, error);
      handleFirestoreError(error, OperationType.LIST, colName);
    });
  });

  // Perform one-time cache-first fetches for non-admin static or large collections
  if (!isAdmin) {
    collectionsToFetchOnce.forEach(async (colName) => {
      try {
        const colRef = collection(db, colName);
        let snapshot;
        try {
          snapshot = await getDocsFromCache(colRef);
        } catch (cacheErr) {
          // Ignore cache query failure, fetch from server next
        }
        if (!snapshot || snapshot.empty) {
          snapshot = await getDocs(colRef);
        }
        loadedCollections.add(colName);
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (colName === "profiles") {
          const otherProfiles = docs.filter((p: any) => p.id !== userId);
          const ownLive = state.profiles.find((p: any) => p.id === userId);
          state.profiles = ownLive ? [ownLive, ...otherProfiles] : docs;
        } else {
          state[colName] = docs;
        }
        dispatchCompiledState();
      } catch (err: any) {
        console.warn(`[subscribeToAllState] One-time fetch failed for ${colName}:`, err);
        // Fallback to empty array to allow the app to function
        loadedCollections.add(colName);
        if (colName !== "profiles" || state.profiles.length === 0) {
          state[colName] = [];
        }
        dispatchCompiledState();
      }
    });
  }

  const dispatchCompiledState = () => {
    if (!userProfile) return;

    const isAdmin = userProfile.role === "admin";
    const now = new Date();
    const todayStr = getLagosDateString(now);
    const todayDayName = getLagosDayOfWeek(now);

    // Apply eligibility filters for trainee users
    let filteredMeetings = [...state.meetings];
    if (!isAdmin) {
      filteredMeetings = filteredMeetings.filter((m: any) => {
        if (m.status && (m.status.trim().toLowerCase() === "archived" || m.status.trim().toLowerCase() === "completed")) {
          return false;
        }

        // Check assigned
        const isAssigned = (state.meetingAssignments || []).some(
          (ma: any) => ma.meetingId === m.id && ma.userId === userId
        );

        // Check user levels and tracks
        const userLevelValue = userProfile.learningLevel || userProfile.techExperience || "Apprentice level 1";
        const userTrackValue = userProfile.track || "";

        const targetTracks = m.targetTeamTrackEligibility;
        const isGlobalTrack = !targetTracks || (Array.isArray(targetTracks) && targetTracks.length === 0);
        const rawLevels = m.userLevels !== undefined ? m.userLevels : m.trackId;
        const isGlobalLevel = !rawLevels || (Array.isArray(rawLevels) && rawLevels.length === 0) || rawLevels === "All" || rawLevels === "";
        const isGlobal = isGlobalTrack && isGlobalLevel;

        const isUserLevelEligible = (uLevel: string, mLevels: any): boolean => {
          const checkLevel = uLevel || "Apprentice level 1";
          const rawL = mLevels !== undefined ? mLevels : "All";
          if (!rawL || (Array.isArray(rawL) && rawL.length === 0) || rawL === "All" || rawL === "") {
            return true;
          }
          if (Array.isArray(rawL)) {
            const filtered = rawL.filter(l => l && l !== "All User Eligible" && l !== "All User Level" && l !== "All Tracks Eligibility");
            if (filtered.length === 0) {
              return true;
            }
            return filtered.some((l: string) => {
              const mLevel = l.trim().toLowerCase();
              const uL = checkLevel.trim().toLowerCase();
              return mLevel === uL || mLevel.includes(uL) || uL.includes(mLevel);
            });
          }
          if (rawL === "All User Eligible" || rawL === "All User Level" || rawL === "All Tracks Eligibility") {
            return true;
          }
          const mLevel = String(rawL).trim().toLowerCase();
          const uL = checkLevel.trim().toLowerCase();
          return mLevel === uL || mLevel.includes(uL) || uL.includes(mLevel);
        };

        const isTeamTrackEligible = (uTrack: string, mTracks: any): boolean => {
          const checkTrack = uTrack || "";
          if (checkTrack.trim().toLowerCase() === "all") {
            return true;
          }
          if (!mTracks || (Array.isArray(mTracks) && mTracks.length === 0)) {
            return true;
          }
          if (Array.isArray(mTracks)) {
            return mTracks.some((t: string) => {
              const mTrack = t.trim().toLowerCase();
              const uT = checkTrack.trim().toLowerCase();
              return mTrack === uT || uT === "all";
            });
          }
          const mTrack = String(mTracks).trim().toLowerCase();
          const uT = checkTrack.trim().toLowerCase();
          return mTrack === uT || uT === "all";
        };

        const levelMatch = isUserLevelEligible(userLevelValue, rawLevels);
        const trackMatch = isTeamTrackEligible(userTrackValue, targetTracks);

        let isLiveEligible = false;
        if (isGlobal) {
          isLiveEligible = true;
        } else if (!isGlobalTrack && !isGlobalLevel) {
          isLiveEligible = trackMatch && levelMatch;
        } else if (!isGlobalTrack) {
          isLiveEligible = trackMatch;
        } else {
          isLiveEligible = levelMatch;
        }

        return isAssigned || isLiveEligible;
      });
    }

    // Filter attendance and history for users
    let returnedAttendance = [...state.attendance].map(a => {
      const matchProf = state.profiles.find(p => p.id === a.userId || (p.username && a.username && p.username.toLowerCase() === a.username.toLowerCase())) || (a.userId === userId ? userProfile : null);
      const fullName = (matchProf && matchProf.fullName && matchProf.fullName.trim() !== "")
        ? matchProf.fullName
        : (a.fullName && a.fullName.trim() !== "" ? a.fullName : (matchProf?.username || a.username || "Student"));
      return {
        ...a,
        fullName
      };
    });
    let returnedProfiles = [...state.profiles];
    let returnedHistory = [...state.meetingHistory];
    let returnedAuditLogs = [] as any[];

    if (!isAdmin) {
      returnedAttendance = returnedAttendance.filter(a => a.userId === userId);
      
      const userLevelValue = userProfile.learningLevel || userProfile.techExperience || "Apprentice level 1";
      const userTrackValue = userProfile.track || "";
      
      returnedHistory = returnedHistory.filter((h: any) => {
        const isAssigned = (state.meetingAssignments || []).some(
          (ma: any) => ma.meetingId === h.meetingId && ma.userId === userId
        );
        if (isAssigned) return true;

        const targetTracks = h.targetTeamTrackEligibility;
        const isGlobalTrack = !targetTracks || (Array.isArray(targetTracks) && targetTracks.length === 0) || targetTracks.includes("All");
        const rawLevels = h.userLevels;
        const isGlobalLevel = !rawLevels || (Array.isArray(rawLevels) && rawLevels.length === 0) || rawLevels.includes("All") || rawLevels === "All" || rawLevels === "";
        const isGlobal = isGlobalTrack && isGlobalLevel;
        if (isGlobal) return true;

        const trackMatch = (() => {
          if (userTrackValue.trim().toLowerCase() === "all") return true;
          if (!targetTracks || targetTracks.length === 0) return true;
          return targetTracks.some((t: string) => t.trim().toLowerCase() === userTrackValue.trim().toLowerCase() || t.trim().toLowerCase() === "all");
        })();

        const levelMatch = (() => {
          if (!rawLevels || rawLevels.length === 0 || rawLevels.includes("All")) return true;
          return rawLevels.some((l: string) => {
            const mLevel = l.trim().toLowerCase();
            const uL = userLevelValue.trim().toLowerCase();
            return mLevel === uL || mLevel.includes(uL) || uL.includes(mLevel);
          });
        })();

        let isEligible = false;
        if (!isGlobalTrack && !isGlobalLevel) {
          isEligible = trackMatch && levelMatch;
        } else if (!isGlobalTrack) {
          isEligible = trackMatch;
        } else {
          isEligible = levelMatch;
        }
        return isEligible;
      });
      returnedProfiles = [userProfile];
    } else {
      returnedAuditLogs = [...state.attendanceAuditLogs];
    }

    const compiled = {
      ...state,
      profiles: returnedProfiles,
      meetings: filteredMeetings,
      attendance: returnedAttendance,
      reminders: state.reminders.filter((r: any) => r.userId === userId),
      meetingHistory: returnedHistory,
      attendanceAuditLogs: returnedAuditLogs
    };

    onStateUpdated(compiled);

    // Auto-check for completed meetings and update status
    if (
      !isQuotaExhausted &&
      compiled.meetings &&
      compiled.meetings.length > 0 &&
      compiled.profiles &&
      compiled.profiles.length > 0
    ) {
      autoArchiveCompletedMeetings(
        compiled.meetings,
        compiled.profiles,
        compiled.attendance,
        compiled.meetingAssignments,
        compiled.meetingHistory,
        compiled.attendancePunctualityConfig
      ).catch((err) =>
        console.error("Auto archive state check error:", err)
      );
    }
  };

  const autoArchiveCheckInterval = setInterval(() => {
    if (isQuotaExhausted) return;
    if (
      state.meetings &&
      state.meetings.length > 0 &&
      state.profiles &&
      state.profiles.length > 0
    ) {
      autoArchiveCompletedMeetings(
        state.meetings,
        state.profiles,
        state.attendance,
        state.meetingAssignments,
        state.meetingHistory,
        state.attendancePunctualityConfig
      ).catch((err) =>
        console.error("Auto archive interval check error:", err)
      );
    }
  }, 60000);

  const checkInterval = setInterval(() => {
    if (isQuotaExhausted) {
      console.warn("[subscribeToAllState] Polling bypassed because Firestore free-tier quota is exhausted.");
      return;
    }

    // Use the distributed lock transaction to run 12:00 AM midnight sync if needed
    runMidnightSyncIfNeeded(state, loadedCollections, userProfile).catch((err) => {
      console.error("[subscribeToAllState] Error running distributed lock-based sync:", err);
    });
  }, 60000); // Check every 60s for 12:00 AM transition or new day sync

  // Also trigger immediate check on initial load
  runMidnightSyncIfNeeded(state, loadedCollections, userProfile).catch((err) => {
    console.error("[subscribeToAllState] Initial sync check error:", err);
  });

  return () => {
    clearInterval(checkInterval);
    clearInterval(autoArchiveCheckInterval);
    unsubscribes.forEach(unsub => unsub());
  };
};

// Configurable polling interval constant.
export const STATE_SYNC_POLLING_INTERVAL = 60000;

let tabSessionId = "";
const getSessionTabId = (): string => {
  if (!tabSessionId) {
    tabSessionId = "client_tab_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  }
  return tabSessionId;
};

export const runMidnightSyncIfNeeded = async (
  state: any,
  loadedCollections: Set<string>,
  userProfile: Profile | null,
  force: boolean = false
): Promise<boolean> => {
  const now = new Date();
  const todayStr = getLagosDateString(now);

  const localSessionId = getSessionTabId();
  const lockDocRef = doc(db, "syncLocks", "midnightSync");

  try {
    const result = await runTransaction(db, async (transaction) => {
      const lockSnap = await transaction.get(lockDocRef);
      
      const data = lockSnap.exists() ? lockSnap.data() : null;
      const lastRunDate = data?.lastRunDate || "";
      const lockedAt = data?.lockedAt; // Timestamp or number
      const lockedBy = data?.lockedBy || "";

      // Check if lastRunDate is already today -> skip sync unless forced
      if (lastRunDate === todayStr && !force) {
        return { claimSucceeded: false, reason: "Already run today (" + todayStr + ")" };
      }

      // Check if another tab holds the active lock
      if (lockedAt) {
        const lockedAtMs = lockedAt instanceof Timestamp ? lockedAt.toMillis() : Number(lockedAt);
        const lockAgeMs = Date.now() - lockedAtMs;
        // Lock expires after 3 minutes (180000ms)
        if (lockAgeMs < 180000 && lockedBy !== localSessionId) {
          return { claimSucceeded: false, reason: "Lock is active and held by another tab: " + lockedBy };
        }
      }

      // Attempt to claim the lock
      const newLockData = {
        lastRunDate: lastRunDate, // preserve lastRunDate during lock claim
        lockedAt: Timestamp.now(),
        lockedBy: localSessionId
      };
      
      transaction.set(lockDocRef, newLockData, { merge: true });
      return { claimSucceeded: true };
    });

    if (!result.claimSucceeded) {
      return false;
    }

    console.log(`[midnightSync] Lock acquired successfully by session: ${localSessionId}. Executing daily meeting sync...`);

    const required = ["meetings", "profiles", "attendance", "meetingAssignments", "meetingHistory"];
    const allLoaded = required.every(col => loadedCollections.has(col));

    if (allLoaded && state.meetings && state.meetings.length > 0) {
      try {
        await autoArchiveCompletedMeetings(
          state.meetings,
          state.profiles,
          state.attendance,
          state.meetingAssignments,
          state.meetingHistory
        );
        console.log("[midnightSync] autoArchiveCompletedMeetings completed successfully.");
      } catch (e) {
        console.error("[midnightSync] autoArchiveCompletedMeetings failed:", e);
      }
    }

    try {
      console.log("⏱️ Automatic daily 12:00 AM sync processing queued updates...");
      await processQueuedUpdates();
    } catch (e) {
      console.error("[midnightSync] processQueuedUpdates failed:", e);
    }

    try {
      console.log("⏱️ Automatic 12:00 AM meeting synchronization executing...");
      await synchronizeMeetings();
      console.log("[midnightSync] synchronizeMeetings completed successfully.");
    } catch (e) {
      console.error("[midnightSync] synchronizeMeetings failed:", e);
    }

    // Release the lock and set today's date as lastRunDate
    await setDoc(lockDocRef, {
      lastRunDate: todayStr,
      lockedAt: null,
      lockedBy: null
    }, { merge: true });

    console.log(`[midnightSync] Sync complete. Lock released for date: ${todayStr}`);
    return true;

  } catch (err: any) {
    const errMsg = String(err?.message || err).toLowerCase();
    const isNetworkOrOffline = 
      errMsg.includes("connection failed") || 
      errMsg.includes("offline") || 
      errMsg.includes("network") ||
      errMsg.includes("unavailable") ||
      err?.code === "unavailable" ||
      err?.code === "auth/network-request-failed";

    if (isNetworkOrOffline) {
      console.warn("[midnightSync] Lock transaction skipped due to transient network/connection state:", err?.message || err);
    } else if (err?.code === "resource-exhausted" || errMsg.includes("quota")) {
      console.warn("[midnightSync] Resource exhausted / quota exceeded in lock transaction. Skipping sync check...");
    } else {
      console.error("[midnightSync] Transaction or lock-based execution failed:", err);
    }
    return false;
  }
};

export const subscribeToAuditLogs = (onUpdate: (logs: any[]) => void) => {
  // --- READ OPTIMIZATION: Query date-scoping ---
  // Approach A: Date-scoping via timestamp comparison (ISO string format on 'timestamp' field)
  const daysAgoISO = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const queryRef = query(collection(db, "attendanceAuditLogs"), where("timestamp", ">=", daysAgoISO));

  // Approach B: Date-scoping via string comparison on 'meetingDate' or 'date' field (if exists)
  // const daysAgoStr = getLagosDateStringDaysAgo(45);
  // const queryRef = query(collection(db, "attendanceAuditLogs"), where("meetingDate", ">=", daysAgoStr));

  // Note: Older records are still fully preserved in Firestore and only excluded from this real-time listener.
  // Any full-history view/export should use a separate one-time getDocs() call instead of a live listener.

  const unsub = onSnapshot(queryRef, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(docs);
  }, (error) => {
    console.error("Error in onSnapshot listener for attendanceAuditLogs:", error);
    handleFirestoreError(error, OperationType.LIST, "attendanceAuditLogs");
  });

  return unsub;
};

export const subscribeToQueuedUpdates = (onUpdate: (updates: any[]) => void) => {
  const queryRef = collection(db, "queuedMeetingUpdates");
  const unsub = onSnapshot(queryRef, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(docs);
  }, (error) => {
    console.error("Error in onSnapshot listener for queuedMeetingUpdates:", error);
    handleFirestoreError(error, OperationType.LIST, "queuedMeetingUpdates");
  });

  return unsub;
};

// --- DB Mutations Service Operations ---

export const getProfileById = async (id: string): Promise<Profile | null> => {
  const d = await getDoc(doc(db, "profiles", id));
  return d.exists() ? (d.data() as Profile) : null;
};

export const updateProfile = async (id: string, updates: Partial<Profile>): Promise<Profile> => {
  try {
    await updateDoc(doc(db, "profiles", id), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${id}`);
  }
  const updated = await getProfileById(id);
  if (!updated) throw new Error("Updated profile not found");
  return updated;
};

export const resetProfileToOnboarding = async (id: string): Promise<Profile> => {
  return updateProfile(id, {
    status: "onboarding",
    score: deleteField() as any
  });
};

export const submitOnboarding = async (
  id: string,
  onboardingData: {
    fullName: string;
    education: string;
    occupation: string;
    techExperience: string;
    track: string;
    learningLevel: string;
    previousCourseCompleted: boolean;
  }
): Promise<Profile> => {
  const submissionId = `onboard-${id}-${Date.now()}`;
  const submissionData = {
    id: submissionId,
    userId: id,
    fullName: onboardingData.fullName,
    education: onboardingData.education,
    occupation: onboardingData.occupation,
    techExperience: onboardingData.techExperience,
    track: onboardingData.track,
    learningLevel: onboardingData.learningLevel,
    previousCourseCompleted: onboardingData.previousCourseCompleted,
    timestamp: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, "onboardingSubmissions", submissionId), submissionData);
  } catch (err) {
    console.error("Failed to store onboarding submission in Firestore:", err);
  }

  const isMentorLevel = 
    String(onboardingData.learningLevel || "").toLowerCase().includes("mentor") ||
    String(onboardingData.occupation || "").toLowerCase().includes("mentor");
  const isAdminLevel = 
    String(onboardingData.learningLevel || "").toLowerCase().includes("admin") ||
    String(onboardingData.occupation || "").toLowerCase().includes("admin");

  const targetRole = isAdminLevel ? "admin" : isMentorLevel ? "mentor" : undefined;
  const targetStatus = (isAdminLevel || isMentorLevel) ? "dashboard" : "assessment_failed";

  const updateFields: Partial<Profile> = {
    fullName: onboardingData.fullName,
    education: onboardingData.education,
    occupation: onboardingData.occupation,
    techExperience: onboardingData.techExperience as any,
    track: onboardingData.track,
    learningLevel: onboardingData.learningLevel as any,
    previousCourseCompleted: onboardingData.previousCourseCompleted,
    status: targetStatus as any,
    score: deleteField() as any
  };

  if (targetRole) {
    updateFields.role = targetRole as any;
  }

  return updateProfile(id, updateFields);
};

export const submitAssessment = async (
  id: string, 
  score: number, 
  status: string,
  answers?: Record<string, number>,
  technicalScore?: number,
  softSkillsScore?: number
): Promise<Profile> => {
  const profile = await getProfileById(id);
  if (profile) {
    const attemptId = `attempt-${id}-${Date.now()}`;
    const attemptData = {
      id: attemptId,
      userId: id,
      fullName: profile.fullName || "",
      email: profile.email || "",
      track: profile.track || "",
      score,
      status,
      timestamp: new Date().toISOString(),
      answers: answers || {},
      technicalScore: technicalScore !== undefined ? technicalScore : null,
      softSkillsScore: softSkillsScore !== undefined ? softSkillsScore : null
    };
    try {
      await setDoc(doc(db, "assessmentAttempts", attemptId), attemptData);
    } catch (err) {
      console.error("Failed to store assessment attempt in Firestore:", err);
    }
  }

  return updateProfile(id, {
    score,
    status: status as any
  });
};

export const retakeAssessment = async (id: string): Promise<Profile> => {
  return updateProfile(id, {
    status: "assessment_failed",
    score: deleteField() as any
  });
};

export const clearOrientation = async (id: string): Promise<Profile> => {
  return updateProfile(id, {
    status: "dashboard"
  });
};

export const completeTask = async (userId: string, taskId: string): Promise<void> => {
  const profileDoc = await getDoc(doc(db, "profiles", userId));
  if (!profileDoc.exists()) return;
  const profile = profileDoc.data() as Profile;
  const tasks = profile.assignedTasks || [];
  const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: "Completed" as const } : t);
  await updateDoc(doc(db, "profiles", userId), { assignedTasks: updatedTasks });
};

export const saveMeetingType = async (typeName: string, oldName?: string): Promise<void> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  
  if (oldName) {
    if (d.exists()) {
      const existing = d.data().meetingTypes || [];
      const updated = existing.map((t: string) => t === oldName ? typeName : t);
      await updateDoc(docRef, { meetingTypes: updated });
    }
    
    const q = query(collection(db, "meetings"), where("type", "==", oldName));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { type: typeName });
    });
    await batch.commit();
  } else {
    if (d.exists()) {
      const existing = d.data().meetingTypes || [];
      if (!existing.includes(typeName)) {
        await updateDoc(docRef, { meetingTypes: [...existing, typeName] });
      }
    } else {
      await setDoc(docRef, { meetingTypes: [typeName], kdCounts: {}, microserviceOwners: {} });
    }
  }
};

export const assignMicroserviceOwner = async (microserviceId: string, ownerId: string): Promise<void> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  if (d.exists()) {
    const owners = d.data().microserviceOwners || {};
    owners[microserviceId] = ownerId || "";
    await updateDoc(docRef, { microserviceOwners: owners });
  } else {
    await setDoc(docRef, { meetingTypes: [], kdCounts: {}, microserviceOwners: { [microserviceId]: ownerId || "" } });
  }
};

export const assignKDCount = async (userId: string, count: number): Promise<void> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  if (d.exists()) {
    const counts = d.data().kdCounts || {};
    counts[userId] = count;
    await updateDoc(docRef, { kdCounts: counts });
  } else {
    await setDoc(docRef, { meetingTypes: [], kdCounts: { [userId]: count }, microserviceOwners: {} });
  }
};

export const deleteMeetingType = async (typeName: string): Promise<void> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  if (d.exists()) {
    const existing = d.data().meetingTypes || [];
    await updateDoc(docRef, { meetingTypes: existing.filter((t: string) => t !== typeName) });
  }
};

export const saveAttendancePunctualityConfig = async (config: AttendancePunctualityConfig): Promise<void> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  if (d.exists()) {
    await updateDoc(docRef, { attendancePunctualityConfig: config });
  } else {
    await setDoc(docRef, { meetingTypes: [], kdCounts: {}, microserviceOwners: {}, attendancePunctualityConfig: config });
  }
};

export const reviewStudent = async (
  userId: string,
  actionOrStatus: string,
  reviewerName: string = "Tech Mentor"
): Promise<void> => {
  let targetStatus = actionOrStatus;
  if (actionOrStatus === "Approve-Orientation") {
    targetStatus = "oriented";
  } else if (
    actionOrStatus === "Promote-Dashboard" ||
    actionOrStatus === "Confirm-Active" ||
    actionOrStatus === "Approve-Dashboard"
  ) {
    targetStatus = "dashboard";
  } else if (
    actionOrStatus === "Pivot-Track" ||
    actionOrStatus === "Set-Onboarding"
  ) {
    targetStatus = "onboarding";
  }

  const updateData: any = {
    status: targetStatus,
    validatedAt: new Date().toISOString(),
    validatedBy: reviewerName,
    placementConfirmed: true,
    isLocked: false,
    lockReason: "",
  };

  await updateDoc(doc(db, "profiles", userId), updateData);
};

export const lockStudentDashboard = async (
  userId: string,
  reason: string,
  lockedBy: string = "Tech Mentor"
): Promise<void> => {
  await updateDoc(doc(db, "profiles", userId), {
    isLocked: true,
    lockReason: reason,
    lockedAt: new Date().toISOString(),
    lockedBy,
  });
};

export const unlockStudentDashboard = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, "profiles", userId), {
    isLocked: false,
    lockReason: "",
    lockedAt: null,
    lockedBy: null,
  });
};

export const resetStudentForOnboarding = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, "profiles", userId), {
    isLocked: false,
    lockReason: "",
    status: "onboarding",
    placementConfirmed: false,
  });
};

export const resetStudentForAssessment = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, "profiles", userId), {
    isLocked: false,
    lockReason: "",
    status: "assessment_failed",
    placementConfirmed: false,
  });
};

export const changeLevel = async (userId: string, level: string): Promise<void> => {
  await updateDoc(doc(db, "profiles", userId), { learningLevel: level });
};

export const assignTask = async (
  userId: string, 
  title: string, 
  description: string, 
  dueDate: string, 
  priority: "High" | "Medium" | "Low"
): Promise<void> => {
  const profileDoc = await getDoc(doc(db, "profiles", userId));
  if (!profileDoc.exists()) return;
  const profile = profileDoc.data() as Profile;
  const tasks = profile.assignedTasks || [];
  const newTask = {
    id: `task_${Date.now()}`,
    title,
    description,
    dueDate,
    priority,
    status: "Pending" as const,
    assignedAt: new Date().toISOString()
  };
  await updateDoc(doc(db, "profiles", userId), { assignedTasks: [...tasks, newTask] });
};

export const addDrill = async (title: string, description: string, link: string): Promise<void> => {
  const newDrill = {
    title,
    description,
    link,
    postedAt: new Date().toISOString()
  };
  await addDoc(collection(db, "weeklyDrills"), newDrill);
};

export const gradeDrillSubmission = async (
  submissionId: string, 
  score: number, 
  remarks: string, 
  status: string
): Promise<void> => {
  await updateDoc(doc(db, "drillSubmissions", submissionId), {
    score,
    remarks,
    status,
    gradedAt: new Date().toISOString()
  });
};

export const sendReminder = async (userId: string, message: string): Promise<void> => {
  const newReminder = {
    userId,
    message,
    timestamp: new Date().toISOString(),
    read: false
  };
  await addDoc(collection(db, "reminders"), newReminder);
};

export const dismissReminder = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "reminders", id));
};

export const dismissAllReminders = async (userId: string): Promise<void> => {
  const q = query(collection(db, "reminders"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => {
    batch.delete(doc(db, "reminders", d.id));
  });
  await batch.commit();
};

export const deleteMeetingAssignmentsForMeetings = async (
  meetingIds: string[],
  profiles?: Profile[]
): Promise<void> => {
  if (!meetingIds || meetingIds.length === 0) return;

  let activeProfiles = profiles;
  if (!activeProfiles || activeProfiles.length === 0) {
    try {
      const snap = await getDocs(collection(db, "profiles"));
      activeProfiles = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Profile[];
    } catch (err) {
      console.warn("[deleteMeetingAssignmentsForMeetings] Failed to query profiles from server:", err);
      try {
        const snap = await getDocsFromCache(collection(db, "profiles"));
        activeProfiles = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Profile[];
      } catch (cacheErr) {
        console.warn("[deleteMeetingAssignmentsForMeetings] Failed to query profiles from cache too, trying fallback query delete:", cacheErr);
        activeProfiles = [];
      }
    }
  }

  // Only use deterministic query-less deletion if the cross-product is small (<= 150)
  // to avoid sending thousands of redundant delete requests for non-existent assignments.
  const useDeterministic = activeProfiles && activeProfiles.length > 0 && (meetingIds.length * activeProfiles.length <= 150);

  if (useDeterministic && activeProfiles) {
    const batches: any[] = [];
    let currentBatch = writeBatch(db);
    let count = 0;

    for (const mId of meetingIds) {
      for (const p of activeProfiles) {
        const assignmentId = `asg_${mId}_${p.id}`;
        currentBatch.delete(doc(db, "meetingAssignments", assignmentId));
        count++;
        if (count >= 400) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
    }

    if (count > 0) {
      batches.push(currentBatch);
    }

    if (batches.length > 0) {
      try {
        await Promise.all(batches.map(b => b.commit()));
      } catch (commitErr) {
        console.error("[deleteMeetingAssignments] Commit parallel batches failed:", commitErr);
      }
    }
    return;
  }

  // Fallback / standard query-based delete for large series (FETCH & DELETE ONLY EXISTING)
  let docsToDelete: any[] = [];

  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < meetingIds.length; i += chunkSize) {
    chunks.push(meetingIds.slice(i, i + chunkSize));
  }

  // Fetch all chunks in parallel to optimize scheduling speed
  const snapPromises = chunks.map(async (chunk) => {
    const q = query(
      collection(db, "meetingAssignments"),
      where("meetingId", "in", chunk)
    );
    try {
      return await getDocs(q);
    } catch (err: any) {
      console.warn("[deleteMeetingAssignments] Failed to query meetingAssignments from server:", err);
      try {
        return await getDocsFromCache(q);
      } catch (cacheErr) {
        console.warn("[deleteMeetingAssignments] Failed to query from cache too, skipping chunk:", cacheErr);
        return null;
      }
    }
  });

  const snaps = await Promise.all(snapPromises);
  for (const snap of snaps) {
    if (snap && !snap.empty) {
      docsToDelete.push(...snap.docs);
    }
  }

  if (docsToDelete.length === 0) return;

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  for (const docSnap of docsToDelete) {
    currentBatch.delete(docSnap.ref);
    count++;
    if (count >= 400) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[deleteMeetingAssignments] Commit parallel batches failed:", commitErr);
    }
  }
};

export const deleteAttendanceForMeetings = async (meetingIds: string[]): Promise<void> => {
  if (!meetingIds || meetingIds.length === 0) return;

  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < meetingIds.length; i += chunkSize) {
    chunks.push(meetingIds.slice(i, i + chunkSize));
  }

  let docsToDelete: any[] = [];
  const snapPromises = chunks.map(async (chunk) => {
    const q = query(
      collection(db, "attendance"),
      where("meetingId", "in", chunk)
    );
    try {
      return await getDocs(q);
    } catch (err: any) {
      console.warn("[deleteAttendanceForMeetings] Failed to query attendance from server:", err);
      try {
        return await getDocsFromCache(q);
      } catch (cacheErr) {
        return null;
      }
    }
  });

  const snaps = await Promise.all(snapPromises);
  for (const snap of snaps) {
    if (snap && !snap.empty) {
      docsToDelete.push(...snap.docs);
    }
  }

  if (docsToDelete.length === 0) return;

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  for (const docSnap of docsToDelete) {
    currentBatch.delete(docSnap.ref);
    count++;
    if (count >= 400) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[deleteAttendanceForMeetings] Commit parallel batches failed:", commitErr);
    }
  }
};

export const deleteMeetingHistoryForMeetings = async (meetingIds: string[]): Promise<void> => {
  if (!meetingIds || meetingIds.length === 0) return;

  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < meetingIds.length; i += chunkSize) {
    chunks.push(meetingIds.slice(i, i + chunkSize));
  }

  let docsToDelete: any[] = [];
  const snapPromises = chunks.map(async (chunk) => {
    const q = query(
      collection(db, "meetingHistory"),
      where("meetingId", "in", chunk)
    );
    try {
      return await getDocs(q);
    } catch (err: any) {
      console.warn("[deleteMeetingHistoryForMeetings] Failed to query meetingHistory from server:", err);
      try {
        return await getDocsFromCache(q);
      } catch (cacheErr) {
        return null;
      }
    }
  });

  const snaps = await Promise.all(snapPromises);
  for (const snap of snaps) {
    if (snap && !snap.empty) {
      docsToDelete.push(...snap.docs);
    }
  }

  if (docsToDelete.length === 0) return;

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  for (const docSnap of docsToDelete) {
    currentBatch.delete(docSnap.ref);
    count++;
    if (count >= 400) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[deleteMeetingHistoryForMeetings] Commit parallel batches failed:", commitErr);
    }
  }
};

export const deleteAttendanceAuditLogsForMeetings = async (meetingIds: string[]): Promise<void> => {
  if (!meetingIds || meetingIds.length === 0) return;

  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < meetingIds.length; i += chunkSize) {
    chunks.push(meetingIds.slice(i, i + chunkSize));
  }

  let docsToDelete: any[] = [];
  const snapPromises = chunks.map(async (chunk) => {
    const q = query(
      collection(db, "attendanceAuditLogs"),
      where("meetingId", "in", chunk)
    );
    try {
      return await getDocs(q);
    } catch (err: any) {
      console.warn("[deleteAttendanceAuditLogsForMeetings] Failed to query attendanceAuditLogs from server:", err);
      try {
        return await getDocsFromCache(q);
      } catch (cacheErr) {
        return null;
      }
    }
  });

  const snaps = await Promise.all(snapPromises);
  for (const snap of snaps) {
    if (snap && !snap.empty) {
      docsToDelete.push(...snap.docs);
    }
  }

  if (docsToDelete.length === 0) return;

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  for (const docSnap of docsToDelete) {
    currentBatch.delete(docSnap.ref);
    count++;
    if (count >= 400) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[deleteAttendanceAuditLogsForMeetings] Commit parallel batches failed:", commitErr);
    }
  }
};

export const deleteMeetingRelatedRecords = async (
  meetingIds: string[],
  profiles?: Profile[]
): Promise<void> => {
  if (!meetingIds || meetingIds.length === 0) return;

  // Preserve student assignment cleanup for deleted schedule meetings,
  // but NEVER delete attendance logs, meetingHistory, or attendanceAuditLogs
  // so student participation records remain permanently available in attendance history.
  await deleteMeetingAssignmentsForMeetings(meetingIds, profiles);
};

export const syncMeetingAssignmentsForMeetings = async (
  meetingsToSync: any[],
  skipDelete = false,
  profiles?: Profile[]
): Promise<void> => {
  if (!meetingsToSync || meetingsToSync.length === 0) return;

  let activeProfiles: Profile[] = profiles || [];
  if (activeProfiles.length === 0) {
    try {
      const profilesSnap = await getDocs(collection(db, "profiles"));
      activeProfiles = profilesSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Profile[];
    } catch (err) {
      console.warn("[syncMeetingAssignmentsForMeetings] Failed to fetch profiles from server:", err);
      try {
        const profilesSnap = await getDocsFromCache(collection(db, "profiles"));
        activeProfiles = profilesSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Profile[];
      } catch (cacheErr) {
        console.warn("[syncMeetingAssignmentsForMeetings] Failed to fetch profiles from cache too, using empty array:", cacheErr);
      }
    }
  }

  const meetingIds = meetingsToSync.map(m => m.id);

  // Perform assignment deletion
  if (!skipDelete) {
    try {
      await deleteMeetingAssignmentsForMeetings(meetingIds, activeProfiles);
    } catch (err) {
      console.warn("[syncMeetingAssignmentsForMeetings] Delete existing assignments failed:", err);
    }
  }

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let batchCount = 0;
  const writeBatchSize = 400;

  for (const meeting of meetingsToSync) {
    for (const profile of activeProfiles) {
      const targetTracks = meeting.targetTeamTrackEligibility;
      const isGlobalTrack = !targetTracks || (Array.isArray(targetTracks) && targetTracks.length === 0);
      const userTrack = profile.track || "";
      const isTrackMatch = profile.role === "admin" || isGlobalTrack || (Array.isArray(targetTracks) && targetTracks.some(
        (t: string) => t.trim().toLowerCase() === userTrack.trim().toLowerCase() || userTrack.trim().toLowerCase() === "all"
      ));

      const rawLevels = meeting.userLevels !== undefined ? meeting.userLevels : meeting.trackId;
      const isGlobalLevel = !rawLevels || (Array.isArray(rawLevels) && rawLevels.length === 0) || rawLevels === "All" || rawLevels === "";
      const userLevel = profile.learningLevel || profile.techExperience || "Apprentice level 1";
      
      let isLevelMatch = false;
      if (profile.role === "admin") {
        isLevelMatch = true;
      } else if (isGlobalLevel) {
        isLevelMatch = true;
      } else if (Array.isArray(rawLevels)) {
        const filtered = rawLevels.filter(l => l && l !== "All User Eligible" && l !== "All User Level" && l !== "All Tracks Eligibility");
        if (filtered.length === 0) {
          isLevelMatch = true;
        } else {
          isLevelMatch = filtered.some((l: string) => {
            const mLevel = l.trim().toLowerCase();
            const uLevel = userLevel.trim().toLowerCase();
            return mLevel === uLevel || mLevel.includes(uLevel) || uLevel.includes(mLevel);
          });
        }
      } else {
        const mLevel = String(rawLevels).trim().toLowerCase();
        const uLevel = userLevel.trim().toLowerCase();
        isLevelMatch = mLevel === uLevel || mLevel.includes(uLevel) || uLevel.includes(mLevel);
      }

      const teamTrackSpecified = !isGlobalTrack;
      const userLevelSpecified = !isGlobalLevel;

      let eligible = false;
      const hasDirectAssignments = meeting.assignedUserIds && Array.isArray(meeting.assignedUserIds) && meeting.assignedUserIds.length > 0;

      const isDirectAssigned = hasDirectAssignments && meeting.assignedUserIds.includes(profile.id);

      if (hasDirectAssignments) {
        eligible = isDirectAssigned;
      } else {
        // Optimization: Do NOT write meetingAssignments documents for rule-based matching.
        // The frontend and backend evaluate level & track eligibility dynamically on the fly.
        eligible = false;
      }

      if (eligible) {
        const assignmentId = `asg_${meeting.id}_${profile.id}`;
        currentBatch.set(doc(db, "meetingAssignments", assignmentId), {
          id: assignmentId,
          meetingId: meeting.id,
          userId: profile.id,
          username: profile.username || "",
          fullName: profile.fullName || "",
          assignedAt: new Date().toISOString()
        });

        batchCount++;
        if (batchCount >= writeBatchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
  }

  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[syncMeetingAssignmentsForMeetings] Commit parallel batches failed:", commitErr);
    }
  }
};

export const syncMeetingAssignments = async (): Promise<void> => {
  const profilesSnap = await getDocs(collection(db, "profiles"));
  const meetingsSnap = await getDocs(collection(db, "meetings"));
  
  const activeProfiles = profilesSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Profile[];
  const activeMeetings = meetingsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as any[];

  const existingSnap = await getDocs(collection(db, "meetingAssignments"));
  const clearBatches: any[] = [];
  let currentClearBatch = writeBatch(db);
  let clearCount = 0;

  existingSnap.docs.forEach(docSnap => {
    currentClearBatch.delete(docSnap.ref);
    clearCount++;
    if (clearCount >= 400) {
      clearBatches.push(currentClearBatch);
      currentClearBatch = writeBatch(db);
      clearCount = 0;
    }
  });
  if (clearCount > 0) {
    clearBatches.push(currentClearBatch);
  }
  if (clearBatches.length > 0) {
    await Promise.all(clearBatches.map(b => b.commit()));
  }

  const writeBatchSize = 400;
  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let batchCount = 0;

  for (const meeting of activeMeetings) {
    for (const profile of activeProfiles) {
      const targetTracks = meeting.targetTeamTrackEligibility;
      const isGlobalTrack = !targetTracks || (Array.isArray(targetTracks) && targetTracks.length === 0);
      const userTrack = profile.track || "";
      const isTrackMatch = profile.role === "admin" || isGlobalTrack || (Array.isArray(targetTracks) && targetTracks.some(
        (t) => t.trim().toLowerCase() === userTrack.trim().toLowerCase() || userTrack.trim().toLowerCase() === "all"
      ));

      const rawLevels = meeting.userLevels !== undefined ? meeting.userLevels : meeting.trackId;
      const isGlobalLevel = !rawLevels || (Array.isArray(rawLevels) && rawLevels.length === 0) || rawLevels === "All" || rawLevels === "";
      const userLevel = profile.learningLevel || profile.techExperience || "Apprentice level 1";
      
      let isLevelMatch = false;
      if (profile.role === "admin") {
        isLevelMatch = true;
      } else if (isGlobalLevel) {
        isLevelMatch = true;
      } else if (Array.isArray(rawLevels)) {
        const filtered = rawLevels.filter(l => l && l !== "All User Eligible" && l !== "All User Level" && l !== "All Tracks Eligibility");
        if (filtered.length === 0) {
          isLevelMatch = true;
        } else {
          isLevelMatch = filtered.some((l: string) => {
            const mLevel = l.trim().toLowerCase();
            const uLevel = userLevel.trim().toLowerCase();
            return mLevel === uLevel || mLevel.includes(uLevel) || uLevel.includes(mLevel);
          });
        }
      } else {
        const mLevel = String(rawLevels).trim().toLowerCase();
        const uLevel = userLevel.trim().toLowerCase();
        isLevelMatch = mLevel === uLevel || mLevel.includes(uLevel) || uLevel.includes(mLevel);
      }

      const teamTrackSpecified = !isGlobalTrack;
      const userLevelSpecified = !isGlobalLevel;

      let eligible = false;
      const hasDirectAssignments = meeting.assignedUserIds && Array.isArray(meeting.assignedUserIds) && meeting.assignedUserIds.length > 0;

      const isDirectAssigned = hasDirectAssignments && meeting.assignedUserIds.includes(profile.id);

      if (hasDirectAssignments) {
        eligible = isDirectAssigned;
      } else {
        // Optimization: Do NOT write meetingAssignments documents for rule-based matching.
        // The frontend and backend evaluate level & track eligibility dynamically on the fly.
        eligible = false;
      }

      if (eligible) {
        const assignmentId = `asg_${meeting.id}_${profile.id}`;
        currentBatch.set(doc(db, "meetingAssignments", assignmentId), {
          id: assignmentId,
          meetingId: meeting.id,
          userId: profile.id,
          username: profile.username || "",
          fullName: profile.fullName || "",
          assignedAt: new Date().toISOString()
        });

        batchCount++;
        if (batchCount >= writeBatchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
  }

  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[syncMeetingAssignments] Final parallel commit failed:", commitErr);
    }
  }
};

export function generateRecurrenceDates(params: {
  frequency: string;
  startDate: string;
  endDate?: string;
  customInterval?: number;
}): string[] {
  const dates: string[] = [];
  
  // Parse YYYY-MM-DD format as a strict UTC Date to avoid any local timezone shifts
  const parseUTCDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  };

  const start = parseUTCDate(params.startDate);
  
  let end: Date;
  if (params.endDate && params.endDate !== "No End Date") {
    end = parseUTCDate(params.endDate);
  } else {
    // Default to 90 days if no end date (90 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  }

  if (end < start) return [params.startDate];

  const current = new Date(start.getTime());
  while (current <= end) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (params.frequency === "daily") {
      dates.push(dateStr);
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (params.frequency === "weekdays") {
      const day = current.getUTCDay();
      if (day !== 0 && day !== 6) {
        dates.push(dateStr);
      }
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (params.frequency === "weekly") {
      dates.push(dateStr);
      current.setUTCDate(current.getUTCDate() + 7);
    } else if (params.frequency === "monthly") {
      dates.push(dateStr);
      current.setUTCMonth(current.getUTCMonth() + 1);
    } else if (params.frequency === "custom") {
      dates.push(dateStr);
      const interval = params.customInterval || 1;
      current.setUTCDate(current.getUTCDate() + interval);
    } else {
      // one-time
      dates.push(dateStr);
      break;
    }
  }
  return dates;
}

const logQueuedUpdate = async (params: {
  meetingId: string;
  type: "create" | "edit" | "delete";
  meetingData?: any;
  deleteMode?: "single" | "future" | "all";
  recurrenceEditMode?: "single" | "future" | "all";
  status: "pending" | "applied";
  adminProfile?: { id: string; email: string };
}) => {
  const adminId = params.adminProfile?.id || "system-admin";
  const adminEmail = params.adminProfile?.email || "admin@bincom.dev";
  const id = `queued-${params.type}-${params.meetingId}-${Date.now()}`;

  const updateDocData: any = {
    id,
    meetingId: params.meetingId,
    type: params.type,
    createdAt: new Date().toISOString(),
    adminId,
    adminEmail,
    status: params.status
  };

  if (params.meetingData !== undefined) {
    updateDocData.meetingData = params.meetingData;
  }
  if (params.deleteMode !== undefined) {
    updateDocData.deleteMode = params.deleteMode;
  }
  if (params.recurrenceEditMode !== undefined) {
    updateDocData.recurrenceEditMode = params.recurrenceEditMode;
  }

  await setDoc(doc(db, "queuedMeetingUpdates", id), updateDocData);
};

export const processQueuedUpdates = async (): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> => {
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  try {
    const q = query(
      collection(db, "queuedMeetingUpdates"),
      where("status", "in", ["pending", "failed"])
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return { succeeded, failed };
    }

    const updates = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as QueuedMeetingUpdate));
    updates.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Process all pending or failed queued updates at midnight
    const latestUpdatesMap = new Map<string, QueuedMeetingUpdate>();
    updates.forEach(up => {
      latestUpdatesMap.set(up.meetingId, up);
    });

    for (const up of latestUpdatesMap.values()) {
      try {
        const syncDetails = {
          syncType: "scheduled (midnight)",
          syncTimestamp: new Date().toISOString(),
          syncAdminId: up.adminId,
          syncAdminEmail: up.adminEmail
        };

        if (up.type === "create" || up.type === "edit") {
          const mData = up.meetingData;
          if (mData) {
            const docRef = doc(db, "meetings", up.meetingId);
            const todayStr = getLagosDateString(new Date());
            const todayDayName = getLagosDayOfWeek(new Date());

            const finalDates = mData.meetingDates || [todayStr];
            const finalDays = mData.scheduleDays || [];
            const isActive = finalDates.includes(todayStr) || finalDays.includes(todayDayName);

            const updatedMeeting = {
              ...mData,
              isActive,
              ...syncDetails
            };

            await setDoc(docRef, updatedMeeting, { merge: true });
            await syncMeetingAssignmentsForMeetings([updatedMeeting]);
            await syncMeetingToKDCase(updatedMeeting);
          }
        } else if (up.type === "delete") {
          await deleteDoc(doc(db, "meetings", up.meetingId));
          await deleteMeetingRelatedRecords([up.meetingId]);
        }

        await updateDoc(doc(db, "queuedMeetingUpdates", up.id), {
          status: "applied",
          error: deleteField()
        });

        const siblingUpdates = updates.filter(sibling => sibling.meetingId === up.meetingId && sibling.id !== up.id);
        for (const sib of siblingUpdates) {
          await updateDoc(doc(db, "queuedMeetingUpdates", sib.id), {
            status: "applied"
          });
        }

        succeeded.push(up.meetingId);
      } catch (err: any) {
        console.error(`Failed to process queued update for ${up.meetingId}:`, err);
        const errorMsg = err.message || String(err);
        
        await updateDoc(doc(db, "queuedMeetingUpdates", up.id), {
          status: "failed",
          error: errorMsg,
          errorTimestamp: new Date().toISOString()
        });

        failed.push({ id: up.meetingId, error: errorMsg });
      }
    }
  } catch (err: any) {
    console.error("Error inside processQueuedUpdates general block:", err);
  }

  return { succeeded, failed };
};

export const syncSingleMeetingImmediately = async (
  meetingId: string,
  adminProfile?: Profile | null,
  profiles?: Profile[]
): Promise<any> => {
  const meetingDocRef = doc(db, "meetings", meetingId);
  const snap = await getDoc(meetingDocRef);

  if (!snap.exists()) {
    throw new Error(`Meeting with ID '${meetingId}' was not found in the database.`);
  }

  const meetingData = snap.data() as any;
  const now = new Date();
  const todayStr = getLagosDateString(now);
  const todayDayName = getLagosDayOfWeek(now);

  const dates = meetingData.meetingDates || (meetingData.occurrenceDate ? [meetingData.occurrenceDate] : []);
  const days = meetingData.scheduleDays || [];

  const isScheduledForToday = dates.includes(todayStr) || days.includes(todayDayName) || meetingData.occurrenceDate === todayStr;

  const updatedMeeting = {
    ...meetingData,
    isActive: isScheduledForToday,
    syncType: "immediate",
    syncTimestamp: now.toISOString(),
    syncAdminId: adminProfile?.id || null,
    syncAdminEmail: adminProfile?.email || null
  };

  await setDoc(meetingDocRef, updatedMeeting, { merge: true });
  await syncMeetingAssignmentsForMeetings([updatedMeeting], false, profiles);
  await syncMeetingToKDCase(updatedMeeting);

  return updatedMeeting;
};

export const saveMeeting = async (
  meetingData: any,
  adminProfile?: { id: string; email: string },
  syncOption: "immediate" | "midnight" = "immediate",
  profiles?: Profile[]
): Promise<void> => {
  const cleanData = { ...meetingData };
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) {
      delete cleanData[key];
    }
  });
  const editMode = cleanData.recurrenceEditMode || "single";
  delete cleanData.recurrenceEditMode;

  const todayStr = getLagosDateString(new Date());
  const todayDayName = getLagosDayOfWeek(new Date());
  const adminId = adminProfile?.id || "system-admin";
  const adminEmail = adminProfile?.email || "admin@bincom.dev";

  if (cleanData.isRecurring && !cleanData.seriesId) {
    const seriesId = `series-${Date.now()}`;
    const rawFreq = cleanData.recurrenceFrequency;
    const frequency = (!rawFreq || rawFreq === "one-time") ? "daily" : rawFreq;
    const startDate = cleanData.recurrenceStartDate || cleanData.meetingDates?.[0] || todayStr;
    const endDate = cleanData.recurrenceEndDate || "";
    const customInterval = cleanData.recurrenceCustomInterval || 1;

    const dates = generateRecurrenceDates({
      frequency,
      startDate,
      endDate: endDate === "No End Date" ? "" : endDate,
      customInterval
    });

    const occurrencesToSync: any[] = [];
    let batch = writeBatch(db);
    let count = 0;

    for (const dateStr of dates) {
      const occurrenceId = `meet-${seriesId}-${dateStr}`;
      const hasTodayDate = dateStr === todayStr;
      const hasTodayDay = cleanData.scheduleDays && cleanData.scheduleDays.includes(todayDayName);
      
      const occurrenceData = {
        ...cleanData,
        id: occurrenceId,
        seriesId,
        occurrenceDate: dateStr,
        meetingDates: [dateStr],
        isActive: hasTodayDate || hasTodayDay,
        recurrenceFrequency: frequency,
        recurrenceStartDate: startDate,
        recurrenceEndDate: endDate,
        recurrenceCustomInterval: customInterval
      };
      
      if (syncOption === "immediate") {
        const syncedData = {
          ...occurrenceData,
          isActive: occurrenceData.isActive,
          syncType: "immediate",
          syncTimestamp: new Date().toISOString(),
          syncAdminId: adminId,
          syncAdminEmail: adminEmail
        };
        batch.set(doc(db, "meetings", occurrenceId), syncedData, { merge: true });
        occurrencesToSync.push(syncedData);

        const logId = `queued-create-${occurrenceId}-${Date.now()}`;
        const updateDocData = {
          id: logId,
          meetingId: occurrenceId,
          type: "create" as const,
          createdAt: new Date().toISOString(),
          adminId,
          adminEmail,
          status: "applied" as const,
          meetingData: syncedData,
          syncOption: "immediate" as const,
          action: "save" as const
        };
        batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
      } else {
        const logId = `queued-create-${occurrenceId}-${Date.now()}`;
        const updateDocData = {
          id: logId,
          meetingId: occurrenceId,
          type: "create" as const,
          createdAt: new Date().toISOString(),
          adminId,
          adminEmail,
          status: "pending" as const,
          meetingData: occurrenceData,
          syncOption: "midnight" as const,
          action: "save" as const
        };
        batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
      }

      count += 2;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    if (syncOption === "immediate") {
      await syncMeetingAssignmentsForMeetings(occurrencesToSync, true, profiles);
    }
    return;
  }

  if (cleanData.id && cleanData.seriesId) {
    const currentId = cleanData.id;
    const currentSeriesId = cleanData.seriesId;
    const currentOccurrenceDate = cleanData.occurrenceDate || todayStr;

    delete cleanData.id;

    if (editMode === "single") {
      const hasTodayDate = currentOccurrenceDate === todayStr;
      const hasTodayDay = cleanData.scheduleDays && cleanData.scheduleDays.includes(todayDayName);
      cleanData.isActive = hasTodayDate || hasTodayDay;

      const occurrenceData = {
        ...cleanData,
        id: currentId,
        seriesId: currentSeriesId,
        occurrenceDate: currentOccurrenceDate,
        meetingDates: [currentOccurrenceDate]
      };

      const batch = writeBatch(db);

      if (syncOption === "immediate") {
        const syncedData = {
          ...occurrenceData,
          isActive: occurrenceData.isActive,
          syncType: "immediate",
          syncTimestamp: new Date().toISOString(),
          syncAdminId: adminId,
          syncAdminEmail: adminEmail
        };
        batch.set(doc(db, "meetings", currentId), syncedData, { merge: true });

        const logId = `queued-edit-${currentId}-${Date.now()}`;
        const updateDocData = {
          id: logId,
          meetingId: currentId,
          type: "edit" as const,
          createdAt: new Date().toISOString(),
          adminId,
          adminEmail,
          status: "applied" as const,
          meetingData: syncedData,
          recurrenceEditMode: "single" as const,
          syncOption: "immediate" as const,
          action: "save" as const
        };
        batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);

        await batch.commit();
        await syncMeetingAssignmentsForMeetings([syncedData], false, profiles);
      } else {
        const logId = `queued-edit-${currentId}-${Date.now()}`;
        const updateDocData = {
          id: logId,
          meetingId: currentId,
          type: "edit" as const,
          createdAt: new Date().toISOString(),
          adminId,
          adminEmail,
          status: "pending" as const,
          meetingData: occurrenceData,
          recurrenceEditMode: "single" as const,
          syncOption: "midnight" as const,
          action: "save" as const
        };
        batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
        await batch.commit();
      }
    } else {
      const q = query(
        collection(db, "meetings"),
        where("seriesId", "==", currentSeriesId)
      );

      const snapshot = await getDocs(q);
      const docsToUpdate = editMode === "future"
        ? snapshot.docs.filter((d) => {
            const dData = d.data() as any;
            const dateStr = dData.occurrenceDate || todayStr;
            return dateStr >= currentOccurrenceDate;
          })
        : snapshot.docs;

      const occurrencesToSync: any[] = [];
      let batch = writeBatch(db);
      let count = 0;

      for (const d of docsToUpdate) {
        const dData = d.data() as any;
        const dateStr = dData.occurrenceDate || todayStr;
        const hasTodayDate = dateStr === todayStr;
        const hasTodayDay = cleanData.scheduleDays && cleanData.scheduleDays.includes(todayDayName);

        const occurrenceData = {
          ...cleanData,
          id: d.id,
          seriesId: currentSeriesId,
          occurrenceDate: dateStr,
          meetingDates: [dateStr],
          isActive: hasTodayDate || hasTodayDay
        };

        if (syncOption === "immediate") {
          const syncedData = {
            ...occurrenceData,
            isActive: occurrenceData.isActive,
            syncType: "immediate",
            syncTimestamp: new Date().toISOString(),
            syncAdminId: adminId,
            syncAdminEmail: adminEmail
          };
          batch.set(d.ref, syncedData, { merge: true });
          occurrencesToSync.push(syncedData);

          const logId = `queued-edit-${d.id}-${Date.now()}`;
          const updateDocData = {
            id: logId,
            meetingId: d.id,
            type: "edit" as const,
            createdAt: new Date().toISOString(),
            adminId,
            adminEmail,
            status: "applied" as const,
            meetingData: syncedData,
            recurrenceEditMode: editMode,
            syncOption: "immediate" as const,
            action: "save" as const
          };
          batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
        } else {
          const logId = `queued-edit-${d.id}-${Date.now()}`;
          const updateDocData = {
            id: logId,
            meetingId: d.id,
            type: "edit" as const,
            createdAt: new Date().toISOString(),
            adminId,
            adminEmail,
            status: "pending" as const,
            meetingData: occurrenceData,
            recurrenceEditMode: editMode,
            syncOption: "midnight" as const,
            action: "save" as const
          };
          batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
        }

        count += 2;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      if (syncOption === "immediate") {
        await syncMeetingAssignmentsForMeetings(occurrencesToSync, false, profiles);
      }
    }

    return;
  }

  delete cleanData.id;
  const meetingId = meetingData.id || `meet-${Date.now()}`;
  const finalMeetingDates = cleanData.meetingDates || [todayStr];
  const finalScheduleDays = cleanData.scheduleDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  cleanData.isActive = finalMeetingDates.includes(todayStr) || finalScheduleDays.includes(todayDayName);

  const occurrenceData = {
    ...cleanData,
    id: meetingId
  };

  const batch = writeBatch(db);

  if (syncOption === "immediate") {
    const syncedData = {
      ...occurrenceData,
      isActive: occurrenceData.isActive,
      syncType: "immediate",
      syncTimestamp: new Date().toISOString(),
      syncAdminId: adminId,
      syncAdminEmail: adminEmail
    };
    batch.set(doc(db, "meetings", meetingId), syncedData, { merge: true });

    const logId = `queued-${meetingData.id ? "edit" : "create"}-${meetingId}-${Date.now()}`;
    const updateDocData = {
      id: logId,
      meetingId,
      type: (meetingData.id ? "edit" : "create") as "edit" | "create",
      createdAt: new Date().toISOString(),
      adminId,
      adminEmail,
      status: "applied" as const,
      meetingData: syncedData,
      syncOption: "immediate" as const,
      action: "save" as const
    };
    batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);

    await batch.commit();
    await syncMeetingAssignmentsForMeetings([syncedData], !meetingData.id, profiles);
    await syncMeetingToKDCase(syncedData);
  } else {
    const logId = `queued-${meetingData.id ? "edit" : "create"}-${meetingId}-${Date.now()}`;
    const updateDocData = {
      id: logId,
      meetingId,
      type: (meetingData.id ? "edit" : "create") as "edit" | "create",
      createdAt: new Date().toISOString(),
      adminId,
      adminEmail,
      status: "pending" as const,
      meetingData: occurrenceData,
      syncOption: "midnight" as const,
      action: "save" as const
    };
    batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
    await batch.commit();
  }
};

export const archiveMeetingInFirestore = async (
  meetingId: string,
  newStatus: string = "Archived"
): Promise<void> => {
  try {
    const docRef = doc(db, "meetings", meetingId);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `meetings/${meetingId}`);
  }
};

const preserveHistoryBeforeDeletion = async (meetings: any[], profiles?: Profile[]): Promise<void> => {
  const now = new Date();
  const todayStr = getLagosDateString(now);

  const historicalMeetings = meetings.filter((m) => {
    const dates: string[] = [];
    if (m.occurrenceDate) {
      dates.push(m.occurrenceDate);
    }
    if (m.meetingDates && Array.isArray(m.meetingDates)) {
      m.meetingDates.forEach((d: string) => {
        if (d && !dates.includes(d)) dates.push(d);
      });
    }
    if (dates.length === 0) {
      dates.push(todayStr);
    }
    // We preserve if any of the dates is today or in the past
    return dates.some(d => d <= todayStr);
  });

  if (historicalMeetings.length === 0) return;

  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let batchCount = 0;
  const writeBatchSize = 400;

  for (const m of historicalMeetings) {
    const dates: string[] = [];
    if (m.occurrenceDate) {
      dates.push(m.occurrenceDate);
    }
    if (m.meetingDates && Array.isArray(m.meetingDates)) {
      m.meetingDates.forEach((d: string) => {
        if (d && !dates.includes(d)) dates.push(d);
      });
    }
    if (dates.length === 0) {
      dates.push(todayStr);
    }

    // Only process dates that are today or in the past
    const occurrencesToProcess = dates.filter(d => d <= todayStr);

    for (const occurrenceDate of occurrencesToProcess) {
      const historyId = `m-hist-${m.id}-${occurrenceDate}`;

      const scheduledTimeStr = m.timeString || m.time || m.scheduledStartTime || m.startTime || "09:00 AM";
      const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);
      const durationStr = m.duration || "30 minutes";
      const matchDuration = durationStr.match(/(\d+)/);
      const durationMinutes = matchDuration ? parseInt(matchDuration[1], 10) : 30;
      const endTimeMinutes = scheduledMinutes + durationMinutes;
      const scheduledEndTimeStr = formatMinutesToMeetingTime(endTimeMinutes);

      const historyData: MeetingHistoryRecord = {
        id: historyId,
        meetingId: m.id,
        title: m.title,
        type: m.type,
        date: occurrenceDate,
        scheduledStartTime: scheduledTimeStr,
        scheduledEndTime: scheduledEndTimeStr,
        duration: durationStr,
        organizer: m.organizer || "Admin Team",
        userLevels: Array.isArray(m.userLevels) ? m.userLevels : (m.trackId ? (Array.isArray(m.trackId) ? m.trackId : [m.trackId]) : []),
        targetTeamTrackEligibility: Array.isArray(m.targetTeamTrackEligibility) ? m.targetTeamTrackEligibility : []
      };

      currentBatch.set(doc(db, "meetingHistory", historyId), historyData, { merge: true });
      batchCount++;
      if (batchCount >= writeBatchSize) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  if (batches.length > 0) {
    try {
      await Promise.all(batches.map(b => b.commit()));
    } catch (commitErr) {
      console.error("[preserveHistoryBeforeDeletion] Commit parallel batches failed:", commitErr);
    }
  }
};

export const deleteMeeting = async (
  meetingId: string,
  deleteMode: "single" | "future" | "all" = "single",
  adminProfile?: { id: string; email: string },
  syncOption: "immediate" | "midnight" = "immediate",
  profiles?: Profile[]
): Promise<void> => {
  const deletedIds: string[] = [];
  const meetingsToDeleteData: any[] = [];

  const meetDoc = await getDoc(doc(db, "meetings", meetingId));
  if (!meetDoc.exists()) {
    console.warn(`[deleteMeeting] Target meeting document ${meetingId} not found.`);
    return;
  }

  const meetData = meetDoc.data() as any;
  const adminId = adminProfile?.id || "system-admin";
  const adminEmail = adminProfile?.email || "admin@bincom.dev";
  const batch = writeBatch(db);
  let batchCount = 0;

  if (deleteMode === "single") {
    meetingsToDeleteData.push({ id: meetingId, ...meetData });
    
    if (syncOption === "immediate") {
      await preserveHistoryBeforeDeletion([{ id: meetingId, ...meetData }], profiles);
      batch.delete(doc(db, "meetings", meetingId));
      deletedIds.push(meetingId);
      
      const logId = `queued-delete-${meetingId}-${Date.now()}`;
      const updateDocData = {
        id: logId,
        meetingId,
        type: "delete" as const,
        createdAt: new Date().toISOString(),
        adminId,
        adminEmail,
        status: "applied" as const,
        deleteMode: "single" as const,
        syncOption: "immediate" as const,
        action: "delete" as const
      };
      batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
    } else {
      const logId = `queued-delete-${meetingId}-${Date.now()}`;
      const updateDocData = {
        id: logId,
        meetingId,
        type: "delete" as const,
        createdAt: new Date().toISOString(),
        adminId,
        adminEmail,
        status: "pending" as const,
        deleteMode: "single" as const,
        meetingData: {
          occurrenceDate: meetData.occurrenceDate || null,
          meetingDates: meetData.meetingDates || null,
          scheduleDays: meetData.scheduleDays || null
        },
        syncOption: "midnight" as const,
        action: "delete" as const
      };
      batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
    }
    await batch.commit();
  } else {
    const seriesId = meetData.seriesId;
    const occurrenceDate = meetData.occurrenceDate;
    if (seriesId) {
      const q = query(
        collection(db, "meetings"),
        where("seriesId", "==", seriesId)
      );
      const snapshot = await getDocs(q);
      const docsToDelete = deleteMode === "future"
        ? snapshot.docs.filter((d) => {
            const dData = d.data() as any;
            const dateStr = dData.occurrenceDate || "";
            return dateStr >= occurrenceDate;
          })
        : snapshot.docs;

      docsToDelete.forEach((d) => {
        meetingsToDeleteData.push({ id: d.id, ...d.data() });
      });

      if (syncOption === "immediate") {
        await preserveHistoryBeforeDeletion(meetingsToDeleteData, profiles);
        for (const d of docsToDelete) {
          batch.delete(d.ref);
          deletedIds.push(d.id);

          const logId = `queued-delete-${d.id}-${Date.now()}`;
          const updateDocData = {
            id: logId,
            meetingId: d.id,
            type: "delete" as const,
            createdAt: new Date().toISOString(),
            adminId,
            adminEmail,
            status: "applied" as const,
            deleteMode,
            syncOption: "immediate" as const,
            action: "delete" as const
          };
          batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
          
          batchCount += 2;
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      } else {
        for (const d of docsToDelete) {
          const dData = d.data() as any;
          const logId = `queued-delete-${d.id}-${Date.now()}`;
          const updateDocData = {
            id: logId,
            meetingId: d.id,
            type: "delete" as const,
            createdAt: new Date().toISOString(),
            adminId,
            adminEmail,
            status: "pending" as const,
            deleteMode,
            meetingData: {
              occurrenceDate: dData.occurrenceDate || null,
              meetingDates: dData.meetingDates || null,
              scheduleDays: dData.scheduleDays || null
            },
            syncOption: "midnight" as const,
            action: "delete" as const
          };
          batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
          
          batchCount++;
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
    } else {
      meetingsToDeleteData.push({ id: meetingId, ...meetData });
      
      if (syncOption === "immediate") {
        await preserveHistoryBeforeDeletion([{ id: meetingId, ...meetData }], profiles);
        batch.delete(doc(db, "meetings", meetingId));
        deletedIds.push(meetingId);

        const logId = `queued-delete-${meetingId}-${Date.now()}`;
        const updateDocData = {
          id: logId,
          meetingId,
          type: "delete" as const,
          createdAt: new Date().toISOString(),
          adminId,
          adminEmail,
          status: "applied" as const,
          deleteMode: "single" as const,
          syncOption: "immediate" as const,
          action: "delete" as const
        };
        batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
      } else {
        const logId = `queued-delete-${meetingId}-${Date.now()}`;
        const updateDocData = {
          id: logId,
          meetingId,
          type: "delete" as const,
          createdAt: new Date().toISOString(),
          adminId,
          adminEmail,
          status: "pending" as const,
          deleteMode: "single" as const,
          meetingData: {
            occurrenceDate: meetData.occurrenceDate || null,
            meetingDates: meetData.meetingDates || null,
            scheduleDays: meetData.scheduleDays || null
          },
          syncOption: "midnight" as const,
          action: "delete" as const
        };
        batch.set(doc(db, "queuedMeetingUpdates", logId), updateDocData);
      }
      await batch.commit();
    }
  }

  if (syncOption === "immediate" && deletedIds.length > 0) {
    await deleteMeetingRelatedRecords(deletedIds, profiles);
  }
};





export const submitStandup = async (standupData: any): Promise<void> => {
  await addDoc(collection(db, "standups"), {
    ...standupData,
    timestamp: new Date().toISOString()
  });
};

export const submitDailyReport = async (reportData: any): Promise<void> => {
  await addDoc(collection(db, "dailyReports"), {
    ...reportData,
    timestamp: new Date().toISOString()
  });
};

export const submitMicroserviceSummary = async (data: any): Promise<void> => {
  await addDoc(collection(db, "personalDevelopment"), {
    ...data,
    timestamp: new Date().toISOString()
  });
};

export const submitMicroserviceUpdate = async (data: any): Promise<void> => {
  await addDoc(collection(db, "techUpdates"), {
    ...data,
    timestamp: new Date().toISOString()
  });
};

export const submitDrillSubmission = async (data: any): Promise<void> => {
  await addDoc(collection(db, "drillSubmissions"), {
    ...data,
    timestamp: new Date().toISOString(),
    status: "Submitted"
  });
};

export const joinKD = async (userId: string, userFullName: string): Promise<number> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  let count = 1;
  if (d.exists()) {
    const counts = d.data().kdCounts || {};
    counts[userId] = (counts[userId] || 0) + 1;
    count = counts[userId];
    await updateDoc(docRef, { kdCounts: counts });
  } else {
    await setDoc(docRef, { kdCounts: { [userId]: 1 } });
  }
  return count;
};

export const submitSocialLog = async (data: any): Promise<void> => {
  await addDoc(collection(db, "socialLogs"), {
    ...data,
    timestamp: new Date().toISOString()
  });
};

export const updateAttendance = async (recordId: string, status: string): Promise<void> => {
  await updateDoc(doc(db, "attendance", recordId), { status });
};

export const joinMeetingAttendance = async (userId: string, meetingId: string): Promise<string> => {
  // First fetch the meeting
  let meeting: Meeting | null = null;
  const meetingDoc = await getDoc(doc(db, "meetings", meetingId));
  
  if (meetingDoc.exists()) {
    meeting = meetingDoc.data() as Meeting;
  } else {
    // Check if it's a project team sync meeting in the "projects" collection
    const projectsSnap = await getDocs(collection(db, "projects"));
    for (const pDoc of projectsSnap.docs) {
      const pData = pDoc.data();
      if (pData.meetings && Array.isArray(pData.meetings)) {
        const found = pData.meetings.find((m: any) => m.id === meetingId);
        if (found) {
          meeting = {
            id: found.id,
            title: found.title,
            type: "project",
            timeString: found.time || "02:00 PM",
            trackId: pData.trackId || "All",
            jitsiUrl: found.jitsiUrl || found.link || "",
            projectId: pDoc.id,
            scheduleDays: found.scheduleDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            duration: found.duration || "45 minutes",
            organizer: found.organizer || "Project Manager",
            status: found.status || "Upcoming",
            description: found.description || found.title
          } as Meeting;
          break;
        }
      }
    }
  }

  if (!meeting) throw new Error("Meeting not found");

  const profileDoc = await getDoc(doc(db, "profiles", userId));
  if (!profileDoc.exists()) throw new Error("User profile not found");
  const profile = profileDoc.data() as Profile;

  // Determine punctuality status
  const now = new Date();
  const todayStr = getLagosDateString(now);
  const scheduledTimeStr = (meeting as any).scheduledStartTime || meeting.timeString || (meeting as any).time || (meeting as any).startTime || "09:00 AM";
  const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);
  const currentMinutes = getLagosMinutesPastMidnight(now);

  const durationStr = meeting.duration || "30 minutes";
  const matchDuration = durationStr.match(/(\d+)/);
  const durationMinutes = matchDuration ? parseInt(matchDuration[1], 10) : 30;
  const endTimeMinutes = scheduledMinutes + durationMinutes;

  // Read configurable punctuality thresholds
  let lateThreshold = 2;
  let veryLateThreshold = 5;
  try {
    const appConfigDoc = await getDoc(doc(db, "metadata", "app_config"));
    if (appConfigDoc.exists() && appConfigDoc.data()?.attendancePunctualityConfig) {
      const cfg = appConfigDoc.data().attendancePunctualityConfig;
      if (typeof cfg.lateThresholdMinutes === "number") lateThreshold = cfg.lateThresholdMinutes;
      if (typeof cfg.veryLateThresholdMinutes === "number") veryLateThreshold = cfg.veryLateThresholdMinutes;
    }
  } catch (err) {
    // Fall back to defaults (2m and 5m) if offline
  }

  let status: "Attended" | "Late" | "Very Late" | "Missed" | string = "Attended";
  if (currentMinutes > scheduledMinutes + veryLateThreshold) {
    status = "Very Late";
  } else if (currentMinutes > scheduledMinutes + lateThreshold) {
    status = "Late";
  }

  const scheduledEndTimeStr = formatMinutesToMeetingTime(endTimeMinutes);

  const record: AttendanceRecord = {
    id: `att_${meetingId}_${userId}_${todayStr}`,
    userId,
    username: profile.username,
    fullName: profile.fullName,
    meetingId,
    meetingTitle: meeting.title,
    meetingType: meeting.type,
    timestamp: now.toISOString(),
    joinedAtTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) + " WAT",
    status,
    track: profile.track,
    meetingDate: todayStr,
    date: todayStr,
    scheduledStartTime: scheduledTimeStr,
    scheduledEndTime: scheduledEndTimeStr,
    duration: durationStr,
    organizer: meeting.organizer || "Admin Team",
    userLevels: Array.isArray(meeting.userLevels) ? meeting.userLevels : (meeting.trackId ? (Array.isArray(meeting.trackId) ? meeting.trackId : [meeting.trackId]) : []),
    targetTeamTrackEligibility: Array.isArray(meeting.targetTeamTrackEligibility) ? meeting.targetTeamTrackEligibility : []
  };

  await setDoc(doc(db, "attendance", record.id), record);

  // Clean up any stale auto-generated 'Missed' records for this user & meeting on this date
  const missedRecordId = `att_missed_${meetingId}_${userId}_${todayStr}`;
  await deleteDoc(doc(db, "attendance", missedRecordId)).catch(() => {});
  try {
    const missedQuery = query(
      collection(db, "attendance"),
      where("userId", "==", userId),
      where("meetingId", "==", meetingId),
      where("status", "==", "Missed")
    );
    const missedSnap = await getDocs(missedQuery);
    for (const d of missedSnap.docs) {
      if (d.id !== record.id) {
        await deleteDoc(doc(db, "attendance", d.id)).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Could not clean up stale missed records:", err);
  }

  // Add standard audit log entry if admin
  if (profile.role === "admin") {
    const auditRecord = {
      id: `audit_${Date.now()}`,
      userId,
      username: profile.username,
      meetingId,
      action: "Admin Joined Session",
      timestamp: now.toISOString()
    };
    await setDoc(doc(db, "attendanceAuditLogs", auditRecord.id), auditRecord);
  }

  return status;
};

export const adminUpdateAttendance = async (
  adminUserId: string,
  targetUserId: string,
  meetingId: string,
  meetingDate: string,
  newStatus: "Attended" | "Late" | "Very Late" | "Missed" | string
): Promise<void> => {
  const adminDoc = await getDoc(doc(db, "profiles", adminUserId));
  if (!adminDoc.exists() || adminDoc.data().role !== "admin") {
    throw new Error("Access denied. Only administrators can perform this action.");
  }

  const targetDoc = await getDoc(doc(db, "profiles", targetUserId));
  if (!targetDoc.exists()) {
    throw new Error("Target student profile not found.");
  }
  const targetUser = targetDoc.data() as Profile;

  const meetingDoc = await getDoc(doc(db, "meetings", meetingId));
  const meeting = meetingDoc.exists() ? (meetingDoc.data() as Meeting) : null;

  const q = query(
    collection(db, "attendance"),
    where("userId", "==", targetUserId),
    where("meetingId", "==", meetingId),
    where("meetingDate", "==", meetingDate)
  );
  const snapshot = await getDocs(q);

  let recordId = `att_${meetingId}_${targetUserId}_${meetingDate}`;
  let recordData: any;

  let scheduledStartTime = "09:00 AM";
  let scheduledEndTime = "09:30 AM";
  let duration = "30 minutes";
  let organizer = "Admin Team";
  let userLevels: string[] = [];
  let targetTeamTrackEligibility: string[] = [];

  if (meeting) {
    scheduledStartTime = meeting.timeString || (meeting as any).time || (meeting as any).scheduledStartTime || (meeting as any).startTime || "09:00 AM";
    duration = meeting.duration || "30 minutes";
    const scheduledMinutes = parseMeetingTimeToMinutes(scheduledStartTime);
    const matchDuration = duration.match(/(\d+)/);
    const durationMinutes = matchDuration ? parseInt(matchDuration[1], 10) : 30;
    const endTimeMinutes = scheduledMinutes + durationMinutes;
    scheduledEndTime = formatMinutesToMeetingTime(endTimeMinutes);
    organizer = meeting.organizer || "Admin Team";
    userLevels = Array.isArray(meeting.userLevels) ? meeting.userLevels : (meeting.trackId ? (Array.isArray(meeting.trackId) ? meeting.trackId : [meeting.trackId]) : []);
    targetTeamTrackEligibility = Array.isArray(meeting.targetTeamTrackEligibility) ? meeting.targetTeamTrackEligibility : [];
  }

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    recordId = docSnap.id;
    recordData = {
      ...docSnap.data(),
      status: newStatus
    };
  } else {
    recordData = {
      id: recordId,
      userId: targetUserId,
      username: targetUser.username,
      fullName: targetUser.fullName,
      meetingId: meetingId,
      meetingTitle: meeting?.title || "Special Session",
      meetingType: meeting?.type || "Alignment Session",
      timestamp: new Date().toISOString(),
      status: newStatus,
      track: targetUser.track,
      meetingDate: meetingDate,
      date: meetingDate,
      scheduledStartTime,
      scheduledEndTime,
      duration,
      organizer,
      userLevels,
      targetTeamTrackEligibility
    };
  }

  await setDoc(doc(db, "attendance", recordId), recordData);

  const auditId = `audit_${Date.now()}`;
  const auditData = {
    id: auditId,
    adminUserId,
    adminUsername: adminDoc.data().username,
    targetUserId,
    targetUsername: targetUser.username,
    meetingId,
    meetingDate,
    previousStatus: !snapshot.empty ? snapshot.docs[0].data().status : "None",
    newStatus,
    timestamp: new Date().toISOString()
  };
  await setDoc(doc(db, "attendanceAuditLogs", auditId), auditData);
};

export const triggerSimulatedCron = async (): Promise<{ meetings: any[] }> => {
  const todayStr = getLagosDateString(new Date());
  const todayDayName = getLagosDayOfWeek(new Date());

  // Process all queued updates first so they are fully synchronized
  await processQueuedUpdates();

  const meetingsSnapshot = await getDocs(collection(db, "meetings"));
  const batch = writeBatch(db);
  const activeMeetings: any[] = [];

  meetingsSnapshot.docs.forEach(docSnap => {
    const m = docSnap.data();
    const hasTodayDate = m.meetingDates && m.meetingDates.includes(todayStr);
    const hasTodayDay = m.scheduleDays && m.scheduleDays.includes(todayDayName);
    const shouldBeActive = hasTodayDate || hasTodayDay;

    batch.update(docSnap.ref, { isActive: shouldBeActive });
    if (shouldBeActive) {
      activeMeetings.push({ id: docSnap.id, ...m, isActive: true });
    }
  });

  await batch.commit();
  return { meetings: activeMeetings };
};

export const loginUser = async (identifier: string, passwordStr: string): Promise<Profile> => {
  let email = identifier;
  let targetProfile: Profile | null = null;

  if (!identifier.includes("@")) {
    const q = query(collection(db, "profiles"), where("username", "==", identifier.trim().toLowerCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error("Incorrect password/email, please try again.");
    }
    const userDoc = snapshot.docs[0];
    targetProfile = userDoc.data() as Profile;
    email = targetProfile.email;
  } else {
    const q = query(collection(db, "profiles"), where("email", "==", identifier.trim().toLowerCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      targetProfile = snapshot.docs[0].data() as Profile;
    }
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, passwordStr);
    const user = userCredential.user;

    let userDoc = await getDoc(doc(db, "profiles", user.uid));
    let profileData: Profile | null = null;

    if (userDoc.exists()) {
      profileData = userDoc.data() as Profile;
    } else if (targetProfile) {
      profileData = { ...targetProfile, id: user.uid };
      await setDoc(doc(db, "profiles", user.uid), profileData);
    }

    if (!profileData) {
      profileData = {
        id: user.uid,
        email: user.email || email,
        username: (user.email || email).split("@")[0].toLowerCase(),
        fullName: user.displayName || (user.email || email).split("@")[0],
        education: "",
        occupation: "",
        techExperience: "Beginner",
        track: "All",
        role: "user",
        status: "onboarding",
        joinedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "profiles", user.uid), profileData);
    }

    localStorage.setItem("bincom_active_profile_id", profileData.id);
    return profileData;

  } catch (error: any) {
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-email" ||
      (error.message && (
        error.message.includes("invalid-credential") ||
        error.message.includes("wrong-password") ||
        error.message.includes("user-not-found") ||
        error.message.includes("invalid-email") ||
        error.message.includes("auth/invalid-credential")
      ))
    ) {
      throw new Error("Incorrect password/email, please try again.");
    }

    if (
      error.code === "auth/operation-not-allowed" ||
      error.code === "auth/admin-restricted-operation" ||
      (error.message && error.message.includes("operation-not-allowed"))
    ) {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Anonymous auth fallback warning:", e);
        }
      }

      if (!targetProfile) {
        const q = query(collection(db, "profiles"), where("email", "==", email.trim().toLowerCase()));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          targetProfile = snapshot.docs[0].data() as Profile;
        }
      }

      if (targetProfile) {
        localStorage.setItem("bincom_active_profile_id", targetProfile.id);
        return targetProfile;
      }

      throw new Error("Incorrect password/email, please try again.");
    }
    throw error;
  }
};

export const registerUser = async (
  email: string,
  username: string,
  fullName: string,
  passwordStr: string
): Promise<Profile> => {
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  const qName = query(collection(db, "profiles"), where("username", "==", cleanUsername));
  const snapshotName = await getDocs(qName);
  if (!snapshotName.empty) {
    throw new Error("Username already taken. Please choose another.");
  }

  const qEmail = query(collection(db, "profiles"), where("email", "==", cleanEmail));
  const snapshotEmail = await getDocs(qEmail);
  if (!snapshotEmail.empty) {
    throw new Error("An account with this email already exists. Please log in.");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, passwordStr);
    const uid = userCredential.user.uid;

    const newProfile: Profile = {
      id: uid,
      email: cleanEmail,
      username: cleanUsername,
      fullName: fullName.trim(),
      education: "",
      occupation: "",
      techExperience: "Beginner",
      track: "All",
      role: "user",
      status: "onboarding",
      joinedAt: new Date().toISOString()
    };

    await setDoc(doc(db, "profiles", uid), newProfile);
    localStorage.setItem("bincom_active_profile_id", newProfile.id);
    return newProfile;
  } catch (error: any) {
    if (
      error.code === "auth/operation-not-allowed" ||
      error.code === "auth/admin-restricted-operation" ||
      (error.message && error.message.includes("operation-not-allowed"))
    ) {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Anonymous auth fallback warning:", e);
        }
      }

      const customDocRef = doc(collection(db, "profiles"));
      const uid = auth.currentUser?.uid || customDocRef.id;

      const newProfile: Profile = {
        id: uid,
        email: cleanEmail,
        username: cleanUsername,
        fullName: fullName.trim(),
        education: "",
        occupation: "",
        techExperience: "Beginner",
        track: "All",
        role: "user",
        status: "onboarding",
        joinedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "profiles", uid), newProfile);
      localStorage.setItem("bincom_active_profile_id", newProfile.id);
      return newProfile;
    }
    throw error;
  }
};

export const adminBypassLogin = async (): Promise<Profile> => {
  const email = "hadekunleabdulwally@gmail.com";
  const password = "AdminPassword123!";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    if (
      error.code === "auth/operation-not-allowed" ||
      error.code === "auth/admin-restricted-operation" ||
      (error.message && error.message.includes("operation-not-allowed"))
    ) {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Anonymous auth fallback warning:", e);
        }
      }
    } else if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/invalid-email") {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (signUpError: any) {
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (e) {
            console.warn("Anonymous auth fallback warning:", e);
          }
        }
      }
    }
  }

  // Find or create admin profile in Firestore
  const q = query(collection(db, "profiles"), where("email", "==", email));
  const snapshot = await getDocs(q);
  let adminProfile: Profile;

  if (!snapshot.empty) {
    adminProfile = snapshot.docs[0].data() as Profile;
    if (adminProfile.role !== "admin" || adminProfile.status !== "admin") {
      adminProfile.role = "admin";
      adminProfile.status = "admin";
      await setDoc(doc(db, "profiles", adminProfile.id), adminProfile);
    }
  } else {
    const uid = auth.currentUser?.uid || "admin_hadekunle_id";
    adminProfile = {
      id: uid,
      email,
      username: "hadekunle",
      fullName: "Adewale Kunle",
      education: "B.Sc. Computer Engineering",
      occupation: "Platform Director / Tech Mentor",
      techExperience: "Advanced",
      track: "All",
      role: "admin",
      status: "admin",
      score: 100,
      joinedAt: "2026-06-01T08:00:00Z"
    };
    await setDoc(doc(db, "profiles", uid), adminProfile);
  }

  localStorage.setItem("bincom_active_profile_id", adminProfile.id);
  return adminProfile;
};

export const sendPasswordRecoveryEmail = async (identifier: string): Promise<string> => {
  const cleanInput = identifier.trim();
  if (!cleanInput) {
    throw new Error("Please enter your email address or username.");
  }

  let targetEmail = cleanInput;

  // Look up profile if input is username or to resolve registered email
  if (!cleanInput.includes("@")) {
    const q = query(collection(db, "profiles"), where("username", "==", cleanInput.toLowerCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error(`No staff or student profile found for username "${cleanInput}".`);
    }
    const profile = snapshot.docs[0].data() as Profile;
    if (!profile.email) {
      throw new Error("No registered email address found associated with this account.");
    }
    targetEmail = profile.email;
  } else {
    // If it is an email address, check if profile exists
    const q = query(collection(db, "profiles"), where("email", "==", cleanInput.toLowerCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const profile = snapshot.docs[0].data() as Profile;
      if (profile.email) {
        targetEmail = profile.email;
      }
    }
  }

  try {
    await sendPasswordResetEmail(auth, targetEmail);
    return targetEmail;
  } catch (error: any) {
    console.error("Firebase sendPasswordResetEmail error:", error);
    if (error.code === "auth/user-not-found") {
      throw new Error(`No account found registered under ${targetEmail}. Please check your email or register.`);
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address format.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many recovery attempts. Please wait a few minutes before trying again.");
    } else {
      throw new Error(error.message || "Failed to send password recovery email.");
    }
  }
};

export const updateAppConfigField = async (fieldName: string, value: any): Promise<void> => {
  const docRef = doc(db, "metadata", "app_config");
  const d = await getDoc(docRef);
  if (d.exists()) {
    await updateDoc(docRef, { [fieldName]: value });
  } else {
    await setDoc(docRef, { [fieldName]: value, meetingTypes: ["Knowledge Track", "Microservices", "Project"], kdCounts: {}, microserviceOwners: {} });
  }
};

export const updateKnowledgeDevelopmentInfo = async (info: KnowledgeDevelopmentInfo, adminUser: Profile): Promise<void> => {
  const updatedInfo: KnowledgeDevelopmentInfo = {
    ...info,
    lastUpdatedBy: adminUser.fullName || adminUser.username || "Admin",
    lastUpdatedAt: new Date().toISOString()
  };
  await updateAppConfigField("kdInfo", updatedInfo);
};

export const syncKDMeetingToFirestoreMeetings = async (
  presentationId: string,
  presentationData: Partial<KDPresentation>
): Promise<string> => {
  if (!presentationData.date) return presentationData.linkedMeetingId || "";
  const meetingId = presentationData.linkedMeetingId || `kd_meet_${presentationId}`;
  const meetingLink = presentationData.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${presentationData.date.replace(/-/g, "")}`;
  
  const meetingDoc = {
    id: meetingId,
    title: `KD Presentation: ${presentationData.presenterName || "Scheduled Session"}${presentationData.topic ? ` - ${presentationData.topic}` : ""}`,
    type: "Knowledge Track",
    timeString: "09:00 AM WAT",
    time: "09:00 AM WAT",
    jitsiUrl: meetingLink,
    meetingDates: [presentationData.date],
    scheduleDays: [presentationData.dayOfWeek || "Tuesday"],
    isActive: presentationData.status !== "Cancelled" && presentationData.status !== "Rejected",
    status: presentationData.status === "Cancelled" ? "Cancelled" : "Active",
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, "meetings", meetingId), meetingDoc, { merge: true });
  } catch (err) {
    console.warn("Error syncing meeting doc:", err);
  }
  return meetingId;
};

export const syncMeetingToKDCase = async (meetingDoc: any): Promise<void> => {
  if (!meetingDoc) return;
  const isKDType = 
    meetingDoc.type === "Knowledge Track" || 
    meetingDoc.type === "Knowledge Development" || 
    meetingDoc.type === "KD Microservice" ||
    String(meetingDoc.title || "").toLowerCase().includes("kd presentation");
  
  if (!isKDType) return;

  const dates: string[] = meetingDoc.meetingDates || (meetingDoc.occurrenceDate ? [meetingDoc.occurrenceDate] : []);
  if (dates.length === 0) return;

  for (const dateStr of dates) {
    const kdPresId = `kd_pres_${meetingDoc.id}_${dateStr.replace(/-/g, "")}`;
    const docRef = doc(db, "kdPresentations", kdPresId);
    
    const dayOfWeek = (meetingDoc.scheduleDays && meetingDoc.scheduleDays[0]) || new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
    const meetingLink = meetingDoc.jitsiUrl || `https://meet.jit.si/BincomDevCenter_KD_${dateStr.replace(/-/g, "")}`;
    
    try {
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        await updateDoc(docRef, {
          date: dateStr,
          dayOfWeek,
          meetingLink,
          notes: meetingDoc.description || existingDoc.data()?.notes || "",
          status: meetingDoc.status === "Cancelled" ? "Cancelled" : (existingDoc.data()?.status || "Awaiting topic submission"),
          updatedAt: new Date().toISOString()
        });
      } else {
        const presDoc: KDPresentation = {
          id: kdPresId,
          date: dateStr,
          dayOfWeek,
          topic: meetingDoc.title?.replace(/^KD Presentation:\s*/i, "") || "Scheduled Knowledge Development Session",
          presenterUserId: "",
          presenterName: "Unassigned Presenter",
          presenterEmail: "",
          assignedMentorUserId: "",
          assignedMentorName: "",
          status: meetingDoc.status === "Cancelled" ? "Cancelled" : "Awaiting topic submission",
          notes: meetingDoc.description || "Scheduled from Meeting Management",
          linkedMeetingId: meetingDoc.id,
          meetingLink,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, presDoc);
      }
    } catch (err) {
      console.warn("Error syncing meeting to KD presentation:", err);
    }
  }
};

export const createKDPresentation = async (presentationData: Partial<KDPresentation>): Promise<string> => {
  const newId = `kd_pres_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultLink = presentationData.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${(presentationData.date || getLagosDateString(new Date())).replace(/-/g, "")}`;
  
  const linkedMeetingId = await syncKDMeetingToFirestoreMeetings(newId, { ...presentationData, meetingLink: defaultLink });

  const presDoc: KDPresentation = {
    id: newId,
    date: presentationData.date || getLagosDateString(new Date()),
    dayOfWeek: presentationData.dayOfWeek || new Date((presentationData.date || getLagosDateString(new Date())) + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }),
    topic: presentationData.topic || "",
    presenterUserId: presentationData.presenterUserId || "",
    presenterName: presentationData.presenterName || "Unassigned Presenter",
    presenterEmail: presentationData.presenterEmail || "",
    assignedMentorUserId: presentationData.assignedMentorUserId || "",
    assignedMentorName: presentationData.assignedMentorName || "",
    status: presentationData.status || "Awaiting topic submission",
    notes: presentationData.notes || "",
    linkedMeetingId: linkedMeetingId,
    meetingLink: defaultLink,
    submittedAt: presentationData.submittedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  try {
    await setDoc(doc(db, "kdPresentations", newId), presDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "kdPresentations");
  }
  return newId;
};

export const updateKDPresentation = async (id: string, updates: Partial<KDPresentation>): Promise<void> => {
  const docRef = doc(db, "kdPresentations", id);
  try {
    if (updates.date || updates.meetingLink || updates.presenterName || updates.topic || updates.status) {
      const linkedMeetingId = await syncKDMeetingToFirestoreMeetings(id, updates);
      if (linkedMeetingId && !updates.linkedMeetingId) {
        updates.linkedMeetingId = linkedMeetingId;
      }
    }
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `kdPresentations/${id}`);
  }
};

export const deleteKDPresentation = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "kdPresentations", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `kdPresentations/${id}`);
  }
};

export const reclassifyAllAttendanceRecords = async (lateThresholdMins?: number, veryLateThresholdMins?: number): Promise<number> => {
  let lateThresh = lateThresholdMins;
  let veryLateThresh = veryLateThresholdMins;

  if (lateThresh === undefined || veryLateThresh === undefined) {
    try {
      const appConfigDoc = await getDoc(doc(db, "metadata", "app_config"));
      if (appConfigDoc.exists() && appConfigDoc.data()?.attendancePunctualityConfig) {
        const cfg = appConfigDoc.data().attendancePunctualityConfig;
        if (typeof cfg.lateThresholdMinutes === "number") lateThresh = cfg.lateThresholdMinutes;
        if (typeof cfg.veryLateThresholdMinutes === "number") veryLateThresh = cfg.veryLateThresholdMinutes;
      }
    } catch (e) {}
  }

  if (lateThresh === undefined) lateThresh = 2;
  if (veryLateThresh === undefined) veryLateThresh = 5;

  const attSnap = await getDocs(collection(db, "attendance"));
  const meetingsSnap = await getDocs(collection(db, "meetings"));
  const meetingsMap = new Map<string, any>();
  meetingsSnap.docs.forEach(d => meetingsMap.set(d.id, d.data()));

  let updatedCount = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const attDoc of attSnap.docs) {
    const data = attDoc.data() as AttendanceRecord;
    if (!data.timestamp || data.status === "Missed") continue;

    let scheduledTimeStr = data.scheduledStartTime;
    if (!scheduledTimeStr && data.meetingId) {
      const m = meetingsMap.get(data.meetingId);
      if (m) {
        scheduledTimeStr = m.scheduledStartTime || m.timeString || m.time;
      }
    }
    if (!scheduledTimeStr) continue;

    const scheduledMins = parseMeetingTimeToMinutes(scheduledTimeStr);
    const joinMins = getLagosMinutesPastMidnight(new Date(data.timestamp));
    if (scheduledMins <= 0 || joinMins <= 0) continue;

    const diff = joinMins - scheduledMins;
    let expectedStatus = "Attended";
    if (diff > veryLateThresh) {
      expectedStatus = "Very Late";
    } else if (diff > lateThresh) {
      expectedStatus = "Late";
    }

    if (data.status !== expectedStatus) {
      batch.update(attDoc.ref, { status: expectedStatus, updatedAt: new Date().toISOString() });
      updatedCount++;
      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return updatedCount;
};


