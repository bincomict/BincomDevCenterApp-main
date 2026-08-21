import React, { useState, useRef, useEffect } from "react";
import KnowledgeDevelopmentInfoView from "./KnowledgeDevelopmentInfoView";
import {
  Profile,
  AttendanceRecord,
  WeeklyDrillSubmission,
  WeeklyDrill,
} from "../types";
import { getCleanTrackName, getLagosDateString } from "../utils/trackUtils";
import {
  getBaseMeetingId,
  cleanMeetingTitle,
  isMatchingLogForMeeting,
  isMatchingLogForMeetingAndUser,
} from "../utils/meetingUtils";
import {
  synchronizeMeetings,
  saveMeetingType,
  deleteMeetingType,
  reviewStudent,
  lockStudentDashboard,
  unlockStudentDashboard,
  addDrill,
  gradeDrillSubmission,
  sendReminder,
  changeLevel,
  assignTask,
  saveMeeting,
  deleteMeeting,
  syncSingleMeetingImmediately,
  triggerSimulatedCron,
  assignMicroserviceOwner,
  assignKDCount,
  updateAppConfigField,
  isUserEligibleForMeetingInBackend,
  subscribeToQueuedUpdates,
  parseMeetingTimeToMinutes,
  getLagosMinutesPastMidnight,
  formatMinutesToTimeString,
} from "../firebaseService";
import { firebaseConfig } from "../firebase";
import { purgeDatabase, seedDatabase } from "../seed";
import { toast } from "./Toast";
import {
  Users,
  BarChart4,
  ShieldCheck,
  Plus,
  Send,
  FileDown,
  Cpu,
  Calendar,
  CheckCircle,
  AlertOctagon,
  Award,
  Search,
  Filter,
  BookOpen,
  FileEdit,
  Check,
  X,
  ChevronDown,
  Trash2,
  Edit2,
  History,
  Settings,
  Layers,
  GraduationCap,
  Laptop,
  Compass,
  Sparkles,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Clock,
  Timer,
  Activity,
} from "lucide-react";
import AttendanceHistoryTab from "./AttendanceHistoryTab";

const LEVELS_OPTIONS = [
  "Apprentice level 1",
  "Apprentice level 2",
  "Apprentice level 3",
  "Intern",
  "Volunteer beginner level",
  "Volunteer intermediate level",
  "Volunteer advanced level",
  "Junior associate level 1",
  "Junior associate level 2",
  "Junior associate level 3",
  "Senior associate level 1",
  "Senior associate level 2",
  "Senior associate level 3",
  "Mentor",
  "Trainee Level 1",
  "Trainee Level 2",
  "Trainee Level 3",
  "Global Techie 0",
  "Global Techie 1",
  "Global Techie 2",
  "Global Techie 3",
];

const ELIGIBILITY_TRACK_GROUPS = [
  {
    category: "Global",
    options: ["All User Eligible"],
  },
  {
    category: "Apprentice",
    options: ["Apprentice level 1", "Apprentice level 2", "Apprentice level 3"],
  },
  {
    category: "Intern",
    options: ["Intern"],
  },
  {
    category: "Trainee",
    options: ["Trainee – Level 1", "Trainee – Level 2", "Trainee – Level 3"],
  },
  {
    category: "Volunteer",
    options: [
      "Volunteer beginner level",
      "Volunteer intermediate level",
      "Volunteer advanced level",
    ],
  },
  {
    category: "Junior Assoc",
    options: [
      "Junior associate level 1",
      "Junior associate level 2",
      "Junior associate level 3",
    ],
  },
  {
    category: "Senior Assoc",
    options: [
      "Senior associate level 1",
      "Senior associate level 2",
      "Senior associate level 3",
    ],
  },
  {
    category: "Mentor",
    options: ["Mentor"],
  },
  {
    category: "Global Techie",
    options: [
      "Global Techie – Level 1",
      "Global Techie – Level 2",
      "Global Techie – Level 3",
    ],
  },
];

const FLATTENED_ELIGIBILITY_OPTIONS = ELIGIBILITY_TRACK_GROUPS.reduce<string[]>(
  (acc, group) => {
    return [...acc, ...group.options];
  },
  [],
);

const TEAM_TRACK_OPTIONS = [
  "PMO Bincom Dev Center",
  "PMO eMigr8",
  "PMO Bincom Global/Bincom ICT",
  "Cybersecurity",
  "PHP/Backend",
  "Infrastructure/DevOps",
  "Python/Data Science",
  "Mobile App/Advanced Frontend",
  "Graphics/UI/UX Design",
  "Proservice",
  "C#",
  "Digital Marketing",
  "eMigr8 AI Product",
];

const getUserLevelsDisplay = (trackId: any, userLevels?: any): string => {
  const levels = userLevels !== undefined ? userLevels : trackId;
  if (
    !levels ||
    (Array.isArray(levels) && levels.length === 0) ||
    levels === "All" ||
    levels === ""
  ) {
    return "All User Levels";
  }
  if (Array.isArray(levels)) {
    const filtered = levels.filter(
      (l) =>
        l &&
        l !== "All User Eligible" &&
        l !== "All User Level" &&
        l !== "All Tracks Eligibility",
    );
    if (filtered.length === 0) {
      return "All User Levels";
    }
    return filtered.join(", ");
  }
  if (
    levels === "All User Eligible" ||
    levels === "All User Level" ||
    levels === "All Tracks Eligibility"
  ) {
    return "All User Levels";
  }
  return String(levels);
};

const getTeamTracksDisplay = (targetTeamTrackEligibility?: any): string => {
  if (
    !targetTeamTrackEligibility ||
    (Array.isArray(targetTeamTrackEligibility) &&
      targetTeamTrackEligibility.length === 0)
  ) {
    return "All Team Tracks";
  }
  if (Array.isArray(targetTeamTrackEligibility)) {
    return targetTeamTrackEligibility.join(", ");
  }
  return String(targetTeamTrackEligibility);
};

const getMeetingTypeLabel = (type: string): string => {
  if (!type) return "";
  const t = type.toLowerCase().trim();
  if (t === "knowledge" || t === "knowledge sharing hub session")
    return "Knowledge Track";
  if (
    t === "microservice" ||
    t === "standup" ||
    t === "weekly progress standup" ||
    t === "weekly progress standup room"
  )
    return "Microservices";
  if (
    t === "project" ||
    t === "pd" ||
    t === "personal development (pd) session"
  )
    return "Project";
  return type;
};

const ALL_DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface AdminPanelProps {
  adminProfile?: Profile;
  state: any;
  onStateUpdate: () => void;
  adminTab:
    | "funnel"
    | "reviews"
    | "drills"
    | "meetings"
    | "reminders"
    | "cron"
    | "export"
    | "owners"
    | "levels"
    | "kd_desk"
    | "pd_desk"
    | "standup_desk"
    | "attendance_history"
    | "tasks_config"
    | "microservices_config"
    | "pathways_config"
    | "sync_logs";
  setAdminTab: (tab: any) => void;
}

const computeRealTimeAttendanceSummary = (
  meetingOrOcc: any,
  eligibleProfiles: any[],
  attendanceLogs: any[],
  currentDateState: Date
) => {
  const scheduledTimeStr =
    meetingOrOcc.scheduledStartTime ||
    meetingOrOcc.timeString ||
    meetingOrOcc.time ||
    "09:00 AM";
  const scheduledStartMins = parseMeetingTimeToMinutes(scheduledTimeStr);
  const durationMins =
    parseInt(
      meetingOrOcc.duration ||
        meetingOrOcc.meetingDuration ||
        "60",
      10
    ) || 60;
  const scheduledEndMins = scheduledStartMins + durationMins;
  const scheduledEndTimeStr =
    meetingOrOcc.scheduledEndTime ||
    formatMinutesToTimeString(scheduledEndMins);
  const meetingDateStr =
    meetingOrOcc.occurrenceDate ||
    meetingOrOcc.date ||
    (meetingOrOcc.meetingDates ? meetingOrOcc.meetingDates[0] : "") ||
    getLagosDateString(currentDateState);

  const currentLagosMins = getLagosMinutesPastMidnight(currentDateState);
  const todayLagosDate = getLagosDateString(currentDateState);
  const isToday = meetingDateStr === todayLagosDate;

  let liveStatusTag = "";
  let liveStatusBadgeClass = "";
  let liveSubtext = "";

  if (isToday) {
    if (currentLagosMins < scheduledStartMins) {
      const minsUntilStart = scheduledStartMins - currentLagosMins;
      liveStatusTag = `Starts in ${minsUntilStart}m`;
      liveStatusBadgeClass = "bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-extrabold";
      liveSubtext = `Window: ${scheduledTimeStr} – ${scheduledEndTimeStr} (${durationMins}m session)`;
    } else if (currentLagosMins <= scheduledEndMins) {
      const elapsed = currentLagosMins - scheduledStartMins;
      const remaining = scheduledEndMins - currentLagosMins;
      liveStatusTag = `🟢 LIVE (${elapsed}m elapsed / ${remaining}m left)`;
      liveStatusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 font-black animate-pulse shadow-2xs";
      liveSubtext = `Active Window: ${scheduledTimeStr} – ${scheduledEndTimeStr} (${durationMins}m duration)`;
    } else {
      const ago = currentLagosMins - scheduledEndMins;
      liveStatusTag = `Ended (${ago}m ago)`;
      liveStatusBadgeClass = "bg-gray-150 text-gray-700 border-gray-250 font-extrabold";
      liveSubtext = `Window: ${scheduledTimeStr} – ${scheduledEndTimeStr} (${durationMins}m duration)`;
    }
  } else {
    if (meetingDateStr < todayLagosDate) {
      liveStatusTag = "Past Session";
      liveStatusBadgeClass = "bg-gray-150 text-gray-600 border-gray-200 font-extrabold";
      liveSubtext = `${meetingDateStr} • Window: ${scheduledTimeStr} – ${scheduledEndTimeStr} (${durationMins}m duration)`;
    } else {
      liveStatusTag = `Scheduled for ${meetingDateStr}`;
      liveStatusBadgeClass = "bg-blue-50 text-blue-700 border-blue-200 font-extrabold";
      liveSubtext = `${meetingDateStr} • Window: ${scheduledTimeStr} – ${scheduledEndTimeStr} (${durationMins}m duration)`;
    }
  }

  const onTimeList: any[] = [];
  const lateList: any[] = [];
  const absentList: any[] = [];

  eligibleProfiles.forEach((p: any) => {
    const userLogs = attendanceLogs.filter((l: any) =>
      isMatchingLogForMeetingAndUser(l, meetingOrOcc, p)
    );
    const attendedLog = userLogs.find((l: any) => {
      const s = (l.status || "").toLowerCase();
      return !s.includes("miss") && !s.includes("absent");
    });

    let joinMinutes: number | null = null;
    let joinTimeDisplay: string = "No Check-in";

    if (attendedLog) {
      if (attendedLog.joinedAtTime) {
        joinMinutes = parseMeetingTimeToMinutes(attendedLog.joinedAtTime);
        joinTimeDisplay = attendedLog.joinedAtTime;
      } else if (attendedLog.timestamp) {
        try {
          const d = new Date(attendedLog.timestamp);
          joinMinutes = getLagosMinutesPastMidnight(d);
          joinTimeDisplay = formatMinutesToTimeString(joinMinutes);
        } catch (_) {
          joinTimeDisplay = "Checked in";
        }
      }
    }

    let joinDelta: number | null = null;
    if (joinMinutes !== null && scheduledStartMins !== null) {
      joinDelta = joinMinutes - scheduledStartMins;
    }

    let statusStr = "Absent";
    if (attendedLog) {
      const statusLower = (attendedLog.status || "").toLowerCase();
      let isLate = false;
      let isVeryLate = false;

      if (joinDelta !== null) {
        if (joinDelta > 5) {
          isVeryLate = true;
          isLate = true;
        } else if (joinDelta > 2) {
          isLate = true;
        }
      } else if (statusLower.includes("very late")) {
        isVeryLate = true;
        isLate = true;
      } else if (statusLower.includes("late")) {
        isLate = true;
      }

      if (isVeryLate) {
        statusStr = "Attended Very Late";
      } else if (isLate) {
        statusStr = "Attended Late";
      } else {
        statusStr = "Attended On Time";
      }
    }

    let timeTrackingSubtext = "";
    let timingBadge = "";

    if (attendedLog) {
      if (joinDelta !== null) {
        if (joinDelta < 0) {
          timingBadge = `${Math.abs(joinDelta)}m Early`;
          timeTrackingSubtext = `Joined at ${joinTimeDisplay} • ${Math.abs(joinDelta)}m before scheduled start`;
        } else if (joinDelta === 0) {
          timingBadge = `Exact Start`;
          timeTrackingSubtext = `Joined at ${joinTimeDisplay} • Exact start time`;
        } else if (joinDelta <= 2) {
          timingBadge = `+${joinDelta}m (On Time)`;
          timeTrackingSubtext = `Joined at ${joinTimeDisplay} • ${joinDelta}m into ${durationMins}m session`;
        } else if (joinDelta <= 5) {
          timingBadge = `+${joinDelta}m Late`;
          timeTrackingSubtext = `Joined at ${joinTimeDisplay} • ${joinDelta}m late (${durationMins}m session)`;
        } else {
          timingBadge = `+${joinDelta}m Very Late`;
          timeTrackingSubtext = `Joined at ${joinTimeDisplay} • ${joinDelta}m very late (${durationMins}m session)`;
        }
      } else {
        timeTrackingSubtext = `Joined at ${joinTimeDisplay}`;
        timingBadge = "Checked In";
      }
    } else {
      if (isToday && currentLagosMins >= scheduledStartMins && currentLagosMins <= scheduledEndMins) {
        timingBadge = `Pending (${currentLagosMins - scheduledStartMins}m elapsed)`;
        timeTrackingSubtext = `Not checked in • ${currentLagosMins - scheduledStartMins}m into live ${durationMins}m session`;
      } else if (isToday && currentLagosMins < scheduledStartMins) {
        timingBadge = "Upcoming";
        timeTrackingSubtext = `Pending start at ${scheduledTimeStr}`;
      } else {
        timingBadge = "Absent";
        timeTrackingSubtext = `No check-in recorded during ${durationMins}m session`;
      }
    }

    const item = {
      id: p.id,
      fullName: p.fullName,
      username: p.username,
      learningLevel: p.learningLevel || p.techExperience || "Apprentice level 1",
      track: p.track || "General",
      attended: !!attendedLog,
      timestamp: attendedLog ? (attendedLog.timestamp || attendedLog.joinedAtTime || null) : null,
      joinTimeDisplay,
      joinDelta,
      timeTrackingSubtext,
      timingBadge,
      status: statusStr,
    };

    if (!attendedLog) {
      absentList.push(item);
    } else if (statusStr === "Attended Late" || statusStr === "Attended Very Late") {
      lateList.push(item);
    } else {
      onTimeList.push(item);
    }
  });

  const sortAttendedByJoinTime = (a: any, b: any) => {
    if (a.joinMinutes !== null && b.joinMinutes !== null) {
      return b.joinMinutes - a.joinMinutes;
    }
    const tA = a.timestamp || a.joinTimeDisplay || "";
    const tB = b.timestamp || b.joinTimeDisplay || "";
    return tB.localeCompare(tA);
  };

  onTimeList.sort(sortAttendedByJoinTime);
  lateList.sort(sortAttendedByJoinTime);

  const list = [...onTimeList, ...lateList, ...absentList];

  const rawRate =
    list.length > 0
      ? ((onTimeList.length + lateList.length) / list.length) * 100
      : 0;
  const attendanceRate =
    rawRate % 1 === 0 ? rawRate.toFixed(0) : rawRate.toFixed(1);

  return {
    scheduledTimeStr,
    scheduledEndTimeStr,
    durationMins,
    meetingDateStr,
    isToday,
    liveStatusTag,
    liveStatusBadgeClass,
    liveSubtext,
    onTimeList,
    lateList,
    absentList,
    list,
    attendanceRate,
  };
};

export default function AdminPanel({
  adminProfile,
  state,
  onStateUpdate,
  adminTab,
  setAdminTab,
}: AdminPanelProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [localQueuedMeetingUpdates, setLocalQueuedMeetingUpdates] = useState<
    any[]
  >([]);

  useEffect(() => {
    if (adminTab === "sync_logs") {
      const unsubscribe = subscribeToQueuedUpdates((updates) => {
        setLocalQueuedMeetingUpdates(updates);
      });
      return unsubscribe;
    }
  }, [adminTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [loading, setLoading] = useState(false);
  const [purgingDb, setPurgingDb] = useState(false);
  const [seedingDb, setSeedingDb] = useState(false);
  const [meetingToDeleteId, setMeetingToDeleteId] = useState<string | null>(
    null,
  );
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Default Tasks Editor States
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditorTitle, setTaskEditorTitle] = useState("");
  const [taskEditorDesc, setTaskEditorDesc] = useState("");
  const [taskEditorDue, setTaskEditorDue] = useState("");
  const [taskEditorPriority, setTaskEditorPriority] = useState<
    "High" | "Medium" | "Low"
  >("Medium");

  // Dashboard Microservices Editor States
  const [editingMicroserviceId, setEditingMicroserviceId] = useState<
    string | null
  >(null);
  const [msEditorTitle, setMsEditorTitle] = useState("");
  const [msEditorDesc, setMsEditorDesc] = useState("");
  const [msEditorLinkText, setMsEditorLinkText] = useState("");
  const [msEditorTab, setMsEditorTab] = useState("");
  const [msEditorSubTab, setMsEditorSubTab] = useState("");
  const [msEditorIcon, setMsEditorIcon] = useState("");

  // Career Pathways Editor States
  const [editingPathwaySection, setEditingPathwaySection] = useState<
    "foundation" | "trackSplit" | "lateralRoles" | null
  >(null);
  const [editingPathwayIndex, setEditingPathwayIndex] = useState<number | null>(
    null,
  );
  const [pathwayEditorTitle, setPathwayEditorTitle] = useState("");
  const [pathwayEditorDesc, setPathwayEditorDesc] = useState("");

  // Custom iframe-safe dialog confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      isDanger: options.isDanger,
      onConfirm: () => {
        options.onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Sub-tabs states
  const [selectedOwners, setSelectedOwners] = useState<Record<string, string>>(
    {},
  );
  const [selectedUserLevels, setSelectedUserLevels] = useState<
    Record<string, string>
  >({});
  const [levelSearch, setLevelSearch] = useState("");

  // KD, PD, and Standup desk dashboards states
  const [kdSearch, setKdSearch] = useState("");
  const [kdTrackFilter, setKdTrackFilter] = useState("all");
  const [kdEdits, setKdEdits] = useState<Record<string, string>>({});

  const [pdSearch, setPdSearch] = useState("");
  const [pdTrackFilter, setPdTrackFilter] = useState("all");

  const [standupSearch, setStandupSearch] = useState("");
  const [standupTrackFilter, setStandupTrackFilter] = useState("all");

  // Search & Filter state variables
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] =
    useState("pending_validation");
  const [reviewTrackFilter, setReviewTrackFilter] = useState("all");
  const [expandedReviewStudentId, setExpandedReviewStudentId] = useState<
    string | null
  >(null);
  const [lockingStudentId, setLockingStudentId] = useState<string | null>(null);
  const [lockReasonInput, setLockReasonInput] = useState("");

  const [drillTrackFilter, setDrillTrackFilter] = useState("all");
  const [drillStatusFilter, setDrillStatusFilter] = useState("all");

  const [funnelTrackFilter, setFunnelTrackFilter] = useState("all");
  const [dispatchTrackFilter, setDispatchTrackFilter] = useState("all");

  // Owner form states
  const [drillTitle, setDrillTitle] = useState("");
  const [drillDesc, setDrillDesc] = useState("");
  const [drillLink, setDrillLink] = useState("");

  // Reminder alert states
  const [targetStudentId, setTargetStudentId] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");

  // Grade Drill states
  const [gradingSubId, setGradingSubId] = useState("");
  const [gradingStatus, setGradingStatus] = useState<"Approved" | "Rejected">(
    "Approved",
  );
  const [gradingFeedback, setGradingFeedback] = useState("");

  // Custom Assigned Task States
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [customTaskTitle, setCustomTaskTitle] = useState("");
  const [customTaskDesc, setCustomTaskDesc] = useState("");
  const [customTaskDue, setCustomTaskDue] = useState(
    "Every Sunday 11:59 PM WAT",
  );
  const [customTaskPriority, setCustomTaskPriority] = useState<
    "High" | "Medium" | "Low"
  >("Medium");

  // Meetings management form states
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingType, setMeetingType] = useState("Knowledge Track");
  const [meetingTrack, setMeetingTrack] = useState<string[]>([]);
  const [meetingTeamTracks, setMeetingTeamTracks] = useState<string[]>([]);
  const [meetingScheduleDays, setMeetingScheduleDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  const [meetingDates, setMeetingDates] = useState<string[]>([]);
  const [currentPickedDate, setCurrentPickedDate] = useState("");
  const [allowPastDates, setAllowPastDates] = useState(false);
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);

  // Recurrence states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("daily");
  const [recurrenceStartDate, setRecurrenceStartDate] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [recurrenceCustomInterval, setRecurrenceCustomInterval] = useState(1);
  const [recurrenceEditMode, setRecurrenceEditMode] = useState<
    "single" | "future" | "all"
  >("single");
  const [deleteRecurrenceOption, setDeleteRecurrenceOption] = useState<
    "single" | "future" | "all"
  >("single");

  // Custom Meeting specifications states
  const [meetingDuration, setMeetingDuration] = useState("60 minutes");
  const [meetingOrganizer, setMeetingOrganizer] = useState("Admin Team");
  const [meetingStatus, setMeetingStatus] = useState("Upcoming");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingAssignedUsers, setMeetingAssignedUsers] = useState<string[]>(
    [],
  );
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearchText, setUserSearchText] = useState("");
  const assignedUsersRef = useRef<HTMLDivElement>(null);

  // Archived / Completed meetings search & filter states
  const [archiveSearchText, setArchiveSearchText] = useState("");
  const [archiveDateFilter, setArchiveDateFilter] = useState("");
  const [archiveTypeFilter, setArchiveTypeFilter] = useState("");
  const [archiveOrganizerFilter, setArchiveOrganizerFilter] = useState("");
  const [isArchiveRepoExpanded, setIsArchiveRepoExpanded] = useState(false);
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<
    Record<string, boolean>
  >({});

  // Combobox dropdown state managers
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxSearch, setComboboxSearch] = useState("");
  const [comboboxFocusIndex, setComboboxFocusIndex] = useState(-1);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Target Team Track Eligibility dropdown state managers
  const [teamTracksSearch, setTeamTracksSearch] = useState("");
  const [teamTracksOpen, setTeamTracksOpen] = useState(false);
  const [teamTracksFocusIndex, setTeamTracksFocusIndex] = useState(-1);
  const teamTracksRef = useRef<HTMLDivElement>(null);

  // Dynamic Meeting Type Management state vars
  const [meetingTypeSearch, setMeetingTypeSearch] = useState("");
  const [meetingTypeDropdownOpen, setMeetingTypeDropdownOpen] = useState(false);
  const [isAddingNewTypeInline, setIsAddingNewTypeInline] = useState(false);
  const [newTypeInputValue, setNewTypeInputValue] = useState("");
  const [editingTypeName, setEditingTypeName] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const [allowDeleteSystemTypes, setAllowDeleteSystemTypes] = useState(false);
  const meetingTypeRef = useRef<HTMLDivElement>(null);

  // Dynamic current date/time coordinator for active meetings
  const [currentDateState, setCurrentDateState] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateState(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (adminProfile?.fullName && meetingOrganizer === "Admin Team") {
      setMeetingOrganizer(adminProfile.fullName);
    }
  }, [adminProfile, meetingOrganizer]);

  const todayDateStr = getLagosDateString(currentDateState);
  const todayDayName = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Lagos",
        weekday: "long",
      }).format(currentDateState);
    } catch (e) {
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return days[currentDateState.getDay()];
    }
  })();
  const formattedTodayDate = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Lagos",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(currentDateState);
    } catch (e) {
      return currentDateState.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  })();

  const isMeetingScheduledForToday = (meeting: any): boolean => {
    if (meeting.status && meeting.status.trim().toLowerCase() === "archived") {
      return false;
    }
    if (
      meeting.meetingDates &&
      Array.isArray(meeting.meetingDates) &&
      meeting.meetingDates.length > 0
    ) {
      return meeting.meetingDates.includes(todayDateStr);
    }
    const days =
      meeting.scheduleDays && meeting.scheduleDays.length > 0
        ? meeting.scheduleDays
        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    return days.some(
      (day: string) => day.trim().toLowerCase() === todayDayName.toLowerCase(),
    );
  };

  const getAdminMeetingDateLabel = (meeting: any): string => {
    const isToday = isMeetingScheduledForToday(meeting);
    if (isToday) {
      return `Today (${formattedTodayDate})`;
    }
    if (
      meeting.meetingDates &&
      Array.isArray(meeting.meetingDates) &&
      meeting.meetingDates.length > 0
    ) {
      const firstDateStr = meeting.meetingDates[0];
      try {
        const parts = firstDateStr.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          return new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(d);
        }
      } catch (e) {}
      return firstDateStr;
    }
    const days =
      meeting.scheduleDays && meeting.scheduleDays.length > 0
        ? meeting.scheduleDays.join(", ")
        : "Monday, Tuesday, Wednesday, Thursday, Friday";
    return `Upcoming: ${days}`;
  };

  // Click outside to close dropdown ref handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(event.target as Node)
      ) {
        setComboboxOpen(false);
      }
      if (
        teamTracksRef.current &&
        !teamTracksRef.current.contains(event.target as Node)
      ) {
        setTeamTracksOpen(false);
      }
      if (
        meetingTypeRef.current &&
        !meetingTypeRef.current.contains(event.target as Node)
      ) {
        setMeetingTypeDropdownOpen(false);
      }
      if (
        assignedUsersRef.current &&
        !assignedUsersRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreateMeetingType = async (
    typeName: string,
    oldName?: string,
  ) => {
    const cleanName = typeName.trim();
    if (!cleanName) {
      triggerError("Meeting type name cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      await saveMeetingType(cleanName, oldName);

      onStateUpdate();
      triggerSuccess(
        oldName
          ? "Meeting type title updated!"
          : "New meeting type registered successfully!",
      );
      setNewTypeInputValue("");
      setIsAddingNewTypeInline(false);
      setEditingTypeName(null);
      setMeetingType(cleanName);
    } catch (err: any) {
      triggerError("Failed to save meeting type: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Meeting Type Modal States
  const [meetingTypeToDelete, setMeetingTypeToDelete] = useState<string | null>(
    null,
  );
  const [isDeletingMeetingType, setIsDeletingMeetingType] = useState(false);
  const [showRelatedMeetings, setShowRelatedMeetings] = useState(false);

  const handleDeleteMeetingType = (typeName: string) => {
    const isSystemDefault = [
      "knowledge sharing hub session",
      "weekly progress standup",
      "weekly progress standup room",
      "personal development (pd) session",
    ].includes(typeName.toLowerCase());

    if (isSystemDefault && !allowDeleteSystemTypes) {
      triggerError(
        "Default system meeting types cannot be deleted unless super administrator override is enabled.",
      );
      return;
    }

    setMeetingTypeToDelete(typeName);
    setShowRelatedMeetings(false);
  };

  const handleConfirmDeleteMeetingType = async () => {
    if (!meetingTypeToDelete) return;
    setIsDeletingMeetingType(true);
    try {
      await deleteMeetingType(meetingTypeToDelete);

      onStateUpdate();
      triggerSuccess(
        `Meeting type "${meetingTypeToDelete}" deleted successfully.`,
      );
      if (meetingType === meetingTypeToDelete) {
        setMeetingType("Knowledge Track");
      }
      setMeetingTypeToDelete(null);
    } catch (err: any) {
      triggerError("Failed to delete meeting type: " + err.message);
    } finally {
      setIsDeletingMeetingType(false);
    }
  };

  // Attendance tracking state
  const [expandedAttendanceMeetingId, setExpandedAttendanceMeetingId] =
    useState<string | null>(null);
  const [attendanceFilterTab, setAttendanceFilterTab] = useState<
    "all" | "on_time" | "late" | "absent"
  >("all");

  // Combobox list modifiers and search processors
  const handleSelectTrack = (track: string) => {
    if (track === "All User Eligible") {
      setMeetingTrack(["All User Eligible"]);
    } else {
      setMeetingTrack((prev) => {
        const removedAll = prev.filter((t) => t !== "All User Eligible");
        if (removedAll.includes(track)) {
          return removedAll.filter((t) => t !== track);
        } else {
          return [...removedAll, track];
        }
      });
    }
  };

  const handleRemoveTrack = (track: string) => {
    setMeetingTrack((prev) => prev.filter((t) => t !== track));
  };

  const handleClearAllTracks = () => {
    setMeetingTrack([]);
  };

  const getGroupedFilteredOptions = () => {
    const term = comboboxSearch.trim().toLowerCase();
    if (!term) return ELIGIBILITY_TRACK_GROUPS;

    return ELIGIBILITY_TRACK_GROUPS.map((group) => {
      const matchedOptions = group.options.filter((opt) =>
        opt.toLowerCase().includes(term),
      );
      return { ...group, options: matchedOptions };
    }).filter((group) => group.options.length > 0);
  };

  const groupedFilteredOptions = getGroupedFilteredOptions();
  const flatVisibleOptions = groupedFilteredOptions.reduce<string[]>(
    (acc, grp) => [...acc, ...grp.options],
    [],
  );

  // Multi-Selection helper functions for Target Team Track Eligibility
  const handleSelectTeamTrack = (track: string) => {
    setMeetingTeamTracks((prev) => {
      if (prev.includes(track)) {
        return prev.filter((t) => t !== track);
      } else {
        return [...prev, track];
      }
    });
  };

  const handleRemoveTeamTrack = (track: string) => {
    setMeetingTeamTracks((prev) => prev.filter((t) => t !== track));
  };

  const handleClearAllTeamTracks = () => {
    setMeetingTeamTracks([]);
  };

  const handleSelectAllTeamTracks = () => {
    setMeetingTeamTracks([...TEAM_TRACK_OPTIONS]);
  };

  const getFilteredTeamTrackOptions = () => {
    const term = teamTracksSearch.trim().toLowerCase();
    if (!term) return TEAM_TRACK_OPTIONS;
    return TEAM_TRACK_OPTIONS.filter((opt) => opt.toLowerCase().includes(term));
  };

  const filteredTeamTrackOptions = getFilteredTeamTrackOptions();

  // Cron logs simulation state
  const [cronLogs, setCronLogs] = useState<string[]>([]);
  const [cronRunning, setCronRunning] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncTimeoutSec, setSyncTimeoutSec] = useState<number>(10);

  // Synchronization selection and scope states
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncModalType, setSyncModalType] = useState<"save" | "delete" | null>(
    null,
  );
  const [syncModalData, setSyncModalData] = useState<any>(null);
  const [syncModalDeleteId, setSyncModalDeleteId] = useState<string | null>(
    null,
  );
  const [syncModalDeleteMode, setSyncModalDeleteMode] = useState<
    "single" | "future" | "all"
  >("single");
  const [selectedSyncOption, setSelectedSyncOption] = useState<
    "immediate" | "midnight"
  >("immediate");
  const [recurrenceEditOption, setRecurrenceEditOption] = useState<
    "single" | "future" | "all"
  >("single");

  // CSV table toggle/preview
  const [csvPreview, setCsvPreview] = useState(false);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg("");
    toast.success(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg("");
    toast.error(msg);
  };

  // --- 1. COMPUTING METRICS ---
  const adminIsTrackScoped = !!(
    adminProfile &&
    adminProfile.track &&
    adminProfile.track !== "All"
  );
  const adminTrackName = adminProfile
    ? getCleanTrackName(adminProfile.track)
    : "";

  const totalProfiles = state.profiles.length;
  const allStandardUsers = state.profiles.filter((p) => p.role === "user");
  const standardUsers = adminIsTrackScoped
    ? allStandardUsers.filter(
        (u) => getCleanTrackName(u.track) === adminTrackName,
      )
    : allStandardUsers;

  const totalSignupsCount = standardUsers.length;

  const uniqueTracksForDropdown = Array.from(
    new Set(allStandardUsers.map((u) => getCleanTrackName(u.track))),
  )
    .filter(
      (track: any) =>
        track && typeof track === "string" && track.toLowerCase() !== "all",
    )
    .sort();

  // Filter funnel metrics by track if scoped
  const filteredUsersForFunnel =
    funnelTrackFilter === "all"
      ? standardUsers
      : standardUsers.filter(
          (u) => getCleanTrackName(u.track) === funnelTrackFilter,
        );

  // Funnel calculations based on user status (OnboardingStatus)
  const stepOnboarding = filteredUsersForFunnel.length; // Everyone starts here
  const stepAssessmentPassed = filteredUsersForFunnel.filter(
    (p) =>
      ["assessment_passed", "oriented", "dashboard"].includes(p.status) ||
      (p.score !== undefined && p.score >= 50),
  ).length;
  const stepOriented = filteredUsersForFunnel.filter((p) =>
    ["oriented", "dashboard"].includes(p.status),
  ).length;
  const stepDashboardActive = filteredUsersForFunnel.filter(
    (p) => p.status === "dashboard",
  ).length;

  const passedScores = filteredUsersForFunnel
    .filter((p) => p.score !== undefined)
    .map((p) => p.score as number);
  const averageAssessmentScore =
    passedScores.length > 0
      ? Math.round(
          passedScores.reduce((acc, curr) => acc + curr, 0) /
            passedScores.length,
        )
      : 0;

  const passedCount = filteredUsersForFunnel.filter(
    (p) => p.score !== undefined && p.score >= 50,
  ).length;
  const passRate =
    passedScores.length > 0
      ? Math.round(((passedCount / passedScores.length) * 105) / 1.05) // normal round
      : 0;

  // Counts & Filters for Student Validation & Reviews Tab
  const isPendingValidation = (status: string) =>
    [
      "onboarding",
      "assessment_failed",
      "assessment_passed",
      "oriented",
    ].includes(status);

  const pendingValidationCount = standardUsers.filter((u) =>
    isPendingValidation(u.status),
  ).length;
  const allCandidatesCount = standardUsers.length;
  const onboardingCount = standardUsers.filter(
    (u) => u.status === "onboarding",
  ).length;
  const assessmentPassedCount = standardUsers.filter(
    (u) => u.status === "assessment_passed",
  ).length;
  const assessmentFailedCount = standardUsers.filter(
    (u) => u.status === "assessment_failed",
  ).length;
  const orientedCount = standardUsers.filter(
    (u) => u.status === "oriented",
  ).length;
  const activeDashboardCount = standardUsers.filter(
    (u) => u.status === "dashboard",
  ).length;

  // Filter standard users for the Reviews tab
  const filteredUsersForReviews = standardUsers.filter((u) => {
    const matchesSearch =
      !reviewSearch ||
      u.fullName.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(reviewSearch.toLowerCase());

    const matchesStatus =
      reviewStatusFilter === "all"
        ? true
        : reviewStatusFilter === "pending_validation"
          ? isPendingValidation(u.status)
          : u.status === reviewStatusFilter;

    const matchesTrack =
      reviewTrackFilter === "all" ||
      getCleanTrackName(u.track) === reviewTrackFilter;

    return matchesSearch && matchesStatus && matchesTrack;
  });

  // Filter homework drill submissions for the Grading desk
  const allowedSubmissions = adminIsTrackScoped
    ? state.drillSubmissions.filter(
        (sub) => getCleanTrackName(sub.track) === adminTrackName,
      )
    : state.drillSubmissions;

  const filteredSubmissions = allowedSubmissions.filter((sub) => {
    const matchesTrack =
      drillTrackFilter === "all" ||
      getCleanTrackName(sub.track) === drillTrackFilter;
    const matchesStatus =
      drillStatusFilter === "all" || sub.status === drillStatusFilter;
    return matchesTrack && matchesStatus;
  });

  // --- 2. CONTROLLERS ---

  // Onboard review trigger
  const handleStudentAction = async (studentId: string, action: string) => {
    setLoading(true);
    try {
      const reviewerName =
        adminProfile.fullName || adminProfile.username || "Tech Mentor";
      await reviewStudent(studentId, action, reviewerName);

      triggerSuccess(`Learner onboarding & placement confirmed successfully!`);
      onStateUpdate();
    } catch (e: any) {
      triggerError("Placement failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLockStudent = async (studentId: string) => {
    if (!lockReasonInput.trim()) {
      triggerError("A reason for locking the dashboard is required.");
      return;
    }
    setLoading(true);
    try {
      const reviewerName =
        adminProfile.fullName || adminProfile.username || "Tech Mentor";
      await lockStudentDashboard(
        studentId,
        lockReasonInput.trim(),
        reviewerName,
      );
      triggerSuccess(
        "Learner dashboard locked successfully! Learner will be notified immediately.",
      );
      setLockingStudentId(null);
      setLockReasonInput("");
      onStateUpdate();
    } catch (e: any) {
      triggerError("Failed to lock learner dashboard: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockStudent = async (studentId: string) => {
    setLoading(true);
    try {
      await unlockStudentDashboard(studentId);
      triggerSuccess("Learner dashboard unlocked successfully.");
      onStateUpdate();
    } catch (e: any) {
      triggerError("Failed to unlock learner dashboard: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Create Drill
  const handleCreateDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillTitle || !drillDesc || !drillLink) return;

    setLoading(true);
    try {
      await addDrill(drillTitle, drillDesc, drillLink);

      setDrillTitle("");
      setDrillDesc("");
      setDrillLink("");
      triggerSuccess(
        "New Weekly challenge posted & alert warnings broadcasted to student workspaces!",
      );
      onStateUpdate();
    } catch (e: any) {
      triggerError("Failed to add drill: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Grade Drill Submission
  const handleGradeDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubId) return;

    setLoading(true);
    try {
      const score = 100; // default/placeholder or computed if any
      await gradeDrillSubmission(
        gradingSubId,
        score,
        gradingFeedback,
        gradingStatus,
      );

      setGradingSubId("");
      setGradingFeedback("");
      triggerSuccess(
        "Homework submission graded & dispatch user alerts updated!",
      );
      onStateUpdate();
    } catch (e: any) {
      triggerError("Grading assignment failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Send Alert Warning Reminder
  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId || !reminderMsg) return;

    setLoading(true);
    try {
      await sendReminder(targetStudentId, reminderMsg);

      setReminderMsg("");
      setTargetStudentId("");
      triggerSuccess(
        "Mentorship warning successfully dispatched to student alert feeds.",
      );
      onStateUpdate();
    } catch (e: any) {
      triggerError("Failed to deliver alert reminder: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Change student level in real-time
  const handleChangeLevel = async (studentId: string, level: string) => {
    setLoading(true);
    try {
      await changeLevel(studentId, level);

      triggerSuccess(`Student level updated successfully to: ${level}`);
      onStateUpdate();
    } catch (e: any) {
      triggerError("Level change failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Assign custom task to student
  const handleAssignTask = async (studentId: string) => {
    if (!customTaskTitle.trim()) {
      triggerError("Task Title is required.");
      return;
    }
    setLoading(true);
    try {
      await assignTask(
        studentId,
        customTaskTitle,
        customTaskDesc,
        customTaskDue,
        customTaskPriority as any,
      );

      triggerSuccess(
        `Task "${customTaskTitle}" custom-assigned successfully to student.`,
      );
      setAssigningTaskId(null);
      setCustomTaskTitle("");
      setCustomTaskDesc("");
      setCustomTaskDue("Every Sunday 11:59 PM WAT");
      setCustomTaskPriority("Medium");
      onStateUpdate();
    } catch (e: any) {
      triggerError("Task assignment failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Save/Edit/Create Meeting - Intercepts to show Sync Options Modal
  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim() || !meetingTime.trim() || !meetingUrl.trim()) {
      triggerError(
        "Meeting Title, Meeting Time, and Meeting Link are required.",
      );
      return;
    }
    if (!meetingType) {
      triggerError("Meeting Type is required.");
      return;
    }

    // Resolve dates for saving
    let finalMeetingDates = meetingDates;
    if (isRecurring && !editingMeetingId) {
      const startD = recurrenceStartDate || getLagosDateString(new Date());
      finalMeetingDates = [startD];
    }

    if (!finalMeetingDates || finalMeetingDates.length === 0) {
      triggerError("Please select at least one calendar date for the meeting.");
      return;
    }
    if (!allowPastDates) {
      const todayStr = getLagosDateString(new Date());
      const hasPastDate = finalMeetingDates.some(
        (dateStr) => dateStr < todayStr,
      );
      if (hasPastDate) {
        triggerError(
          "Cannot select past dates unless 'Allow Past Dates' is explicitly enabled in system settings.",
        );
        return;
      }
    }

    const meetingData = {
      id: editingMeetingId || undefined,
      title: meetingTitle,
      type: meetingType,
      timeString: meetingTime,
      jitsiUrl: meetingUrl,
      trackId: meetingTrack.length > 0 ? meetingTrack : null,
      userLevels: meetingTrack.length > 0 ? meetingTrack : null,
      targetTeamTrackEligibility:
        meetingTeamTracks.length > 0 ? meetingTeamTracks : null,
      scheduleDays: meetingScheduleDays,
      meetingDates: finalMeetingDates,
      assignedUserIds: meetingAssignedUsers,
      duration: meetingDuration,
      organizer: meetingOrganizer,
      status: meetingStatus,
      description: meetingDescription,
      // Recurrence parameters
      isRecurring,
      recurrenceFrequency: isRecurring
        ? !recurrenceFrequency || recurrenceFrequency === "one-time"
          ? "daily"
          : recurrenceFrequency
        : undefined,
      recurrenceStartDate: isRecurring
        ? recurrenceStartDate || finalMeetingDates[0] || getLagosDateString(new Date())
        : undefined,
      recurrenceEndDate: isRecurring ? recurrenceEndDate : undefined,
      recurrenceCustomInterval:
        isRecurring && recurrenceFrequency === "custom"
          ? recurrenceCustomInterval
          : undefined,
      recurrenceEditMode: editingMeetingId ? recurrenceEditOption : undefined,
      seriesId: editingMeetingId
        ? state.meetings.find((m: any) => m.id === editingMeetingId)
            ?.seriesId || undefined
        : undefined,
      occurrenceDate: editingMeetingId
        ? state.meetings.find((m: any) => m.id === editingMeetingId)
            ?.occurrenceDate || undefined
        : undefined,
    };

    // Directly save/update meeting immediately without prompting for 12:00 AM Midnight Sync
    setLoading(true);
    try {
      await saveMeeting(
        meetingData,
        adminProfile,
        "immediate",
        state.profiles,
      );

      triggerSuccess(
        editingMeetingId
          ? "Meeting updated & published successfully!"
          : "New meeting scheduled & published successfully!"
      );

      // Reset form states
      setIsAddingMeeting(false);
      setEditingMeetingId(null);
      setMeetingTitle("");
      setMeetingTime("");
      setMeetingUrl("");
      setMeetingType("Knowledge Track");
      setMeetingTrack([]);
      setMeetingTeamTracks([]);
      setMeetingScheduleDays([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ]);
      setMeetingDates([]);
      setCurrentPickedDate("");
      setAllowPastDates(false);
      setMeetingDuration("60 minutes");
      setMeetingOrganizer("Admin Team");
      setMeetingStatus("Upcoming");
      setMeetingDescription("");
      setMeetingAssignedUsers([]);
      setUserSearchText("");
      setIsRecurring(false);
      setRecurrenceFrequency("one-time");
      setRecurrenceStartDate("");
      setRecurrenceEndDate("");
      setRecurrenceCustomInterval(1);
      setRecurrenceEditMode("single");
      onStateUpdate();
    } catch (e: any) {
      console.error("Failed to save meeting:", e);
      triggerError("Failed to save meeting: " + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  // Direct Delete Execution
  const handleInitiateDelete = async (
    meetingId: string,
    deleteMode: "single" | "future" | "all",
  ) => {
    setMeetingToDeleteId(null); // Close confirmation modal
    setLoading(true);
    try {
      await deleteMeeting(
        meetingId,
        deleteMode,
        adminProfile,
        "immediate",
        state.profiles,
      );
      triggerSuccess("Meeting deleted successfully.");
      if (meetingId === editingMeetingId) {
        setEditingMeetingId(null);
      }
      onStateUpdate();
    } catch (e: any) {
      console.error("Failed to delete meeting:", e);
      triggerError("Failed to delete meeting: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger immediate synchronization for a specific meeting
  const handleTriggerUpdateImmediately = async (meetingId: string) => {
    setLoading(true);
    try {
      const updated = await syncSingleMeetingImmediately(
        meetingId,
        adminProfile,
        state.profiles,
      );
      const title = updated?.title || "Meeting";
      triggerSuccess(
        `Meeting '${title}' successfully updated and synchronised immediately to affected users!`,
      );
      onStateUpdate();
    } catch (e: any) {
      console.error("Failed to update immediately:", e);
      triggerError("Failed to update immediately: " + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };







  // Execute Save or Delete with selected Sync Option
  const executeSyncAction = async () => {
    if (!syncModalType || !syncModalData) return;
    setLoading(true);
    try {
      if (syncModalType === "save") {
        await saveMeeting(
          syncModalData,
          adminProfile,
          selectedSyncOption,
          state.profiles,
        );

        triggerSuccess(
          editingMeetingId
            ? selectedSyncOption === "immediate"
              ? "Meeting updated successfully & pushed immediately!"
              : "Meeting changes saved & queued for 12:00 AM Midnight synchronization!"
            : selectedSyncOption === "immediate"
              ? "New meeting scheduled & updated immediately!"
              : "New meeting scheduled & queued for 12:00 AM Midnight synchronization!"
        );

        // Reset modal and form states
        setSyncModalOpen(false);
        setSyncModalData(null);
        setEditingMeetingId(null);
        setMeetingTitle("");
        setMeetingTime("");
        setMeetingUrl("");
        setMeetingType("Knowledge Track");
        setMeetingTrack([]);
        setMeetingTeamTracks([]);
        setMeetingScheduleDays([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ]);
        setMeetingDates([]);
        setCurrentPickedDate("");
        setAllowPastDates(false);
        setMeetingDuration("60 minutes");
        setMeetingOrganizer("Admin Team");
        setMeetingStatus("Upcoming");
        setMeetingDescription("");
        setMeetingAssignedUsers([]);
        setUserSearchText("");
        setIsAddingMeeting(false);
        setIsRecurring(false);
        setRecurrenceFrequency("one-time");
        setRecurrenceStartDate("");
        setRecurrenceEndDate("");
        setRecurrenceCustomInterval(1);
        setRecurrenceEditMode("single");
        onStateUpdate();
      }
    } catch (e: any) {
      console.error("Failed to execute sync action:", e);
      triggerError("Failed to execute sync action: " + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  // Sync Meetings Trigger & Config
  const handleTriggerSync = async () => {
    setSyncRunning(true);
    setSyncLogs([
      "🔄 Initialising meeting synchronisation engine...",
      "🌐 Querying Bincom Corporate Meeting Directory pool...",
    ]);

    setTimeout(async () => {
      try {
        // Create safety timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Synchronization request timed out after ${syncTimeoutSec} seconds.`,
              ),
            );
          }, syncTimeoutSec * 1000);
        });

        // Race the sync function against the safety timeout
        const result = await Promise.race([
          synchronizeMeetings(),
          timeoutPromise,
        ]);

        setSyncLogs((prev) => [
          ...prev,
          `✅ Successfully connected to Corporate Directory.`,
          `🆕 Newly created meetings fetched & published: ${result.added.length > 0 ? result.added.join(", ") : "None"}`,
          `🔄 Updated meetings synced & previous info replaced: ${result.updated.length > 0 ? result.updated.join(", ") : "None"}`,
          `📅 Alignment complete! All target track memberships updated.`,
        ]);
        triggerSuccess("Meetings synchronized successfully!");
        onStateUpdate();
      } catch (e: any) {
        setSyncLogs((prev) => [
          ...prev,
          "❌ CRITICAL Error synchronising meetings: " + e.message,
        ]);
        triggerError("Synchronization failed: " + e.message);
      } finally {
        setSyncRunning(false);
      }
    }, 1200);
  };

  const handleToggleMidnightSync = async (enabled: boolean) => {
    try {
      await updateAppConfigField("autoMidnightSyncEnabled", enabled);
      triggerSuccess(
        `Midnight Sync successfully ${enabled ? "enabled" : "disabled"}!`,
      );
      onStateUpdate();
    } catch (e: any) {
      triggerError("Failed to update midnight sync setting: " + e.message);
    }
  };

  // Simulated 00:00 WAT Cron script trigger
  const handleTriggerSimulatedCron = async () => {
    setCronRunning(true);
    setCronLogs([
      "⏱️ 00:00 WAT Scheduler triggered: starting nightly workspace cron job...",
      "🔍 Checking user_daily_meetings profiles alignment mappings...",
      "📂 Scanning 10 available track curriculum rules and project assigns...",
    ]);

    setTimeout(async () => {
      try {
        const data = await triggerSimulatedCron();

        setCronLogs((prev) => [
          ...prev,
          "⚡ Scanning finished. Target projects verified: Bincom Dev applet, eMigr8 pathway.",
          "✔️ Regenerating Jitsi coordinates & standup links baseline database entities...",
          `📅 Cron Success Code: Generated ${data.meetings.length} brand new customized day meetings.`,
          "💻 State synced! Workspace rejuvenated for the next 24-hour cycle.",
        ]);
        onStateUpdate();
      } catch (e: any) {
        setCronLogs((prev) => [
          ...prev,
          "❌ CRITICAL: overnight cron process failed: " + e.message,
        ]);
      } finally {
        setCronRunning(false);
      }
    }, 1200);
  };

  // Purge Seed Data & Fresh Start Trigger
  const handlePurgeDatabase = () => {
    showConfirm({
      title: "Purge All Mock & Seed Data",
      message:
        "Are you absolutely sure you want to purge all mock and transaction data? This will clear all meetings, drills, projects, standups, and student profiles from Firestore. This action is IRREVERSIBLE.",
      confirmText: "🗑️ Yes, Purge Everything",
      isDanger: true,
      onConfirm: async () => {
        setPurgingDb(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
          await purgeDatabase(adminProfile?.id);
          triggerSuccess(
            "Database successfully purged! All seed data has been deleted and you have a completely fresh workspace.",
          );
          onStateUpdate();
        } catch (err: any) {
          triggerError("Failed to purge database: " + err.message);
        } finally {
          setPurgingDb(false);
        }
      },
    });
  };

  // Seed Database Trigger
  const handleSeedDatabase = () => {
    showConfirm({
      title: "Seed Default Configurations",
      message:
        "Are you sure you want to seed default configurations (tasks, microservices, pathways) into the database?",
      confirmText: "🌱 Yes, Seed Database",
      isDanger: false,
      onConfirm: async () => {
        setSeedingDb(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
          await seedDatabase(true); // force = true to override
          triggerSuccess(
            "Database successfully configured with default tasks, microservices, and pathways.",
          );
          onStateUpdate();
        } catch (err: any) {
          triggerError("Failed to seed database: " + err.message);
        } finally {
          setSeedingDb(false);
        }
      },
    });
  };

  // --- CONFIGURATIONS DIRECT CRUDS (Tasks, Microservices, Career Pathways) ---

  // Default Tasks
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskEditorTitle.trim()) {
      triggerError("Task title is required.");
      return;
    }
    const currentTasks = [...(state.tasks || [])];
    if (editingTaskId === "new") {
      const newTask = {
        id: "tsk_" + Math.random().toString(36).substring(2, 9),
        title: taskEditorTitle.trim(),
        description: taskEditorDesc.trim(),
        due: taskEditorDue.trim() || "Daily by 05:00 PM (WAT)",
        priority: taskEditorPriority,
      };
      const updated = [...currentTasks, newTask];
      try {
        await updateAppConfigField("tasks", updated);
        triggerSuccess("New default task added successfully!");
        setEditingTaskId(null);
        onStateUpdate();
      } catch (err: any) {
        triggerError("Failed to add task: " + err.message);
      }
    } else if (editingTaskId) {
      const updated = currentTasks.map((t) =>
        t.id === editingTaskId
          ? {
              ...t,
              title: taskEditorTitle.trim(),
              description: taskEditorDesc.trim(),
              due: taskEditorDue.trim(),
              priority: taskEditorPriority,
            }
          : t,
      );
      try {
        await updateAppConfigField("tasks", updated);
        triggerSuccess("Default task updated successfully!");
        setEditingTaskId(null);
        onStateUpdate();
      } catch (err: any) {
        triggerError("Failed to update task: " + err.message);
      }
    }
  };

  const handleDeleteTask = (id: string) => {
    showConfirm({
      title: "Delete Default Task",
      message: "Are you sure you want to delete this default task?",
      confirmText: "🗑️ Delete Task",
      isDanger: true,
      onConfirm: async () => {
        const currentTasks = [...(state.tasks || [])];
        const updated = currentTasks.filter((t) => t.id !== id);
        try {
          await updateAppConfigField("tasks", updated);
          triggerSuccess("Default task deleted successfully!");
          onStateUpdate();
        } catch (err: any) {
          triggerError("Failed to delete task: " + err.message);
        }
      },
    });
  };

  const startEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setTaskEditorTitle(task.title);
    setTaskEditorDesc(task.description || "");
    setTaskEditorDue(task.due || "");
    setTaskEditorPriority(task.priority || "Medium");
  };

  const startAddTask = () => {
    setEditingTaskId("new");
    setTaskEditorTitle("");
    setTaskEditorDesc("");
    setTaskEditorDue("Daily by 05:00 PM (WAT)");
    setTaskEditorPriority("Medium");
  };

  // Dashboard Microservices
  const handleSaveMicroservice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msEditorTitle.trim()) {
      triggerError("Microservice title is required.");
      return;
    }
    const currentMs = [...(state.microservices || [])];
    if (editingMicroserviceId === "new") {
      const newMs = {
        id: "ms_" + Math.random().toString(36).substring(2, 9),
        title: msEditorTitle.trim(),
        description: msEditorDesc.trim(),
        linkText: msEditorLinkText.trim() || "Click to Enter",
        tab: msEditorTab.trim() || "microservices",
        subTab: msEditorSubTab.trim() || "kd",
        icon: msEditorIcon.trim() || "Award",
      };
      const updated = [...currentMs, newMs];
      try {
        await updateAppConfigField("microservices", updated);
        triggerSuccess("New dashboard microservice added successfully!");
        setEditingMicroserviceId(null);
        onStateUpdate();
      } catch (err: any) {
        triggerError("Failed to add microservice: " + err.message);
      }
    } else if (editingMicroserviceId) {
      const updated = currentMs.map((ms) =>
        ms.id === editingMicroserviceId
          ? {
              ...ms,
              title: msEditorTitle.trim(),
              description: msEditorDesc.trim(),
              linkText: msEditorLinkText.trim(),
              tab: msEditorTab.trim(),
              subTab: msEditorSubTab.trim(),
              icon: msEditorIcon.trim(),
            }
          : ms,
      );
      try {
        await updateAppConfigField("microservices", updated);
        triggerSuccess("Dashboard microservice updated successfully!");
        setEditingMicroserviceId(null);
        onStateUpdate();
      } catch (err: any) {
        triggerError("Failed to update microservice: " + err.message);
      }
    }
  };

  const handleDeleteMicroservice = (id: string) => {
    showConfirm({
      title: "Delete Microservice",
      message:
        "Are you sure you want to delete this microservice from the dashboard?",
      confirmText: "🗑️ Delete Microservice",
      isDanger: true,
      onConfirm: async () => {
        const currentMs = [...(state.microservices || [])];
        const updated = currentMs.filter((ms) => ms.id !== id);
        try {
          await updateAppConfigField("microservices", updated);
          triggerSuccess("Microservice deleted successfully!");
          onStateUpdate();
        } catch (err: any) {
          triggerError("Failed to delete microservice: " + err.message);
        }
      },
    });
  };

  const startEditMs = (ms: any) => {
    setEditingMicroserviceId(ms.id);
    setMsEditorTitle(ms.title);
    setMsEditorDesc(ms.description || "");
    setMsEditorLinkText(ms.linkText || "Click to Enter");
    setMsEditorTab(ms.tab || "microservices");
    setMsEditorSubTab(ms.subTab || "");
    setMsEditorIcon(ms.icon || "Award");
  };

  const startAddMs = () => {
    setEditingMicroserviceId("new");
    setMsEditorTitle("");
    setMsEditorDesc("");
    setMsEditorLinkText("Click to Enter");
    setMsEditorTab("microservices");
    setMsEditorSubTab("kd");
    setMsEditorIcon("Award");
  };

  // Career Pathways
  const handleSavePathwayStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathwayEditorTitle.trim()) {
      triggerError("Step title is required.");
      return;
    }
    const pathways = state.careerPathways
      ? { ...state.careerPathways }
      : { foundation: [], trackSplit: [], lateralRoles: [] };
    const section = editingPathwaySection!;
    const index = editingPathwayIndex;

    const list = [...(pathways[section] || [])];
    const stepObj = {
      title: pathwayEditorTitle.trim(),
      description: pathwayEditorDesc.trim(),
    };

    if (index === -1) {
      list.push(stepObj);
    } else if (index !== null) {
      list[index] = stepObj;
    }

    const updatedPathways = {
      ...pathways,
      [section]: list,
    };

    try {
      await updateAppConfigField("careerPathways", updatedPathways);
      triggerSuccess(`Pathway step saved under ${section} successfully!`);
      setEditingPathwaySection(null);
      setEditingPathwayIndex(null);
      onStateUpdate();
    } catch (err: any) {
      triggerError("Failed to save step: " + err.message);
    }
  };

  const handleDeletePathwayStep = (
    section: "foundation" | "trackSplit" | "lateralRoles",
    index: number,
  ) => {
    showConfirm({
      title: "Delete Pathway Step",
      message: `Are you sure you want to delete this step from the ${section} section?`,
      confirmText: "🗑️ Delete Step",
      isDanger: true,
      onConfirm: async () => {
        const pathways = state.careerPathways
          ? { ...state.careerPathways }
          : { foundation: [], trackSplit: [], lateralRoles: [] };
        const list = [...(pathways[section] || [])];
        list.splice(index, 1);

        const updatedPathways = {
          ...pathways,
          [section]: list,
        };

        try {
          await updateAppConfigField("careerPathways", updatedPathways);
          triggerSuccess(`Step removed from ${section} pathway section.`);
          onStateUpdate();
        } catch (err: any) {
          triggerError("Failed to delete step: " + err.message);
        }
      },
    });
  };

  const startEditPathway = (
    section: "foundation" | "trackSplit" | "lateralRoles",
    index: number,
    step?: any,
  ) => {
    setEditingPathwaySection(section);
    setEditingPathwayIndex(index);
    if (step) {
      setPathwayEditorTitle(step.title);
      setPathwayEditorDesc(step.description || "");
    } else {
      setPathwayEditorTitle("");
      setPathwayEditorDesc("");
    }
  };

  // Simulate CSV download
  const handleDownloadCSV = () => {
    // Generate simple comma-separated columns
    const headers =
      "AttendanceRecordID,StudentFullName,StudentEmail,TrackGroup,MeetingName,CheckInTime,PunctualityRating\n";
    const rows = state.attendance
      .map(
        (a) =>
          `"${a.id}","${a.fullName || a.username}","${a.fullName ? `${a.fullName.toLowerCase().replace(/\s+/g, '.')}@bincom.co` : `${a.username}@bincom.co`}","${a.track}","${a.meetingTitle}","${a.timestamp}","${a.status}"`,
      )
      .join("\n");

    const csvContent =
      "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute(
      "download",
      `Bincom_Attendance_Audit_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess(
      "Simulated student attendance ledger successfully structured & downloaded.",
    );
  };

  const tabDetails: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    funnel: { label: "Operations Funnel", icon: BarChart4 },
    reviews: {
      label: `Student Reviews (${standardUsers.filter((u) => u.status !== "dashboard").length})`,
      icon: Users,
    },
    drills: {
      label: `Weekly Drills (${state.drillSubmissions.filter((s) => s.status === "Pending").length})`,
      icon: Award,
    },
    meetings: {
      label: `Meetings Management (${state.meetings.length})`,
      icon: Calendar,
    },
    reminders: { label: "Warning Dispatches", icon: Send },
    cron: { label: "00:00 WAT Cron Sync", icon: Cpu },
    export: { label: "Export Ledger CSV", icon: FileDown },
    owners: { label: "Module Owners", icon: ShieldCheck },
    levels: { label: "Levels Promotion Desk", icon: Users },
    kd_desk: { label: "KD Microservice (Knowledge Check)", icon: BookOpen },
    pd_desk: { label: "PD Desk (Project Delivery)", icon: FileEdit },
    standup_desk: { label: "Standup Compliance Desk", icon: Calendar },
    attendance_history: { label: "Attendance Ledger History", icon: History },
    tasks_config: { label: "Default Tasks Config", icon: Settings },
    microservices_config: { label: "Microservices Config", icon: Layers },
    pathways_config: { label: "Career Pathways Config", icon: GraduationCap },
    sync_logs: { label: "Sync & Error Audit Logs", icon: RefreshCw },
  };

  const adminTabGroups = [
    {
      label: "Core Operations",
      items: [
        { id: "funnel", label: "Operations Funnel", icon: BarChart4 },
        {
          id: "reviews",
          label: `Student Reviews (${standardUsers.filter((u) => u.status !== "dashboard").length})`,
          icon: Users,
        },
        {
          id: "drills",
          label: `Weekly Drills (${state.drillSubmissions.filter((s) => s.status === "Pending").length})`,
          icon: Award,
        },
        {
          id: "meetings",
          label: `Meetings Management (${state.meetings.length})`,
          icon: Calendar,
        },
      ],
    },
    {
      label: "Desks & Registers",
      items: [
        {
          id: "kd_desk",
          label: "📚 KD Microservice (Knowledge Check)",
          icon: BookOpen,
        },
        {
          id: "pd_desk",
          label: "💡 PD Desk (Project Delivery)",
          icon: FileEdit,
        },
        { id: "standup_desk", label: "☀️ Standup Desk", icon: Calendar },
        {
          id: "attendance_history",
          label: "📋 Attendance Ledger",
          icon: History,
        },
        { id: "levels", label: "📈 Levels Promotion Desk", icon: Users },
        { id: "reminders", label: "Warning Dispatches", icon: Send },
      ],
    },
    {
      label: "System & Config",
      items: [
        { id: "cron", label: "00:00 WAT Cron Sync", icon: Cpu },
        {
          id: "sync_logs",
          label: "🔄 Sync & Error Audit Logs",
          icon: RefreshCw,
        },
        { id: "export", label: "Export Ledger CSV", icon: FileDown },
        { id: "owners", label: "👥 Module Owners", icon: ShieldCheck },
        {
          id: "tasks_config",
          label: "⚙️ Default Tasks Config",
          icon: Settings,
        },
        {
          id: "microservices_config",
          label: "🔌 Microservices Config",
          icon: Layers,
        },
        {
          id: "pathways_config",
          label: "🎓 Career Pathways Config",
          icon: GraduationCap,
        },
      ],
    },
  ];

  const activeTabInfo = tabDetails[adminTab] || {
    label: "Select View",
    icon: Filter,
  };
  const ActiveIcon = activeTabInfo.icon;

  return (
    <div className="space-y-6" id="admin-module-root">
      {/* Dropdown-based Sub Tabs Menu */}
      <div
        className="bg-white p-4 rounded-xl border border-gray-150 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none animate-fade-in"
        id="admin-view-selector-container"
      >
        <div>
          <h3 className="text-sm font-extrabold text-gray-950 flex items-center gap-1.5">
            <span className="p-1 bg-[#4B5E40]/10 text-[#4B5E40] rounded">
              🛡️
            </span>
            Administrative Operations
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-gray-500">
              Switch between analytical funnels, student compliance reviews,
              configuration desks, and logs.
            </p>
          </div>
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full sm:w-72 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#F8FAF8] hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 transition cursor-pointer shadow-3xs focus:outline-none focus:ring-2 focus:ring-[#4B5E40]/20"
            id="admin-dropdown-trigger"
          >
            <span className="flex items-center gap-2 text-gray-800">
              <ActiveIcon className="w-4 h-4 text-[#4B5E40]" />
              {activeTabInfo.label}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-full sm:w-85 max-h-96 overflow-y-auto bg-white rounded-xl border border-gray-150 shadow-xl z-50 py-2 divide-y divide-gray-100 animate-slide-in scrollbar-thin scrollbar-thumb-gray-200"
              id="admin-dropdown-menu"
            >
              {adminTabGroups.map((group, gIdx) => (
                <div key={gIdx} className="p-1.5">
                  <span className="block px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isSelected = adminTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setAdminTab(item.id as any);
                            setIsDropdownOpen(false);
                            setErrorMsg("");
                            setSuccessMsg("");
                            if (item.id === "tasks_config")
                              setEditingTaskId(null);
                            if (item.id === "microservices_config")
                              setEditingMicroserviceId(null);
                            if (item.id === "pathways_config") {
                              setEditingPathwaySection(null);
                              setEditingPathwayIndex(null);
                            }
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition text-left cursor-pointer ${
                            isSelected
                              ? "bg-[#4B5E40] text-white font-bold"
                              : "text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                          }`}
                        >
                          <ItemIcon
                            className={`w-4 h-4 ${isSelected ? "text-white" : "text-[#4B5E40]"}`}
                          />
                          <span className="truncate">{item.label}</span>
                          {isSelected && (
                            <span className="ml-auto text-xs">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          className="flex items-start gap-2.5 p-3.5 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-100"
          id="admin-alert-err"
        >
          <AlertOctagon className="w-4.5 h-4.5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          className="flex items-start gap-2.5 p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-100"
          id="admin-alert-suc"
        >
          <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* --- MENU VIEWPORTS --- */}

      {adminTab === "attendance_history" && (
        <AttendanceHistoryTab
          isAdmin={true}
          currentUserId={adminProfile?.id || ""}
          state={state}
          onStateUpdate={onStateUpdate}
        />
      )}

      {adminTab === "tasks_config" && (
        <div className="space-y-6 animate-fade-in" id="tasks-config-tab-root">
          <div className="bg-white p-5 rounded-xl border border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
                ⚙️ Default Ongoing Tasks Configurations
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Configure default ongoing tasks assigned to students. Changes
                propagate instantly to all student dashboards.
              </p>
            </div>
            {editingTaskId === null && (
              <button
                onClick={startAddTask}
                className="px-4 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Default Task
              </button>
            )}
          </div>

          {editingTaskId !== null ? (
            <form
              onSubmit={handleSaveTask}
              className="bg-white p-6 rounded-xl border border-gray-150 space-y-4 max-w-2xl mx-auto animate-fade-in"
            >
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-gray-500">
                {editingTaskId === "new"
                  ? "➕ Create New Default Task"
                  : "✏️ Edit Default Task"}
              </h4>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Report Submission"
                  value={taskEditorTitle}
                  onChange={(e) => setTaskEditorTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700">
                  Task Description
                </label>
                <textarea
                  placeholder="Describe task expectations clearly..."
                  value={taskEditorDesc}
                  onChange={(e) => setTaskEditorDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Due String / Frequency
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily by 05:00 PM (WAT)"
                    value={taskEditorDue}
                    onChange={(e) => setTaskEditorDue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Priority Level
                  </label>
                  <select
                    value={taskEditorPriority}
                    onChange={(e) =>
                      setTaskEditorPriority(e.target.value as any)
                    }
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingTaskId(null)}
                  className="px-4 py-2 border border-gray-250 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(state.tasks || []).map((t) => (
                <div
                  key={t.id}
                  className="bg-white p-5 rounded-xl border border-gray-150 hover:border-gray-300 transition shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-gray-950 leading-tight">
                        {t.title}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 border ${
                          t.priority === "High"
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : t.priority === "Medium"
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                      {t.description || "No description provided."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[11px] font-medium text-gray-500">
                    <span className="flex items-center gap-1">
                      ⏰ {t.due || "No specific deadline"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditTask(t)}
                        className="p-1.5 hover:bg-gray-100 text-[#4B5E40] rounded-lg transition"
                        title="Edit Task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(state.tasks || []).length === 0 && (
                <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-gray-250 text-gray-400">
                  No default tasks found. Click "Add New Default Task" to create
                  one.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {adminTab === "microservices_config" && (
        <div
          className="space-y-6 animate-fade-in"
          id="microservices-config-tab-root"
        >
          <div className="bg-white p-5 rounded-xl border border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
                🔌 Dashboard Microservices Configurations
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage the active modules and links rendered on student hub
                grids.
              </p>
            </div>
            {editingMicroserviceId === null && (
              <button
                onClick={startAddMs}
                className="px-4 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Microservice
              </button>
            )}
          </div>

          {editingMicroserviceId !== null ? (
            <form
              onSubmit={handleSaveMicroservice}
              className="bg-white p-6 rounded-xl border border-gray-150 space-y-4 max-w-2xl mx-auto animate-fade-in"
            >
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-gray-500">
                {editingMicroserviceId === "new"
                  ? "➕ Create Dashboard Microservice"
                  : "✏️ Edit Dashboard Microservice"}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Microservice Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekly Drills"
                    value={msEditorTitle}
                    onChange={(e) => setMsEditorTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Link Text Action
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Learn Skills"
                    value={msEditorLinkText}
                    onChange={(e) => setMsEditorLinkText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700">
                  Short Description
                </label>
                <textarea
                  placeholder="Explain microservice scope..."
                  value={msEditorDesc}
                  onChange={(e) => setMsEditorDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Target Tab
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. microservices"
                    value={msEditorTab}
                    onChange={(e) => setMsEditorTab(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Target Sub-Tab (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. drills"
                    value={msEditorSubTab}
                    onChange={(e) => setMsEditorSubTab(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Lucide Icon name
                  </label>
                  <select
                    value={msEditorIcon}
                    onChange={(e) => setMsEditorIcon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                  >
                    <option value="Award">Award</option>
                    <option value="BookOpen">BookOpen</option>
                    <option value="Users">Users</option>
                    <option value="Calendar">Calendar</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Compass">Compass</option>
                    <option value="Sparkles">Sparkles</option>
                    <option value="Settings">Settings</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingMicroserviceId(null)}
                  className="px-4 py-2 border border-gray-250 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(state.microservices || []).map((ms) => (
                <div
                  key={ms.id}
                  className="bg-white p-5 rounded-xl border border-gray-150 flex flex-col justify-between space-y-4 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        {ms.icon === "BookOpen" && (
                          <BookOpen className="w-4 h-4" />
                        )}
                        {ms.icon === "Award" && <Award className="w-4 h-4" />}
                        {ms.icon === "Users" && <Users className="w-4 h-4" />}
                        {ms.icon === "Calendar" && (
                          <Calendar className="w-4 h-4" />
                        )}
                        {ms.icon === "Laptop" && <Laptop className="w-4 h-4" />}
                        {ms.icon === "Compass" && (
                          <Compass className="w-4 h-4" />
                        )}
                        {ms.icon === "Sparkles" && (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {ms.icon === "Settings" && (
                          <Settings className="w-4 h-4" />
                        )}
                        {![
                          "BookOpen",
                          "Award",
                          "Users",
                          "Calendar",
                          "Laptop",
                          "Compass",
                          "Sparkles",
                          "Settings",
                        ].includes(ms.icon) && <Settings className="w-4 h-4" />}
                      </div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-gray-950 font-sans">
                        {ms.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-gray-650 leading-relaxed font-medium">
                      {ms.description}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      <span>Tab: {ms.tab}</span>
                      {ms.subTab && (
                        <>
                          <span>•</span>
                          <span>Sub: {ms.subTab}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[11px] font-bold">
                    <span className="text-[#4B5E40] hover:underline">
                      {ms.linkText || "Click to Enter"} &rarr;
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditMs(ms)}
                        className="p-1.5 hover:bg-gray-100 text-[#4B5E40] rounded-lg transition"
                        title="Edit Microservice"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMicroservice(ms.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                        title="Delete Microservice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(state.microservices || []).length === 0 && (
                <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-gray-250 text-gray-400">
                  No dashboard microservices configured. Click "Add New
                  Microservice" to create one.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {adminTab === "pathways_config" && (
        <div
          className="space-y-6 animate-fade-in"
          id="pathways-config-tab-root"
        >
          <div className="bg-white p-5 rounded-xl border border-gray-150">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
              🎓 Career Pathways Step Configurations
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Edit the three structured career pathways presented to students on
              their pathway milestones page.
            </p>
          </div>

          {editingPathwaySection !== null ? (
            <form
              onSubmit={handleSavePathwayStep}
              className="bg-white p-6 rounded-xl border border-gray-150 space-y-4 max-w-2xl mx-auto animate-fade-in"
            >
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-[#4B5E40]">
                {editingPathwayIndex === -1
                  ? `➕ Add Step to: ${editingPathwaySection}`
                  : `✏️ Edit Step in: ${editingPathwaySection}`}
              </h4>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700">
                  Step Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High-Accountability Mock Interviews"
                  value={pathwayEditorTitle}
                  onChange={(e) => setPathwayEditorTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700">
                  Step Description
                </label>
                <textarea
                  placeholder="Describe step requirements and value delivered..."
                  value={pathwayEditorDesc}
                  onChange={(e) => setPathwayEditorDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-250 rounded-xl text-xs focus:ring-1 focus:ring-[#4B5E40] focus:outline-none bg-white text-gray-800"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPathwaySection(null);
                    setEditingPathwayIndex(null);
                  }}
                  className="px-4 py-2 border border-gray-250 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                >
                  Save Pathway Step
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Foundation Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="font-extrabold text-xs sm:text-sm text-[#4B5E40] uppercase tracking-wider">
                    🌱 Foundation Section
                  </h4>
                  <button
                    onClick={() => startEditPathway("foundation", -1)}
                    className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-md transition"
                    title="Add Step"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {(state.careerPathways?.foundation || []).map(
                    (step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1 relative group"
                      >
                        <div className="text-xs font-extrabold text-gray-900 pr-10">
                          {step.title}
                        </div>
                        <div className="text-[10px] text-gray-500 leading-normal">
                          {step.description}
                        </div>
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white rounded-md border border-gray-200 shadow-sm p-0.5">
                          <button
                            onClick={() =>
                              startEditPathway("foundation", idx, step)
                            }
                            className="p-1 hover:bg-gray-100 text-[#4B5E40] rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeletePathwayStep("foundation", idx)
                            }
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                  {(state.careerPathways?.foundation || []).length === 0 && (
                    <div className="text-center py-6 text-[10px] text-gray-400">
                      No foundation steps. Click (+) to add.
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Split Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="font-extrabold text-xs sm:text-sm text-[#4B5E40] uppercase tracking-wider">
                    ⚙️ Technical Split
                  </h4>
                  <button
                    onClick={() => startEditPathway("trackSplit", -1)}
                    className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-md transition"
                    title="Add Step"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {(state.careerPathways?.trackSplit || []).map(
                    (step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1 relative group"
                      >
                        <div className="text-xs font-extrabold text-gray-900 pr-10">
                          {step.title}
                        </div>
                        <div className="text-[10px] text-gray-500 leading-normal">
                          {step.description}
                        </div>
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white rounded-md border border-gray-200 shadow-sm p-0.5">
                          <button
                            onClick={() =>
                              startEditPathway("trackSplit", idx, step)
                            }
                            className="p-1 hover:bg-gray-100 text-[#4B5E40] rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeletePathwayStep("trackSplit", idx)
                            }
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                  {(state.careerPathways?.trackSplit || []).length === 0 && (
                    <div className="text-center py-6 text-[10px] text-gray-400">
                      No technical steps. Click (+) to add.
                    </div>
                  )}
                </div>
              </div>

              {/* Lateral Roles Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="font-extrabold text-xs sm:text-sm text-[#4B5E40] uppercase tracking-wider">
                    🚀 Lateral Roles
                  </h4>
                  <button
                    onClick={() => startEditPathway("lateralRoles", -1)}
                    className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-md transition"
                    title="Add Step"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {(state.careerPathways?.lateralRoles || []).map(
                    (step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1 relative group"
                      >
                        <div className="text-xs font-extrabold text-gray-900 pr-10">
                          {step.title}
                        </div>
                        <div className="text-[10px] text-gray-500 leading-normal">
                          {step.description}
                        </div>
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white rounded-md border border-gray-200 shadow-sm p-0.5">
                          <button
                            onClick={() =>
                              startEditPathway("lateralRoles", idx, step)
                            }
                            className="p-1 hover:bg-gray-100 text-[#4B5E40] rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeletePathwayStep("lateralRoles", idx)
                            }
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                  {(state.careerPathways?.lateralRoles || []).length === 0 && (
                    <div className="text-center py-6 text-[10px] text-gray-400">
                      No lateral/other roles steps. Click (+) to add.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. MICROSERVICE OWNERS TAB */}
      {adminTab === "owners" && (
        <div className="space-y-6 animate-fade-in" id="owners-tab-root">
          <div className="bg-white p-5 rounded-xl border border-gray-150">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
              👥 Microservice Owners
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Assign an owner to each microservice. Owners get specialized
              dashboard visibility and management controls.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-150 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-150 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                    <th className="p-3.5 pl-5">Microservice</th>
                    <th className="p-3.5">Assigned Owner</th>
                    <th className="p-3.5">New Assignment</th>
                    <th className="p-3.5 pr-5 text-right font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {[
                    { id: "kd", name: "Knowledge Development" },
                    { id: "pd", name: "Personal Development" },
                    { id: "wd", name: "Weekly Drills" },
                    { id: "standups", name: "Daily Standups" },
                    { id: "tech_update", name: "Tech Update" },
                    { id: "ke", name: "Knowledge Exchange" },
                    { id: "social_influence", name: "Social Influence" },
                    { id: "social_engagement", name: "Social Engagement" },
                    { id: "external_events", name: "External Events" },
                  ].map((service) => {
                    const currentOwnerId =
                      state.microserviceOwners?.[service.id];
                    const currentOwner = state.profiles.find(
                      (p) => p.id === currentOwnerId,
                    );
                    const selectedValue =
                      selectedOwners[service.id] || currentOwnerId || "";

                    return (
                      <tr key={service.id} className="hover:bg-gray-50/50">
                        <td className="p-3.5 pl-5 font-bold text-gray-900">
                          {service.name}
                        </td>
                        <td className="p-3.5">
                          {currentOwner ? (
                            <span className="p-1 px-2.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]/none">
                              {currentOwner.fullName}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic font-medium">
                              Not Assigned
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <select
                            value={selectedValue}
                            onChange={(e) =>
                              setSelectedOwners((prev) => ({
                                ...prev,
                                [service.id]: e.target.value,
                              }))
                            }
                            className="p-1.5 text-xs bg-gray-50 rounded-lg border border-gray-200 text-gray-700 min-w-[220px] outline-none cursor-pointer"
                          >
                            <option value="">Select owner...</option>
                            {state.profiles
                              .filter(
                                (p) =>
                                  p.role === "admin" ||
                                  p.learningLevel?.toLowerCase() === "admin" ||
                                  p.learningLevel?.toLowerCase() === "mentor" ||
                                  p.learningLevel?.toLowerCase() ===
                                    "administrative mentor",
                              )
                              .map((admin) => (
                                <option key={admin.id} value={admin.id}>
                                  {admin.fullName} ({admin.email})
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <button
                            onClick={async () => {
                              const targetOwner =
                                selectedOwners[service.id] || "";
                              try {
                                await assignMicroserviceOwner(
                                  service.id,
                                  targetOwner,
                                );

                                triggerSuccess(
                                  `Assigned owner to "${service.name}" successfully!`,
                                );
                                onStateUpdate();
                              } catch (e: any) {
                                triggerError(
                                  "Error routing assignment: " + e.message,
                                );
                              }
                            }}
                            className="p-1 px-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white font-bold rounded text-[10px] uppercase transition cursor-pointer"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. USER LEVEL MANAGEMENT TAB */}
      {adminTab === "levels" && (
        <div className="space-y-6 animate-fade-in" id="levels-tab-root">
          <div className="bg-white p-5 rounded-xl border border-gray-150">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
              📈 User Level Management
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Change user learning levels. Users will be notified on their
              dashboard and appropriate features will adjust automatically.
            </p>

            <div className="mt-4 flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-150">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name, email, or track..."
                value={levelSearch}
                onChange={(e) => setLevelSearch(e.target.value)}
                className="bg-transparent border-none text-xs text-gray-800 outline-none w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.profiles
              .filter((p) => {
                const q = levelSearch.toLowerCase();
                return (
                  p.fullName.toLowerCase().includes(q) ||
                  p.email.toLowerCase().includes(q) ||
                  p.track.toLowerCase().includes(q)
                );
              })
              .map((p) => {
                const selectedLevel =
                  selectedUserLevels[p.id] ||
                  p.learningLevel ||
                  "Apprentice level 1";
                return (
                  <div
                    key={p.id}
                    className="bg-white p-4 rounded-xl border border-gray-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-extrabold text-xs text-gray-900">
                        {p.fullName}
                      </p>
                      <p className="text-[10px] text-gray-555 whitespace-nowrap">
                        {p.email}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="p-0.5 px-1.5 bg-gray-100 text-gray-600 font-bold rounded-full text-[9px]/tight uppercase">
                          {p.role}
                        </span>
                        <span className="p-0.5 px-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-full text-[9px]/tight">
                          {p.track}
                        </span>
                        <span className="p-0.5 px-1.5 bg-amber-50 text-amber-700 font-bold rounded-full text-[9px]/tight">
                          {p.learningLevel || "Apprentice level 1"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedLevel}
                        onChange={(e) =>
                          setSelectedUserLevels((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        className="p-1 px-2 text-xs bg-gray-50 rounded-lg border border-gray-200 text-gray-700 outline-none cursor-pointer"
                      >
                        {LEVELS_OPTIONS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleChangeLevel(p.id, selectedLevel)}
                        className="p-1 px-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white font-bold rounded text-[10px] uppercase transition cursor-pointer"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 3. KD ALIGNMENT ASSIGNMENT DESK */}
      {adminTab === "kd_desk" && (
        <div className="space-y-6 animate-fade-in" id="kd-desk-tab-root">
          <KnowledgeDevelopmentInfoView
            profile={adminProfile}
            kdInfo={state.kdInfo}
            presentations={state.kdPresentations}
            meetings={state.meetings}
            attendance={state.attendance}
            microserviceOwners={state.microserviceOwners}
            profiles={state.profiles}
            onStateUpdate={onStateUpdate}
          />
          <div className="bg-white p-5 rounded-xl border border-gray-150">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5 animate-fade-in">
              <BookOpen className="w-4 h-4 text-[#4B5E40]" /> KD Alignment
              Assignment Desk
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5 animate-fade-in">
              Manually set or adjust students' monthly Knowledge Development
              (KD) sync attendance logs. Submissions update student dashboards
              instantly.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
              <div className="flex items-center gap-2 bg-gray-55 p-2 rounded-lg border border-gray-150">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search student name..."
                  value={kdSearch || ""}
                  onChange={(e) => setKdSearch(e.target.value)}
                  className="bg-transparent border-none text-xs text-gray-800 outline-none w-full"
                />
              </div>

              <select
                value={kdTrackFilter}
                onChange={(e) => setKdTrackFilter(e.target.value)}
                className="p-2 text-xs bg-gray-55 rounded-lg border border-gray-150 text-gray-700 outline-none cursor-pointer font-medium"
              >
                <option value="all">All Tracks</option>
                {Array.from(new Set(state.profiles.map((p: any) => p.track)))
                  .filter(Boolean)
                  .map((trackName: any) => (
                    <option key={trackName} value={trackName}>
                      {trackName}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-150 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-55 border-b border-gray-150 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                    <th className="p-3.5 pl-5">Student</th>
                    <th className="p-3.5">Assigned Track & Level</th>
                    <th className="p-3.5 text-center">Active KD Count</th>
                    <th className="p-3.5">New KD Count Assignment</th>
                    <th className="p-3.5 pr-5 text-right font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
                  {state.profiles
                    .filter((p: any) => {
                      const q = kdSearch.toLowerCase();
                      const matchSearch =
                        p.fullName.toLowerCase().includes(q) ||
                        p.email.toLowerCase().includes(q) ||
                        p.username.toLowerCase().includes(q);
                      const matchTrack =
                        kdTrackFilter === "all" || p.track === kdTrackFilter;
                      return matchSearch && matchTrack && p.role !== "admin";
                    })
                    .map((p: any) => {
                      const currentCount = state.kdCounts?.[p.id] || 0;
                      const selectedCountVal =
                        kdEdits[p.id] !== undefined
                          ? kdEdits[p.id]
                          : String(currentCount);

                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="p-3.5 pl-5">
                            <p className="font-extrabold text-[#4B5E40]">
                              {p.fullName}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {p.email}
                            </p>
                          </td>
                          <td className="p-3.5">
                            <span className="p-0.5 px-2 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px]/none mr-1">
                              {p.track?.split(" ")[0]}
                            </span>
                            <span className="p-0.5 px-2 bg-amber-50 text-amber-700 font-bold rounded text-[10px]/none">
                              {p.learningLevel || "Apprentice level 1"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`p-1 px-3 rounded-full font-bold text-xs ${
                                currentCount >= 16
                                  ? "bg-emerald-100 text-emerald-850 border border-emerald-250 animate-pulse"
                                  : "bg-gray-100 text-gray-750"
                              }`}
                            >
                              {currentCount} / 16
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={selectedCountVal}
                                onChange={(e) =>
                                  setKdEdits((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                className="w-16 p-1 text-center bg-gray-50 rounded border border-gray-200 text-xs text-gray-800 font-bold outline-none"
                              />
                              <span className="text-[10px] text-gray-400 shrink-0">
                                sessions
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                            <button
                              disabled={loading}
                              onClick={async () => {
                                const targetCount = parseInt(
                                  selectedCountVal,
                                  10,
                                );
                                if (isNaN(targetCount) || targetCount < 0) {
                                  setErrorMsg(
                                    "Invalid KD count value entered.",
                                  );
                                  return;
                                }
                                try {
                                  setLoading(true);
                                  setErrorMsg("");
                                  setSuccessMsg("");
                                  await assignKDCount(p.id, targetCount);

                                  setSuccessMsg(
                                    `Successfully assigned ${targetCount} Knowledge Development logs to "${p.fullName}"!`,
                                  );
                                  onStateUpdate();
                                } catch (e: any) {
                                  setErrorMsg(
                                    "Error assigning KD sync count: " +
                                      e.message,
                                  );
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="p-1 px-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:bg-gray-300 text-white font-bold rounded text-[10px] uppercase transition cursor-pointer"
                            >
                              Assign KD
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. PERSONAL DEVELOPMENT OWNER DASHBOARD */}
      {adminTab === "pd_desk" && (
        <div className="space-y-6 animate-fade-in" id="pd-desk-tab-root">
          <div className="bg-white p-5 rounded-xl border border-gray-150">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
              <FileEdit className="w-4 h-4 text-[#4B5E40]" /> Personal
              Development Summaries Ledger
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Review daily personal development log submissions. By default
              lists students under your pathway track.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
              <div className="flex items-center gap-2 bg-gray-55 p-2 rounded-lg border border-gray-150">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search student or keywords..."
                  value={pdSearch || ""}
                  onChange={(e) => setPdSearch(e.target.value)}
                  className="bg-transparent border-none text-xs text-gray-800 outline-none w-full"
                />
              </div>

              <select
                value={pdTrackFilter}
                onChange={(e) => setPdTrackFilter(e.target.value)}
                className="p-2 text-xs bg-gray-55 rounded-lg border border-gray-150 text-gray-700 outline-none cursor-pointer font-medium"
              >
                <option value="all">All Pathways (Show All)</option>
                {Array.from(new Set(state.profiles.map((p: any) => p.track)))
                  .filter(Boolean)
                  .map((trackName: any) => (
                    <option key={trackName} value={trackName}>
                      {trackName}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-150 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-55 border-b border-gray-150 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                    <th className="p-3.5 pl-5 w-1/4">Student & Track</th>
                    <th className="p-3.5 w-1/6">Date</th>
                    <th className="p-3.5 w-1/2">take-away Learning Summary</th>
                    <th className="p-3.5 pr-5 text-right w-1/12 font-medium">
                      Verify
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
                  {(state.personalDevelopment || [])
                    .filter((pd: any) => {
                      const q = pdSearch.toLowerCase();
                      const matchSearch =
                        pd.fullName.toLowerCase().includes(q) ||
                        pd.summary.toLowerCase().includes(q);

                      const adminTrack = adminProfile?.track || "All";
                      const effectiveTrackFilter =
                        pdTrackFilter !== "all"
                          ? pdTrackFilter
                          : adminTrack !== "All"
                            ? adminTrack
                            : "all";
                      const matchTrack =
                        effectiveTrackFilter === "all" ||
                        pd.track === effectiveTrackFilter;

                      return matchSearch && matchTrack;
                    })
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime(),
                    )
                    .map((pd: any) => (
                      <tr key={pd.id} className="hover:bg-gray-50/50 align-top">
                        <td className="p-3.5 pl-5">
                          <p className="font-extrabold text-gray-900">
                            {pd.fullName}
                          </p>
                          <p className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block mt-1">
                            {pd.track?.split(" ")[0]}
                          </p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-gray-750">{pd.date}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {new Date(pd.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </td>
                        <td className="p-3.5 text-gray-700 italic leading-relaxed pr-6 whitespace-pre-line font-medium">
                          {pd.summary}
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[9px]/none font-black text-emerald-800 bg-emerald-100/75 p-1 px-2 rounded-full font-mono">
                              Word Count:{" "}
                              {pd.summary.trim().split(/\s+/).length} words
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 pr-5 text-right font-bold text-emerald-700 text-[10px] uppercase">
                          Authenticated
                        </td>
                      </tr>
                    ))}
                  {(!state.personalDevelopment ||
                    state.personalDevelopment.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-xs text-gray-400 font-medium italic"
                      >
                        No Personal Development summaries matching current
                        filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. DAILY STANDUPS MONITOR TAB */}
      {adminTab === "standup_desk" && (
        <div className="space-y-6 animate-fade-in" id="standup-desk-tab-root">
          <div className="bg-white p-5 rounded-xl border border-gray-150">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#4B5E40]" /> Student
              Accountability Standups Desk
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Monitor daily morning goals and evening achievements submitted by
              students. Verifies live accountability progress and
              synchronization.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
              <div className="flex items-center gap-2 bg-gray-55 p-2 rounded-lg border border-gray-150">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search student or standup notes..."
                  value={standupSearch || ""}
                  onChange={(e) => setStandupSearch(e.target.value)}
                  className="bg-transparent border-none text-xs text-gray-800 outline-none w-full"
                />
              </div>

              <select
                value={standupTrackFilter}
                onChange={(e) => setStandupTrackFilter(e.target.value)}
                className="p-2 text-xs bg-gray-55 rounded-lg border border-gray-150 text-gray-700 outline-none cursor-pointer font-medium"
              >
                <option value="all">All Pathways (Show All)</option>
                {Array.from(new Set(state.profiles.map((p: any) => p.track)))
                  .filter(Boolean)
                  .map((trackName: any) => (
                    <option key={trackName} value={trackName}>
                      {trackName}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-150 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-55 border-b border-gray-150 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                    <th className="p-3.5 pl-5">Student name & Track</th>
                    <th className="p-3.5">Date Submitted</th>
                    <th className="p-3.5">
                      ☀️ Morning Accountability Goals (09:45)
                    </th>
                    <th className="p-3.5">
                      🌙 Evening Achievements summary (17:00)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
                  {(state.standups || [])
                    .filter((st: any) => {
                      const q = standupSearch.toLowerCase();
                      const matchSearch =
                        st.fullName.toLowerCase().includes(q) ||
                        (st.morningGoals || "").toLowerCase().includes(q) ||
                        (st.eveningAchievements || "")
                          .toLowerCase()
                          .includes(q);

                      const adminTrack = adminProfile?.track || "All";
                      const effectiveTrackFilter =
                        standupTrackFilter !== "all"
                          ? standupTrackFilter
                          : adminTrack !== "All"
                            ? adminTrack
                            : "all";
                      const matchTrack =
                        effectiveTrackFilter === "all" ||
                        st.track === effectiveTrackFilter;

                      return matchSearch && matchTrack;
                    })
                    .sort((a: any, b: any) => b.date.localeCompare(a.date))
                    .map((st: any) => (
                      <tr key={st.id} className="hover:bg-gray-50/50 align-top">
                        <td className="p-3.5 pl-5">
                          <p className="font-extrabold text-[#4B5E40]">
                            {st.fullName}
                          </p>
                          <p className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block mt-1">
                            {st.track?.split(" ")[0]}
                          </p>
                        </td>
                        <td className="p-3.5 font-bold text-gray-750">
                          {st.date}
                        </td>
                        <td className="p-3.5 max-w-sm">
                          {st.morningGoals ? (
                            <div className="space-y-1">
                              <p className="text-gray-750 leading-relaxed italic">
                                {st.morningGoals}
                              </p>
                              {st.morningTime && (
                                <p className="text-[10px] text-emerald-800 font-mono">
                                  Logged: {st.morningTime}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">
                              Not submitted
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 max-w-sm">
                          {st.eveningAchievements ? (
                            <div className="space-y-1">
                              <p className="text-gray-750 leading-relaxed italic">
                                {st.eveningAchievements}
                              </p>
                              {st.eveningTime && (
                                <p className="text-[10px] text-amber-800 font-mono">
                                  Logged: {st.eveningTime}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-450 italic">
                              Not submitted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  {(!state.standups || state.standups.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-xs text-gray-400 font-medium italic"
                      >
                        No Daily Standups submitted matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MENU VIEWPORTS --- */}

      {/* A. OPERATIONS FUNNEL & ANALYTICS MONITORING (Section 4.1) */}
      {adminTab === "funnel" && (
        <div className="space-y-6 animate-fade-in" id="funnel-tab-root">
          {/* Funnel Filtering Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-150">
            <div>
              <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1.5">
                <BarChart4 className="w-4 h-4 text-[#4B5E40]" /> Operations
                Dashboard Metrics
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Filter key metrics and placement tracking by knowledge pathway.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-gray-400" /> Pathway:
              </span>
              <select
                id="funnel-track-select"
                value={funnelTrackFilter}
                onChange={(e) => setFunnelTrackFilter(e.target.value)}
                className="p-1.5 px-3 text-xs font-semibold bg-gray-50 rounded-lg border border-gray-200 text-gray-700 min-w-[200px] outline-none focus:border-[#4B5E40] cursor-pointer"
              >
                <option value="all">All Tracks Combined</option>
                {uniqueTracksForDropdown.map((track) => (
                  <option key={track} value={track}>
                    {track}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Key Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-150 text-center">
              <span className="block text-2xl font-black text-gray-900">
                {stepOnboarding}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                Total Student Sign-ups
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-150 text-center">
              <span className="block text-2xl font-black text-[#4B5E40]">
                {passRate}%
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                Assessment Pass Rate
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-150 text-center">
              <span className="block text-2xl font-black text-indigo-600">
                {averageAssessmentScore}%
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                Average Evaluation Score
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-150 text-center">
              <span className="block text-2xl font-black text-emerald-600">
                {stepDashboardActive}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                Fully Active in Dashboard
              </span>
            </div>
          </div>

          {/* Graphical Conversion Funnel Progress Bars (Section 4.1) */}
          <div
            className="bg-white rounded-2xl border border-gray-150 p-6 space-y-6"
            id="conversion-funnel-card"
          >
            <div>
              <h3 className="font-extrabold text-sm text-gray-950 sm:text-base leading-snug">
                Student Operations Progression Funnel
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tracks student transitions from initial Sign In records to fully
                compliant daily tracker operation dashboard.
              </p>
            </div>

            <div className="space-y-4">
              {/* Funnel Stage 1: Registered */}
              <div>
                <div className="flex justify-between text-xs text-gray-700 font-semibold mb-1">
                  <span>Stage 1: Signed In & Profiled</span>
                  <span>
                    {stepOnboarding} Candidates (
                    {stepOnboarding > 0 ? "100" : "0"}%)
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-lg select-none border">
                  <div
                    className="h-full bg-slate-550 bg-[#4B5E40] rounded-lg transition-all"
                    style={{ width: stepOnboarding > 0 ? "100%" : "0%" }}
                  ></div>
                </div>
              </div>

              {/* Funnel Stage 2: Passed Assessments */}
              <div>
                <div className="flex justify-between text-xs text-gray-700 font-semibold mb-1">
                  <span>Stage 2: Technical Assessment Passed</span>
                  <span>
                    {stepAssessmentPassed} Students (
                    {stepOnboarding > 0
                      ? Math.round(
                          (stepAssessmentPassed / stepOnboarding) * 100,
                        )
                      : 0}
                    %)
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-lg select-none border">
                  <div
                    className="h-full bg-emerald-550 bg-emerald-600 rounded-lg transition-all"
                    style={{
                      width:
                        stepOnboarding > 0
                          ? `${(stepAssessmentPassed / stepOnboarding) * 100}%`
                          : "0%",
                    }}
                  ></div>
                </div>
              </div>

              {/* Funnel Stage 3: Oriented */}
              <div>
                <div className="flex justify-between text-xs text-gray-700 font-semibold mb-1">
                  <span>Stage 3: Orientation Briefing Cleared</span>
                  <span>
                    {stepOriented} Students (
                    {stepOnboarding > 0
                      ? Math.round((stepOriented / stepOnboarding) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-lg select-none border">
                  <div
                    className="h-full bg-indigo-550 bg-indigo-600 rounded-lg transition-all"
                    style={{
                      width:
                        stepOnboarding > 0
                          ? `${(stepOriented / stepOnboarding) * 100}%`
                          : "0%",
                    }}
                  ></div>
                </div>
              </div>

              {/* Funnel Stage 4: Dashboard Active */}
              <div>
                <div className="flex justify-between text-xs text-gray-700 font-semibold mb-1">
                  <span>Stage 4: Workspace Dashboard Active</span>
                  <span>
                    {stepDashboardActive} Students (
                    {stepOnboarding > 0
                      ? Math.round((stepDashboardActive / stepOnboarding) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-lg select-none border">
                  <div
                    className="h-full bg-pink-550 bg-pink-600 rounded-lg transition-all"
                    style={{
                      width:
                        stepOnboarding > 0
                          ? `${(stepDashboardActive / stepOnboarding) * 100}%`
                          : "0%",
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B. STUDENT PLACEMENT REVIEWS AUDITING (Section 4.1) */}
      {adminTab === "reviews" && (
        <div
          className="bg-white rounded-2xl border border-gray-150 p-5 space-y-4 animate-fade-in"
          id="reviews-tab-root"
        >
          <div className="border-b border-gray-100 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 leading-normal flex items-center gap-2">
                <span>Onboarding Placement & Validation Reviews</span>
                {pendingValidationCount > 0 && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-white font-extrabold text-[10px] rounded-full animate-pulse shadow-2xs">
                    {pendingValidationCount} Awaiting Review
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Review newly registered users awaiting validation, verify
                onboarding submissions and assessment results, and clear
                candidates for placement.
              </p>
            </div>
          </div>

          {/* Quick Filter Tab Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50/80 p-2.5 rounded-xl border border-gray-150">
            <button
              onClick={() => setReviewStatusFilter("pending_validation")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                reviewStatusFilter === "pending_validation"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-50 text-amber-900 border border-amber-250 hover:bg-amber-100"
              }`}
            >
              <span>⌛ Awaiting Validation ({pendingValidationCount})</span>
            </button>

            <button
              onClick={() => setReviewStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                reviewStatusFilter === "all"
                  ? "bg-[#4B5E40] text-white shadow-xs"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span>👥 All Candidates ({allCandidatesCount})</span>
            </button>

            <button
              onClick={() => setReviewStatusFilter("onboarding")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                reviewStatusFilter === "onboarding"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-650 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              Stage 1: Onboarding ({onboardingCount})
            </button>

            <button
              onClick={() => setReviewStatusFilter("assessment_passed")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                reviewStatusFilter === "assessment_passed"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-650 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              Stage 2: Passed ({assessmentPassedCount})
            </button>

            <button
              onClick={() => setReviewStatusFilter("assessment_failed")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                reviewStatusFilter === "assessment_failed"
                  ? "bg-rose-600 text-white"
                  : "bg-white text-gray-650 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              Stage 2: Failed ({assessmentFailedCount})
            </button>

            <button
              onClick={() => setReviewStatusFilter("oriented")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                reviewStatusFilter === "oriented"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-650 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              Stage 3: Oriented ({orientedCount})
            </button>

            <button
              onClick={() => setReviewStatusFilter("dashboard")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                reviewStatusFilter === "dashboard"
                  ? "bg-teal-600 text-white"
                  : "bg-white text-gray-650 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              Stage 4: Active ({activeDashboardCount})
            </button>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-150">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates Name/@user/Email..."
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-lg border border-gray-200 outline-none focus:border-[#4B5E40]"
              />
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                Status:
              </span>
              <select
                value={reviewStatusFilter}
                onChange={(e) => setReviewStatusFilter(e.target.value)}
                className="w-full p-1.5 text-xs bg-white rounded-lg border border-gray-200 outline-none focus:border-[#4B5E40] cursor-pointer font-semibold text-gray-750"
              >
                <option value="pending_validation">
                  ⌛ Newly Registered / Awaiting Validation
                </option>
                <option value="all">👥 All Candidate States</option>
                <option value="onboarding">
                  Stage 1: Onboarding / Profiling
                </option>
                <option value="assessment_passed">
                  Stage 2: Passed (Unlock Orientation)
                </option>
                <option value="assessment_failed">
                  Stage 2: Failed (Requires Pivot)
                </option>
                <option value="oriented">
                  Stage 3: Oriented (Ready for Active)
                </option>
                <option value="dashboard">
                  Stage 4: Active in Workspace Dashboard
                </option>
              </select>
            </div>

            {/* Track Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                Track:
              </span>
              <select
                value={reviewTrackFilter}
                onChange={(e) => setReviewTrackFilter(e.target.value)}
                className="w-full p-1.5 text-xs bg-white rounded-lg border border-gray-200 outline-none focus:border-[#4B5E40] cursor-pointer font-semibold text-gray-750"
              >
                <option value="all">All Knowledge Tracks</option>
                {uniqueTracksForDropdown.map((track) => (
                  <option key={track} value={track}>
                    {track}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredUsersForReviews.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs font-semibold bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              No registered students match your current filter or search
              criteria.
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredUsersForReviews.map((student) => {
                const isPending = [
                  "onboarding",
                  "assessment_failed",
                  "assessment_passed",
                  "oriented",
                ].includes(student.status);
                const isExpanded = expandedReviewStudentId === student.id;

                // Get onboarding submissions for this student
                const studentOnboardingSubs = (
                  state.onboardingSubmissions || []
                ).filter(
                  (sub: any) =>
                    sub.userId === student.id ||
                    (sub.email &&
                      sub.email.toLowerCase() ===
                        (student.email || "").toLowerCase()),
                );
                const latestOnboarding = studentOnboardingSubs.sort(
                  (a: any, b: any) =>
                    new Date(b.timestamp || 0).getTime() -
                    new Date(a.timestamp || 0).getTime(),
                )[0];

                // Get assessment attempts for this student
                const studentAttempts = (state.assessmentAttempts || []).filter(
                  (a: any) => a.userId === student.id,
                );
                const latestAttempt = studentAttempts
                  .slice()
                  .sort((a: any, b: any) =>
                    b.timestamp.localeCompare(a.timestamp),
                  )[0];

                return (
                  <div
                    key={student.id}
                    className={`p-4 border rounded-xl text-xs space-y-3 transition-all ${
                      isPending
                        ? "bg-amber-50/20 border-amber-250 border-l-4 border-l-amber-500 shadow-2xs"
                        : "bg-[#F8FAF8] border-gray-150"
                    }`}
                    id={`audit-card-${student.id}`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-gray-900 text-xs sm:text-sm leading-tight">
                            {student.fullName} (@{student.username})
                          </h4>
                          {isPending && (
                            <span className="px-2.5 py-0.5 bg-amber-500 text-white font-extrabold text-[9.5px] rounded-md tracking-wide flex items-center gap-1 shadow-2xs">
                              <span>⌛</span> AWAITING MENTOR VALIDATION
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-gray-500 font-mono mt-1">
                          Email:{" "}
                          <span className="font-semibold text-gray-700">
                            {student.email}
                          </span>{" "}
                          | Registered:{" "}
                          <span className="font-semibold text-gray-700">
                            {new Date(student.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[9px] uppercase tracking-wider border ${
                            student.status === "onboarding"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : student.status === "assessment_passed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : student.status === "assessment_failed"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : student.status === "oriented"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {student.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Grid: Profile, Knowledge Track, Assessment Score */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-gray-150 shadow-2xs">
                      <div>
                        <span className="block text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">
                          PROFILE DETAILS
                        </span>
                        <span className="font-bold text-gray-800 block truncate leading-relaxed mt-0.5">
                          {student.education || "Education: Unspecified"}
                        </span>
                        <span className="text-[10px] text-gray-500 block truncate">
                          {student.occupation || "Occupation: Unspecified"}
                        </span>
                        <span className="text-[9.5px] text-gray-400 block truncate italic font-mono mt-0.5">
                          Exp: {student.techExperience || "General IT"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">
                          SELECTED KNOWLEDGE TRACK
                        </span>
                        <span
                          className="font-extrabold block text-[#4B5E40] leading-relaxed mt-0.5 text-xs"
                          title={student.track}
                        >
                          🎯 {getCleanTrackName(student.track)}
                        </span>
                        <span className="text-[9.5px] text-gray-400 block truncate font-mono mt-0.5">
                          Full Track: {student.track}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">
                          ASSESSMENT SCORE
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span
                            className={`font-black text-sm ${
                              student.score === undefined
                                ? "text-gray-400"
                                : student.score >= 50
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                            }`}
                          >
                            {student.score !== undefined
                              ? `${student.score}%`
                              : "Not Taken"}
                          </span>
                          {studentAttempts.length > 0 && (
                            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded font-mono">
                              {studentAttempts.length}{" "}
                              {studentAttempts.length === 1
                                ? "attempt"
                                : "attempts"}
                            </span>
                          )}
                        </div>
                        {latestAttempt &&
                          latestAttempt.technicalScore !== undefined &&
                          latestAttempt.softSkillsScore !== undefined && (
                            <span className="block text-[9.5px] text-gray-500 font-mono mt-0.5">
                              Tech:{" "}
                              <strong className="text-gray-700">
                                {latestAttempt.technicalScore}%
                              </strong>{" "}
                              | Soft:{" "}
                              <strong className="text-gray-700">
                                {latestAttempt.softSkillsScore}%
                              </strong>
                            </span>
                          )}
                      </div>

                      <div>
                        <span className="block text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">
                          ASSIGNED LEVEL & TASKS
                        </span>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="font-extrabold text-[10.5px] text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded uppercase">
                            {student.learningLevel || "Apprentice level 1"}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 block mt-1 font-mono">
                          Tasks Assigned:{" "}
                          <strong className="text-gray-700">
                            {student.assignedTasks?.length || 0}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Toggle Expand Onboarding Answers & Assessment Breakdown */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white/80 p-2 px-3 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReviewStudentId(
                            isExpanded ? null : student.id,
                          )
                        }
                        className="text-xs font-bold text-[#4B5E40] hover:text-[#3d4d34] flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <span>📋</span>
                        <span>
                          {isExpanded
                            ? "Hide Onboarding Answers & Assessment Breakdown"
                            : "Review Onboarding Answers & Assessment Breakdown"}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      <span className="text-[10px] text-gray-400 font-mono">
                        {latestOnboarding
                          ? `Submitted Onboarding: ${new Date(latestOnboarding.timestamp).toLocaleDateString()}`
                          : "Form: Initial Profiling"}
                      </span>
                    </div>

                    {/* Expanded Onboarding Details */}
                    {isExpanded && (
                      <div className="animate-fade-in bg-white p-4 rounded-xl border border-gray-200 space-y-3 shadow-xs">
                        <h5 className="font-black text-xs text-gray-800 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                          <span>
                            Onboarding Profile & Assessment Audit Sheet
                          </span>
                          <span className="text-[10px] font-normal text-gray-400">
                            Candidate ID: {student.id}
                          </span>
                        </h5>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-150 space-y-1.5">
                            <span className="block text-[10px] font-black text-gray-500 uppercase">
                              Track Motivation & Background
                            </span>
                            <p className="text-gray-700 leading-snug">
                              <strong>Education Background:</strong>{" "}
                              {student.education ||
                                latestOnboarding?.education ||
                                "N/A"}
                            </p>
                            <p className="text-gray-700 leading-snug">
                              <strong>Current Occupation:</strong>{" "}
                              {student.occupation ||
                                latestOnboarding?.occupation ||
                                "N/A"}
                            </p>
                            <p className="text-gray-700 leading-snug">
                              <strong>Tech Stack Experience:</strong>{" "}
                              {student.techExperience ||
                                latestOnboarding?.techExperience ||
                                "N/A"}
                            </p>
                            {latestOnboarding?.courseCompleted && (
                              <p className="text-gray-700 leading-snug">
                                <strong>Previous Course Completed:</strong>{" "}
                                {latestOnboarding.courseCompleted}
                              </p>
                            )}
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-150 space-y-1.5">
                            <span className="block text-[10px] font-black text-gray-500 uppercase">
                              Assessment Attempts Trail
                            </span>
                            {studentAttempts.length === 0 ? (
                              <p className="text-gray-400 italic text-[11px]">
                                No assessment attempts recorded yet for this
                                user.
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {studentAttempts
                                  .slice()
                                  .sort((a: any, b: any) =>
                                    b.timestamp.localeCompare(a.timestamp),
                                  )
                                  .map((att: any) => (
                                    <div
                                      key={att.id}
                                      className="p-2 bg-white rounded border border-gray-200 text-[11px] flex justify-between items-center"
                                    >
                                      <div>
                                        <div className="font-bold text-gray-800">
                                          {att.track
                                            ? getCleanTrackName(att.track)
                                            : "Track Assessment"}
                                        </div>
                                        <div className="text-[9.5px] text-gray-400 font-mono">
                                          {new Date(
                                            att.timestamp,
                                          ).toLocaleString()}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span
                                          className={`px-2 py-0.5 rounded-full font-black text-[10px] ${att.score >= 50 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                                        >
                                          {att.score}%
                                        </span>
                                        {att.technicalScore !== undefined &&
                                          att.softSkillsScore !== undefined && (
                                            <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                                              T: {att.technicalScore}% | S:{" "}
                                              {att.softSkillsScore}%
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Assessment vs Track Placement Match Comparison Analysis */}
                        <div className="p-3 bg-[#F4F7F3] rounded-xl border border-[#D5E0D2] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-extrabold text-[#3a4a32] uppercase tracking-wider flex items-center gap-1.5">
                              <span>⚖️</span>
                              <span>Mentor Placement Alignment Analysis</span>
                            </span>
                            <span className="text-[10px] font-bold text-gray-500">
                              Selected Track:{" "}
                              <strong className="text-[#4B5E40]">
                                {getCleanTrackName(student.track)}
                              </strong>
                            </span>
                          </div>

                          <div className="text-xs text-gray-700 leading-relaxed font-medium">
                            {student.score === undefined ? (
                              <p className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px]">
                                ⚠️ <strong>Assessment Pending:</strong> Learner
                                has not taken the entry assessment for{" "}
                                <strong>
                                  {getCleanTrackName(student.track)}
                                </strong>
                                . Placement clearance requires test completion.
                              </p>
                            ) : student.score >= 70 ? (
                              <p className="text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-[11px]">
                                ✅{" "}
                                <strong>
                                  Optimal Track Match ({student.score}%):
                                </strong>{" "}
                                Excellent technical and soft skill score
                                alignment for the{" "}
                                <strong>
                                  {getCleanTrackName(student.track)}
                                </strong>{" "}
                                track. Recommended for immediate orientation
                                clearance.
                              </p>
                            ) : student.score >= 50 ? (
                              <p className="text-blue-900 bg-blue-50 p-2 rounded-lg border border-blue-200 text-[11px]">
                                ℹ️{" "}
                                <strong>
                                  Passable Track Match ({student.score}%):
                                </strong>{" "}
                                Candidate passed the baseline cutoff (50%) for{" "}
                                <strong>
                                  {getCleanTrackName(student.track)}
                                </strong>
                                . Additional foundation tasks may be assigned
                                upon orientation.
                              </p>
                            ) : (
                              <p className="text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200 text-[11px]">
                                🚨{" "}
                                <strong>
                                  Placement Gap ({student.score}%):
                                </strong>{" "}
                                Score is below the 50% pass mark for{" "}
                                <strong>
                                  {getCleanTrackName(student.track)}
                                </strong>
                                . Review background answers above and consider
                                using the <em>"Pivot Onboarding Track"</em>{" "}
                                control to reassign candidate to a foundation
                                track.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recorded Placement Confirmation Record Banner */}
                    {(student.placementConfirmed || student.validatedAt) && (
                      <div className="bg-emerald-50/90 border border-emerald-200 p-2.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-emerald-900 shadow-2xs font-sans">
                        <div className="flex items-center gap-2 font-bold">
                          <span className="text-emerald-600">🛡️</span>
                          <span>
                            Placement & Onboarding Confirmed by{" "}
                            <strong className="text-emerald-950">
                              {student.validatedBy || "Mentor/Admin"}
                            </strong>
                          </span>
                        </div>
                        <div className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md self-start sm:self-auto border border-emerald-200">
                          {student.validatedAt
                            ? new Date(student.validatedAt).toLocaleString()
                            : "Confirmed"}
                        </div>
                      </div>
                    )}

                    {/* Locked Dashboard Banner */}
                    {student.isLocked && (
                      <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs space-y-1 text-rose-900 shadow-2xs font-sans">
                        <div className="flex items-center justify-between font-extrabold">
                          <span className="flex items-center gap-1.5 text-rose-700">
                            <span>🔒</span> DASHBOARD ACCESS LOCKED
                          </span>
                          <span className="text-[10px] font-mono text-rose-600 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            {student.lockedAt
                              ? new Date(student.lockedAt).toLocaleString()
                              : "Recently"}
                          </span>
                        </div>
                        <p className="text-rose-950 font-bold bg-white/90 p-2 rounded-lg border border-rose-200">
                          Lock Reason: "
                          {student.lockReason ||
                            "Wrong knowledge track or validation failed."}
                          "
                        </p>
                        <div className="text-[10.5px] text-rose-800 font-mono">
                          Locked by:{" "}
                          <strong>{student.lockedBy || "Tech Mentor"}</strong>
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-bold">
                          Set Learning Level:
                        </span>
                        <select
                          value={student.learningLevel || "Apprentice level 1"}
                          onChange={(e) =>
                            handleChangeLevel(student.id, e.target.value)
                          }
                          className="bg-white border border-gray-200 text-[11px] rounded-lg px-2 py-1 outline-none text-gray-800 font-semibold cursor-pointer"
                        >
                          {LEVELS_OPTIONS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {student.isLocked ? (
                          <button
                            id={`auth-unlock-btn-${student.id}`}
                            onClick={() => handleUnlockStudent(student.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>🔓</span> Unlock Learner Dashboard
                          </button>
                        ) : (
                          <button
                            id={`auth-lock-btn-${student.id}`}
                            onClick={() => {
                              if (lockingStudentId === student.id) {
                                setLockingStudentId(null);
                                setLockReasonInput("");
                              } else {
                                setLockingStudentId(student.id);
                                setLockReasonInput("");
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-lg cursor-pointer flex items-center gap-1"
                          >
                            <span>🔒</span>{" "}
                            {lockingStudentId === student.id
                              ? "Cancel Lock"
                              : "Lock Dashboard"}
                          </button>
                        )}

                        {student.status === "assessment_passed" && (
                          <button
                            id={`auth-approve-btn-${student.id}`}
                            onClick={() =>
                              handleStudentAction(
                                student.id,
                                "Approve-Orientation",
                              )
                            }
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>✅</span> Validate & Unlock Orientation
                          </button>
                        )}

                        {student.status === "oriented" && (
                          <button
                            id={`auth-promote-btn-${student.id}`}
                            onClick={() =>
                              handleStudentAction(
                                student.id,
                                "Promote-Dashboard",
                              )
                            }
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>🚀</span> Validate & Promote to Workspace
                          </button>
                        )}

                        {student.status === "dashboard" && (
                          <button
                            id={`auth-confirm-dashboard-btn-${student.id}`}
                            onClick={() =>
                              handleStudentAction(student.id, "Confirm-Active")
                            }
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>✅</span> Confirm Placement & Keep Active
                          </button>
                        )}

                        {student.status === "assessment_failed" && (
                          <button
                            id={`auth-reset-btn-${student.id}`}
                            onClick={() =>
                              handleStudentAction(student.id, "Pivot-Track")
                            }
                            className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] rounded-lg cursor-pointer flex items-center gap-1"
                          >
                            <span>🔀</span> Pivot Onboarding Track
                          </button>
                        )}

                        {student.status === "onboarding" && (
                          <button
                            id={`auth-approve-onboarding-btn-${student.id}`}
                            onClick={() =>
                              handleStudentAction(
                                student.id,
                                "Approve-Orientation",
                              )
                            }
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>✅</span> Validate Onboarding Profile
                          </button>
                        )}

                        <button
                          id={`auth-onboard-btn-${student.id}`}
                          onClick={() =>
                            handleStudentAction(student.id, "Set-Onboarding")
                          }
                          disabled={student.status === "onboarding"}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-150 rounded-lg text-[11px] disabled:opacity-40 shrink-0 cursor-pointer"
                        >
                          Reset to Profiling Step
                        </button>
                      </div>
                    </div>

                    {/* Inline Lock Dashboard Form */}
                    {lockingStudentId === student.id && (
                      <div className="mt-3 bg-rose-50/90 border border-rose-200 p-3.5 rounded-xl space-y-2.5 animate-fade-in font-sans">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🔒</span> Lock Learner Dashboard Access
                          </span>
                          <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            Reason Required *
                          </span>
                        </div>

                        <p className="text-xs text-rose-900 leading-tight">
                          Locking immediately restricts{" "}
                          <strong>
                            {student.fullName || student.username}
                          </strong>
                          's access to workspace features until they correct
                          their onboarding details or knowledge track placement.
                        </p>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-rose-900 uppercase">
                            Reason for Lock (Required):
                          </label>
                          <textarea
                            value={lockReasonInput}
                            onChange={(e) => setLockReasonInput(e.target.value)}
                            placeholder="e.g. Placed in incorrect knowledge track (Front-End vs Mobile), or failed onboarding validation..."
                            className="w-full bg-white border border-rose-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:border-rose-500 h-18 resize-none text-gray-900 shadow-2xs"
                          />
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-500">
                            Quick Presets:
                          </span>
                          {[
                            "Placed in wrong knowledge track",
                            "Failed onboarding track validation",
                            "Requires track re-assessment",
                            "Incomplete prerequisite details",
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setLockReasonInput(preset)}
                              className="px-2 py-0.5 bg-white hover:bg-rose-100 text-rose-900 border border-rose-200 rounded text-[10px] font-semibold cursor-pointer transition"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setLockingStudentId(null);
                              setLockReasonInput("");
                            }}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-[11px] rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLockStudent(student.id)}
                            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] rounded-lg cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <span>🔒</span> Confirm & Lock Dashboard Access
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MEETINGS MANAGEMENT TAB */}
      {adminTab === "meetings" && (
        <div className="space-y-6 animate-fade-in" id="meetings-tab-root">
          <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-2.5 gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 leading-normal">
                  Interactive Meetings & Time Coordinator
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Directly schedule, update timings, edit Jitsi coordinate
                  links, or cancel sessions across tracks.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingMeetingId(null);
                  setMeetingTitle("");
                  setMeetingTime("");
                  setMeetingUrl(
                    `https://meet.jit.si/Bincom-Core-Session-${Math.floor(1000 + Math.random() * 9000)}`,
                  );
                  setMeetingType("Knowledge Track");
                  setMeetingTrack([]);
                  setMeetingTeamTracks([]);
                  setMeetingScheduleDays([
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                  ]);
                  setMeetingDuration("60 minutes");
                  setMeetingOrganizer("Admin Team");
                  setMeetingStatus("Upcoming");
                  setMeetingDescription("");
                  setMeetingAssignedUsers([]);
                  setUserSearchText("");

                  // Reset recurrence states
                  setIsRecurring(false);
                  setRecurrenceFrequency("one-time");
                  setRecurrenceStartDate("");
                  setRecurrenceEndDate("");
                  setRecurrenceCustomInterval(1);
                  setRecurrenceEditMode("single");

                  setIsAddingMeeting(!isAddingMeeting);
                }}
                className="px-3.5 py-1.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-[11px] font-black rounded-lg cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />{" "}
                {isAddingMeeting ? "Close Scheduler" : "Schedule New Meeting"}
              </button>
            </div>

            {/* Scheduler Form */}
            {(isAddingMeeting || editingMeetingId) && (
              <form
                id="meeting-edit-form-anchor"
                onSubmit={handleSaveMeeting}
                className="bg-gray-50/50 p-4 rounded-xl border border-gray-200 animate-zoom-in space-y-4"
              >
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  {editingMeetingId
                    ? "✏️ Edit Scheduled Meeting Properties"
                    : "📅 Classify & Schedule New Interactive Sync"}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Frontend Knowledge Track Session"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Meeting Time
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Every Wednesday 4:00 PM WAT"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Meeting Link
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://meet.jit.si/..."
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Additional Meeting Properties Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-gray-150">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Meeting Duration
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 60 minutes or 1.5 hours"
                      value={meetingDuration}
                      onChange={(e) => setMeetingDuration(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:bg-white focus:border-[#4B5E40] text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Organizer/Admin Name
                    </label>
                    <select
                      value={meetingOrganizer}
                      onChange={(e) => setMeetingOrganizer(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:bg-white focus:border-[#4B5E40] text-xs font-semibold cursor-pointer"
                    >
                      <option value="Admin Team">Admin Team</option>
                      <option value="Facilitators">Facilitators</option>
                      <option value="Track Lead">Track Lead</option>
                      <option value="External Speaker">External Speaker</option>
                      {(() => {
                        const set = new Set<string>();
                        (state.profiles || []).forEach((p: any) => {
                          const isAdm =
                            p.role === "admin" ||
                            String(p.learningLevel || "").toLowerCase() ===
                              "admin" ||
                            String(p.learningLevel || "").toLowerCase() ===
                              "mentor" ||
                            String(p.learningLevel || "").toLowerCase() ===
                              "administrative mentor";
                          const name = String(p.fullName || "").trim();
                          if (isAdm && name) {
                            set.add(name);
                          }
                        });
                        return Array.from(set)
                          .sort((a, b) => a.localeCompare(b))
                          .map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ));
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Brief Description/Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Discussing project milestones"
                      value={meetingDescription}
                      onChange={(e) => setMeetingDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:bg-white focus:border-[#4B5E40] text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Recurrence Setup Section (NEW Meetings Only) */}
                {!editingMeetingId && (
                  <div
                    className="bg-white p-4 rounded-xl border border-gray-200 space-y-3.5 animate-fade-in"
                    id="recurrence-setup-section"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-700">
                          🔄 Recurring Meeting Series Settings
                        </h5>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Configure this meeting to repeat automatically over a
                          period of time
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is-recurring-toggle"
                          checked={isRecurring}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsRecurring(checked);
                            if (checked) {
                              // Auto set a start date if empty
                              if (!recurrenceStartDate) {
                                setRecurrenceStartDate(
                                  meetingDates[0] || getLagosDateString(new Date()),
                                );
                              }
                              if (!recurrenceFrequency || recurrenceFrequency === "one-time") {
                                setRecurrenceFrequency("daily");
                              }
                            }
                          }}
                          className="rounded border-gray-300 text-[#4B5E40] focus:ring-[#4B5E40] h-4 w-4 cursor-pointer"
                        />
                        <label
                          htmlFor="is-recurring-toggle"
                          className="text-xs font-extrabold text-gray-700 select-none cursor-pointer"
                        >
                          Enable Recurrence
                        </label>
                      </div>
                    </div>

                    {isRecurring && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50/50 p-3.5 rounded-lg border border-gray-150 animate-fade-in text-xs font-semibold text-gray-700">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Frequency
                          </label>
                          <select
                            value={recurrenceFrequency}
                            onChange={(e) =>
                              setRecurrenceFrequency(e.target.value)
                            }
                            className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold cursor-pointer"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays (Mon-Fri)</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="custom">Custom Recurrence</option>
                          </select>
                        </div>

                        {recurrenceFrequency === "custom" && (
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                              Every (Days)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={recurrenceCustomInterval}
                              onChange={(e) =>
                                setRecurrenceCustomInterval(
                                  parseInt(e.target.value) || 1,
                                )
                              }
                              className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={recurrenceStartDate}
                            onChange={(e) => {
                              setRecurrenceStartDate(e.target.value);
                              // Sync meetingDates list automatically with the start date as the first date!
                              if (
                                e.target.value &&
                                !meetingDates.includes(e.target.value)
                              ) {
                                setMeetingDates([e.target.value]);
                              }
                            }}
                            className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold cursor-pointer"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            End Date Option
                          </label>
                          <select
                            value={recurrenceEndDate ? "specify" : "none"}
                            onChange={(e) => {
                              if (e.target.value === "none") {
                                setRecurrenceEndDate("");
                              } else {
                                // Default end date to 30 days out from start date
                                const d = (() => {
                                  if (!recurrenceStartDate) return new Date();
                                  const parts = recurrenceStartDate.split("-");
                                  return new Date(
                                    parseInt(parts[0], 10),
                                    parseInt(parts[1], 10) - 1,
                                    parseInt(parts[2], 10),
                                  );
                                })();
                                d.setDate(d.getDate() + 30);
                                setRecurrenceEndDate(getLagosDateString(d));
                              }
                            }}
                            className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold cursor-pointer"
                          >
                            <option value="none">
                              No End Date (Auto 90 days)
                            </option>
                            <option value="specify">Specify End Date</option>
                          </select>
                        </div>

                        {recurrenceEndDate && (
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={recurrenceEndDate}
                              onChange={(e) =>
                                setRecurrenceEndDate(e.target.value)
                              }
                              className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs font-semibold cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Recurrence Edit Options Section (EXISTING Meetings Only) */}
                {editingMeetingId &&
                  (() => {
                    const currentEditingMeeting = state.meetings.find(
                      (m: any) => m.id === editingMeetingId,
                    );
                    if (!currentEditingMeeting?.seriesId) return null;
                    return (
                      <div
                        className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 space-y-3 animate-fade-in"
                        id="recurrence-edit-section"
                      >
                        <div>
                          <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                            🔄 Recurring Series Modification
                          </h5>
                          <p className="text-[10px] text-amber-700/80 font-semibold">
                            This occurrence is part of a recurring series. How
                            should your changes be applied when saved?
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 text-xs font-bold text-gray-700">
                          <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-gray-200 flex-1 hover:border-[#4B5E40]/40">
                            <input
                              type="radio"
                              name="recurrence-edit-mode"
                              value="single"
                              checked={recurrenceEditMode === "single"}
                              onChange={() => setRecurrenceEditMode("single")}
                              className="text-[#4B5E40] focus:ring-[#4B5E40] h-4 w-4 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span>This occurrence only</span>
                              <span className="text-[9.5px] text-gray-400 font-normal">
                                Change only this specific meeting record
                              </span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-gray-200 flex-1 hover:border-[#4B5E40]/40">
                            <input
                              type="radio"
                              name="recurrence-edit-mode"
                              value="future"
                              checked={recurrenceEditMode === "future"}
                              onChange={() => setRecurrenceEditMode("future")}
                              className="text-[#4B5E40] focus:ring-[#4B5E40] h-4 w-4 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span>This and future occurrences</span>
                              <span className="text-[9.5px] text-gray-400 font-normal">
                                Apply changes to subsequent meetings
                              </span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-gray-200 flex-1 hover:border-[#4B5E40]/40">
                            <input
                              type="radio"
                              name="recurrence-edit-mode"
                              value="all"
                              checked={recurrenceEditMode === "all"}
                              onChange={() => setRecurrenceEditMode("all")}
                              className="text-[#4B5E40] focus:ring-[#4B5E40] h-4 w-4 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span>The entire meeting series</span>
                              <span className="text-[9.5px] text-gray-400 font-normal">
                                Apply changes to all occurrences in series
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                {/* Meeting Date Selection Section */}
                <div
                  className="bg-white p-4 rounded-xl border border-gray-200 space-y-4"
                  id="meeting-dates-section"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-700">
                        Meeting Date(s) <span className="text-rose-500">*</span>
                      </h5>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Select one or multiple calendar dates for this meeting
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setMeetingDates([])}
                        className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-150 transition cursor-pointer select-none"
                      >
                        Clear All Dates
                      </button>
                    </div>
                  </div>

                  {/* Add Date Controls */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50/50 p-3 rounded-lg border border-gray-150">
                    <div className="w-full sm:w-auto">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Select Calendar Date
                      </label>
                      <input
                        type="date"
                        value={currentPickedDate}
                        onChange={(e) => setCurrentPickedDate(e.target.value)}
                        className="bg-white border border-gray-250 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 outline-none focus:border-[#4B5E40]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!currentPickedDate) {
                          triggerError(
                            "Please choose a valid calendar date first.",
                          );
                          return;
                        }
                        if (meetingDates.includes(currentPickedDate)) {
                          triggerError("This meeting date is already added.");
                          return;
                        }
                        const todayStr = getLagosDateString(new Date());
                        if (!allowPastDates && currentPickedDate < todayStr) {
                          triggerError(
                            "Selection of past dates is disabled. Enable past dates below if explicitly required.",
                          );
                          return;
                        }
                        setMeetingDates((prev) =>
                          [...prev, currentPickedDate].sort(),
                        );
                        setCurrentPickedDate("");
                      }}
                      className="w-full sm:w-auto sm:self-end px-3 py-1.5 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3D4C33] rounded-lg shadow-sm transition cursor-pointer text-center"
                    >
                      + Add Date
                    </button>

                    <div className="flex items-center gap-2 sm:self-end sm:ml-auto h-8 pt-2 sm:pt-0">
                      <input
                        type="checkbox"
                        id="allow-past-dates-toggle"
                        checked={allowPastDates}
                        onChange={(e) => setAllowPastDates(e.target.checked)}
                        className="rounded border-gray-300 text-[#4B5E40] focus:ring-[#4B5E40] h-3.5 w-3.5 cursor-pointer"
                      />
                      <label
                        htmlFor="allow-past-dates-toggle"
                        className="text-[10px] font-bold text-gray-600 select-none cursor-pointer"
                      >
                        Allow Past Dates
                      </label>
                    </div>
                  </div>

                  {/* Selected Dates Display */}
                  {meetingDates.length > 0 ? (
                    <div className="space-y-2">
                      <span className="font-bold text-gray-400 uppercase text-[9px] tracking-wider block">
                        Selected Dates:
                      </span>
                      <div
                        className="flex flex-wrap gap-1.5"
                        id="selected-meeting-dates-list"
                      >
                        {meetingDates.map((dateStr) => (
                          <div
                            key={dateStr}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#4B5E40]/10 text-[#4B5E40] border border-[#4B5E40]/20 rounded-full text-[11px] font-bold"
                          >
                            <span>
                              {(() => {
                                try {
                                  const d = new Date(dateStr);
                                  const utcDate = new Date(
                                    d.getTime() + d.getTimezoneOffset() * 60000,
                                  );
                                  return utcDate.toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  });
                                } catch (e) {
                                  return dateStr;
                                }
                              })()}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setMeetingDates((prev) =>
                                  prev.filter((d) => d !== dateStr),
                                )
                              }
                              className="text-rose-600 hover:text-rose-800 font-black cursor-pointer ml-0.5 select-none"
                              title="Remove date"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 pt-2 text-rose-600 text-[10px] font-bold animate-pulse flex items-center gap-1">
                      ⚠️ No date selected! A meeting cannot be created or
                      updated until at least one meeting date is chosen.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    className="relative animate-fade-in"
                    ref={meetingTypeRef}
                  >
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Meeting Type
                    </label>
                    <div
                      onClick={() =>
                        setMeetingTypeDropdownOpen(!meetingTypeDropdownOpen)
                      }
                      className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-2 flex items-center justify-between outline-none focus-within:border-[#4B5E40] text-xs font-semibold text-gray-800 cursor-pointer"
                    >
                      <span className="truncate">
                        {getMeetingTypeLabel(meetingType) ||
                          "Select Meeting Type..."}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>

                    {meetingTypeDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-2 text-xs font-medium">
                        {/* Search field */}
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search existing meeting types..."
                            value={meetingTypeSearch}
                            onChange={(e) =>
                              setMeetingTypeSearch(e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-white border border-gray-250 rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-[#4B5E40] text-xs"
                          />
                        </div>

                        {/* Meeting list */}
                        <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                          {(state.meetingTypes && state.meetingTypes.length > 0
                            ? state.meetingTypes
                            : ["Knowledge Track", "Microservices", "Project"]
                          ).filter((type: string) =>
                            type
                              .toLowerCase()
                              .includes(meetingTypeSearch.toLowerCase()),
                          ).length === 0 ? (
                            <div className="p-3 text-center text-gray-400 italic">
                              No matching meeting types.
                            </div>
                          ) : (
                            (state.meetingTypes && state.meetingTypes.length > 0
                              ? state.meetingTypes
                              : ["Knowledge Track", "Microservices", "Project"]
                            )
                              .filter((type: string) =>
                                type
                                  .toLowerCase()
                                  .includes(meetingTypeSearch.toLowerCase()),
                              )
                              .map((type: string) => {
                                const isSelected = meetingType === type;
                                const isSystemDefault = [
                                  "knowledge track",
                                  "microservices",
                                  "project",
                                ].includes(type.toLowerCase());
                                return (
                                  <div
                                    key={type}
                                    onClick={() => {
                                      setMeetingType(type);
                                      setMeetingTypeDropdownOpen(false);
                                    }}
                                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer select-none transition ${
                                      isSelected
                                        ? "bg-[#4B5E40]/10 text-[#4B5E40] font-bold"
                                        : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                  >
                                    <span className="truncate">
                                      {getMeetingTypeLabel(type)}
                                    </span>
                                    <div
                                      className="flex items-center gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        title="Edit meeting type name"
                                        onClick={() => {
                                          setEditingTypeName(type);
                                          setEditingTypeValue(type);
                                        }}
                                        className="p-1 hover:bg-gray-200/50 rounded text-gray-500 hover:text-slate-800 transition"
                                      >
                                        <Search
                                          className="w-3 h-3 text-transparent bg-slate-400 [mask-image:url('data:image/svg+xml;utf8,<svg viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><path d=%22M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7%22/><path d=%22M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z%22/></svg>')] shrink-0 bg-no-repeat bg-contain"
                                          style={{ maskSize: "contain" }}
                                          onClick={() => {
                                            setEditingTypeName(type);
                                            setEditingTypeValue(type);
                                          }}
                                        />
                                      </button>

                                      {(!isSystemDefault ||
                                        allowDeleteSystemTypes) && (
                                        <button
                                          type="button"
                                          title="Delete meeting type"
                                          onClick={() =>
                                            handleDeleteMeetingType(type)
                                          }
                                          className="p-1 rounded transition hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>

                        {/* Trigger Adding inline */}
                        {!isAddingNewTypeInline && !editingTypeName && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAddingNewTypeInline(true);
                            }}
                            className="w-full mt-2 py-1.5 border border-dashed border-[#4B5E40]/30 hover:border-[#4B5E40] text-[#4B5E40] text-xs font-bold rounded-lg transition hover:bg-[#4B5E40]/5 flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> + Add New Meeting
                            Type
                          </button>
                        )}

                        {/* Inline Adding form */}
                        {isAddingNewTypeInline && (
                          <div
                            className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-150 space-y-2 animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                              Add New Type
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Enter meeting type name..."
                                value={newTypeInputValue}
                                onChange={(e) =>
                                  setNewTypeInputValue(e.target.value)
                                }
                                className="flex-1 bg-white border border-gray-250 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#4B5E40]"
                              />
                            </div>
                            <div className="flex justify-end gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setIsAddingNewTypeInline(false)}
                                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10.5px] font-bold rounded-md"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCreateMeetingType(newTypeInputValue)
                                }
                                className="px-3 py-1 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-[10.5px] font-black rounded-md"
                              >
                                Save Entry
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Editing form */}
                        {editingTypeName && (
                          <div
                            className="mt-2 p-2 bg-[#4B5E40]/5 rounded-lg border border-[#4B5E40]/20 space-y-2 animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[10px] font-bold text-[#4B5E40] uppercase tracking-wider">
                              Rename: {editingTypeName}
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={editingTypeValue}
                                onChange={(e) =>
                                  setEditingTypeValue(e.target.value)
                                }
                                className="flex-1 bg-white border border-[#4B5E40]/25 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#4B5E40]"
                              />
                            </div>
                            <div className="flex justify-end gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setEditingTypeName(null)}
                                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10.5px] font-bold rounded-md"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCreateMeetingType(
                                    editingTypeValue,
                                    editingTypeName,
                                  )
                                }
                                className="px-3 py-1 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-[10.5px] font-black rounded-md"
                              >
                                Apply Changes
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Super admin toggle option at bottom */}
                        <div
                          className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-2 select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            id="allow-system-defaults-delete"
                            checked={allowDeleteSystemTypes}
                            onChange={(e) =>
                              setAllowDeleteSystemTypes(e.target.checked)
                            }
                            className="rounded text-[#4B5E40] focus:ring-[#4B5E40]"
                          />
                          <label
                            htmlFor="allow-system-defaults-delete"
                            className="text-[9.5px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer uppercase tracking-wider"
                          >
                            Super Admin: Unlock Default Types
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative" ref={comboboxRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      User Level(optional)
                    </label>

                    <div className="w-full bg-white border border-gray-250 rounded-lg p-1.5 flex flex-col gap-1.5 focus-within:border-[#4B5E40]">
                      <div className="flex items-center gap-1.5 flex-1 select-none">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          placeholder={
                            meetingTrack.length > 0
                              ? "Search more user level..."
                              : "Select user level..."
                          }
                          value={comboboxSearch}
                          onChange={(e) => {
                            setComboboxSearch(e.target.value);
                            setComboboxOpen(true);
                            setComboboxFocusIndex(0);
                          }}
                          onFocus={() => setComboboxOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setComboboxOpen(true);
                              setComboboxFocusIndex((prev) =>
                                Math.min(
                                  flatVisibleOptions.length - 1,
                                  prev + 1,
                                ),
                              );
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setComboboxOpen(true);
                              setComboboxFocusIndex((prev) =>
                                Math.max(0, prev - 1),
                              );
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              if (
                                comboboxOpen &&
                                comboboxFocusIndex >= 0 &&
                                comboboxFocusIndex < flatVisibleOptions.length
                              ) {
                                handleSelectTrack(
                                  flatVisibleOptions[comboboxFocusIndex],
                                );
                              } else {
                                setComboboxOpen(true);
                              }
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setComboboxOpen(false);
                            }
                          }}
                          className="w-full bg-transparent border-0 outline-none text-xs font-semibold text-gray-850 placeholder-gray-400"
                        />

                        {meetingTrack.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllTracks}
                            className="p-1 text-[10px] font-bold text-gray-500 hover:text-rose-600 transition bg-gray-50 hover:bg-rose-50 rounded"
                            title="Clear all selections"
                          >
                            Clear All
                          </button>
                        )}
                        <ChevronDown
                          className="w-4 h-4 text-gray-400 cursor-pointer shrink-0 hover:text-gray-600"
                          onClick={() => setComboboxOpen(!comboboxOpen)}
                        />
                      </div>
                    </div>

                    {/* Display selected tracks as chips/tags */}
                    {meetingTrack.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5 mt-2"
                        id="selected-tracks-chips"
                      >
                        {meetingTrack.map((track) => (
                          <span
                            key={track}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-lg border transition ${
                              track === "All User Eligible"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-[#4B5E40]/10 text-[#4B5E40] border-[#4B5E40]/25"
                            }`}
                          >
                            <span>{track}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTrack(track)}
                              className="w-3.5 h-3.5 rounded-full hover:bg-black/10 flex items-center justify-center font-bold text-[10px] text-gray-500 hover:text-gray-850"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Combobox Dropdown Menu */}
                    {comboboxOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs font-medium">
                        {groupedFilteredOptions.length === 0 ? (
                          <div className="p-3.5 text-center text-gray-400 italic">
                            No track options match your search.
                          </div>
                        ) : (
                          (() => {
                            let itemFlatIdx = 0;
                            return groupedFilteredOptions.map((group) => (
                              <div
                                key={group.category}
                                className="border-b last:border-b-0 border-gray-100 pb-1 last:pb-0"
                              >
                                <div className="px-3 py-1 bg-gray-50/75 text-[9px] text-gray-400 tracking-wider uppercase font-extrabold select-none">
                                  {group.category}
                                </div>
                                <div className="space-y-0.5 mt-0.5 font-sans">
                                  {group.options.map((option) => {
                                    const optionIdx = itemFlatIdx++;
                                    const isSelected =
                                      meetingTrack.includes(option);
                                    const isFocused =
                                      optionIdx === comboboxFocusIndex;
                                    return (
                                      <div
                                        key={option}
                                        onClick={() => {
                                          handleSelectTrack(option);
                                          setComboboxSearch(""); // clear search on select
                                        }}
                                        onMouseEnter={() =>
                                          setComboboxFocusIndex(optionIdx)
                                        }
                                        className={`flex items-center justify-between px-3.5 py-2 cursor-pointer select-none transition ${
                                          isFocused
                                            ? "bg-[#4B5E40]/10 text-[#4B5E40] font-extrabold"
                                            : isSelected
                                              ? "bg-gray-50 text-gray-800 font-bold"
                                              : "hover:bg-gray-55 text-gray-700 font-medium"
                                        }`}
                                      >
                                        <span className="flex items-center gap-2">
                                          {isSelected ? (
                                            <span className="w-4 h-4 rounded bg-[#4B5E40] text-white flex items-center justify-center text-[10px] font-black">
                                              ✓
                                            </span>
                                          ) : (
                                            <span className="w-4 h-4 rounded border border-gray-300 bg-white"></span>
                                          )}
                                          <span>{option}</span>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative animate-fade-in" ref={teamTracksRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Target Team Track Eligibility (optional)
                    </label>

                    <div className="w-full bg-white border border-gray-250 rounded-lg p-1.5 flex flex-col gap-1.5 focus-within:border-[#4B5E40] min-h-[38px] justify-center">
                      <div className="flex items-center gap-1.5 flex-1 select-none">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          placeholder={
                            meetingTeamTracks.length > 0
                              ? "Search target team tracks..."
                              : "Select target team tracks..."
                          }
                          value={teamTracksSearch}
                          onChange={(e) => {
                            setTeamTracksSearch(e.target.value);
                            setTeamTracksOpen(true);
                            setTeamTracksFocusIndex(0);
                          }}
                          onFocus={() => setTeamTracksOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setTeamTracksOpen(true);
                              setTeamTracksFocusIndex((prev) =>
                                Math.min(
                                  filteredTeamTrackOptions.length - 1,
                                  prev + 1,
                                ),
                              );
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setTeamTracksOpen(true);
                              setTeamTracksFocusIndex((prev) =>
                                Math.max(0, prev - 1),
                              );
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              if (
                                teamTracksOpen &&
                                teamTracksFocusIndex >= 0 &&
                                teamTracksFocusIndex <
                                  filteredTeamTrackOptions.length
                              ) {
                                handleSelectTeamTrack(
                                  filteredTeamTrackOptions[
                                    teamTracksFocusIndex
                                  ],
                                );
                                setTeamTracksSearch("");
                              } else {
                                setTeamTracksOpen(true);
                              }
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setTeamTracksOpen(false);
                            }
                          }}
                          className="w-full bg-transparent border-0 outline-none text-xs font-semibold text-gray-850 placeholder-gray-400"
                        />

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleSelectAllTeamTracks}
                            className="px-1.5 py-0.5 text-[9px] font-black bg-gray-100 hover:bg-[#4B5E40]/10 text-gray-650 hover:text-[#4B5E40] transition rounded uppercase cursor-pointer"
                            title="Select all"
                          >
                            All
                          </button>
                          {meetingTeamTracks.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllTeamTracks}
                              className="px-1.5 py-0.5 text-[9px] font-black bg-rose-50 hover:bg-rose-100 text-rose-600 transition rounded uppercase animate-fade-in cursor-pointer"
                              title="Clear all"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <ChevronDown
                          className="w-4 h-4 text-gray-400 cursor-pointer shrink-0 hover:text-gray-600"
                          onClick={() => setTeamTracksOpen(!teamTracksOpen)}
                        />
                      </div>
                    </div>

                    {/* Removable chips/tags */}
                    {meetingTeamTracks.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5 mt-2"
                        id="selected-team-tracks-chips"
                      >
                        {meetingTeamTracks.map((track) => (
                          <span
                            key={track}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-lg border bg-[#4B5E40]/10 text-[#4B5E40] border-[#4B5E40]/25 animate-zoom-in"
                          >
                            <span>{track}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTeamTrack(track)}
                              className="w-3.5 h-3.5 rounded-full hover:bg-black/10 flex items-center justify-center font-bold text-[10px] text-gray-500 hover:text-gray-850 cursor-pointer"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dropdown Menu */}
                    {teamTracksOpen && (
                      <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs font-medium">
                        {filteredTeamTrackOptions.length === 0 ? (
                          <div className="p-3.5 text-center text-gray-400 italic">
                            No track options match your search.
                          </div>
                        ) : (
                          filteredTeamTrackOptions.map((option, index) => {
                            const isSelected =
                              meetingTeamTracks.includes(option);
                            const isFocused = index === teamTracksFocusIndex;
                            return (
                              <div
                                key={option}
                                onClick={() => {
                                  handleSelectTeamTrack(option);
                                  setTeamTracksSearch("");
                                }}
                                onMouseEnter={() =>
                                  setTeamTracksFocusIndex(index)
                                }
                                className={`flex items-center justify-between px-3.5 py-2 cursor-pointer select-none transition ${
                                  isFocused
                                    ? "bg-[#4B5E40]/10 text-[#4B5E40] font-extrabold"
                                    : isSelected
                                      ? "bg-gray-50 text-gray-800 font-bold"
                                      : "hover:bg-gray-55 text-gray-700 font-medium"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  {isSelected ? (
                                    <span className="w-4 h-4 rounded bg-[#4B5E40] text-white flex items-center justify-center text-[10px] font-black">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="w-4 h-4 rounded border border-gray-300 bg-white"></span>
                                  )}
                                  <span>{option}</span>
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct User Assignments Panel */}
                <div
                  className="bg-white p-4 rounded-xl border border-gray-200 space-y-3 relative"
                  ref={assignedUsersRef}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-700 flex items-center gap-1">
                        👥 Direct User Assignments (Optional)
                      </h5>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Directly assign this meeting to specific participants.
                        When specified, only these users can see this meeting on
                        their dashboard.
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => {
                          const nonAdmins = (state.profiles || []).filter(
                            (p: any) => p.role !== "admin",
                          );
                          setMeetingAssignedUsers(
                            nonAdmins.map((p: any) => p.id),
                          );
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-[#4B5E40] bg-[#4B5E40]/5 hover:bg-[#4B5E40]/10 rounded-md border border-[#4B5E40]/15 transition cursor-pointer"
                      >
                        Assign All
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetingAssignedUsers([])}
                        className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-150 transition cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="w-full bg-white border border-gray-250 rounded-lg p-1.5 flex flex-col gap-1.5 focus-within:border-[#4B5E40] min-h-[38px] justify-center">
                      <div className="flex items-center gap-1.5 flex-1 select-none">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          placeholder={
                            meetingAssignedUsers.length > 0
                              ? "Search/Assign more users..."
                              : "Search/Click to Assign users directly..."
                          }
                          value={userSearchText}
                          onChange={(e) => {
                            setUserSearchText(e.target.value);
                            setUserDropdownOpen(true);
                          }}
                          onFocus={() => setUserDropdownOpen(true)}
                          className="w-full bg-transparent border-0 outline-none text-xs font-semibold text-gray-850 placeholder-gray-400"
                        />
                        <ChevronDown
                          className="w-4 h-4 text-gray-400 cursor-pointer shrink-0 hover:text-gray-600"
                          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        />
                      </div>
                    </div>

                    {/* Selected Users Chips */}
                    {meetingAssignedUsers.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5 mt-2"
                        id="selected-assigned-users-chips"
                      >
                        {meetingAssignedUsers.map((uId) => {
                          const userProfile = (state.profiles || []).find(
                            (p: any) => p.id === uId,
                          );
                          if (!userProfile) return null;
                          return (
                            <span
                              key={uId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-lg border bg-[#4B5E40]/10 text-[#4B5E40] border-[#4B5E40]/25 animate-zoom-in"
                            >
                              <span>
                                {userProfile.fullName} ({userProfile.username})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setMeetingAssignedUsers((prev) =>
                                    prev.filter((id) => id !== uId),
                                  )
                                }
                                className="w-3.5 h-3.5 rounded-full hover:bg-black/10 flex items-center justify-center font-bold text-[10px] text-gray-500 hover:text-gray-850 cursor-pointer"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Dropdown list */}
                    {userDropdownOpen &&
                      (() => {
                        const nonAdminProfiles = (state.profiles || []).filter(
                          (p: any) => p.role !== "admin",
                        );
                        const filteredUsers = nonAdminProfiles.filter(
                          (p: any) => {
                            const word = userSearchText.toLowerCase().trim();
                            if (!word) return true;
                            return (
                              (p.fullName || "").toLowerCase().includes(word) ||
                              (p.username || "").toLowerCase().includes(word) ||
                              (p.track || "").toLowerCase().includes(word) ||
                              (p.learningLevel || "")
                                .toLowerCase()
                                .includes(word)
                            );
                          },
                        );

                        return (
                          <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs font-medium">
                            {filteredUsers.length === 0 ? (
                              <div className="p-3.5 text-center text-gray-400 italic">
                                No matching students found.
                              </div>
                            ) : (
                              filteredUsers.map((p: any) => {
                                const isSelected =
                                  meetingAssignedUsers.includes(p.id);
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => {
                                      if (isSelected) {
                                        setMeetingAssignedUsers((prev) =>
                                          prev.filter((id) => id !== p.id),
                                        );
                                      } else {
                                        setMeetingAssignedUsers((prev) => [
                                          ...prev,
                                          p.id,
                                        ]);
                                      }
                                      setUserSearchText("");
                                    }}
                                    className={`flex items-center justify-between px-3.5 py-2 cursor-pointer select-none transition ${
                                      isSelected
                                        ? "bg-[#4B5E40]/10 text-[#4B5E40] font-extrabold"
                                        : "hover:bg-gray-50 text-gray-750 font-medium"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isSelected ? (
                                        <span className="w-4 h-4 rounded bg-[#4B5E40] text-white flex items-center justify-center text-[10px] font-black">
                                          ✓
                                        </span>
                                      ) : (
                                        <span className="w-4 h-4 rounded border border-gray-300 bg-white"></span>
                                      )}
                                      <div className="flex flex-col">
                                        <span className="font-bold text-gray-900">
                                          {p.fullName}
                                        </span>
                                        <span className="text-[9.5px] text-gray-400">
                                          @{p.username} •{" "}
                                          {p.track
                                            ? p.track.replace(
                                                "– Beginner Level",
                                                "",
                                              )
                                            : "No Track"}{" "}
                                          •{" "}
                                          {p.learningLevel ||
                                            "Apprentice level 1"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMeetingId(null);
                      setIsAddingMeeting(false);
                    }}
                    className="px-3 py-1.5 border border-gray-250 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-650 cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-white text-xs font-black rounded-lg cursor-pointer flex items-center gap-1.5 transition shadow-sm bg-[#4B5E40] hover:bg-[#3d4d34]"
                  >
                    <span>⚡</span>
                    <span>
                      {editingMeetingId
                        ? "Save Meeting Changes"
                        : "Schedule Meeting"}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* List of Meetings */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Currently Programmed & Scheduled Meetings (Grouped by Series)
                </h4>

              </div>

              {(() => {
                // Group meetings by seriesId
                const groupedMap: Record<string, any[]> = {};
                const standaloneActive: any[] = [];

                (state.meetings || []).forEach((m: any) => {
                  if (m.seriesId) {
                    if (!groupedMap[m.seriesId]) {
                      groupedMap[m.seriesId] = [];
                    }
                    groupedMap[m.seriesId].push(m);
                  } else {
                    const statusLower = String(m.status || "")
                      .trim()
                      .toLowerCase();
                    if (
                      statusLower !== "archived" &&
                      statusLower !== "completed"
                    ) {
                      standaloneActive.push(m);
                    }
                  }
                });

                // Convert grouped map to an array of series
                const activeSeriesList = Object.entries(groupedMap)
                  .map(([seriesId, occurrences]) => {
                    // Sort occurrences by date ascending
                    const sortedOccurrences = [...occurrences].sort(
                      (a: any, b: any) => {
                        const dateA =
                          a.occurrenceDate ||
                          (a.meetingDates && a.meetingDates[0]) ||
                          "";
                        const dateB =
                          b.occurrenceDate ||
                          (b.meetingDates && b.meetingDates[0]) ||
                          "";
                        return dateA.localeCompare(dateB);
                      },
                    );

                    // A series is active if at least one of its occurrences is active (not archived and not completed)
                    const hasActiveOccurrence = sortedOccurrences.some(
                      (o: any) => {
                        const s = String(o.status || "")
                          .toLowerCase()
                          .trim();
                        return s !== "archived" && s !== "completed";
                      },
                    );

                    // Representative can be the first active occurrence, or simply the first occurrence
                    const representative =
                      sortedOccurrences.find((o: any) => {
                        const s = String(o.status || "")
                          .toLowerCase()
                          .trim();
                        return s !== "archived" && s !== "completed";
                      }) || sortedOccurrences[0];

                    return {
                      seriesId,
                      representative,
                      occurrences: sortedOccurrences,
                      isActive: hasActiveOccurrence,
                    };
                  })
                  .filter((s) => s.isActive);

                const hasNoMeetings =
                  standaloneActive.length === 0 &&
                  activeSeriesList.length === 0;

                if (hasNoMeetings) {
                  return (
                    <div className="py-8 text-center text-gray-450 text-xs font-medium bg-gray-50/50 rounded-xl border border-dashed">
                      No scheduled or active meetings programmed.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Render active recurring meeting series */}
                    {activeSeriesList.map((series) => {
                      const rep = series.representative;
                      const isExpanded = !!expandedSeriesIds[series.seriesId];
                      return (
                        <div
                          key={series.seriesId}
                          className="p-4 bg-[#F4F7F4] rounded-xl border border-gray-200 flex flex-col justify-between gap-3 text-xs col-span-1 md:col-span-2 shadow-sm animate-fade-in"
                        >
                          <div>
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9.5px] font-bold uppercase text-gray-400 font-mono tracking-wider">
                                  SERIES ID: {series.seriesId}
                                </span>
                                <span className="px-2 py-0.5 text-[8.5px] font-extrabold bg-[#4B5E40]/10 text-[#4B5E40] rounded-md border border-[#4B5E40]/20 tracking-wide uppercase font-mono">
                                  Recurring Series 🔁
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 text-[8.5px] font-extrabold rounded-md border tracking-wide ${
                                  rep.type === "knowledge" ||
                                  rep.type.toLowerCase().includes("knowledge")
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : rep.type === "standup" ||
                                        rep.type === "microservice" ||
                                        rep.type
                                          .toLowerCase()
                                          .includes("standup")
                                      ? "bg-teal-50 text-teal-700 border-teal-200"
                                      : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                {getMeetingTypeLabel(rep.type)}
                              </span>
                            </div>
                            <h5 className="font-extrabold text-slate-900 mt-2 text-sm sm:text-base leading-snug">
                              {rep.title}
                            </h5>

                            <div className="grid grid-cols-1 gap-1.5 mt-3 text-[11px] text-gray-500 font-medium">
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400">🗓️</span>
                                <span className="font-bold text-gray-700">
                                  Default Time: {rep.timeString}
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="text-gray-400">📅</span>
                                <span className="leading-tight">
                                  Recurrence Frequency:{" "}
                                  <strong className="text-[#4B5E40] uppercase">
                                    {rep.recurrenceFrequency || "one-time"}
                                  </strong>
                                  {rep.recurrenceStartDate && (
                                    <>
                                      {" "}
                                      (From {rep.recurrenceStartDate} to{" "}
                                      {rep.recurrenceEndDate || "No End Date"})
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                                <div className="flex items-start gap-1.5">
                                  <span className="text-gray-400 mt-0.5">
                                    🛡️
                                  </span>
                                  <span className="leading-tight">
                                    User Level Eligibility:{" "}
                                    <strong className="text-[#4B5E40] uppercase">
                                      {getUserLevelsDisplay(
                                        rep.trackId,
                                        rep.userLevels,
                                      )}
                                    </strong>
                                  </span>
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <span className="text-gray-400 mt-0.5">
                                    👥
                                  </span>
                                  <span className="leading-tight">
                                    Team Track Eligibility:{" "}
                                    <strong className="text-[#4B5E40] uppercase">
                                      {getTeamTracksDisplay(
                                        rep.targetTeamTrackEligibility,
                                      )}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono text-[10px] break-all text-indigo-700 bg-indigo-50/40 p-1.5 rounded border border-indigo-100 mt-1">
                                <strong>Common Jitsi Link:</strong>{" "}
                                {rep.jitsiUrl}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-150 justify-between items-center mt-2">
                            <span className="text-gray-500 font-bold text-[11px]">
                              Contains {series.occurrences.length} occurrences
                              total
                            </span>
                            <div className="flex flex-wrap items-center gap-2">

                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedSeriesIds((prev) => ({
                                    ...prev,
                                    [series.seriesId]: !prev[series.seriesId],
                                  }));
                                }}
                                className="px-3 py-1.5 text-[11px] font-black text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                              >
                                <span>
                                  {isExpanded
                                    ? "Collapse Series ⬆️"
                                    : "Expand Series ⬇️"}
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* Render sub-list of occurrences if expanded */}
                          {isExpanded && (
                            <div className="mt-4 p-3.5 bg-white rounded-xl border border-gray-200 space-y-3 animate-fade-in text-left">
                              <h6 className="font-extrabold text-[#4B5E40] text-xs uppercase tracking-wider border-b border-gray-100 pb-2">
                                Series Occurrences
                              </h6>
                              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {series.occurrences.map((occurrence: any) => {
                                  // Compute eligibility/attendance for this occurrence
                                  const eligibleAssignments = (
                                    state.meetingAssignments || []
                                  ).filter(
                                    (a: any) => a.meetingId === occurrence.id,
                                  );
                                  const eligibleUserIds =
                                    eligibleAssignments.map(
                                      (a: any) => a.userId,
                                    );
                                  const eligibleProfiles = (
                                    state.profiles || []
                                  ).filter(
                                    (p: any) =>
                                      p.role !== "admin" &&
                                      (eligibleUserIds.includes(p.id) ||
                                        isUserEligibleForMeetingInBackend(
                                          p,
                                          occurrence,
                                          state.meetingAssignments || [],
                                        ) ||
                                        (state.attendance || []).some(
                                          (a: any) =>
                                            isMatchingLogForMeetingAndUser(
                                              a,
                                              occurrence,
                                              p,
                                            ),
                                        )),
                                  );
                                  const attendanceLogs = (
                                    state.attendance || []
                                  ).filter((a: any) =>
                                    isMatchingLogForMeeting(a, occurrence),
                                  );
                                  const joinedCount = eligibleProfiles.filter(
                                    (p: any) => {
                                      const userLogs = attendanceLogs.filter(
                                        (l: any) =>
                                          isMatchingLogForMeetingAndUser(
                                            l,
                                            occurrence,
                                            p,
                                          ),
                                      );
                                      const log =
                                        userLogs.find((l: any) => {
                                          const s = (
                                            l.status || ""
                                          ).toLowerCase();
                                          return (
                                            !s.includes("miss") &&
                                            !s.includes("absent")
                                          );
                                        }) || userLogs[0];
                                      if (!log) return false;
                                      const s = (
                                        log.status || ""
                                      ).toLowerCase();
                                      return (
                                        !s.includes("miss") &&
                                        !s.includes("absent")
                                      );
                                    },
                                  ).length;
                                  const rawRateOcc =
                                    eligibleProfiles.length > 0
                                      ? (joinedCount /
                                          eligibleProfiles.length) *
                                        100
                                      : 0;
                                  const attendanceRate =
                                    rawRateOcc % 1 === 0
                                      ? rawRateOcc.toFixed(0)
                                      : rawRateOcc.toFixed(1);

                                  const getOccEffectiveStatus = (occ: any) => {
                                    const s = String(occ.status || "").trim();
                                    const sLower = s.toLowerCase();
                                    if (sLower === "cancelled" || sLower === "archived") return occ.status || "Upcoming";
                                    if (sLower === "completed") return "Completed";

                                    const now = new Date();
                                    const todayStr = getLagosDateString(now);
                                    const currentMins = getLagosMinutesPastMidnight(now);

                                    const occDate = occ.occurrenceDate || (occ.meetingDates && occ.meetingDates[0]) || todayStr;
                                    const scheduledTimeStr = occ.timeString || occ.time || "09:00 AM";
                                    const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);
                                    const durationStr = occ.duration || "30 minutes";
                                    const matchDuration = durationStr.match(/(\d+)/);
                                    const durationMinutes = matchDuration ? parseInt(matchDuration[1], 10) : 30;
                                    const endTimeMinutes = scheduledMinutes + durationMinutes;

                                    if (occDate < todayStr || (occDate === todayStr && currentMins >= endTimeMinutes)) {
                                      return "Completed";
                                    }
                                    return occ.status || "Upcoming";
                                  };

                                  const occStatus = getOccEffectiveStatus(occurrence);

                                  return (
                                    <div
                                      key={occurrence.id}
                                      className="p-3 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-200/80 flex flex-col sm:flex-row justify-between gap-3 text-xs"
                                    >
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">
                                            📅 {occurrence.occurrenceDate}
                                          </span>
                                          <span className="text-[10px] font-bold text-gray-500">
                                            🕒 {occurrence.timeString}
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 text-[8.5px] font-extrabold rounded-md border tracking-wide uppercase ${
                                              occStatus.toLowerCase() ===
                                              "upcoming"
                                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                                : occStatus.toLowerCase() ===
                                                    "completed"
                                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                  : occStatus.toLowerCase() ===
                                                      "cancelled"
                                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                                    : "bg-gray-100 text-gray-700 border-gray-300"
                                            }`}
                                          >
                                            {occStatus}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10.5px] text-gray-600">
                                          <span className="font-extrabold">
                                            Attendance rate:
                                          </span>
                                          <span
                                            className={`font-black ${Number(attendanceRate) >= 70 ? "text-emerald-700" : Number(attendanceRate) >= 40 ? "text-amber-700" : "text-rose-600"}`}
                                          >
                                            {attendanceRate}% ({joinedCount} /{" "}
                                            {eligibleProfiles.length} Joined)
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-1.5 items-center justify-end">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (
                                              expandedAttendanceMeetingId ===
                                              occurrence.id
                                            ) {
                                              setExpandedAttendanceMeetingId(
                                                null,
                                              );
                                            } else {
                                              setExpandedAttendanceMeetingId(
                                                occurrence.id,
                                              );
                                              setAttendanceFilterTab("all");
                                            }
                                          }}
                                          className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition cursor-pointer ${
                                            expandedAttendanceMeetingId ===
                                            occurrence.id
                                              ? "bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold shadow-sm"
                                              : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                                          }`}
                                        >
                                          {expandedAttendanceMeetingId ===
                                          occurrence.id
                                            ? "Close Attendance 📊"
                                            : "Track Attendance 📊"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingMeetingId(occurrence.id);
                                            setMeetingTitle(occurrence.title);
                                            setMeetingTime(
                                              occurrence.timeString,
                                            );
                                            setMeetingUrl(occurrence.jitsiUrl);
                                            setMeetingType(occurrence.type);
                                            const rawLevels =
                                              occurrence.userLevels !==
                                              undefined
                                                ? occurrence.userLevels
                                                : occurrence.trackId;
                                            setMeetingTrack(
                                              Array.isArray(rawLevels)
                                                ? rawLevels
                                                : rawLevels === "All" ||
                                                    !rawLevels
                                                  ? []
                                                  : [rawLevels],
                                            );
                                            setMeetingTeamTracks(
                                              occurrence.targetTeamTrackEligibility ||
                                                [],
                                            );
                                            setMeetingScheduleDays(
                                              occurrence.scheduleDays &&
                                                occurrence.scheduleDays.length >
                                                  0
                                                ? occurrence.scheduleDays
                                                : [
                                                    "Monday",
                                                    "Tuesday",
                                                    "Wednesday",
                                                    "Thursday",
                                                    "Friday",
                                                  ],
                                            );
                                            setMeetingDates(
                                              occurrence.meetingDates || [],
                                            );
                                            setMeetingDuration(
                                              occurrence.duration ||
                                                "60 minutes",
                                            );
                                            setMeetingOrganizer(
                                              occurrence.organizer ||
                                                "Admin Team",
                                            );
                                            setMeetingStatus(
                                              occurrence.status || "Upcoming",
                                            );
                                            setMeetingDescription(
                                              occurrence.description || "",
                                            );
                                            setMeetingAssignedUsers(
                                              occurrence.assignedUserIds || [],
                                            );
                                            setUserSearchText("");
                                            setIsRecurring(true);
                                            setRecurrenceFrequency(
                                              occurrence.recurrenceFrequency ||
                                                "one-time",
                                            );
                                            setRecurrenceStartDate(
                                              occurrence.recurrenceStartDate ||
                                                "",
                                            );
                                            setRecurrenceEndDate(
                                              occurrence.recurrenceEndDate ||
                                                "",
                                            );
                                            setRecurrenceCustomInterval(
                                              occurrence.recurrenceCustomInterval ||
                                                1,
                                            );
                                            setRecurrenceEditMode("single");
                                            setIsAddingMeeting(false);
                                            // Scroll back to editing form smoothly after state update
                                            setTimeout(() => {
                                              const formElement =
                                                document.getElementById(
                                                  "meeting-edit-form-anchor",
                                                );
                                              if (formElement) {
                                                formElement.scrollIntoView({
                                                  behavior: "smooth",
                                                  block: "start",
                                                });
                                              } else {
                                                setTimeout(() => {
                                                  const formElementRetry =
                                                    document.getElementById(
                                                      "meeting-edit-form-anchor",
                                                    );
                                                  if (formElementRetry) {
                                                    formElementRetry.scrollIntoView(
                                                      {
                                                        behavior: "smooth",
                                                        block: "start",
                                                      },
                                                    );
                                                  }
                                                }, 200);
                                              }
                                            }, 100);
                                          }}
                                          className="px-2.5 py-1 text-[10.5px] font-bold text-slate-700 bg-white border border-gray-250 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                                        >
                                          Edit properties ✏️
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleTriggerUpdateImmediately(occurrence.id)}
                                          title="Immediately synchronise latest meeting changes to affected users"
                                          className="px-2.5 py-1 text-[10.5px] font-bold text-[#4B5E40] bg-[#4B5E40]/10 border border-[#4B5E40]/30 rounded-lg hover:bg-[#4B5E40]/20 transition cursor-pointer flex items-center gap-1"
                                        >
                                          ⚡ Update Immediately
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMeetingToDeleteId(occurrence.id);
                                            setDeleteRecurrenceOption("single");
                                          }}
                                          className="px-2.5 py-1 text-[10.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                        >
                                          Delete scheduled 🗑️
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Render attendance drawer inline if active for any occurrence in this series */}
                              {series.occurrences.some(
                                (occ: any) =>
                                  expandedAttendanceMeetingId === occ.id,
                              ) &&
                                (() => {
                                  const currentOcc = series.occurrences.find(
                                    (occ: any) =>
                                      expandedAttendanceMeetingId === occ.id,
                                  );
                                  const eligibleAssignments = (
                                    state.meetingAssignments || []
                                  ).filter(
                                    (a: any) => a.meetingId === currentOcc.id,
                                  );
                                  const eligibleUserIds =
                                    eligibleAssignments.map(
                                      (a: any) => a.userId,
                                    );
                                  const eligibleProfiles = (
                                    state.profiles || []
                                  ).filter(
                                    (p: any) =>
                                      p.role !== "admin" &&
                                      (eligibleUserIds.includes(p.id) ||
                                        isUserEligibleForMeetingInBackend(
                                          p,
                                          currentOcc,
                                          state.meetingAssignments || [],
                                        ) ||
                                        (state.attendance || []).some(
                                          (a: any) =>
                                            isMatchingLogForMeetingAndUser(
                                              a,
                                              currentOcc,
                                              p,
                                            ),
                                        )),
                                  );
                                  const attendanceLogs = (
                                    state.attendance || []
                                  ).filter((a: any) =>
                                    isMatchingLogForMeeting(a, currentOcc),
                                  );

                                  const summaryData = computeRealTimeAttendanceSummary(
                                    currentOcc,
                                    eligibleProfiles,
                                    attendanceLogs,
                                    currentDateState
                                  );

                                  const {
                                    liveStatusTag,
                                    liveStatusBadgeClass,
                                    liveSubtext,
                                    onTimeList,
                                    lateList,
                                    absentList,
                                    list,
                                    attendanceRate,
                                  } = summaryData;

                                  const displayedList =
                                    attendanceFilterTab === "on_time"
                                      ? onTimeList
                                      : attendanceFilterTab === "late"
                                        ? lateList
                                        : attendanceFilterTab === "absent"
                                          ? absentList
                                          : list;

                                  return (
                                    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-250 space-y-3 animate-fade-in text-left">
                                      <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                                        <div className="flex items-center gap-1.5 text-[#4B5E40] font-extrabold text-xs">
                                          <Users className="w-4 h-4" />
                                          <span>
                                            Attendance Summary for{" "}
                                            {currentOcc.occurrenceDate}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-gray-200 text-gray-750 rounded-full">
                                          {onTimeList.length + lateList.length}{" "}
                                          / {list.length} Joined
                                        </span>
                                      </div>

                                      {/* Metrics display */}
                                      <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                                        <div className="bg-[#4B5E40]/5 p-1.5 rounded-lg border border-[#4B5E40]/10">
                                          <div className="text-[8px] uppercase font-bold text-gray-400">
                                            Rate
                                          </div>
                                          <div className="text-xs font-black text-[#4B5E40]">
                                            {attendanceRate}%
                                          </div>
                                        </div>
                                        <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                          <div className="text-[8px] uppercase font-bold text-emerald-600">
                                            On Time
                                          </div>
                                          <div className="text-xs font-black text-emerald-700">
                                            {onTimeList.length}
                                          </div>
                                        </div>
                                        <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                                          <div className="text-[8px] uppercase font-bold text-amber-600">
                                            Late
                                          </div>
                                          <div className="text-xs font-black text-amber-700">
                                            {lateList.length}
                                          </div>
                                        </div>
                                        <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                                          <div className="text-[8px] uppercase font-bold text-rose-500">
                                            Absent
                                          </div>
                                          <div className="text-xs font-black text-rose-700">
                                            {absentList.length}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Filter tabs */}
                                      <div className="flex gap-1 bg-gray-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAttendanceFilterTab("all")
                                          }
                                          className={`flex-1 py-1 rounded-md text-center transition ${
                                            attendanceFilterTab === "all"
                                              ? "bg-white text-gray-800 shadow-2xs font-extrabold"
                                              : "text-gray-500 hover:text-gray-950"
                                          }`}
                                        >
                                          All ({list.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAttendanceFilterTab("on_time")
                                          }
                                          className={`flex-1 py-1 rounded-md text-center transition ${
                                            attendanceFilterTab === "on_time"
                                              ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                                              : "text-gray-500 hover:text-gray-950"
                                          }`}
                                        >
                                          On Time ({onTimeList.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAttendanceFilterTab("late")
                                          }
                                          className={`flex-1 py-1 rounded-md text-center transition ${
                                            attendanceFilterTab === "late"
                                              ? "bg-white text-amber-700 shadow-2xs font-extrabold"
                                              : "text-gray-500 hover:text-gray-950"
                                          }`}
                                        >
                                          Late ({lateList.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAttendanceFilterTab("absent")
                                          }
                                          className={`flex-1 py-1 rounded-md text-center transition ${
                                            attendanceFilterTab === "absent"
                                              ? "bg-white text-rose-600 shadow-2xs font-extrabold"
                                              : "text-gray-500 hover:text-gray-950"
                                          }`}
                                        >
                                          Absent ({absentList.length})
                                        </button>
                                      </div>

                                      {/* Attendance rows */}
                                      <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                                        {displayedList.length === 0 ? (
                                          <div className="text-center py-4 text-gray-400 text-[10px] font-medium italic">
                                            No records match this filter.
                                          </div>
                                        ) : (
                                          displayedList.map((item: any) => {
                                            const initials = (
                                              item.fullName ||
                                              item.username ||
                                              "U"
                                            )
                                              .split(" ")
                                              .map((n: string) => n[0])
                                              .join("")
                                              .substring(0, 2)
                                              .toUpperCase();

                                            return (
                                              <div
                                                key={item.id}
                                                className="flex items-center justify-between p-1.5 hover:bg-gray-55 rounded-lg border border-gray-150 bg-white transition gap-2"
                                              >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <div
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                                                      item.attended
                                                        ? "bg-[#4B5E40] text-white"
                                                        : "bg-gray-200 text-gray-600"
                                                    }`}
                                                  >
                                                    {initials}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <div className="font-extrabold text-[11px] text-gray-800 truncate">
                                                      {item.fullName || item.username}
                                                    </div>
                                                    <div className="text-[9px] text-gray-400 truncate">
                                                      {item.track} • {item.learningLevel || "Apprentice"}
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex flex-col items-end shrink-0 gap-0.5">
                                                  <span
                                                    className={`px-1.5 py-0.5 text-[8.5px] font-extrabold rounded-md border tracking-wide uppercase ${
                                                      item.status ===
                                                        "Attended" ||
                                                      item.status ===
                                                        "on time" ||
                                                      item.status ===
                                                        "Attended On Time"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : item.status ===
                                                              "Late" ||
                                                            item.status ===
                                                              "Attended Late"
                                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                                          : item.status ===
                                                              "Very Late" ||
                                                            item.status ===
                                                              "Attended Very Late"
                                                          ? "bg-orange-50 text-orange-700 border-orange-200"
                                                          : "bg-rose-50 text-rose-700 border-rose-200"
                                                    }`}
                                                  >
                                                    {item.status}
                                                  </span>
                                                  {item.attended && (
                                                    <span className="text-[8.5px] font-medium text-gray-500">
                                                      {item.joinTimeDisplay && item.joinTimeDisplay !== "No Check-in"
                                                        ? `Joined: ${item.joinTimeDisplay}`
                                                        : (item.timeTrackingSubtext || "Joined")}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Render active standalone meetings */}
                    {standaloneActive.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="p-3.5 bg-[#F8FAF8] rounded-xl border border-gray-150 flex flex-col justify-between gap-3 text-xs shadow-2xs animate-fade-in"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[9.5px] font-bold uppercase text-gray-400 font-mono tracking-wider">
                              ID: {meeting.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[8.5px] font-extrabold rounded-md border tracking-wide ${
                                meeting.type === "knowledge" ||
                                meeting.type.toLowerCase().includes("knowledge")
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : meeting.type === "standup" ||
                                      meeting.type === "microservice" ||
                                      meeting.type
                                        .toLowerCase()
                                        .includes("standup")
                                    ? "bg-teal-50 text-teal-700 border-teal-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {getMeetingTypeLabel(meeting.type)}
                            </span>
                          </div>
                          <h5 className="font-extrabold text-slate-900 mt-1.5 text-xs sm:text-sm leading-snug">
                            {meeting.title}
                          </h5>

                          <div className="grid grid-cols-1 gap-1 mt-2 text-[11px] text-gray-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400">🗓️</span>
                              <span className="font-bold text-gray-700">
                                {meeting.timeString}
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-gray-400 mt-0.5">📅</span>
                              <span className="leading-tight">
                                Scheduled for:{" "}
                                <strong className="text-indigo-800">
                                  {getAdminMeetingDateLabel(meeting)}
                                </strong>
                              </span>
                            </div>
                            <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                              <div
                                className="flex items-start gap-1.5"
                                id={`meeting-user-levels-eligibility-${meeting.id}`}
                              >
                                <span className="text-gray-400 mt-0.5">🛡️</span>
                                <span className="leading-tight">
                                  User Level Eligibility:{" "}
                                  <strong className="text-[#4B5E40] uppercase">
                                    {getUserLevelsDisplay(
                                      meeting.trackId,
                                      meeting.userLevels,
                                    )}
                                  </strong>
                                </span>
                              </div>
                              <div
                                className="flex items-start gap-1.5"
                                id={`meeting-team-tracks-eligibility-${meeting.id}`}
                              >
                                <span className="text-gray-400 mt-0.5">👥</span>
                                <span className="leading-tight">
                                  Team Track Eligibility:{" "}
                                  <strong className="text-[#4B5E40] uppercase">
                                    {getTeamTracksDisplay(
                                      meeting.targetTeamTrackEligibility,
                                    )}
                                  </strong>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] break-all text-indigo-700 bg-indigo-50/40 p-1 rounded border border-indigo-100">
                              <strong>Link:</strong> {meeting.jitsiUrl}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1 border-t border-dashed border-gray-150 justify-end items-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (expandedAttendanceMeetingId === meeting.id) {
                                setExpandedAttendanceMeetingId(null);
                              } else {
                                setExpandedAttendanceMeetingId(meeting.id);
                                setAttendanceFilterTab("all");
                              }
                            }}
                            className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition mr-auto cursor-pointer ${
                              expandedAttendanceMeetingId === meeting.id
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold shadow-sm"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                            }`}
                          >
                            {expandedAttendanceMeetingId === meeting.id
                              ? "Close Attendance 📊"
                              : "Track Attendance 📊"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerUpdateImmediately(meeting.id)}
                            title="Immediately synchronise latest meeting changes to affected users"
                            className="px-2.5 py-1 text-[10.5px] font-bold text-[#4B5E40] bg-[#4B5E40]/10 border border-[#4B5E40]/30 rounded-lg hover:bg-[#4B5E40]/20 transition cursor-pointer flex items-center gap-1"
                          >
                            ⚡ Update Immediately
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMeetingId(meeting.id);
                              setMeetingTitle(meeting.title);
                              setMeetingTime(meeting.timeString);
                              setMeetingUrl(meeting.jitsiUrl);
                              setMeetingType(meeting.type);
                              const rawLevels =
                                meeting.userLevels !== undefined
                                  ? meeting.userLevels
                                  : meeting.trackId;
                              setMeetingTrack(
                                Array.isArray(rawLevels)
                                  ? rawLevels
                                  : rawLevels === "All" || !rawLevels
                                    ? []
                                    : [rawLevels],
                              );
                              setMeetingTeamTracks(
                                meeting.targetTeamTrackEligibility || [],
                              );
                              setMeetingScheduleDays(
                                meeting.scheduleDays &&
                                  meeting.scheduleDays.length > 0
                                  ? meeting.scheduleDays
                                  : [
                                      "Monday",
                                      "Tuesday",
                                      "Wednesday",
                                      "Thursday",
                                      "Friday",
                                    ],
                              );
                              setMeetingDates(meeting.meetingDates || []);
                              setMeetingDuration(
                                meeting.duration || "60 minutes",
                              );
                              setMeetingOrganizer(
                                meeting.organizer || "Admin Team",
                              );
                              setMeetingStatus(meeting.status || "Upcoming");
                              setMeetingDescription(meeting.description || "");
                              setMeetingAssignedUsers(
                                meeting.assignedUserIds || [],
                              );
                              setUserSearchText("");
                              setIsRecurring(false);
                              setRecurrenceFrequency("one-time");
                              setRecurrenceStartDate("");
                              setRecurrenceEndDate("");
                              setRecurrenceCustomInterval(1);
                              setRecurrenceEditMode("single");
                              setIsAddingMeeting(false);
                              // Scroll back to editing form smoothly after state update
                              setTimeout(() => {
                                const formElement = document.getElementById(
                                  "meeting-edit-form-anchor",
                                );
                                if (formElement) {
                                  formElement.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                                } else {
                                  setTimeout(() => {
                                    const formElementRetry =
                                      document.getElementById(
                                        "meeting-edit-form-anchor",
                                      );
                                    if (formElementRetry) {
                                      formElementRetry.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                      });
                                    }
                                  }, 200);
                                }
                              }, 100);
                            }}
                            className="px-2.5 py-1 text-[10.5px] font-bold text-slate-700 bg-white border border-gray-250 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                          >
                            Edit properties ✏️
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMeetingToDeleteId(meeting.id);
                              setDeleteRecurrenceOption("single");
                            }}
                            className="px-2.5 py-1 text-[10.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                          >
                            Delete scheduled 🗑️
                          </button>
                        </div>

                        {/* Standalone Attendance Drawer */}
                        {expandedAttendanceMeetingId === meeting.id &&
                          (() => {
                            const eligibleAssignments = (
                              state.meetingAssignments || []
                            ).filter((a: any) => a.meetingId === meeting.id);
                            const eligibleUserIds = eligibleAssignments.map(
                              (a: any) => a.userId,
                            );
                            const eligibleProfiles = (
                              state.profiles || []
                            ).filter(
                              (p: any) =>
                                p.role !== "admin" &&
                                (eligibleUserIds.includes(p.id) ||
                                  isUserEligibleForMeetingInBackend(
                                    p,
                                    meeting,
                                    state.meetingAssignments || [],
                                  ) ||
                                  (state.attendance || []).some((a: any) =>
                                    isMatchingLogForMeetingAndUser(
                                      a,
                                      meeting,
                                      p,
                                    ),
                                  )),
                            );
                            const attendanceLogs = (
                              state.attendance || []
                            ).filter((a: any) =>
                              isMatchingLogForMeeting(a, meeting),
                            );

                            const onTimeList: any[] = [];
                            const lateList: any[] = [];
                            const absentList: any[] = [];

                            eligibleProfiles.forEach((p: any) => {
                              const userLogs = attendanceLogs.filter((l: any) =>
                                isMatchingLogForMeetingAndUser(l, meeting, p),
                              );
                              const attendedLog = userLogs.find((l: any) => {
                                const s = (l.status || "").toLowerCase();
                                return !s.includes("miss") && !s.includes("absent");
                              });

                              const baseItem = {
                                id: p.id,
                                fullName: p.fullName,
                                username: p.username,
                                learningLevel:
                                  p.learningLevel ||
                                  p.techExperience ||
                                  "Apprentice level 1",
                                track: p.track || "General",
                                attended: !!attendedLog,
                                timestamp: attendedLog ? (attendedLog.timestamp || attendedLog.joinedAtTime || null) : null,
                                joinTimeDisplay: attendedLog ? (attendedLog.joinedAtTime || (attendedLog.timestamp ? new Date(attendedLog.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "Checked in")) : "No Check-in",
                              };

                              if (!attendedLog) {
                                absentList.push({
                                  ...baseItem,
                                  status: "Absent",
                                });
                              } else {
                                const scheduledTimeStr = meeting.scheduledStartTime || meeting.timeString || meeting.time || attendedLog.scheduledStartTime || "09:00 AM";
                                const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);

                                let joinMinutes: number | null = null;
                                if (attendedLog.joinedAtTime) {
                                  joinMinutes = parseMeetingTimeToMinutes(attendedLog.joinedAtTime);
                                } else if (attendedLog.timestamp) {
                                  joinMinutes = getLagosMinutesPastMidnight(new Date(attendedLog.timestamp));
                                }

                                const statusLower = (attendedLog.status || "").toLowerCase();
                                let isLate = false;
                                let isVeryLate = false;

                                if (joinMinutes !== null && scheduledMinutes !== null) {
                                  if (joinMinutes > scheduledMinutes + 5) {
                                    isVeryLate = true;
                                    isLate = true;
                                  } else if (joinMinutes > scheduledMinutes + 2) {
                                    isLate = true;
                                  }
                                } else if (statusLower.includes("very late")) {
                                  isVeryLate = true;
                                  isLate = true;
                                } else if (statusLower.includes("late")) {
                                  isLate = true;
                                }

                                if (isVeryLate) {
                                  lateList.push({
                                    ...baseItem,
                                    status: "Attended Very Late",
                                  });
                                } else if (isLate) {
                                  lateList.push({
                                    ...baseItem,
                                    status: "Attended Late",
                                  });
                                } else {
                                  onTimeList.push({
                                    ...baseItem,
                                    status: "Attended On Time",
                                  });
                                }
                              }
                            });

                            const sortByJoinTimeDesc = (a: any, b: any) => {
                              const tA = a.timestamp || a.joinTimeDisplay || "";
                              const tB = b.timestamp || b.joinTimeDisplay || "";
                              return tB.localeCompare(tA);
                            };
                            onTimeList.sort(sortByJoinTimeDesc);
                            lateList.sort(sortByJoinTimeDesc);

                            const list = [
                              ...onTimeList,
                              ...lateList,
                              ...absentList,
                            ];

                            const displayedList =
                              attendanceFilterTab === "on_time"
                                ? onTimeList
                                : attendanceFilterTab === "late"
                                  ? lateList
                                  : attendanceFilterTab === "absent"
                                    ? absentList
                                    : list;

                            const rawRate =
                              list.length > 0
                                ? ((onTimeList.length + lateList.length) /
                                    list.length) *
                                  100
                                : 0;
                            const attendanceRate =
                              rawRate % 1 === 0
                                ? rawRate.toFixed(0)
                                : rawRate.toFixed(1);

                            return (
                              <div
                                className="mt-3 p-3 bg-white border border-gray-200 rounded-xl space-y-3 animate-fade-in text-left col-span-1 md:col-span-2"
                                id={`attendance-tracker-panel-${meeting.id}`}
                              >
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <div className="flex items-center gap-1.5 text-[#4B5E40] font-extrabold text-xs">
                                    <Users className="w-4 h-4" />
                                    <span>Attendance Summary</span>
                                  </div>
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-gray-100 text-gray-750 rounded-full">
                                    {onTimeList.length + lateList.length} /{" "}
                                    {list.length} Joined
                                  </span>
                                </div>

                                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                                  <div className="bg-[#4B5E40]/5 p-1.5 rounded-lg border border-[#4B5E40]/10">
                                    <div className="text-[8px] uppercase font-bold text-gray-400">
                                      Rate
                                    </div>
                                    <div className="text-xs font-black text-[#4B5E40]">
                                      {attendanceRate}%
                                    </div>
                                  </div>
                                  <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                    <div className="text-[8px] uppercase font-bold text-emerald-600">
                                      On Time
                                    </div>
                                    <div className="text-xs font-black text-emerald-700">
                                      {onTimeList.length}
                                    </div>
                                  </div>
                                  <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                                    <div className="text-[8px] uppercase font-bold text-amber-600">
                                      Late
                                    </div>
                                    <div className="text-xs font-black text-amber-700">
                                      {lateList.length}
                                    </div>
                                  </div>
                                  <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                                    <div className="text-[8px] uppercase font-bold text-rose-500">
                                      Absent
                                    </div>
                                    <div className="text-xs font-black text-rose-700">
                                      {absentList.length}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-1 bg-gray-150/60 p-0.5 rounded-lg text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttendanceFilterTab("all")
                                    }
                                    className={`flex-1 py-1 rounded-md text-center transition ${
                                      attendanceFilterTab === "all"
                                        ? "bg-white text-gray-800 shadow-2xs font-extrabold"
                                        : "text-gray-500 hover:text-gray-950"
                                    }`}
                                  >
                                    All ({list.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttendanceFilterTab("on_time")
                                    }
                                    className={`flex-1 py-1 rounded-md text-center transition ${
                                      attendanceFilterTab === "on_time"
                                        ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                                        : "text-gray-500 hover:text-gray-950"
                                    }`}
                                  >
                                    On Time ({onTimeList.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttendanceFilterTab("late")
                                    }
                                    className={`flex-1 py-1 rounded-md text-center transition ${
                                      attendanceFilterTab === "late"
                                        ? "bg-white text-amber-700 shadow-2xs font-extrabold"
                                        : "text-gray-500 hover:text-gray-950"
                                    }`}
                                  >
                                    Late ({lateList.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttendanceFilterTab("absent")
                                    }
                                    className={`flex-1 py-1 rounded-md text-center transition ${
                                      attendanceFilterTab === "absent"
                                        ? "bg-white text-rose-600 shadow-2xs font-extrabold"
                                        : "text-gray-500 hover:text-gray-950"
                                    }`}
                                  >
                                    Absent ({absentList.length})
                                  </button>
                                </div>

                                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                                  {displayedList.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400 text-[10px] font-medium italic">
                                      No records match this filter.
                                    </div>
                                  ) : (
                                    displayedList.map((item: any) => {
                                      const initials = (
                                        item.fullName ||
                                        item.username ||
                                        "U"
                                      )
                                        .split(" ")
                                        .map((n: string) => n[0])
                                        .join("")
                                        .substring(0, 2)
                                        .toUpperCase();

                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center justify-between p-1.5 hover:bg-gray-55 rounded-lg border border-gray-150 bg-white transition gap-2"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <div
                                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                                                item.attended
                                                  ? "bg-[#4B5E40] text-white"
                                                  : "bg-gray-200 text-gray-600"
                                              }`}
                                            >
                                              {initials}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="font-extrabold text-[11px] text-gray-800 truncate">
                                                {item.fullName || item.username}
                                              </div>
                                              <div className="text-[9px] text-gray-400 truncate">
                                                {item.track} • {item.learningLevel || "Apprentice"}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex flex-col items-end shrink-0 gap-0.5">
                                            <span
                                              className={`px-1.5 py-0.5 text-[8.5px] font-extrabold rounded-md border tracking-wide uppercase ${
                                                item.status === "Attended" ||
                                                item.status === "on time" ||
                                                item.status ===
                                                  "Attended On Time"
                                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                  : item.status === "Late" ||
                                                      item.status ===
                                                        "Attended Late"
                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                    : item.status === "Very Late" ||
                                                      item.status ===
                                                        "Attended Very Late"
                                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                              }`}
                                            >
                                              {item.status}
                                            </span>
                                            {item.attended && (
                                              <span className="text-[8.5px] font-medium text-gray-500">
                                                {item.joinTimeDisplay && item.joinTimeDisplay !== "No Check-in"
                                                  ? `Joined: ${item.joinTimeDisplay}`
                                                  : (item.timeTrackingSubtext || "Joined")}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* ARCHIVED & COMPLETED MEETINGS REPOSITORY */}
            <div
              className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs transition-all duration-200"
              id="archived-meetings-repository"
            >
              <div
                className="flex items-center justify-between cursor-pointer select-none group"
                onClick={() => setIsArchiveRepoExpanded(!isArchiveRepoExpanded)}
              >
                <div className="space-y-1 pr-4">
                  <h3 className="font-extrabold text-sm text-[#4B5E40] leading-normal flex items-center gap-2 group-hover:text-[#3d4d34] transition-colors">
                    <span>📁 Archived & Completed Meetings Repository</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Historical database of meetings that have completed or been
                    manually archived. These records retain all full meeting
                    details, attendance logs, and reports, and remain available
                    for export.
                  </p>
                </div>
                <div className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0">
                  <ChevronDown
                    className={`w-5 h-5 transform transition-transform duration-200 ${isArchiveRepoExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {isArchiveRepoExpanded && (
                <div className="space-y-4 mt-4 pt-4 border-t border-gray-100 animate-slide-up">
                  {/* Filter controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100 text-xs font-semibold">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-gray-400">
                        Search Meetings
                      </label>
                      <input
                        type="text"
                        placeholder="Search title, description..."
                        value={archiveSearchText}
                        onChange={(e) => setArchiveSearchText(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#4B5E40] text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-gray-400">
                        Filter by Date
                      </label>
                      <input
                        type="date"
                        value={archiveDateFilter}
                        onChange={(e) => setArchiveDateFilter(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#4B5E40] text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-gray-400">
                        Filter by Type
                      </label>
                      <select
                        value={archiveTypeFilter}
                        onChange={(e) => setArchiveTypeFilter(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4B5E40] text-xs font-medium cursor-pointer"
                      >
                        <option value="">All Types</option>
                        {state.meetingTypes &&
                          state.meetingTypes.map((type: string) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        <option value="Knowledge Track">Knowledge Track</option>
                        <option value="Microservice Alignment">
                          Microservice Alignment
                        </option>
                        <option value="General Alignment">
                          General Alignment
                        </option>
                        <option value="Weekly Drills Sync">
                          Weekly Drills Sync
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-gray-400">
                        Filter by Organizer
                      </label>
                      <select
                        value={archiveOrganizerFilter}
                        onChange={(e) =>
                          setArchiveOrganizerFilter(e.target.value)
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4B5E40] text-xs font-medium cursor-pointer"
                      >
                        <option value="">All Organizers</option>
                        {(() => {
                          const set = new Set<string>();
                          set.add("Admin Team");
                          set.add("Facilitators");
                          set.add("Track Lead");
                          set.add("External Speaker");

                          (state.meetings || []).forEach((m: any) => {
                            const org = String(
                              m.organizer || m.meetingOrganizer || "",
                            ).trim();
                            if (org) {
                              set.add(org);
                            }
                          });

                          (state.profiles || [])
                            .filter(
                              (p: any) =>
                                p.role === "admin" ||
                                p.learningLevel?.toLowerCase() === "mentor" ||
                                p.learningLevel?.toLowerCase() ===
                                  "administrative mentor",
                            )
                            .forEach((p: any) => {
                              const name = String(p.fullName || "").trim();
                              if (name) {
                                set.add(name);
                              }
                            });

                          return Array.from(set)
                            .sort((a, b) => a.localeCompare(b))
                            .map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ));
                        })()}
                      </select>
                    </div>
                  </div>

                  {/* Reset Filter Button */}
                  {(archiveSearchText ||
                    archiveDateFilter ||
                    archiveTypeFilter ||
                    archiveOrganizerFilter) && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setArchiveSearchText("");
                          setArchiveDateFilter("");
                          setArchiveTypeFilter("");
                          setArchiveOrganizerFilter("");
                        }}
                        className="text-[11px] text-rose-600 font-extrabold hover:underline cursor-pointer"
                      >
                        Clear Filters &times;
                      </button>
                    </div>
                  )}

                  {/* List of Archived/Completed Meetings */}
                  <div className="space-y-3">
                    {(() => {
                      const archived = (state.meetings || []).filter(
                        (m: any) => {
                          const statusLower = String(m.status || "")
                            .trim()
                            .toLowerCase();
                          if (
                            statusLower !== "archived" &&
                            statusLower !== "completed"
                          )
                            return false;

                          // Search text
                          if (archiveSearchText) {
                            const search = archiveSearchText.toLowerCase();
                            const matchTitle = String(m.title || "")
                              .toLowerCase()
                              .includes(search);
                            const matchDesc = String(m.description || "")
                              .toLowerCase()
                              .includes(search);
                            if (!matchTitle && !matchDesc) return false;
                          }

                          // Date filter
                          if (archiveDateFilter) {
                            const hasMatchDate =
                              m.occurrenceDate === archiveDateFilter ||
                              (m.meetingDates &&
                                Array.isArray(m.meetingDates) &&
                                m.meetingDates.includes(archiveDateFilter));
                            if (!hasMatchDate) return false;
                          }

                          // Type filter
                          if (
                            archiveTypeFilter &&
                            String(m.type || "").toLowerCase() !==
                              archiveTypeFilter.toLowerCase()
                          ) {
                            return false;
                          }

                          // Organizer filter
                          if (
                            archiveOrganizerFilter &&
                            String(
                              m.organizer || m.meetingOrganizer || "Admin Team",
                            ).toLowerCase() !==
                              archiveOrganizerFilter.toLowerCase()
                          ) {
                            return false;
                          }

                          return true;
                        },
                      );

                      if (archived.length === 0) {
                        return (
                          <div className="py-8 text-center text-gray-450 text-xs font-medium bg-gray-50/50 rounded-xl border border-dashed">
                            No archived or completed meetings match the filters.
                          </div>
                        );
                      }

                      // Export all filtered archived CSV function
                      const exportFilteredToCSV = () => {
                        const headers = [
                          "ID",
                          "Title",
                          "Type",
                          "Organizer",
                          "Scheduled Date",
                          "Time",
                          "Duration",
                          "Status",
                        ];
                        const rows = archived.map((m) => [
                          m.id,
                          m.title,
                          m.type,
                          m.organizer || "Admin Team",
                          m.occurrenceDate ||
                            (m.meetingDates && m.meetingDates[0]) ||
                            "N/A",
                          m.timeString || m.time || "N/A",
                          m.duration || "N/A",
                          m.status || "N/A",
                        ]);

                        const csvContent =
                          "data:text/csv;charset=utf-8," +
                          [
                            headers.join(","),
                            ...rows.map((e) =>
                              e
                                .map(
                                  (val) =>
                                    `"${String(val).replace(/"/g, '""')}"`,
                                )
                                .join(","),
                            ),
                          ].join("\n");

                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute(
                          "download",
                          `archived_meetings_report_${getLagosDateString(new Date())}.csv`,
                        );
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      };

                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2 justify-between items-center pb-2 bg-gray-50/70 p-3 rounded-xl border border-gray-150">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-gray-600 font-extrabold">
                                Showing {archived.length} archived records
                              </span>
                              {archived.length > 2 && (
                                <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const container = document.getElementById(
                                        "archive-meetings-grid-container",
                                      );
                                      if (container)
                                        container.scrollTo({
                                          top: 0,
                                          behavior: "smooth",
                                        });
                                    }}
                                    className="p-1 px-2 text-[#4B5E40] hover:bg-[#4B5E40]/10 hover:text-[#3d4d34] rounded-lg border border-[#4B5E40]/15 bg-white transition cursor-pointer flex items-center gap-1 shadow-2xs font-extrabold text-[10px]"
                                    title="Scroll to Top"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                    <span>Top</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const container = document.getElementById(
                                        "archive-meetings-grid-container",
                                      );
                                      if (container)
                                        container.scrollTo({
                                          top: container.scrollHeight,
                                          behavior: "smooth",
                                        });
                                    }}
                                    className="p-1 px-2 text-[#4B5E40] hover:bg-[#4B5E40]/10 hover:text-[#3d4d34] rounded-lg border border-[#4B5E40]/15 bg-white transition cursor-pointer flex items-center gap-1 shadow-2xs font-extrabold text-[10px]"
                                    title="Scroll to Bottom"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                    <span>Bottom</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={exportFilteredToCSV}
                              className="px-2.5 py-1 text-[10px] font-extrabold bg-[#4B5E40] text-white hover:bg-[#3d4d34] rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              📥 Export Filtered Report (CSV)
                            </button>
                          </div>

                          <div
                            id="archive-meetings-grid-container"
                            className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2 scroll-smooth"
                          >
                            {archived.map((meeting: any) => {
                              const mDate =
                                meeting.occurrenceDate ||
                                (meeting.meetingDates &&
                                  meeting.meetingDates[0]) ||
                                "N/A";
                              const isCompleted =
                                String(meeting.status || "").toLowerCase() ===
                                "completed";

                              return (
                                <div
                                  key={meeting.id}
                                  className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-150 flex flex-col justify-between gap-3 text-xs"
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-black text-gray-800 text-[12.5px] truncate max-w-[70%]">
                                        {meeting.title}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${
                                          isCompleted
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                                            : "bg-gray-100 text-gray-600 border-gray-200"
                                        }`}
                                      >
                                        {meeting.status}
                                      </span>
                                    </div>

                                    <p className="text-[11px] text-gray-500 font-medium line-clamp-2">
                                      {meeting.description ||
                                        "No description provided."}
                                    </p>

                                    <div className="grid grid-cols-2 gap-1.5 text-[10.5px] font-medium text-gray-600 pt-1">
                                      <div>📅 {mDate}</div>
                                      <div>
                                        🕒{" "}
                                        {meeting.timeString ||
                                          meeting.time ||
                                          "N/A"}
                                      </div>
                                      <div>
                                        ⏳ {meeting.duration || "30 minutes"}
                                      </div>
                                      <div>
                                        👤 {meeting.organizer || "Admin Team"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                          if (
                                            expandedAttendanceMeetingId ===
                                            meeting.id
                                          ) {
                                            setExpandedAttendanceMeetingId(null);
                                          } else {
                                            setExpandedAttendanceMeetingId(
                                              meeting.id,
                                            );
                                            setAttendanceFilterTab("all");
                                          }
                                        }}
                                      className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition cursor-pointer ${
                                        expandedAttendanceMeetingId ===
                                        meeting.id
                                          ? "bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold shadow-sm"
                                          : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                                      }`}
                                    >
                                      {expandedAttendanceMeetingId ===
                                      meeting.id
                                        ? "Close Attendance 📊"
                                        : "View Attendance & Report 📊"}
                                    </button>

                                    {/* Single record CSV export */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const attLogs = (
                                          state.attendance || []
                                        ).filter((a: any) =>
                                          isMatchingLogForMeeting(a, meeting),
                                        );
                                        const eligibleMa = (
                                          state.meetingAssignments || []
                                        ).filter(
                                          (a: any) =>
                                            a.meetingId === meeting.id,
                                        );
                                        const eligibleUids = eligibleMa.map(
                                          (a: any) => a.userId,
                                        );
                                        const eligibleProfs = (
                                          state.profiles || []
                                        ).filter(
                                          (p: any) =>
                                            p.role !== "admin" &&
                                            (eligibleUids.includes(p.id) ||
                                              isUserEligibleForMeetingInBackend(
                                                p,
                                                meeting,
                                                state.meetingAssignments || [],
                                              ) ||
                                              attLogs.some((a: any) =>
                                                isMatchingLogForMeetingAndUser(
                                                  a,
                                                  meeting,
                                                  p,
                                                ),
                                              )),
                                        );

                                        const headers = [
                                          "User ID",
                                          "Full Name",
                                          "Username",
                                          "Track",
                                          "Status",
                                          "Timestamp",
                                        ];
                                        const rows = eligibleProfs.map(
                                          (p: any) => {
                                            const userLogs = attLogs.filter(
                                              (l: any) =>
                                                isMatchingLogForMeetingAndUser(
                                                  l,
                                                  meeting,
                                                  p,
                                                ),
                                            );
                                            const log =
                                              userLogs.find((l: any) => {
                                                const s = (
                                                  l.status || ""
                                                ).toLowerCase();
                                                return (
                                                  !s.includes("miss") &&
                                                  !s.includes("absent")
                                                );
                                              }) || userLogs[0];
                                            return [
                                              p.id,
                                              p.fullName || "",
                                              p.username || "",
                                              p.track || "General",
                                              log ? log.status : "Absent",
                                              log ? log.timestamp : "N/A",
                                            ];
                                          },
                                        );

                                        const csvContent =
                                          "data:text/csv;charset=utf-8," +
                                          [
                                            headers.join(","),
                                            ...rows.map((e) =>
                                              e
                                                .map(
                                                  (val) =>
                                                    `"${String(val).replace(/"/g, '""')}"`,
                                                )
                                                .join(","),
                                            ),
                                          ].join("\n");

                                        const encodedUri =
                                          encodeURI(csvContent);
                                        const link =
                                          document.createElement("a");
                                        link.setAttribute("href", encodedUri);
                                        link.setAttribute(
                                          "download",
                                          `meeting_attendance_${meeting.title.replace(/\s+/g, "_")}.csv`,
                                        );
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                      className="px-2 py-1 text-[10.5px] font-bold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition cursor-pointer"
                                    >
                                      Export Meeting CSV
                                    </button>
                                  </div>

                                  {/* Attendance Tracker expanded drawer */}
                                  {expandedAttendanceMeetingId === meeting.id &&
                                    (() => {
                                      const eligibleAssignments = (
                                        state.meetingAssignments || []
                                      ).filter(
                                        (a: any) => a.meetingId === meeting.id,
                                      );
                                      const eligibleUserIds =
                                        eligibleAssignments.map(
                                          (a: any) => a.userId,
                                        );

                                      const eligibleProfiles = (
                                        state.profiles || []
                                      ).filter(
                                        (p: any) =>
                                          p.role !== "admin" &&
                                          (eligibleUserIds.includes(p.id) ||
                                            isUserEligibleForMeetingInBackend(
                                              p,
                                              meeting,
                                              state.meetingAssignments || [],
                                            ) ||
                                            (state.attendance || []).some(
                                              (a: any) =>
                                                isMatchingLogForMeetingAndUser(
                                                  a,
                                                  meeting,
                                                  p,
                                                ),
                                            )),
                                      );
                                      const attendanceLogs = (
                                        state.attendance || []
                                      ).filter((a: any) =>
                                        isMatchingLogForMeeting(a, meeting),
                                      );

                                      const onTimeList: any[] = [];
                                      const lateList: any[] = [];
                                      const absentList: any[] = [];

                                      eligibleProfiles.forEach((p: any) => {
                                        const userLogs = attendanceLogs.filter(
                                          (l: any) =>
                                            isMatchingLogForMeetingAndUser(
                                              l,
                                              meeting,
                                              p,
                                            ),
                                        );
                                        const attendedLog = userLogs.find((l: any) => {
                                          const s = (l.status || "").toLowerCase();
                                          return !s.includes("miss") && !s.includes("absent");
                                        });

                                        const baseItem = {
                                          id: p.id,
                                          fullName: p.fullName,
                                          username: p.username,
                                          learningLevel:
                                            p.learningLevel ||
                                            p.techExperience ||
                                            "Apprentice level 1",
                                          track: p.track || "General",
                                          attended: !!attendedLog,
                                          timestamp: attendedLog ? (attendedLog.timestamp || attendedLog.joinedAtTime || null) : null,
                                          joinTimeDisplay: attendedLog ? (attendedLog.joinedAtTime || (attendedLog.timestamp ? new Date(attendedLog.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "Checked in")) : "No Check-in",
                                        };

                                        if (!attendedLog) {
                                          absentList.push({
                                            ...baseItem,
                                            status: "Absent",
                                          });
                                        } else {
                                          const scheduledTimeStr = meeting.scheduledStartTime || meeting.timeString || meeting.time || attendedLog.scheduledStartTime || "09:00 AM";
                                          const scheduledMinutes = parseMeetingTimeToMinutes(scheduledTimeStr);

                                          let joinMinutes: number | null = null;
                                          if (attendedLog.joinedAtTime) {
                                            joinMinutes = parseMeetingTimeToMinutes(attendedLog.joinedAtTime);
                                          } else if (attendedLog.timestamp) {
                                            joinMinutes = getLagosMinutesPastMidnight(new Date(attendedLog.timestamp));
                                          }

                                          const statusLower = (attendedLog.status || "").toLowerCase();
                                          let isLate = false;
                                          let isVeryLate = false;

                                          if (joinMinutes !== null && scheduledMinutes !== null) {
                                            if (joinMinutes > scheduledMinutes + 5) {
                                              isVeryLate = true;
                                              isLate = true;
                                            } else if (joinMinutes > scheduledMinutes + 2) {
                                              isLate = true;
                                            }
                                          } else if (statusLower.includes("very late")) {
                                            isVeryLate = true;
                                            isLate = true;
                                          } else if (statusLower.includes("late")) {
                                            isLate = true;
                                          }

                                          if (isVeryLate) {
                                            lateList.push({
                                              ...baseItem,
                                              status: "Attended Very Late",
                                            });
                                          } else if (isLate) {
                                            lateList.push({
                                              ...baseItem,
                                              status: "Attended Late",
                                            });
                                          } else {
                                            onTimeList.push({
                                              ...baseItem,
                                              status: "Attended On Time",
                                            });
                                          }
                                        }
                                      });

                                      const sortByJoinTimeDesc = (a: any, b: any) => {
                                        const tA = a.timestamp || a.joinTimeDisplay || "";
                                        const tB = b.timestamp || b.joinTimeDisplay || "";
                                        return tB.localeCompare(tA);
                                      };
                                      onTimeList.sort(sortByJoinTimeDesc);
                                      lateList.sort(sortByJoinTimeDesc);

                                      const list = [
                                        ...onTimeList,
                                        ...lateList,
                                        ...absentList,
                                      ];

                                      const displayedList =
                                        attendanceFilterTab === "on_time"
                                          ? onTimeList
                                          : attendanceFilterTab === "late"
                                            ? lateList
                                            : attendanceFilterTab === "absent"
                                              ? absentList
                                              : list;

                                      const rawRate =
                                        list.length > 0
                                          ? ((onTimeList.length +
                                              lateList.length) /
                                              list.length) *
                                            100
                                          : 0;
                                      const attendanceRate =
                                        rawRate % 1 === 0
                                          ? rawRate.toFixed(0)
                                          : rawRate.toFixed(1);

                                      return (
                                        <div className="mt-3 p-3 bg-white border border-gray-150 rounded-xl space-y-3 animate-slide-up text-left">
                                          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                            <div className="space-y-0.5">
                                              <h5 className="font-extrabold text-[11px] text-gray-800">
                                                Attendance Report
                                              </h5>
                                              <p className="text-[10px] text-gray-400">
                                                Total assigned: {list.length}{" "}
                                                trainees
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <div className="font-black text-sm text-[#4B5E40]">
                                                {attendanceRate}%
                                              </div>
                                              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                Attendance Rate
                                              </div>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                                            <div className="bg-[#4B5E40]/5 p-1.5 rounded-lg border border-[#4B5E40]/10">
                                              <div className="text-[8px] uppercase font-bold text-gray-400">
                                                Rate
                                              </div>
                                              <div className="text-xs font-black text-[#4B5E40]">
                                                {attendanceRate}%
                                              </div>
                                            </div>
                                            <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                              <div className="text-[8px] uppercase font-bold text-emerald-600">
                                                On Time
                                              </div>
                                              <div className="text-xs font-black text-emerald-700">
                                                {onTimeList.length}
                                              </div>
                                            </div>
                                            <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                                              <div className="text-[8px] uppercase font-bold text-amber-600">
                                                Late
                                              </div>
                                              <div className="text-xs font-black text-amber-700">
                                                {lateList.length}
                                              </div>
                                            </div>
                                            <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                                              <div className="text-[8px] uppercase font-bold text-rose-500">
                                                Absent
                                              </div>
                                              <div className="text-xs font-black text-rose-700">
                                                {absentList.length}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Filter tabs */}
                                          <div className="flex bg-gray-50 border border-gray-100 p-0.5 rounded-lg text-[10px] font-extrabold">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAttendanceFilterTab("all")
                                              }
                                              className={`flex-1 py-1 rounded-md text-center transition ${
                                                attendanceFilterTab === "all"
                                                  ? "bg-white text-gray-850 shadow-2xs font-black"
                                                  : "text-gray-500 hover:text-gray-950"
                                              }`}
                                            >
                                              All ({list.length})
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAttendanceFilterTab(
                                                  "on_time",
                                                )
                                              }
                                              className={`flex-1 py-1 rounded-md text-center transition ${
                                                attendanceFilterTab ===
                                                "on_time"
                                                  ? "bg-white text-emerald-700 shadow-2xs font-black"
                                                  : "text-gray-500 hover:text-gray-950"
                                              }`}
                                            >
                                              On Time ({onTimeList.length})
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAttendanceFilterTab("late")
                                              }
                                              className={`flex-1 py-1 rounded-md text-center transition ${
                                                attendanceFilterTab === "late"
                                                  ? "bg-white text-amber-700 shadow-2xs font-black"
                                                  : "text-gray-500 hover:text-gray-950"
                                              }`}
                                            >
                                              Late ({lateList.length})
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAttendanceFilterTab("absent")
                                              }
                                              className={`flex-1 py-1 rounded-md text-center transition ${
                                                attendanceFilterTab === "absent"
                                                  ? "bg-white text-rose-600 shadow-2xs font-black"
                                                  : "text-gray-500 hover:text-gray-950"
                                              }`}
                                            >
                                              Absent ({absentList.length})
                                            </button>
                                          </div>

                                          {/* Display List */}
                                          <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                                            {displayedList.length === 0 ? (
                                              <div className="text-center py-4 text-gray-400 text-[10px] font-medium italic">
                                                No records match this filter.
                                              </div>
                                            ) : (
                                              displayedList.map((item: any) => {
                                                const initials = (
                                                  item.fullName ||
                                                  item.username ||
                                                  "U"
                                                )
                                                  .split(" ")
                                                  .map((n: string) => n[0])
                                                  .join("")
                                                  .substring(0, 2)
                                                  .toUpperCase();

                                                return (
                                                  <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-1.5 hover:bg-gray-55 rounded-lg border border-gray-150 bg-white transition gap-2"
                                                  >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <div
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                                                          item.attended
                                                            ? "bg-[#4B5E40] text-white"
                                                            : "bg-gray-200 text-gray-600"
                                                        }`}
                                                      >
                                                        {initials}
                                                      </div>
                                                      <div className="min-w-0">
                                                        <div className="font-extrabold text-[11px] text-gray-800 truncate">
                                                          {item.fullName || item.username}
                                                        </div>
                                                        <div className="text-[9px] text-gray-400 truncate">
                                                          {item.track} • {item.learningLevel || "Apprentice"}
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                                                      <span
                                                        className={`px-1.5 py-0.5 text-[8.5px] font-extrabold rounded-md border tracking-wide uppercase ${
                                                          item.status ===
                                                            "Attended" ||
                                                          item.status ===
                                                            "on time" ||
                                                          item.status ===
                                                            "Attended On Time"
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : item.status ===
                                                                  "Late" ||
                                                                item.status ===
                                                                  "Attended Late"
                                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                                              : item.status ===
                                                                    "Very Late" ||
                                                                  item.status ===
                                                                    "Attended Very Late"
                                                              ? "bg-orange-50 text-orange-700 border-orange-200"
                                                              : "bg-rose-50 text-rose-700 border-rose-200"
                                                        }`}
                                                      >
                                                        {item.status}
                                                      </span>
                                                      {item.attended && (
                                                        <span className="text-[8.5px] font-medium text-gray-500">
                                                          {item.joinTimeDisplay && item.joinTimeDisplay !== "No Check-in"
                                                            ? `Joined: ${item.joinTimeDisplay}`
                                                            : (item.timeTrackingSubtext || "Joined")}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                </div>
                              );
                            })}
                          </div>

                          {archived.length > 2 && (
                            <div className="flex justify-center pt-2 border-t border-gray-100 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const container = document.getElementById(
                                    "archive-meetings-grid-container",
                                  );
                                  if (container)
                                    container.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                }}
                                className="px-3.5 py-1.5 text-[10px] font-black bg-white hover:bg-gray-50 text-[#4B5E40] border border-gray-200 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                              >
                                <ArrowUp className="w-3.5 h-3.5" /> Back to Top
                                of Repository
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* C. DRILLS PUBLISHING & GRADING BOARD */}
      {adminTab === "drills" && (
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in"
          id="drills-tab-root"
        >
          {/* Post Drill Form (5 cols) */}
          <form
            onSubmit={handleCreateDrill}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-150 p-5 space-y-4"
            id="admin-drill-form"
          >
            <h3 className="font-extrabold text-sm text-gray-900 leading-normal">
              Post New Weekly Challenge Drill
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Drill Title / Challenge Heading
                </label>
                <input
                  id="admin-drill-title"
                  type="text"
                  required
                  placeholder="e.g., Construct SQL models CRM relationships"
                  value={drillTitle}
                  onChange={(e) => setDrillTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:outline-[#4B5E40]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Challenge Instructions description
                </label>
                <textarea
                  id="admin-drill-desc"
                  required
                  placeholder="Detailed guidelines on database migrations..."
                  rows={4}
                  value={drillDesc}
                  onChange={(e) => setDrillDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:outline-[#4B5E40] resize-y font-sans leading-normal"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  External Resource reference link
                </label>
                <input
                  id="admin-drill-link"
                  type="url"
                  required
                  placeholder="https://github.com/bincom-acad/specs"
                  value={drillLink}
                  onChange={(e) => setDrillLink(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:outline-[#4B5E40]"
                />
              </div>
            </div>

            <button
              id="admin-post-drill-btn"
              type="submit"
              disabled={loading || !drillTitle}
              className="w-full py-2 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:opacity-40 text-white font-bold text-xs rounded-lg transition cursor-pointer"
            >
              Publish Drill to Workspaces 🚀
            </button>
          </form>

          {/* Submission grading queues (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-150 p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-1">
              <Award className="w-4.5 h-4.5 text-[#4B5E40]" /> Weekly Drills
              Grade Desk
            </h3>

            {/* Filters bar for Grading Queue */}
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-150">
              {/* Track select */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Filter Track:
                </span>
                <select
                  value={drillTrackFilter}
                  onChange={(e) => setDrillTrackFilter(e.target.value)}
                  className="p-1 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#4B5E40] cursor-pointer text-gray-700 font-medium"
                >
                  <option value="all">All Tracks</option>
                  {uniqueTracksForDropdown.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status select */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Filter Status:
                </span>
                <select
                  value={drillStatusFilter}
                  onChange={(e) => setDrillStatusFilter(e.target.value)}
                  className="p-1 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#4B5E40] cursor-pointer text-gray-700 font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending Review</option>
                  <option value="Approved">Approved Pass</option>
                  <option value="Rejected">Rejected Fail</option>
                </select>
              </div>
            </div>

            {state.drillSubmissions.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-8">
                No student solutions submitted in this session yet.
              </p>
            ) : filteredSubmissions.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-8">
                No submissions match the chosen track or status filters.
              </p>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                {filteredSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 bg-[#F8FAF8] border border-gray-150 rounded-xl text-xs space-y-3"
                    id={`grade-card-${sub.id}`}
                  >
                    <div className="flex items-start justify-between flex-col sm:flex-row gap-2">
                      <div>
                        <span className="font-bold text-gray-900 block text-xs">
                          {sub.fullName}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                          {sub.drillTitle} | Track: {sub.track}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono leading-none font-bold ${
                          sub.status === "Approved"
                            ? "bg-emerald-50 text-emerald-800"
                            : sub.status === "Rejected"
                              ? "bg-red-50 text-red-800"
                              : "bg-orange-50 text-orange-850"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    <p className="font-semibold block whitespace-pre-line truncate leading-normal">
                      Solution URL:{" "}
                      <a
                        id={`link-sub-${sub.id}`}
                        href={sub.solutionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#4B5E40] hover:underline font-mono text-[11px] font-bold block"
                      >
                        {sub.solutionUrl}
                      </a>
                    </p>

                    {sub.feedback && (
                      <p className="bg-white p-2 border-l-2 border-slate-300 text-gray-600 font-sans italic text-[11px]">
                        <b>Current Feedback:</b> "{sub.feedback}"
                      </p>
                    )}

                    {/* Review Forms */}
                    {gradingSubId === sub.id ? (
                      <form
                        onSubmit={handleGradeDrill}
                        className="bg-white p-3 rounded-lg border border-gray-200 mt-2.5 space-y-3"
                        id={`gradeform-${sub.id}`}
                      >
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            id="grade-approve-toggle"
                            onClick={() => setGradingStatus("Approved")}
                            className={`py-1.5 text-center rounded-md font-bold cursor-pointer ${
                              gradingStatus === "Approved"
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-650"
                            }`}
                          >
                            Approve Pass
                          </button>
                          <button
                            type="button"
                            id="grade-reject-toggle"
                            onClick={() => setGradingStatus("Rejected")}
                            className={`py-1.5 text-center rounded-md font-bold cursor-pointer ${
                              gradingStatus === "Rejected"
                                ? "bg-rose-600 text-white"
                                : "bg-gray-100 text-gray-650"
                            }`}
                          >
                            Reject Fail
                          </button>
                        </div>

                        <div>
                          <input
                            id="admin-grade-feedback"
                            type="text"
                            required
                            placeholder="Mentor feedback rubric comments..."
                            value={gradingFeedback}
                            onChange={(e) => setGradingFeedback(e.target.value)}
                            className="w-full p-2 bg-gray-50 text-xs border border-gray-200 rounded-md"
                          />
                        </div>

                        <div className="flex gap-1.5 justify-end">
                          <button
                            id="cancel-grading-btn"
                            type="button"
                            onClick={() => setGradingSubId("")}
                            className="px-3 py-1 text-[10px] border rounded-md text-gray-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            id="submit-grade-btn"
                            type="submit"
                            className="px-3 py-1 bg-[#4B5E40] text-white rounded-md text-[10px] font-bold cursor-pointer"
                          >
                            Submit Evaluation
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-end pt-1">
                        <button
                          id={`grade-trigger-btn-${sub.id}`}
                          onClick={() => {
                            setGradingSubId(sub.id);
                            setGradingFeedback(sub.feedback || "");
                          }}
                          className="px-4 py-1.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white font-bold text-[11px] rounded-lg cursor-pointer"
                        >
                          Grade / Modify Evaluation
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* D. WARNING ALERTS DISPATCH COCKPIT (Section 4.1) */}
      {adminTab === "reminders" && (
        <form
          onSubmit={handleSendReminder}
          className="bg-white rounded-2xl border border-gray-150 p-6 max-w-xl mx-auto space-y-4 animate-fade-in"
          id="reminders-tab-root"
        >
          <div className="border-b border-gray-105 pb-2">
            <h3 className="font-extrabold text-sm text-gray-950">
              One-Click Warning Alerts Dispatcher
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Select lagging or non-compliant users to dispatch push alert
              notifications directly to their alert banners.
            </p>
          </div>

          <div className="space-y-3.5 animate-fade-in">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Target Student Profile
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Fast-Filter:
                  </span>
                  <select
                    id="dispatch-track-filter"
                    value={dispatchTrackFilter}
                    onChange={(e) => {
                      setDispatchTrackFilter(e.target.value);
                      setTargetStudentId(""); // reset selected target on filter change
                    }}
                    className="p-1 px-1.5 text-[10px] font-bold bg-gray-50 border rounded text-gray-600 focus:outline-[#4B5E40] cursor-pointer"
                  >
                    <option value="all">All Tracks Combined</option>
                    {uniqueTracksForDropdown.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <select
                id="reminder-target-select"
                required
                value={targetStudentId}
                onChange={(e) => setTargetStudentId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 text-xs border rounded-lg focus:outline-[#4B5E40] font-semibold text-gray-700"
              >
                <option value="">
                  -- Choose student target (
                  {
                    (dispatchTrackFilter === "all"
                      ? standardUsers
                      : standardUsers.filter(
                          (u) =>
                            getCleanTrackName(u.track) === dispatchTrackFilter,
                        )
                    ).length
                  }{" "}
                  matching candidates) --
                </option>
                {(dispatchTrackFilter === "all"
                  ? standardUsers
                  : standardUsers.filter(
                      (u) => getCleanTrackName(u.track) === dispatchTrackFilter,
                    )
                ).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({getCleanTrackName(u.track)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Reminder Alert Message Context
              </label>
              <textarea
                id="reminder-text-input"
                required
                rows={3}
                placeholder="Alert: You missed consecutive Morning Standups. High accountability rules trigger evaluation panels if missed log is recorded again..."
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 text-xs border rounded-lg focus:outline-[#4B5E40] font-sans"
              />
            </div>
          </div>

          <button
            id="admin-send-reminder-btn"
            type="submit"
            disabled={loading || !targetStudentId || !reminderMsg}
            className="w-full py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Dispatch Warning Banner Alert 🎯
          </button>
        </form>
      )}

      {/* E. AUTOMATED 00:00 WAT CRON ENGINE (Section 4.3) */}
      {adminTab === "cron" && (
        <div className="space-y-6">
          {/* MEETING DIRECTORY SYNCHRONIZATION & AUTOMATIC SCHEDULING CONFIG */}
          <div
            className="bg-white rounded-2xl border border-gray-150 p-6 max-w-xl mx-auto space-y-5 animate-fade-in"
            id="meeting-sync-panel"
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-2xs">
                <RefreshCw className="w-6 h-6 text-[#4B5E40]" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-gray-950">
                Corporate Directory Synchronisation
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Connect and synchronize newly created and updated meetings from
                the Bincom Corporate Server database.
              </p>
            </div>

            {/* AUTOMATIC MIDNIGHT SYNC CONFIGURATION */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/60 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-xs text-slate-800">
                    Automatic Midnight Synchronisation
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Trigger automated synchronization every night at 00:00 WAT.
                  </p>
                </div>
                <button
                  id="admin-toggle-midnight-sync"
                  type="button"
                  onClick={() =>
                    handleToggleMidnightSync(!state.autoMidnightSyncEnabled)
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    state.autoMidnightSyncEnabled
                      ? "bg-[#4B5E40]"
                      : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      state.autoMidnightSyncEnabled
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="text-[10px] flex items-center gap-1.5 font-bold pt-1 border-t border-gray-200/50">
                {state.autoMidnightSyncEnabled ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    🟢 Automatic Midnight Sync is ACTIVE (Runs at 00:00 WAT)
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    🔴 Automatic Midnight Sync is DISABLED (Manual Only)
                  </span>
                )}
              </div>
            </div>

            {/* MANUAL TRIGGER */}
            <div className="text-center bg-[#F8FAF8] p-4 rounded-xl border border-dashed border-gray-250 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <span>Sync Timeout:</span>
                <select
                  id="sync-timeout-select"
                  value={syncTimeoutSec}
                  onChange={(e) => setSyncTimeoutSec(Number(e.target.value))}
                  disabled={syncRunning}
                  className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#4B5E40] cursor-pointer"
                >
                  <option value={2}>2 seconds (For Testing)</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds (Default)</option>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>

              <button
                id="admin-trigger-sync-btn"
                onClick={handleTriggerSync}
                disabled={syncRunning}
                className="px-6 py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer inline-flex items-center gap-1.5"
              >
                {syncRunning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Synchronising...
                  </>
                ) : (
                  "🔄 Manually Synchronise Meetings"
                )}
              </button>
            </div>

            {/* Sync Console Logs */}
            {syncLogs.length > 0 && (
              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800 text-left font-mono text-[10px] space-y-1.5 text-emerald-400 leading-normal max-h-56 overflow-y-auto block shadow-inner">
                <span className="text-gray-500 select-none">
                  // SYSTEM CONSOLE: MEETING DIRECTORY SYNC LOGS
                </span>
                {syncLogs.map((log, index) => (
                  <p key={index} className="block whitespace-pre-wrap">
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div
            className="bg-white rounded-2xl border border-gray-150 p-6 max-w-xl mx-auto space-y-5 animate-fade-in"
            id="cron-tab-root"
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-250 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
                <Cpu className="w-6.5 h-6.5 text-[#4B5E40]" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-gray-950">
                Automated overnight Cron Engine (00:00 WAT WAT)
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Every midnight WAT, the cron scan parses profile assignments and
                populates all 24-hour schedules automatically.
              </p>
            </div>

            <div className="text-center bg-[#F8FAF8] p-4 rounded-xl border border-dashed border-gray-250">
              <button
                id="admin-trigger-cron-btn"
                onClick={handleTriggerSimulatedCron}
                disabled={cronRunning}
                className="px-6 py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs rounded-xl shadow transition animate-pulse cursor-pointer inline-flex items-center gap-1.5"
              >
                {cronRunning
                  ? "Executing scan..."
                  : "🚀 Manually Trigger Overnight 00:00 WAT Cron Sync"}
              </button>
            </div>

            {/* PRE-ACTIVATION AUDIT PANEL */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  📋 Pre-Activation Audit (Today's Slated Meetings)
                </h4>
                <button
                  type="button"
                  onClick={() => setAdminTab("meetings")}
                  className="text-[11px] text-[#4B5E40] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  Edit List ⚙️
                </button>
              </div>

              {(() => {
                const slatedToday = (state.meetings || []).filter(
                  (m: any) =>
                    (!m.status ||
                      m.status.trim().toLowerCase() !== "archived") &&
                    isMeetingScheduledForToday(m),
                );

                if (slatedToday.length === 0) {
                  return (
                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 text-center space-y-1">
                      <p className="text-xs text-amber-800 font-bold">
                        No dynamic meetings are scheduled for today (
                        {todayDateStr}).
                      </p>
                      <p className="text-[10.5px] text-gray-500 font-medium">
                        Running the overnight sync will clear active states on
                        existing meetings to keep schedules accurate.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                      The following <strong>{slatedToday.length}</strong>{" "}
                      meeting(s) will be automatically marked as{" "}
                      <strong>Active</strong> and populated on eligible user
                      calendars today:
                    </p>
                    <div className="space-y-2">
                      {slatedToday.map((meeting: any) => (
                        <div
                          key={meeting.id}
                          className="p-3 bg-[#F8FAF8] rounded-xl border border-gray-150 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 truncate">
                                {meeting.title}
                              </span>
                              <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold rounded-md bg-white border border-gray-200 text-gray-500">
                                {meeting.timeString}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-gray-400 font-medium">
                              <span>
                                📁 {getMeetingTypeLabel(meeting.type)}
                              </span>
                              <span>•</span>
                              <span className="truncate">
                                🎯 Tracks: {meeting.tracks?.join(", ") || "All"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-emerald-700">
                              Ready
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Simulated Cron Console logs */}
            {cronLogs.length > 0 && (
              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800 text-left font-mono text-[10px] space-y-1.5 text-emerald-400 leading-normal max-h-56 overflow-y-auto block shadow-inner">
                <span className="text-gray-500 select-none">
                  // SYSTEM CONSOLE OVERNIGHT CRON MONITOR
                </span>
                {cronLogs.map((log, index) => (
                  <p key={index} className="block whitespace-pre-wrap">
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div
            className="bg-white rounded-2xl border border-rose-200 p-6 max-w-xl mx-auto space-y-5 animate-fade-in"
            id="danger-zone-root"
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-2xs">
                <Trash2 className="w-6.5 h-6.5 text-rose-600" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-gray-950">
                Danger Zone: Database Fresh Start
              </h3>
              <p className="text-xs text-rose-600 max-w-sm mx-auto leading-relaxed">
                Delete all pre-seeded mock records (meetings, projects, drills,
                attendance logs, and student profiles) to start with a
                completely fresh, empty workspace. Your admin account will be
                preserved.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center bg-rose-50/50 p-4 rounded-xl border border-dashed border-rose-200">
              <button
                id="admin-purge-db-btn"
                onClick={handlePurgeDatabase}
                disabled={purgingDb || seedingDb}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                {purgingDb
                  ? "Purging Seed Data..."
                  : "🗑️ Purge Seed Data & Start Fresh"}
              </button>

              <button
                id="admin-seed-db-btn"
                onClick={handleSeedDatabase}
                disabled={purgingDb || seedingDb}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                {seedingDb
                  ? "Seeding Database..."
                  : "🌱 Seed Default Configurations"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. SYNCHRONISATION & ERROR AUDIT LOGS (Section 4.4) */}
      {adminTab === "sync_logs" &&
        (() => {
          const queuedMeetingUpdatesList = localQueuedMeetingUpdates;
          return (
            <div className="space-y-6 animate-fade-in" id="sync-logs-tab-root">
              <div className="bg-white rounded-2xl border border-gray-150 p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin-slow" />
                      Synchronisation & Error Audit Logs
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      View queue status, audit immediate or midnight sync
                      actions, and inspect errors.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await triggerSimulatedCron();
                        triggerSuccess(
                          "Midnight cron sync simulated successfully! Queued items processed.",
                        );
                        onStateUpdate();
                      } catch (err: any) {
                        triggerError("Cron simulation failed: " + err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-2 justify-center shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Simulate Midnight Sync Job
                  </button>
                </div>

                {/* STATS ROW */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 text-center">
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Total Actions
                    </span>
                    <span className="block text-2xl font-black text-slate-800 mt-1">
                      {(queuedMeetingUpdatesList || []).length}
                    </span>
                  </div>
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-150 text-center">
                    <span className="block text-xs font-bold text-amber-600 uppercase tracking-wider">
                      Pending Queue
                    </span>
                    <span className="block text-2xl font-black text-amber-700 mt-1">
                      {
                        (queuedMeetingUpdatesList || []).filter(
                          (item: any) => item.status === "pending",
                        ).length
                      }
                    </span>
                  </div>
                  <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-150 text-center">
                    <span className="block text-xs font-bold text-emerald-600 uppercase tracking-wider">
                      Successfully Synced
                    </span>
                    <span className="block text-2xl font-black text-emerald-700 mt-1">
                      {
                        (queuedMeetingUpdatesList || []).filter(
                          (item: any) =>
                            item.status === "synced" ||
                            item.status === "applied",
                        ).length
                      }
                    </span>
                  </div>
                  <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-150 text-center">
                    <span className="block text-xs font-bold text-rose-600 uppercase tracking-wider">
                      Failed Attempts
                    </span>
                    <span className="block text-2xl font-black text-rose-700 mt-1">
                      {
                        (queuedMeetingUpdatesList || []).filter(
                          (item: any) => item.status === "failed",
                        ).length
                      }
                    </span>
                  </div>
                </div>

                {/* AUDIT LOG TABLE/LIST */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider">
                    Sync Event Chronicle:
                  </h4>

                  {(queuedMeetingUpdatesList || []).length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                      <span className="text-2xl block mb-2">📋</span>
                      <p className="text-xs text-gray-400 font-semibold">
                        No sync or error logs recorded yet.
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Logs appear here when admin creates, edits, or deletes
                        meetings.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-150 rounded-xl divide-y divide-gray-100">
                      {/* Row headers */}
                      <div className="bg-gray-50 px-4 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <span className="col-span-3">
                          Action Type / Meeting
                        </span>
                        <span className="col-span-2">Sync Schedule</span>
                        <span className="col-span-3">Admin Initiator</span>
                        <span className="col-span-2">Date & Time</span>
                        <span className="col-span-2 text-right">Status</span>
                      </div>

                      {/* Rows */}
                      {[...queuedMeetingUpdatesList]
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt || 0).getTime() -
                            new Date(a.createdAt || 0).getTime(),
                        )
                        .map((item: any) => {
                          const isSave =
                            item.action === "save" ||
                            item.type === "create" ||
                            item.type === "edit";
                          const isImmediate =
                            item.syncOption === "immediate" ||
                            item.status === "applied";
                          const isSynced =
                            item.status === "synced" ||
                            item.status === "applied";

                          return (
                            <div
                              key={item.id}
                              className="px-4 py-3 grid grid-cols-12 gap-2 text-xs items-center hover:bg-gray-50/60 transition"
                            >
                              {/* Action / Meeting info */}
                              <div className="col-span-3 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  {isSave ? (
                                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 uppercase">
                                      Save
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-rose-50 text-rose-700 rounded-md border border-rose-100 uppercase">
                                      Delete
                                    </span>
                                  )}
                                  <span className="font-extrabold text-gray-900 truncate max-w-[120px]">
                                    {item.meetingData?.title ||
                                      `ID: ${item.meetingId}`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium">
                                  Meeting ID: {item.meetingId}
                                </div>
                              </div>

                              {/* Sync Schedule */}
                              <div className="col-span-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isImmediate ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                                >
                                  {isImmediate ? "⚡ Immediate" : "🌙 Midnight"}
                                </span>
                              </div>

                              {/* Admin Initiator */}
                              <div className="col-span-3 text-[11px] font-semibold text-slate-700 truncate">
                                {item.adminEmail ||
                                  item.adminId ||
                                  "Automated/Unknown"}
                              </div>

                              {/* Date & Time */}
                              <div className="col-span-2 space-y-0.5 text-gray-400 font-medium">
                                <div className="text-[10.5px]">
                                  {item.createdAt
                                    ? new Date(
                                        item.createdAt,
                                      ).toLocaleDateString()
                                    : "-"}
                                </div>
                                <div className="text-[9.5px]">
                                  {item.createdAt
                                    ? new Date(
                                        item.createdAt,
                                      ).toLocaleTimeString()
                                    : "-"}
                                </div>
                              </div>

                              {/* Status */}
                              <div className="col-span-2 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {isSynced && (
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100">
                                      Synced
                                    </span>
                                  )}
                                  {item.status === "pending" && (
                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-100">
                                      Pending
                                    </span>
                                  )}
                                  {item.status === "failed" && (
                                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-100">
                                      Failed
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Detailed Error Block if failed */}
                              {item.status === "failed" && item.error && (
                                <div className="col-span-12 mt-2 bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-[10.5px] font-mono text-rose-700 leading-normal space-y-1">
                                  <div className="font-bold uppercase tracking-wide text-[9px] text-rose-500">
                                    Error Stack Detail:
                                  </div>
                                  <p>{item.error}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* HISTORICAL ONBOARDING SUBMISSIONS LOG (STUDENT AUDIT TRAIL) */}
                <div className="space-y-3 pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider">
                        Student Onboarding Audit Trail
                      </h4>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Historical log of onboarding form submissions, track
                        updates, and level resubmissions for audit compliance
                        purposes.
                      </p>
                    </div>
                  </div>

                  {!state.onboardingSubmissions ||
                  state.onboardingSubmissions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                      <span className="text-xl block mb-2.5">📋</span>
                      <p className="text-xs text-gray-400 font-semibold">
                        No onboarding form updates recorded yet.
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        When students reopen and update their onboarding
                        details, previous forms are archived here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-150 rounded-xl divide-y divide-gray-100">
                      <div className="bg-gray-50 px-4 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <span className="col-span-3">Student Name / ID</span>
                        <span className="col-span-3">Knowledge Track</span>
                        <span className="col-span-2">Learning Level</span>
                        <span className="col-span-2">
                          Education / Experience
                        </span>
                        <span className="col-span-2 text-right">
                          Submitted At
                        </span>
                      </div>

                      {[...(state.onboardingSubmissions || [])]
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp || 0).getTime() -
                            new Date(a.timestamp || 0).getTime(),
                        )
                        .map((item: any) => (
                          <div
                            key={item.id}
                            className="px-4 py-3 grid grid-cols-12 gap-2 text-xs items-center hover:bg-gray-50/60 transition"
                          >
                            <div className="col-span-3 space-y-0.5">
                              <div className="font-extrabold text-gray-900 truncate">
                                {item.fullName}
                              </div>
                              <div className="text-[9.5px] text-gray-400 font-mono">
                                User ID: {item.userId}
                              </div>
                            </div>

                            <div className="col-span-3 font-semibold text-gray-700">
                              {item.track}
                            </div>

                            <div className="col-span-2">
                              <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-md font-bold text-[10px]">
                                {item.learningLevel || "Apprentice"}
                              </span>
                            </div>

                            <div className="col-span-2 text-[10.5px] text-gray-500 leading-normal">
                              <div>{item.education}</div>
                              <div className="text-[9.5px] text-gray-400 italic">
                                {item.techExperience}
                              </div>
                            </div>

                            <div className="col-span-2 text-right text-gray-400 font-medium">
                              <div className="text-[10.5px]">
                                {item.timestamp
                                  ? new Date(
                                      item.timestamp,
                                    ).toLocaleDateString()
                                  : "-"}
                              </div>
                              <div className="text-[9.5px]">
                                {item.timestamp
                                  ? new Date(
                                      item.timestamp,
                                    ).toLocaleTimeString()
                                  : "-"}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* F. EXPORT CSV DATA REPORTING (Section 4.2) */}
      {adminTab === "export" && (
        <div
          className="bg-white rounded-2xl border border-gray-150 p-6 max-w-xl mx-auto space-y-5 animate-fade-in"
          id="export-tab-root"
        >
          <div className="border-b border-gray-105 pb-2.5 text-center">
            <h3 className="font-extrabold text-sm sm:text-base text-gray-950">
              Administrative Ledger Report Exporter
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Generate structured punctuality logs and attendance metrics
              audit-compliant with administrative reports formatting.
            </p>
          </div>

          <div className="flex gap-2.5 justify-center">
            <button
              id="admin-csv-download-btn"
              onClick={handleDownloadCSV}
              className="px-5 py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" /> Download Attendance Audit Sheet
              (CSV)
            </button>
            <button
              id="admin-preview-btn"
              type="button"
              onClick={() => setCsvPreview(!csvPreview)}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Toggle Ledger Preview
            </button>
          </div>

          {csvPreview && (
            <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 text-left font-mono text-[9px] text-gray-650 max-h-56 overflow-y-auto block whitespace-pre shadow-inner">
              <span className="font-bold border-b border-gray-300 pb-1.5 mb-1.5 block">
                CSV Ledger Row Preview (Pre-download)
              </span>
              <div>
                {
                  "AttendanceRecordID,StudentFullName,StudentEmail,TrackGroup,MeetingName,CheckInTime,PunctualityRating\n"
                }
                {state.attendance.map(
                  (a) =>
                    `"${a.id}","${a.fullName || a.username}","${a.fullName ? `${a.fullName.toLowerCase().replace(/\s+/g, '.')}@bincom.co` : `${a.username}@bincom.co`}","${a.track}","${a.meetingTitle}","${a.timestamp}","${a.status}"\n`,
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- CONFIRM DELETE MEETING MODAL --- */}
      {meetingToDeleteId &&
        (() => {
          const meetingToDelete = state.meetings.find(
            (m: any) => m.id === meetingToDeleteId,
          );
          return (
            <div
              className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
              id="delete-meeting-modal-overlay"
            >
              <div className="bg-white rounded-2xl border border-gray-150 p-6 max-w-sm w-full shadow-2xl space-y-4 relative transform scale-100 transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                    <span className="text-lg">⚠️</span>
                  </div>
                  <h3 className="font-extrabold text-[#991b1b] text-sm sm:text-base leading-normal">
                    Delete Meeting
                  </h3>
                </div>

                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Are you sure you want to permanently delete this scheduled
                  meeting? This action cannot be undone.
                </p>

                {meetingToDelete && (
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-1 text-left">
                    <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">
                      Selected Meeting Details:
                    </div>
                    <div className="text-xs font-extrabold text-slate-800">
                      {meetingToDelete.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-gray-500 mt-1">
                      <span>🗓️ {meetingToDelete.timeString}</span>
                      <span className="text-gray-300">•</span>
                      <span>ID: {meetingToDelete.id}</span>
                    </div>
                  </div>
                )}

                {meetingToDelete && meetingToDelete.seriesId && (
                  <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-150 space-y-2 text-left text-xs font-semibold text-gray-700">
                    <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">
                      Recurrence Deletion Options:
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium mb-1">
                      This meeting is part of a recurring series. Choose how you
                      want to apply the deletion:
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="radio"
                        name="delete-recurrence-option"
                        value="single"
                        checked={deleteRecurrenceOption === "single"}
                        onChange={() => setDeleteRecurrenceOption("single")}
                        className="text-[#4B5E40] focus:ring-[#4B5E40] h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>Delete only this occurrence</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="radio"
                        name="delete-recurrence-option"
                        value="future"
                        checked={deleteRecurrenceOption === "future"}
                        onChange={() => setDeleteRecurrenceOption("future")}
                        className="text-[#4B5E40] focus:ring-[#4B5E40] h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>Delete this and all future occurrences</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="radio"
                        name="delete-recurrence-option"
                        value="all"
                        checked={deleteRecurrenceOption === "all"}
                        onChange={() => setDeleteRecurrenceOption("all")}
                        className="text-[#4B5E40] focus:ring-[#4B5E40] h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>Delete the entire meeting series</span>
                    </label>
                  </div>
                )}

                <div className="flex gap-2.5 justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    id="cancel-delete-meeting-btn"
                    disabled={isDeletingMeeting}
                    onClick={() => setMeetingToDeleteId(null)}
                    className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-250 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-delete-meeting-btn"
                    disabled={isDeletingMeeting}
                    onClick={() =>
                      handleInitiateDelete(
                        meetingToDeleteId,
                        deleteRecurrenceOption,
                      )
                    }
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none transition flex items-center gap-1.5 justify-center"
                  >
                    {isDeletingMeeting ? (
                      <>
                        <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full shrink-0"></span>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Confirm Delete</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* --- CONFIRM DELETE MEETING TYPE MODAL --- */}
      {meetingTypeToDelete &&
        (() => {
          const relatedMeetings = (state.meetings || []).filter(
            (m: any) =>
              m.type &&
              m.type.trim().toLowerCase() ===
                meetingTypeToDelete.trim().toLowerCase(),
          );
          const isMeetingTypeInUse = relatedMeetings.length > 0;

          return (
            <div
              className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
              id="delete-meeting-type-modal-overlay"
            >
              <div className="bg-white rounded-2xl border border-gray-150 p-6 max-w-md w-full shadow-2xl space-y-4 relative transform scale-100 transition duration-200 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                      isMeetingTypeInUse
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-rose-50 text-rose-600 border-rose-100"
                    }`}
                  >
                    <span className="text-lg">
                      {isMeetingTypeInUse ? "⚠️" : "🗑️"}
                    </span>
                  </div>
                  <h3
                    className={`font-extrabold text-sm sm:text-base leading-normal ${
                      isMeetingTypeInUse ? "text-amber-850" : "text-[#991b1b]"
                    }`}
                  >
                    Delete Meeting Type
                  </h3>
                </div>

                {isMeetingTypeInUse ? (
                  <>
                    <p
                      className="text-xs text-gray-750 font-semibold leading-relaxed"
                      id="meeting-type-in-use-warning"
                    >
                      This Meeting Type is currently assigned to one or more
                      scheduled meetings and cannot be deleted until those
                      meetings are updated or removed.
                    </p>

                    <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 space-y-1 text-left">
                      <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">
                        In-Use Meeting Type:
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {meetingTypeToDelete}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {relatedMeetings.length} active scheduled meeting(s)
                        detected
                      </div>
                    </div>

                    {showRelatedMeetings && (
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-48 overflow-y-auto space-y-2 text-left animate-fade-in">
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">
                          Related Meetings Details:
                        </div>
                        {relatedMeetings.map((m: any) => (
                          <div
                            key={m.id}
                            className="border-b border-gray-150 pb-1.5 last:border-0 last:pb-0 text-xs animate-fade-in"
                          >
                            <div className="font-extrabold text-gray-800">
                              {m.title}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              🗓️ {m.timeString || m.time || "N/A"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2.5 justify-end pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setMeetingTypeToDelete(null)}
                        className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-250 cursor-pointer select-none transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowRelatedMeetings(!showRelatedMeetings)
                        }
                        className="px-4 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl shadow cursor-pointer select-none transition"
                      >
                        {showRelatedMeetings
                          ? "Hide Related Meetings"
                          : "View Related Meetings"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      Are you sure you want to delete this Meeting Type?
                    </p>
                    <p className="text-xs text-rose-600 font-bold leading-relaxed">
                      This action cannot be undone.
                    </p>

                    <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-1 text-left">
                      <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wide font-mono">
                        Custom Meeting Type Name:
                      </div>
                      <div className="text-xs font-extrabold text-slate-800">
                        {meetingTypeToDelete}
                      </div>
                    </div>

                    <div className="flex gap-2.5 justify-end pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        disabled={isDeletingMeetingType}
                        onClick={() => setMeetingTypeToDelete(null)}
                        className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-250 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="confirm-delete-meeting-type-btn"
                        disabled={isDeletingMeetingType}
                        onClick={handleConfirmDeleteMeetingType}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none transition flex items-center gap-1.5 justify-center"
                      >
                        {isDeletingMeetingType ? (
                          <>
                            <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full shrink-0"></span>
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <span>Delete</span>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      {confirmDialog.isOpen && (
        <div
          className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          id="custom-confirm-modal-overlay"
        >
          <div className="bg-white rounded-2xl border border-gray-150 p-6 max-w-sm w-full shadow-2xl space-y-4 relative transform scale-100 transition duration-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                  confirmDialog.isDanger
                    ? "bg-rose-50 text-rose-600 border-rose-100"
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
                }`}
              >
                <span className="text-lg">
                  {confirmDialog.isDanger ? "⚠️" : "💡"}
                </span>
              </div>
              <h3
                className={`font-extrabold text-sm sm:text-base leading-normal ${
                  confirmDialog.isDanger ? "text-[#991b1b]" : "text-[#4B5E40]"
                }`}
              >
                {confirmDialog.title}
              </h3>
            </div>

            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                id="custom-confirm-cancel-btn"
                onClick={() =>
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-4 py-2 border border-gray-250 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer select-none"
              >
                {confirmDialog.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                id="custom-confirm-action-btn"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow cursor-pointer select-none transition ${
                  confirmDialog.isDanger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {confirmDialog.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
