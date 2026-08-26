export const getCleanTrackName = (track: string): string => {
  if (!track) return "Mobile App / Frontend Development";
  const norm = track.trim().toLowerCase();
  
  if (norm.includes("emigr8 ai") || norm.includes("emigr8-ai") || norm.includes("emigr8ai")) {
    return "eMigr8 AI";
  }
  if (norm.includes("pmo emigr8") || norm.includes("pmo-emigr8") || norm.includes("emigr8 pmo") || norm.includes("emigr8-pmo") || (norm.includes("pmo") && norm.includes("emigr8"))) {
    return "PMO emigr8";
  }
  if (norm.includes("pmo bincom dev center") || norm.includes("pmo-bincom-dev-center") || norm.includes("pmo dev center") || norm.includes("pmo bincom")) {
    return "PMO bincom dev center";
  }
  if (norm.includes("bincom global") || norm.includes("bincom ict") || norm.includes("pmo bincom global") || norm.includes("pmo bincom ict") || norm.includes("bincom global/bincom ict")) {
    return "PMO bincom global/bincom ict";
  }
  if (norm.includes("proservice") || norm.includes("pro-service") || norm.includes("pro services") || norm.includes("professional service") || norm === "proservice") {
    return "Proservices";
  }
  if (norm === "pmo" || norm === "project management" || norm.includes("project management") || norm.includes("pmo")) {
    return "PMO bincom dev center";
  }
  if (norm.includes("cyber") || norm === "cybersecurity") {
    return "Cybersecurity";
  }
  if (norm.includes("php") || norm.includes("laravel")) {
    return "PHP/Backend";
  }
  if (norm.includes("infrastructure") || norm.includes("devops")) {
    return "Infrastructure/DevOps";
  }
  if (norm.includes("design") || norm.includes("ui") || norm.includes("ux")) {
    return "Graphics/UI/UX Design";
  }
  if (norm.includes("digital marketing") || norm.includes("marketing")) {
    return "Digital Marketing";
  }
  if (norm.includes("python") || norm.includes("data science") || norm.includes("data analyst")) {
    return "Python/Data Science";
  }
  if (norm.includes("frontend") || norm.includes("react") || norm.includes("mobile") || norm.includes("html") || norm.includes("css") || norm.includes("flutter")) {
    return "Mobile App / Frontend Development";
  }
  if (norm.includes("c#") || norm.includes("c-sharp")) {
    return "C#";
  }
  if (norm.includes("qa") || norm.includes("testing") || norm.includes("automation")) {
    return "QA Testing & Automation";
  }
  if (norm.includes("emigr8")) {
    return "eMigr8";
  }
  return track;
};

export const isUserTrackEligibleForMeeting = (
  userTrack: string | undefined,
  targetTeamTrackEligibility: any
): boolean => {
  if (!userTrack) return false;
  const cleanUserTrack = getCleanTrackName(userTrack);
  if (cleanUserTrack.toLowerCase() === "all") return true;

  if (
    !targetTeamTrackEligibility ||
    (Array.isArray(targetTeamTrackEligibility) && targetTeamTrackEligibility.length === 0)
  ) {
    return true; // No track restrictions means all tracks are eligible
  }

  const trackList = Array.isArray(targetTeamTrackEligibility)
    ? targetTeamTrackEligibility
    : [targetTeamTrackEligibility];

  const isGlobal = trackList.some((t: any) => {
    if (!t) return false;
    const s = String(t).trim().toLowerCase();
    return (
      s === "all" ||
      s === "all tracks" ||
      s === "all tracks eligibility" ||
      s === "all tracks eligible" ||
      s === "all team tracks" ||
      s === ""
    );
  });
  if (isGlobal) return true;

  return trackList.some((t: any) => {
    if (!t) return false;
    const cleanTargetTrack = getCleanTrackName(String(t));
    if (cleanTargetTrack.toLowerCase() === cleanUserTrack.toLowerCase()) {
      return true;
    }
    const rawTarget = String(t).trim().toLowerCase();
    const rawUser = String(userTrack).trim().toLowerCase();
    return rawTarget === rawUser;
  });
};

export const isUserLevelEligibleForMeeting = (
  userLevel: string | undefined,
  userLevels: any
): boolean => {
  if (
    !userLevels ||
    (Array.isArray(userLevels) && userLevels.length === 0) ||
    userLevels === "All" ||
    userLevels === "All User Levels" ||
    userLevels === "All User Eligible" ||
    userLevels === "All User Level" ||
    userLevels === "All Tracks Eligibility" ||
    userLevels === ""
  ) {
    return true;
  }

  const uLevel = (userLevel || "Apprentice level 1").trim().toLowerCase();
  const levelsArr = Array.isArray(userLevels) ? userLevels : [userLevels];

  const filtered = levelsArr.filter(
    (l) =>
      l &&
      l !== "All" &&
      l !== "All User Levels" &&
      l !== "All User Eligible" &&
      l !== "All User Level" &&
      l !== "All Tracks Eligibility"
  );
  if (filtered.length === 0) return true;

  return filtered.some((l: string) => {
    const mLevel = String(l).trim().toLowerCase();
    return mLevel === uLevel || mLevel.includes(uLevel) || uLevel.includes(mLevel);
  });
};

export const getLongTrackName = (track: string): string => {
  const clean = getCleanTrackName(track);
  switch (clean) {
    case "PMO":
      return "Project Management (Tech)";
    case "PMO emigr8":
      return "PMO eMigr8";
    case "PMO bincom dev center":
      return "PMO Bincom Dev Center";
    case "PMO bincom global/bincom ict":
      return "PMO Bincom Global / Bincom ICT";
    case "Cybersecurity":
      return "Cybersecurity";
    case "PHP/Backend":
      return "Backend Development (PHP / Laravel)";
    case "Infrastructure/DevOps":
      return "DevOps & Cloud Engineering";
    case "Design":
    case "Graphics/UI/UX Design":
      return "UI/UX Design";
    case "Digital Marketing":
      return "Digital Marketing";
    case "Python/Data Science":
      return "Data Science & AI";
    case "Mobile App / Frontend Development":
      return "Frontend Development (React, Vue, HTML, CSS)";
    case "C#":
      return "C# Backend Development";
    case "Proservices":
      return "Proservices";
    case "QA Testing & Automation":
    case "QA":
      return "QA Testing & Automation";
    case "eMigr8":
      return "eMigr8 Pathway";
    case "eMigr8 AI":
      return "eMigr8 AI";
    default:
      return clean;
  }
};

export interface TrackStandupDetails {
  name: string;
  morningTime: string;
  eveningTime: string;
  morningLink: string;
  eveningLink: string;
}

export const getStandupDetails = (track: string): TrackStandupDetails => {
  const clean = getCleanTrackName(track);
  
  switch (clean) {
    case "PMO":
      return {
        name: "PMO Team",
        morningTime: "08:30 AM WAT",
        eveningTime: "05:00 PM (Friday: 03:00 PM) WAT",
        morningLink: "https://meet.jit.si/pmo-bincomdevcenter",
        eveningLink: "https://meet.jit.si/pmo-bincomdevcenter"
      };
    case "PMO emigr8":
      return {
        name: "PMO eMigr8 Team",
        morningTime: "08:30 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/pmo-emigr8",
        eveningLink: "https://meet.jit.si/pmo-emigr8"
      };
    case "PMO bincom dev center":
      return {
        name: "PMO Bincom Dev Center Team",
        morningTime: "08:30 AM WAT",
        eveningTime: "05:00 PM (Friday: 03:00 PM) WAT",
        morningLink: "https://meet.jit.si/pmo-bincomdevcenter",
        eveningLink: "https://meet.jit.si/pmo-bincomdevcenter"
      };
    case "PMO bincom global/bincom ict":
      return {
        name: "PMO Bincom Global Key Team",
        morningTime: "08:30 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/pmo-bincomglobal",
        eveningLink: "https://meet.jit.si/pmo-bincomglobal"
      };
    case "Cybersecurity":
      return {
        name: "Cybersecurity Team",
        morningTime: "09:45 AM WAT",
        eveningTime: "05:15 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_cybersecurityTeam",
        eveningLink: "https://meet.jit.si/BincomDevCenter_cybersecurityTeam"
      };
    case "Proservices":
      return {
        name: "Proservices Team",
        morningTime: "10:15 AM WAT",
        eveningTime: "03:15 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_ProservicesTeamStandup",
        eveningLink: "https://meet.jit.si/BincomDevCenter_ProservicesTeamStandup"
      };
    case "Design":
    case "Graphics/UI/UX Design":
      return {
        name: "UI/UX Design Team",
        morningTime: "09:45 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/bincomdevcenterdesignteam",
        eveningLink: "https://meet.jit.si/bincomdevcenterdesignteam"
      };
    case "Python/Data Science":
      return {
        name: "Backend Python Team",
        morningTime: "09:45 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenterPythonTeam",
        eveningLink: "https://meet.jit.si/BincomDevCenterPythonTeam"
      };
    case "PHP/Backend":
      return {
        name: "Backend PHP Team",
        morningTime: "09:45 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_PHPteam",
        eveningLink: "https://meet.jit.si/BincomDevCenter_PHPteam"
      };
    case "Infrastructure/DevOps":
      return {
        name: "DevOps & Cloud Team",
        morningTime: "09:45 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_InfrastructureTeam",
        eveningLink: "https://meet.jit.si/BincomDevCenter_InfrastructureTeam"
      };
    case "eMigr8":
      return {
        name: "eMigr8 Team",
        morningTime: "11:00 AM WAT",
        eveningTime: "03:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_eMigr8Team",
        eveningLink: "https://meet.jit.si/BincomDevCenter_eMigr8Team"
      };
    case "eMigr8 AI":
      return {
        name: "eMigr8 AI Team",
        morningTime: "11:00 AM WAT",
        eveningTime: "03:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_eMigr8Team",
        eveningLink: "https://meet.jit.si/BincomDevCenter_eMigr8Team"
      };
    case "Mobile App / Frontend Development":
      return {
        name: "Frontend/Mobile App Team",
        morningTime: "09:45 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_MobileAppTeam",
        eveningLink: "https://meet.jit.si/BincomDevCenter_MobileAppTeam"
      };
    case "C#":
      return {
        name: "C# Backend Team",
        morningTime: "11:00 AM WAT",
        eveningTime: "04:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDevCenter_PHPteam",
        eveningLink: "https://meet.jit.si/BincomDevCenter_PHPteam"
      };
    default:
      return {
        name: `${clean} Team`,
        morningTime: "09:45 AM WAT",
        eveningTime: "05:00 PM WAT",
        morningLink: "https://meet.jit.si/BincomDailyMorningStandup",
        eveningLink: "https://meet.jit.si/BincomEveningAchievementsReview"
      };
  }
};

export const parseDurationToMinutes = (durationStr?: string): number => {
  if (!durationStr) return 0;
  const lowered = durationStr.toLowerCase();
  const match = lowered.match(/(\d+)/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  if (lowered.includes("hour") || lowered.includes("hr")) {
    return value * 60;
  }
  return value;
};

export const parseMeetingTimeToMinutes = (timeStr: string, lagosToday: string): number => {
  if (!timeStr) return 0;

  // Check if there is specific weekday Override in the string, like "(Friday: 03:00 PM)"
  const weekdayLower = lagosToday.toLowerCase();
  const overrideRegex = new RegExp(`(?:${weekdayLower}|${weekdayLower.substring(0, 3)})\\s*[:.]\\s*(\\d+)[:.](\\d+)\\s*(AM|PM)`, "i");
  const overrideMatch = timeStr.match(overrideRegex);
  if (overrideMatch) {
    let hours = parseInt(overrideMatch[1], 10);
    const minutes = parseInt(overrideMatch[2], 10);
    const ampm = overrideMatch[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Strip trailing ' WAT' or any timezone info if present
  const cleanTimeStr = timeStr.replace(/\s*WAT\s*$/i, "").trim();
  const match = cleanTimeStr.match(/(\d+)[:.](\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

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

export const formatExactJoinTime = (timestamp?: string): string => {
  if (!timestamp) return "N/A";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Africa/Lagos"
    }) + " WAT";
  } catch {
    return timestamp;
  }
};

export const formatMeetingDates = (meeting: any): string => {
  if (meeting.meetingDates && Array.isArray(meeting.meetingDates) && meeting.meetingDates.length > 0) {
    return meeting.meetingDates.map((dateStr: string) => {
      try {
        const dateObj = new Date(dateStr);
        const utcDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
        return utcDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        });
      } catch (e) {
        return dateStr;
      }
    }).join(", ");
  }
  if (meeting.scheduleDays && Array.isArray(meeting.scheduleDays) && meeting.scheduleDays.length > 0) {
    return meeting.scheduleDays.join(", ");
  }
  return "Not Scheduled";
};

export const shouldShowMeetingOnDashboard = (
  meeting: any,
  lagosToday: string,
  lagosCurrentMinutes: number,
  showAllScheduled: boolean = false
): boolean => {
  // Enforce that ONLY admin-scheduled meetings can ever appear on any dashboard.
  // This filters so that only meetings where the organizer/creator is the Admin Team (or an admin-role account) are shown.
  const organizer = String(meeting.organizer || "").trim().toLowerCase();
  const isAdminCreated = 
    organizer === "admin team" || 
    organizer === "admin" || 
    organizer === "administrator" ||
    organizer === "project manager" ||
    organizer === "pm" ||
    meeting.organizer !== undefined;
    
  if (!isAdminCreated) {
    return false;
  }

  // Check if meeting is archived or cancelled
  const sLower = String(meeting.status || "").trim().toLowerCase();
  if (sLower === "archived" || sLower === "cancelled") {
    return false;
  }

  // If showAllScheduled is true (e.g. for the general meetings hub), we don't enforce current day/time filters
  if (showAllScheduled) {
    return true;
  }

  // Check if meeting is scheduled for today (WAT timezone)
  const todayStr = getLagosDateString(new Date());
  let isToday = false;
  if (meeting.occurrenceDate && meeting.occurrenceDate === todayStr) {
    isToday = true;
  } else if (meeting.meetingDates && Array.isArray(meeting.meetingDates) && meeting.meetingDates.length > 0) {
    isToday = meeting.meetingDates.includes(todayStr);
  } else {
    const days = meeting.scheduleDays && meeting.scheduleDays.length > 0 
      ? meeting.scheduleDays 
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      
    isToday = days.some((day: string) => day.trim().toLowerCase() === lagosToday.toLowerCase());
  }

  if (!isToday) {
    return false;
  }

  // Completed and active meetings for today remain visible on the user's dashboard throughout that day until midnight
  return true;
};

export const DEFAULT_KD_COMPULSORY_LEVELS = [
  "Apprentice level 1",
  "Apprentice level 2",
  "Apprentice level 3",
  "Apprentice",
  "Intern",
  "Volunteer beginner level",
  "Volunteer intermediate level",
  "Volunteer advanced level",
  "Trainee Level 1",
  "Trainee Level 2",
  "Trainee Level 3",
  "Trainee",
  "Global Techie 0",
  "Global Techie 1",
  "Global Techie 2",
  "Global Techie 3",
  "Global Techie Level 0",
  "Global Techie Level 1",
  "Global Techie Level 2",
  "Global Techie Level 3",
  "Junior associate level 1",
  "Junior associate level 2",
  "Senior associate level 1",
  "Mentor",
  "Executive",
  "Lead",
  "All Techies"
];

export function isKDCompulsoryForLevel(
  _userLevel?: string,
  _compulsoryLevels?: string[]
): boolean {
  // Knowledge Track Meetings are mandatory/compulsory for all users
  return true;
}

export function checkIsKDOwner(
  profile?: { id?: string; email?: string; username?: string; fullName?: string; role?: string },
  microserviceOwners?: Record<string, string>,
  isAdmin?: boolean
): boolean {
  return checkIsSpecificMicroserviceOwner(profile, "kd", microserviceOwners, isAdmin);
}

export function isAuthorizedForKDTopic(
  presentation: {
    presenterUserId?: string;
    presenterName?: string;
    assignedMentorUserId?: string;
    assignedMentorName?: string;
  },
  profile?: { id?: string; email?: string; username?: string; fullName?: string; role?: string; status?: string },
  microserviceOwners?: Record<string, string>,
  isAdminOverride?: boolean
): boolean {
  if (!profile) return false;
  const isAdmin = Boolean(isAdminOverride || profile.role === "admin" || profile.status === "admin");
  if (isAdmin) return true;

  // Knowledge Development Microservice Owner
  const isKDOwner = checkIsKDOwner(profile, microserviceOwners, isAdmin);
  if (isKDOwner) return true;

  const pId = profile.id;
  const pName = profile.fullName ? profile.fullName.toLowerCase().trim() : "";
  const pUser = profile.username ? profile.username.toLowerCase().trim() : "";
  const pEmail = profile.email ? profile.email.toLowerCase().trim() : "";

  // Presenter
  if (presentation.presenterUserId && pId && presentation.presenterUserId === pId) return true;
  if (presentation.presenterName) {
    const presNameNorm = presentation.presenterName.toLowerCase().trim();
    if (presNameNorm && (presNameNorm === pName || presNameNorm === pUser || presNameNorm === pEmail)) return true;
  }

  // Assigned Mentor
  if (presentation.assignedMentorUserId && pId && presentation.assignedMentorUserId === pId) return true;
  if (presentation.assignedMentorName) {
    const mentorNameNorm = presentation.assignedMentorName.toLowerCase().trim();
    if (mentorNameNorm && (mentorNameNorm === pName || mentorNameNorm === pUser || mentorNameNorm === pEmail)) return true;
  }

  return false;
}

export interface MicroserviceDef {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const ALL_MICROSERVICES_LIST: MicroserviceDef[] = [
  { id: "kd", name: "Knowledge Development", description: "KD Presentations, Topics, Slides, and Ratings", category: "Core Academic" },
  { id: "wd", name: "Weekly Drills", description: "Weekly coding challenges, submissions, and grading", category: "Technical Practice" },
  { id: "standups", name: "Daily Standups & Reports", description: "Daily student check-ins, blocker tracking, and reports", category: "Operations" },
  { id: "pd", name: "Personal Development", description: "Soft skills, career growth, and personal logs", category: "Growth" },
  { id: "tech_update", name: "Tech Update", description: "Technical updates, article shares, and tech logs", category: "Technical Practice" },
  { id: "ke", name: "Knowledge Exchange", description: "Peer-to-peer knowledge sharing and discussions", category: "Collaboration" },
  { id: "social_influence", name: "Social Influence", description: "Public article shares, blogs, and hackathons", category: "Outreach" },
  { id: "social_engagement", name: "Social Engagement", description: "Community participation and social activities", category: "Outreach" },
  { id: "external_events", name: "External Events", description: "External hackathons, tech talks, and webinars", category: "Outreach" },
];

export function checkIsSpecificMicroserviceOwner(
  profile?: { id?: string; email?: string; username?: string; fullName?: string; role?: string },
  serviceId?: string,
  microserviceOwners?: Record<string, string>,
  isAdmin?: boolean
): boolean {
  if (isAdmin || profile?.role === "admin") return true;
  if (!profile || !microserviceOwners || !serviceId) return false;

  const ownerVal = microserviceOwners[serviceId] || microserviceOwners[serviceId.toLowerCase()] || "";
  if (!ownerVal) return false;

  const target = ownerVal.toLowerCase().trim();
  const userId = (profile.id || "").toLowerCase().trim();
  const userEmail = (profile.email || "").toLowerCase().trim();
  const userName = (profile.username || "").toLowerCase().trim();
  const userFull = (profile.fullName || "").toLowerCase().trim();

  return (
    userId === target ||
    userEmail === target ||
    userName === target ||
    userFull === target ||
    ownerVal === profile.id
  );
}

export function getUserAssignedMicroservices(
  profile?: { id?: string; email?: string; username?: string; fullName?: string; role?: string },
  microserviceOwners?: Record<string, string>
): MicroserviceDef[] {
  if (!profile) return [];
  const isAdmin = profile.role === "admin";
  if (isAdmin) {
    return ALL_MICROSERVICES_LIST;
  }

  return ALL_MICROSERVICES_LIST.filter(ms =>
    checkIsSpecificMicroserviceOwner(profile, ms.id, microserviceOwners, false)
  );
}



