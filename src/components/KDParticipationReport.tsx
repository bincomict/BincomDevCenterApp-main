import React, { useState, useMemo } from "react";
import { 
  Profile, 
  KDPresentation, 
  Meeting, 
  AttendanceRecord, 
  KnowledgeDevelopmentInfo 
} from "../types";
import { isKDCompulsoryForLevel, getLagosDateString, isAuthorizedForKDTopic } from "../utils/trackUtils";
import { sendReminder } from "../firebaseService";
import { toast } from "./Toast";
import { 
  BarChart2, 
  Filter, 
  Download, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Mic, 
  MicOff, 
  TrendingUp, 
  TrendingDown,
  Send, 
  FileText, 
  Search, 
  Award,
  PieChart,
  Layers,
  Briefcase,
  UserX,
  RefreshCw,
  XCircle,
  AlertCircle,
  Calendar,
  Clock
} from "lucide-react";

interface KDParticipationReportProps {
  profile?: Profile;
  profiles: Profile[];
  presentations?: KDPresentation[];
  meetings?: Meeting[];
  attendance?: AttendanceRecord[];
  kdInfo?: KnowledgeDevelopmentInfo;
  microserviceOwners?: Record<string, string>;
  onStateUpdate?: () => void;
}

const ALL_TEAMS = [
  "All Teams / Tracks",
  "Frontend Engineering",
  "Backend Engineering",
  "Mobile App Development",
  "DevOps & Cloud Engineering",
  "Data Science & Analytics",
  "UI/UX Product Design",
  "Quality Assurance & Testing",
  "Cybersecurity",
  "Project & Product Management"
];

const ALL_LEVELS = [
  "All Techie Levels",
  "Apprentice level 1",
  "Apprentice level 2",
  "Apprentice level 3",
  "Intern",
  "Volunteer beginner level",
  "Volunteer intermediate level",
  "Volunteer advanced level",
  "Trainee Level 1",
  "Trainee Level 2",
  "Trainee Level 3",
  "Global Techie 0",
  "Global Techie 1",
  "Junior associate level 1",
  "Junior associate level 2",
  "Senior associate level 1",
  "Mentor / Admin"
];

const MONTH_NAMES = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function KDParticipationReport({
  profile,
  profiles = [],
  presentations = [],
  meetings = [],
  attendance = [],
  kdInfo,
  microserviceOwners = {},
  onStateUpdate
}: KDParticipationReportProps) {
  const currentDate = new Date();
  const defaultYear = String(currentDate.getFullYear());
  const defaultMonth = String(currentDate.getMonth() + 1).padStart(2, "0");

  // Filters State
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>(defaultMonth);
  const [selectedTeam, setSelectedTeam] = useState<string>("All Teams / Tracks");
  const [selectedLevel, setSelectedLevel] = useState<string>("All Techie Levels");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [complianceFilter, setComplianceFilter] = useState<"all" | "completed" | "upcoming" | "missed" | "notscheduled">("all");
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);

  const selectedMonthStr = `${selectedYear}-${selectedMonthNum}`;
  const selectedMonthObj = MONTH_NAMES.find(m => m.value === selectedMonthNum) || MONTH_NAMES[0];
  const reportPeriodLabel = `${selectedMonthObj.label} ${selectedYear}`;
  const todayLagosDate = getLagosDateString(new Date());

  // Helper: check if meeting is KD
  const isKDMeeting = (m: Meeting) => {
    const title = String(m.title || "").toLowerCase();
    const type = String(m.type || "").toLowerCase();
    return (
      title.includes("knowledge") ||
      title.includes("kd") ||
      type.includes("knowledge") ||
      type.includes("kd")
    );
  };

  // 1. FILTER TECHIE PROFILES BY TEAM, LEVEL, AND TECHIE NAME
  const eligibleProfiles = useMemo(() => {
    return profiles.filter(p => {
      // Must be a standard student / techie
      if (p.role !== "user") return false;

      // Filter Team / Track
      if (selectedTeam !== "All Teams / Tracks") {
        const userTrack = (p.track || "").toLowerCase();
        const filterTeam = selectedTeam.toLowerCase();
        if (!userTrack.includes(filterTeam) && !filterTeam.includes(userTrack)) {
          // Check common aliases
          if (filterTeam.includes("frontend") && !userTrack.includes("frontend")) return false;
          if (filterTeam.includes("backend") && !userTrack.includes("backend")) return false;
          if (filterTeam.includes("mobile") && !userTrack.includes("mobile")) return false;
          if (filterTeam.includes("devops") && !userTrack.includes("devops") && !userTrack.includes("cloud")) return false;
          if (filterTeam.includes("data") && !userTrack.includes("data")) return false;
          if (filterTeam.includes("design") && !userTrack.includes("design") && !userTrack.includes("ui")) return false;
        }
      }

      // Filter Techie Level
      if (selectedLevel !== "All Techie Levels") {
        const userLevel = (p.learningLevel || "Apprentice level 1").toLowerCase();
        const filterLvl = selectedLevel.toLowerCase();
        if (!userLevel.includes(filterLvl) && !filterLvl.includes(userLevel)) return false;
      }

      // Filter Techie Name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = p.fullName.toLowerCase().includes(q);
        const emailMatch = p.email.toLowerCase().includes(q);
        const usernameMatch = (p.username || "").toLowerCase().includes(q);
        const trackMatch = (p.track || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !usernameMatch && !trackMatch) return false;
      }

      return true;
    });
  }, [profiles, selectedTeam, selectedLevel, searchQuery]);

  // 2. KD MEETINGS IN MONTH
  const monthKDMeetings = useMemo(() => {
    return meetings.filter(m => {
      const dateStr = (m as any).date || m.occurrenceDate || m.recurrenceStartDate || (m as any).timestamp?.substring(0, 10) || "";
      return dateStr.startsWith(selectedMonthStr) && isKDMeeting(m);
    });
  }, [meetings, selectedMonthStr]);

  const monthKDMeetingIds = useMemo(() => {
    return new Set(monthKDMeetings.map(m => m.id));
  }, [monthKDMeetings]);

  // 3. PRESENTATIONS IN MONTH
  const monthPresentations = useMemo(() => {
    return presentations.filter(p => p.date && p.date.startsWith(selectedMonthStr));
  }, [presentations, selectedMonthStr]);

  // Map of userId -> array of presentations in month
  const presenterMap = useMemo(() => {
    const map: Record<string, KDPresentation[]> = {};
    monthPresentations.forEach(pres => {
      if (pres.presenterUserId) {
        if (!map[pres.presenterUserId]) map[pres.presenterUserId] = [];
        map[pres.presenterUserId].push(pres);
      } else if (pres.presenterName) {
        const match = profiles.find(p => p.fullName.toLowerCase() === pres.presenterName.toLowerCase());
        if (match) {
          if (!map[match.id]) map[match.id] = [];
          map[match.id].push(pres);
        }
      }
    });
    return map;
  }, [monthPresentations, profiles]);

  // 3B. COMPREHENSIVE MONTHLY PRESENTER COMPLIANCE MONITOR DATA
  const presenterComplianceData = useMemo(() => {
    const list = eligibleProfiles.map(p => {
      const userPresList = presenterMap[p.id] || [];
      const isCompulsory = isKDCompulsoryForLevel(p.learningLevel, kdInfo?.compulsoryLevels);

      // Check for Completed presentation
      const completedPres = userPresList.find(pres => pres.status === "Completed");

      // Check for Missed presentation: explicit status === "Missed" / "Cancelled" / "Absent", or scheduled date in past without completion
      const missedPres = userPresList.find(pres => {
        if (pres.status === "Completed") return false;
        if (pres.status === "Missed" || pres.status === "Cancelled" || pres.status === "Absent") return true;
        if (pres.date && pres.date < todayLagosDate && (pres.status === "Scheduled" || pres.status === "Approved" || pres.status === "Pending")) return true;
        return false;
      });

      // Check for Upcoming presentation: scheduled or approved, date >= today (or generic upcoming)
      const upcomingPres = userPresList.find(pres => {
        if (pres.status === "Completed") return false;
        if (missedPres && pres.id === missedPres.id) return false;
        if (pres.status === "Scheduled" || pres.status === "Approved" || pres.status === "Upcoming") {
          return !pres.date || pres.date >= todayLagosDate;
        }
        return false;
      });

      const primaryPres = completedPres || upcomingPres || missedPres || userPresList[0];

      let complianceStatus: "Completed" | "Upcoming" | "Missed" | "Not Scheduled" = "Not Scheduled";
      if (completedPres) {
        complianceStatus = "Completed";
      } else if (missedPres) {
        complianceStatus = "Missed";
      } else if (upcomingPres) {
        complianceStatus = "Upcoming";
      }

      const allUserPres = presentations.filter(pres => pres.presenterUserId === p.id || (pres.presenterName && pres.presenterName.toLowerCase() === p.fullName.toLowerCase()));
      const completedAll = allUserPres.filter(pres => pres.status === "Completed").sort((a, b) => b.date.localeCompare(a.date));
      const lastPresDate = completedAll[0]?.date || "Never Presented";

      return {
        profile: p,
        isCompulsory,
        userPresList,
        primaryPres,
        topic: (() => {
          if (!primaryPres || !primaryPres.topic || !primaryPres.topic.trim()) return "No Topic Assigned";
          if (primaryPres.status === "Approved" || primaryPres.status === "Ready for Presentation" || primaryPres.status === "Completed") return primaryPres.topic;
          if (isAuthorizedForKDTopic(primaryPres, profile, microserviceOwners, profile?.role === "admin" || profile?.status === "admin")) return primaryPres.topic;
          return "Topic Awaiting Approval";
        })(),
        presentationDate: primaryPres?.date || "N/A",
        status: complianceStatus,
        rating: completedPres?.rating ? `⭐ ${completedPres.rating} / 5` : "Pending Rating",
        lastPresDate
      };
    });

    const eligibleCount = list.length;
    const completedList = list.filter(item => item.status === "Completed");
    const upcomingList = list.filter(item => item.status === "Upcoming");
    const missedList = list.filter(item => item.status === "Missed");
    const notScheduledList = list.filter(item => item.status === "Not Scheduled");

    const overallMonthlyComplianceRate = eligibleCount > 0 
      ? Math.round((completedList.length / eligibleCount) * 100) 
      : 0;

    const assignedComplianceRate = eligibleCount > 0 
      ? Math.round(((completedList.length + upcomingList.length) / eligibleCount) * 100) 
      : 0;

    return {
      allPresenters: list,
      eligibleCount,
      completedList,
      upcomingList,
      missedList,
      notScheduledList,
      completedCount: completedList.length,
      upcomingCount: upcomingList.length,
      missedCount: missedList.length,
      notScheduledCount: notScheduledList.length,
      overallMonthlyComplianceRate,
      assignedComplianceRate
    };
  }, [eligibleProfiles, presenterMap, presentations, kdInfo, todayLagosDate]);

  const filteredCompliancePresenters = useMemo(() => {
    if (complianceFilter === "completed") return presenterComplianceData.completedList;
    if (complianceFilter === "upcoming") return presenterComplianceData.upcomingList;
    if (complianceFilter === "missed") return presenterComplianceData.missedList;
    if (complianceFilter === "notscheduled") return presenterComplianceData.notScheduledList;
    return presenterComplianceData.allPresenters;
  }, [complianceFilter, presenterComplianceData]);

  // 4. TECHIES WHO PRESENTED
  const techiesWhoPresented = useMemo(() => {
    return eligibleProfiles.filter(p => {
      const userPres = presenterMap[p.id] || [];
      return userPres.some(pres => pres.status === "Completed" || pres.status === "Scheduled" || pres.status === "Approved");
    }).map(p => {
      const userPres = presenterMap[p.id] || [];
      const completed = userPres.filter(pres => pres.status === "Completed");
      const scheduled = userPres.filter(pres => pres.status === "Scheduled" || pres.status === "Approved");
      
      let totalRating = 0;
      let ratingCount = 0;
      completed.forEach(pres => {
        if (pres.rating) {
          totalRating += pres.rating;
          ratingCount++;
        }
      });
      const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : "N/A";

      return {
        profile: p,
        userPres,
        completedCount: completed.length,
        scheduledCount: scheduled.length,
        avgRating,
        primaryTopic: userPres[0]?.topic || "Knowledge Development Session",
        presentationDate: userPres[0]?.date || "N/A",
        status: completed.length > 0 ? "Completed" : "Scheduled"
      };
    });
  }, [eligibleProfiles, presenterMap]);

  // 5. ELIGIBLE TECHIES WHO DID NOT PRESENT
  const techiesWhoDidNotPresent = useMemo(() => {
    return eligibleProfiles.filter(p => {
      const userPres = presenterMap[p.id] || [];
      return !userPres.some(pres => pres.status === "Completed" || pres.status === "Scheduled" || pres.status === "Approved");
    }).map(p => {
      const allUserPres = presentations.filter(pres => pres.presenterUserId === p.id || (pres.presenterName && pres.presenterName.toLowerCase() === p.fullName.toLowerCase()));
      const completedAll = allUserPres.filter(pres => pres.status === "Completed").sort((a, b) => b.date.localeCompare(a.date));
      const lastPresDate = completedAll[0]?.date || "Never Presented";
      const isCompulsory = isKDCompulsoryForLevel(p.learningLevel, kdInfo?.compulsoryLevels);

      return {
        profile: p,
        isCompulsory,
        lastPresDate
      };
    });
  }, [eligibleProfiles, presenterMap, presentations, kdInfo]);

  // 6. ATTENDANCE STATISTICS FOR ELIGIBLE COHORT
  const attendanceStats = useMemo(() => {
    const eligibleIds = new Set(eligibleProfiles.map(p => p.id));
    
    const monthKDAttendance = attendance.filter(a => {
      if (!eligibleIds.has(a.userId)) return false;
      if (monthKDMeetingIds.has(a.meetingId)) return true;
      const aDate = a.meetingDate || a.timestamp?.substring(0, 7);
      return aDate && aDate.startsWith(selectedMonthStr);
    });

    const totalAttended = monthKDAttendance.filter(a => a.status === "Attended").length;
    const totalLate = monthKDAttendance.filter(a => a.status === "Late").length;
    const totalAbsent = monthKDAttendance.filter(a => (a.status as string) === "Absent" || a.status === "Missed").length;
    const totalRecords = monthKDAttendance.length;

    const onTimeRate = totalRecords > 0 ? Math.round((totalAttended / totalRecords) * 100) : 0;
    const lateRate = totalRecords > 0 ? Math.round((totalLate / totalRecords) * 100) : 0;
    const absentRate = totalRecords > 0 ? Math.round((totalAbsent / totalRecords) * 100) : 0;
    const overallAttendanceRate = totalRecords > 0 ? Math.round(((totalAttended + totalLate) / totalRecords) * 100) : 0;

    // Per techie attendance breakdown
    const userAttendanceLedger = eligibleProfiles.map(p => {
      const userRecords = monthKDAttendance.filter(a => a.userId === p.id);
      const attended = userRecords.filter(a => a.status === "Attended").length;
      const late = userRecords.filter(a => a.status === "Late").length;
      const absent = userRecords.filter(a => (a.status as string) === "Absent" || a.status === "Missed").length;
      const total = userRecords.length;
      const rate = total > 0 ? Math.round(((attended + late) / total) * 100) : 0;

      return {
        profile: p,
        attended,
        late,
        absent,
        total,
        rate
      };
    }).sort((a, b) => a.rate - b.rate); // Default sorted ascending (lowest rate first)

    return {
      monthKDAttendance,
      totalRecords,
      totalAttended,
      totalLate,
      totalAbsent,
      onTimeRate,
      lateRate,
      absentRate,
      overallAttendanceRate,
      userAttendanceLedger
    };
  }, [eligibleProfiles, attendance, monthKDMeetingIds, selectedMonthStr]);

  // 7. LOWEST ATTENDANCE BY TECHIE LEVEL
  const lowestAttendanceLevels = useMemo(() => {
    const levelMap: Record<string, { totalTechies: number; totalRecords: number; attended: number; late: number; absent: number }> = {};
    
    // Group eligible techies by learning level
    eligibleProfiles.forEach(p => {
      const lvl = p.learningLevel || "Apprentice level 1";
      if (!levelMap[lvl]) {
        levelMap[lvl] = { totalTechies: 0, totalRecords: 0, attended: 0, late: 0, absent: 0 };
      }
      levelMap[lvl].totalTechies += 1;
    });

    // Map attendance records to levels
    attendanceStats.monthKDAttendance.forEach(a => {
      const p = eligibleProfiles.find(prof => prof.id === a.userId);
      if (p) {
        const lvl = p.learningLevel || "Apprentice level 1";
        if (!levelMap[lvl]) {
          levelMap[lvl] = { totalTechies: 1, totalRecords: 0, attended: 0, late: 0, absent: 0 };
        }
        levelMap[lvl].totalRecords += 1;
        if (a.status === "Attended") levelMap[lvl].attended += 1;
        else if (a.status === "Late") levelMap[lvl].late += 1;
        else levelMap[lvl].absent += 1;
      }
    });

    return Object.entries(levelMap).map(([level, stats]) => {
      const rate = stats.totalRecords > 0 
        ? Math.round(((stats.attended + stats.late) / stats.totalRecords) * 100) 
        : 0;
      return {
        level,
        ...stats,
        rate
      };
    }).sort((a, b) => a.rate - b.rate); // Lowest attendance rate first
  }, [eligibleProfiles, attendanceStats.monthKDAttendance]);

  // 8. LOWEST ATTENDANCE BY TEAM / TRACK
  const lowestAttendanceTeams = useMemo(() => {
    const teamMap: Record<string, { totalTechies: number; totalRecords: number; attended: number; late: number; absent: number }> = {};

    eligibleProfiles.forEach(p => {
      const track = p.track || "General Engineering";
      if (!teamMap[track]) {
        teamMap[track] = { totalTechies: 0, totalRecords: 0, attended: 0, late: 0, absent: 0 };
      }
      teamMap[track].totalTechies += 1;
    });

    attendanceStats.monthKDAttendance.forEach(a => {
      const p = eligibleProfiles.find(prof => prof.id === a.userId);
      if (p) {
        const track = p.track || "General Engineering";
        if (!teamMap[track]) {
          teamMap[track] = { totalTechies: 1, totalRecords: 0, attended: 0, late: 0, absent: 0 };
        }
        teamMap[track].totalRecords += 1;
        if (a.status === "Attended") teamMap[track].attended += 1;
        else if (a.status === "Late") teamMap[track].late += 1;
        else teamMap[track].absent += 1;
      }
    });

    return Object.entries(teamMap).map(([team, stats]) => {
      const rate = stats.totalRecords > 0 
        ? Math.round(((stats.attended + stats.late) / stats.totalRecords) * 100) 
        : 0;
      return {
        team,
        ...stats,
        rate
      };
    }).sort((a, b) => a.rate - b.rate); // Lowest attendance rate first
  }, [eligibleProfiles, attendanceStats.monthKDAttendance]);

  // 9. FREQUENTLY ABSENT ATTENDEES
  const frequentlyAbsentAttendees = useMemo(() => {
    return attendanceStats.userAttendanceLedger
      .filter(item => item.absent > 0 || (item.total > 0 && item.rate < 60))
      .sort((a, b) => b.absent - a.absent || a.rate - b.rate);
  }, [attendanceStats.userAttendanceLedger]);

  // 10. SUMMARY METRICS
  const totalEligible = eligibleProfiles.length;
  const presentedCount = techiesWhoPresented.length;
  const didNotPresentCount = techiesWhoDidNotPresent.length;
  const presentationCompletionRate = totalEligible > 0 ? Math.round((presentedCount / totalEligible) * 100) : 0;

  // Compliance Status Health
  const complianceStatus = useMemo(() => {
    if (presentationCompletionRate >= 80) {
      return { label: "High Compliance", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "🟢" };
    } else if (presentationCompletionRate >= 50) {
      return { label: "Moderate Compliance", color: "bg-amber-100 text-amber-800 border-amber-300", icon: "🟡" };
    } else {
      return { label: "Critical Participation Gap", color: "bg-rose-100 text-rose-800 border-rose-300", icon: "🔴" };
    }
  }, [presentationCompletionRate]);

  // Handler: Send presentation reminder
  const handleSendReminder = async (targetProfile: Profile) => {
    setRemindingUserId(targetProfile.id);
    try {
      const msg = `📢 Knowledge Development Notice: You are scheduled/required to present your KD topic for ${reportPeriodLabel}. Please check the KD Presentation Schedule and submit your topic details.`;
      await sendReminder(targetProfile.id, msg);
      toast.success(`Presentation reminder successfully dispatched to ${targetProfile.fullName}.`);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error(`Failed to send reminder: ${err.message}`);
    } finally {
      setRemindingUserId(null);
    }
  };

  // Handler: Send attendance warning reminder to frequently absent attendee
  const handleSendAttendanceWarning = async (targetProfile: Profile, absentCount: number) => {
    setRemindingUserId(targetProfile.id);
    try {
      const msg = `⚠️ Knowledge Development Attendance Warning: You have ${absentCount} missed/absent session(s) recorded in ${reportPeriodLabel}. Regular attendance is required for your progression. Please ensure you attend all scheduled KD sessions.`;
      await sendReminder(targetProfile.id, msg);
      toast.success(`Attendance warning reminder sent to ${targetProfile.fullName}.`);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error(`Failed to send warning: ${err.message}`);
    } finally {
      setRemindingUserId(null);
    }
  };

  // Handler: Export CSV Report
  const handleExportCSV = () => {
    const headers = [
      "=== BINCOM DEV CENTER - MONTHLY PRESENTER COMPLIANCE & PARTICIPATION REPORT ===",
      `Report Period: ${reportPeriodLabel}`,
      `Generated Date: ${getLagosDateString(new Date())}`,
      `Team Filter: ${selectedTeam}`,
      `Level Filter: ${selectedLevel}`,
      `Techie Name Search: ${searchQuery || "None"}`,
      `Total Eligible Presenters: ${presenterComplianceData.eligibleCount}`,
      `Completed Presenters: ${presenterComplianceData.completedCount}`,
      `Upcoming Presenters: ${presenterComplianceData.upcomingCount}`,
      `Missed Presenters: ${presenterComplianceData.missedCount}`,
      `Not Scheduled Presenters: ${presenterComplianceData.notScheduledCount}`,
      `Overall Monthly Compliance Rate: ${presenterComplianceData.overallMonthlyComplianceRate}%`,
      `Overall Attendance Rate: ${attendanceStats.overallAttendanceRate}%`,
      "",
      "--- SECTION 1: MONTHLY PRESENTER COMPLIANCE MONITOR ---",
      "Student ID,Full Name,Username,Track/Team,Techie Level,Assigned Topic,Scheduled Date,Presentation Status,Compulsory Status",
      ...presenterComplianceData.allPresenters.map(item =>
        `"${item.profile.id}","${item.profile.fullName}","${item.profile.username}","${item.profile.track}","${item.profile.learningLevel || 'Apprentice level 1'}","${item.topic}","${item.presentationDate}","${item.status}","${item.isCompulsory ? 'Mandatory for Level' : 'Optional'}"`
      ),
      "",
      "--- SECTION 2: TECHIE LEVELS WITH LOWEST ATTENDANCE ---",
      "Techie Level,Total Techies,Recorded Sessions,Attended,Late,Absent,Attendance Rate %",
      ...lowestAttendanceLevels.map(item =>
        `"${item.level}",${item.totalTechies},${item.totalRecords},${item.attended},${item.late},${item.absent},"${item.rate}%"`
      ),
      "",
      "--- SECTION 3: TEAMS WITH LOWEST ATTENDANCE ---",
      "Team / Track,Total Techies,Recorded Sessions,Attended,Late,Absent,Attendance Rate %",
      ...lowestAttendanceTeams.map(item =>
        `"${item.team}",${item.totalTechies},${item.totalRecords},${item.attended},${item.late},${item.absent},"${item.rate}%"`
      ),
      "",
      "--- SECTION 4: FREQUENTLY ABSENT ATTENDEES ---",
      "Student ID,Full Name,Username,Track/Team,Techie Level,Attended,Late,Absent,Total Sessions,Attendance Rate %",
      ...frequentlyAbsentAttendees.map(item =>
        `"${item.profile.id}","${item.profile.fullName}","${item.profile.username}","${item.profile.track}","${item.profile.learningLevel || 'Apprentice level 1'}",${item.attended},${item.late},${item.absent},${item.total},"${item.rate}%"`
      ),
      "",
      "--- SECTION 5: FULL INDIVIDUAL ATTENDANCE LEDGER ---",
      "Student ID,Full Name,Track/Team,Attended Sessions,Late Sessions,Absent Sessions,Total Sessions,Attendance Rate %",
      ...attendanceStats.userAttendanceLedger.map(item =>
        `"${item.profile.id}","${item.profile.fullName}","${item.profile.track}",${item.attended},${item.late},${item.absent},${item.total},"${item.rate}%"`
      )
    ].join("\n");

    const blob = new Blob([headers], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Bincom_KD_Presenter_Compliance_Report_${selectedYear}_${selectedMonthNum}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("KD Monthly Presenter Compliance CSV generated successfully!");
  };

  // Handler: Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // Handler: Export JSON Report
  const handleExportJSON = () => {
    const reportData = {
      meta: {
        title: "Knowledge Development Monthly Presenter Compliance & Attendance Report",
        organization: "Bincom Dev Center",
        period: reportPeriodLabel,
        generatedAt: new Date().toISOString(),
        filters: {
          year: selectedYear,
          month: selectedMonthNum,
          team: selectedTeam,
          level: selectedLevel,
          searchQuery
        }
      },
      presenterComplianceSummary: {
        totalEligiblePresenters: presenterComplianceData.eligibleCount,
        completedPresenters: presenterComplianceData.completedCount,
        upcomingPresenters: presenterComplianceData.upcomingCount,
        missedPresenters: presenterComplianceData.missedCount,
        notScheduledPresenters: presenterComplianceData.notScheduledCount,
        overallMonthlyComplianceRate: `${presenterComplianceData.overallMonthlyComplianceRate}%`,
        assignedComplianceRate: `${presenterComplianceData.assignedComplianceRate}%`,
        complianceHealth: complianceStatus.label
      },
      presenterComplianceDetails: presenterComplianceData.allPresenters.map(p => ({
        id: p.profile.id,
        fullName: p.profile.fullName,
        username: p.profile.username,
        track: p.profile.track,
        level: p.profile.learningLevel || "Apprentice level 1",
        topic: p.topic,
        scheduledDate: p.presentationDate,
        presentationStatus: p.status,
        isCompulsory: p.isCompulsory,
        rating: p.rating
      })),
      attendanceAnalytics: {
        overallAttendanceRate: `${attendanceStats.overallAttendanceRate}%`,
        totalKDMeetingsInMonth: monthKDMeetings.length,
        lowestAttendanceLevels: lowestAttendanceLevels.map(l => ({
          level: l.level,
          totalTechies: l.totalTechies,
          totalRecords: l.totalRecords,
          attended: l.attended,
          late: l.late,
          absent: l.absent,
          attendanceRate: `${l.rate}%`
        })),
        lowestAttendanceTeams: lowestAttendanceTeams.map(t => ({
          team: t.team,
          totalTechies: t.totalTechies,
          totalRecords: t.totalRecords,
          attended: t.attended,
          late: t.late,
          absent: t.absent,
          attendanceRate: `${t.rate}%`
        }))
      },
      frequentlyAbsentAttendees: frequentlyAbsentAttendees.map(a => ({
        id: a.profile.id,
        fullName: a.profile.fullName,
        username: a.profile.username,
        track: a.profile.track,
        level: a.profile.learningLevel || "Apprentice level 1",
        attended: a.attended,
        late: a.late,
        absent: a.absent,
        total: a.total,
        rate: `${a.rate}%`
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Bincom_KD_Presenter_Compliance_Report_${selectedYear}_${selectedMonthNum}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Structured JSON Presenter Compliance Report exported!");
  };

  const isFiltered = selectedTeam !== "All Teams / Tracks" || selectedLevel !== "All Techie Levels" || searchQuery.trim() !== "";

  return (
    <div className="space-y-6" id="kd-report-root">
      {/* HEADER BAR & CONTROLS */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 print:shadow-none print:border-none print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-150 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-[#4B5E40] text-white rounded-xl shadow-xs">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  Knowledge Development Participation & Engagement Analytics
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  Identify low attendance techie levels, low participation teams, non-presenters, and absent attendees for <strong className="text-gray-800">{reportPeriodLabel}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download full report as CSV"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>

            <button
              onClick={handleExportJSON}
              className="px-3 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Export structured JSON report"
            >
              <FileText className="w-4 h-4" /> Export JSON
            </button>

            <button
              onClick={handlePrintReport}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print formatted organizational report"
            >
              <Printer className="w-4 h-4" /> Print Report
            </button>
          </div>
        </div>

        {/* FILTERS TOOLBAR */}
        <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3 print:hidden">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700">
            <span className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#4B5E40]" /> Filter Analytics & Cohort
            </span>
            <div className="flex items-center gap-2">
              {isFiltered && (
                <button
                  onClick={() => {
                    setSelectedTeam("All Teams / Tracks");
                    setSelectedLevel("All Techie Levels");
                    setSearchQuery("");
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" /> Clear Filters
                </button>
              )}
              <span className="text-[10px] text-gray-500 font-mono bg-gray-200/80 px-2 py-0.5 rounded-md">
                {eligibleProfiles.length} eligible techies
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Filter 1: Month */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">
                Month
              </label>
              <select
                value={selectedMonthNum}
                onChange={(e) => setSelectedMonthNum(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#4B5E40] focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Year */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#4B5E40] focus:outline-none cursor-pointer"
              >
                {["2024", "2025", "2026", "2027"].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Team / Track */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">
                Team / Track
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#4B5E40] focus:outline-none cursor-pointer"
              >
                {ALL_TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Techie Level */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">
                Techie Level
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#4B5E40] focus:outline-none cursor-pointer"
              >
                {ALL_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 5: Techie Name Search */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">
                Techie Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter techie name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#4B5E40] focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="report-summary-cards">
        {/* Card 1: Presentation Compliance Percentage */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Presentation Compliance</span>
            <Mic className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{presentationCompletionRate}%</span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${complianceStatus.color}`}>
              {complianceStatus.label}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            {presentedCount} of {totalEligible} techies completed or scheduled.
          </p>
        </div>

        {/* Card 2: Overall Attendance Rate */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Overall Attendance</span>
            <TrendingUp className="w-4 h-4 text-[#4B5E40]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900">{attendanceStats.overallAttendanceRate}%</span>
            <span className="text-[10px] font-mono text-gray-500">{monthKDMeetings.length} sessions</span>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            {attendanceStats.totalAttended} on-time + {attendanceStats.totalLate} late logs.
          </p>
        </div>

        {/* Card 3: Lowest Level Attendance */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Lowest Level Rate</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700">
              {lowestAttendanceLevels[0] ? `${lowestAttendanceLevels[0].rate}%` : "N/A"}
            </span>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 truncate max-w-[80px]" title={lowestAttendanceLevels[0]?.level}>
              {lowestAttendanceLevels[0]?.level || "N/A"}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            Techie Level requiring attendance boost.
          </p>
        </div>

        {/* Card 4: Lowest Team Attendance */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Lowest Team Rate</span>
            <Briefcase className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700">
              {lowestAttendanceTeams[0] ? `${lowestAttendanceTeams[0].rate}%` : "N/A"}
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-[80px]" title={lowestAttendanceTeams[0]?.team}>
              {lowestAttendanceTeams[0]?.team || "N/A"}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            Team/Track requiring engagement follow-up.
          </p>
        </div>

        {/* Card 5: Frequently Absent Techies */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Absent Techies</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700">{frequentlyAbsentAttendees.length}</span>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Low Engagement
            </span>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            Techies with frequent session absences.
          </p>
        </div>
      </div>

      {/* VISUAL PRESENTATION COMPLIANCE PROGRESS */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-150 pb-3">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#4B5E40]" /> Presentation Compliance Percentage Visual Breakdown
          </h3>
          <span className="text-xs font-mono font-bold text-[#4B5E40]">
            {presentedCount} of {totalEligible} presented ({presentationCompletionRate}%)
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
            <div 
              style={{ width: `${presentationCompletionRate}%` }} 
              className="bg-emerald-500 transition-all duration-500 flex items-center justify-center text-[9px] font-black text-white"
              title={`Presented: ${presentationCompletionRate}%`}
            >
              {presentationCompletionRate > 10 && `${presentationCompletionRate}%`}
            </div>
            <div 
              style={{ width: `${100 - presentationCompletionRate}%` }} 
              className="bg-rose-400 transition-all duration-500 flex items-center justify-center text-[9px] font-black text-white"
              title={`Pending: ${100 - presentationCompletionRate}%`}
            >
              {(100 - presentationCompletionRate) > 10 && `${100 - presentationCompletionRate}%`}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-emerald-700 flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" /> Completed / Scheduled Presenters ({presentedCount})
            </span>
            <span className="text-rose-700 flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-rose-400 rounded-full inline-block" /> Unassigned / Pending ({didNotPresentCount})
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 0: MONTHLY PRESENTER COMPLIANCE MONITOR */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="presenter-compliance-section">
        <div className="p-5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl shrink-0">
              <Mic className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm uppercase tracking-wider text-emerald-300">
                  Monthly Presenter Compliance Monitor
                </h3>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-mono">
                  {reportPeriodLabel}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                Monitor eligible presenters, completed presentations, upcoming schedules, and missed assignments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Overall Monthly Compliance Rate</span>
              <span className="text-2xl font-black text-white font-mono">{presenterComplianceData.overallMonthlyComplianceRate}%</span>
            </div>
          </div>
        </div>

        {/* 4 COMPLIANCE SUMMARY TILES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-200 bg-emerald-50/30 border-b border-gray-200">
          <div className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider">1. Eligible Presenters</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-gray-900">{presenterComplianceData.eligibleCount}</span>
              <span className="text-[10px] font-bold text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-full">Total Cohort</span>
            </div>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">2. Completed Presentations</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-700">{presenterComplianceData.completedCount}</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                Fulfilled
              </span>
            </div>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-sky-700 tracking-wider">3. Upcoming Presentations</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-sky-700">{presenterComplianceData.upcomingCount}</span>
              <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-300">
                Scheduled
              </span>
            </div>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider">4. Missed Presentations</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-rose-700">{presenterComplianceData.missedCount}</span>
              <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                Attention Required
              </span>
            </div>
          </div>
        </div>

        {/* STATUS FILTER TAB STRIP */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setComplianceFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                complianceFilter === "all"
                  ? "bg-gray-900 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-200"
              }`}
            >
              All Eligible Presenters ({presenterComplianceData.eligibleCount})
            </button>

            <button
              type="button"
              onClick={() => setComplianceFilter("completed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                complianceFilter === "completed"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" /> Completed ({presenterComplianceData.completedCount})
            </button>

            <button
              type="button"
              onClick={() => setComplianceFilter("upcoming")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                complianceFilter === "upcoming"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Upcoming ({presenterComplianceData.upcomingCount})
            </button>

            <button
              type="button"
              onClick={() => setComplianceFilter("missed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                complianceFilter === "missed"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Missed ({presenterComplianceData.missedCount})
            </button>

            <button
              type="button"
              onClick={() => setComplianceFilter("notscheduled")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                complianceFilter === "notscheduled"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Not Scheduled ({presenterComplianceData.notScheduledCount})
            </button>
          </div>

          <span className="text-xs text-gray-500 font-mono">
            Showing {filteredCompliancePresenters.length} presenters
          </span>
        </div>

        {/* PRESENTER COMPLIANCE TABLE */}
        {filteredCompliancePresenters.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs font-medium space-y-1">
            <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
            <p>No presenters found for the selected compliance filter status ({complianceFilter}).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
              <thead>
                <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Presenter Name</th>
                  <th className="py-3 px-4">Track / Team</th>
                  <th className="py-3 px-4">Techie Level</th>
                  <th className="py-3 px-4">Assigned Topic</th>
                  <th className="py-3 px-4 text-center">Scheduled Date</th>
                  <th className="py-3 px-4 text-center">Presentation Status</th>
                  <th className="py-3 px-4 text-center">Compulsory Requirement</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {filteredCompliancePresenters.map((item) => {
                  return (
                    <tr key={item.profile.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        <div>{item.profile.fullName}</div>
                        <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-semibold max-w-xs truncate">
                        {item.profile.track}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-bold">
                          {item.profile.learningLevel || "Apprentice level 1"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-800 max-w-xs truncate">
                        {item.topic}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-gray-600 font-bold">
                        {item.presentationDate}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          item.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : item.status === "Upcoming"
                            ? "bg-sky-100 text-sky-800 border-sky-300"
                            : item.status === "Missed"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}>
                          {item.status === "Completed" && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                          {item.status === "Upcoming" && <Calendar className="w-3 h-3 text-sky-600" />}
                          {item.status === "Missed" && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                          {item.status === "Not Scheduled" && <Clock className="w-3 h-3 text-amber-600" />}
                          {item.status === "Completed" ? "Completed" : item.status === "Upcoming" ? "Upcoming" : item.status === "Missed" ? "Missed Assigned" : "Not Scheduled"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.isCompulsory
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}>
                          {item.isCompulsory ? "Mandatory for Level" : "Optional"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(item.profile)}
                          disabled={remindingUserId === item.profile.id}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3 h-3 text-emerald-600" />
                          {remindingUserId === item.profile.id ? "Sending..." : "Dispatch Notice"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 1: TECHIE LEVELS WITH LOWEST ATTENDANCE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="lowest-levels-section">
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-300">
                1. Techie Levels with Lowest Attendance Rate
              </h3>
              <p className="text-[11px] text-gray-300 font-medium">
                Identifies techie levels ordered from lowest to highest attendance rate to help microservice owners trigger targeted level interventions.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full self-start sm:self-auto">
            {lowestAttendanceLevels.length} Techie Levels Identified
          </span>
        </div>

        {lowestAttendanceLevels.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs font-medium space-y-1">
            <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
            <p>No techie level attendance data found for the selected filter period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Techie Level</th>
                  <th className="py-3 px-4 text-center">Techies Count</th>
                  <th className="py-3 px-4 text-center">Sessions Recorded</th>
                  <th className="py-3 px-4 text-center">Attended On-Time</th>
                  <th className="py-3 px-4 text-center">Late Entries</th>
                  <th className="py-3 px-4 text-center">Absent Sessions</th>
                  <th className="py-3 px-4 text-center">Attendance Rate %</th>
                  <th className="py-3 px-4 text-center">Engagement Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {lowestAttendanceLevels.map((item, idx) => {
                  const isLowest = idx === 0 || item.rate < 50;
                  return (
                    <tr key={item.level} className={`transition ${isLowest ? "bg-rose-50/30 hover:bg-rose-50/50" : "hover:bg-gray-50/60"}`}>
                      <td className="py-3.5 px-4 font-extrabold text-gray-900 flex items-center gap-2">
                        {idx === 0 && <span className="text-rose-600 text-xs" title="Lowest overall attendance level">🚨</span>}
                        {item.level}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                        {item.totalTechies}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-gray-600">
                        {item.totalRecords}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-700 font-bold">
                        {item.attended}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-amber-700 font-bold">
                        {item.late}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-rose-600 font-bold">
                        {item.absent}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono border ${
                          item.rate >= 80 
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                            : item.rate >= 50 
                            ? "bg-amber-50 text-amber-800 border-amber-200" 
                            : "bg-rose-100 text-rose-900 border-rose-300 animate-pulse"
                        }`}>
                          {item.rate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                          item.rate < 50 
                            ? "bg-rose-100 text-rose-800 border-rose-200" 
                            : item.rate < 75 
                            ? "bg-amber-100 text-amber-800 border-amber-200" 
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {item.rate < 50 ? "High Priority Risk" : item.rate < 75 ? "Medium Monitor" : "Optimal"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: TEAMS / TRACKS WITH LOWEST ATTENDANCE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="lowest-teams-section">
        <div className="p-4 bg-gray-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-sky-300">
                2. Teams / Tracks with Lowest Attendance Rate
              </h3>
              <p className="text-[11px] text-gray-300 font-medium">
                Ranks all functional tracks by attendance percentage to pinpoint low engagement teams across the organization.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-black text-sky-300 bg-sky-950/60 border border-sky-500/30 px-3 py-1 rounded-full self-start sm:self-auto">
            {lowestAttendanceTeams.length} Teams Identified
          </span>
        </div>

        {lowestAttendanceTeams.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs font-medium space-y-1">
            <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
            <p>No team attendance data found for the selected filter period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Team / Track</th>
                  <th className="py-3 px-4 text-center">Techies Count</th>
                  <th className="py-3 px-4 text-center">Sessions Recorded</th>
                  <th className="py-3 px-4 text-center">Attended On-Time</th>
                  <th className="py-3 px-4 text-center">Late Entries</th>
                  <th className="py-3 px-4 text-center">Absent Sessions</th>
                  <th className="py-3 px-4 text-center">Attendance Rate %</th>
                  <th className="py-3 px-4 text-center">Engagement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {lowestAttendanceTeams.map((item, idx) => {
                  const isLowest = idx === 0 || item.rate < 50;
                  return (
                    <tr key={item.team} className={`transition ${isLowest ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-gray-50/60"}`}>
                      <td className="py-3.5 px-4 font-extrabold text-gray-900 flex items-center gap-2">
                        {idx === 0 && <span className="text-amber-600 text-xs" title="Lowest attendance team">⚠️</span>}
                        {item.team}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                        {item.totalTechies}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-gray-600">
                        {item.totalRecords}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-700 font-bold">
                        {item.attended}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-amber-700 font-bold">
                        {item.late}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-rose-600 font-bold">
                        {item.absent}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono border ${
                          item.rate >= 80 
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                            : item.rate >= 50 
                            ? "bg-amber-50 text-amber-800 border-amber-200" 
                            : "bg-rose-100 text-rose-900 border-rose-300"
                        }`}>
                          {item.rate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                          item.rate < 50 
                            ? "bg-rose-100 text-rose-800 border-rose-200" 
                            : item.rate < 75 
                            ? "bg-amber-100 text-amber-800 border-amber-200" 
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {item.rate < 50 ? "Low Engagement" : item.rate < 75 ? "Moderate Engagement" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: FREQUENTLY ABSENT ATTENDEES */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="frequently-absent-section">
        <div className="p-4 bg-rose-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <UserX className="w-5 h-5 text-rose-300 shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-rose-200">
                3. Frequently Absent Attendees (Low Engagement Warning)
              </h3>
              <p className="text-[11px] text-rose-100 font-medium">
                Individual trainees with high absence counts or attendance rate under 60% in {reportPeriodLabel}.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-black text-rose-200 bg-rose-950/80 border border-rose-500/30 px-3 py-1 rounded-full self-start sm:self-auto">
            Count: {frequentlyAbsentAttendees.length}
          </span>
        </div>

        {frequentlyAbsentAttendees.length === 0 ? (
          <div className="p-8 text-center text-emerald-700 text-xs font-bold space-y-1">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-600" />
            <p>No frequently absent attendees detected for this filter period! High overall punctuality.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Track / Team</th>
                  <th className="py-3 px-4">Techie Level</th>
                  <th className="py-3 px-4 text-center">Attended On-Time</th>
                  <th className="py-3 px-4 text-center">Late Entries</th>
                  <th className="py-3 px-4 text-center">Absent Sessions</th>
                  <th className="py-3 px-4 text-center">Attendance Rate %</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {frequentlyAbsentAttendees.map((item) => (
                  <tr key={item.profile.id} className="hover:bg-rose-50/20 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <div>{item.profile.fullName}</div>
                      <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-semibold max-w-xs truncate">
                      {item.profile.track}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-bold">
                        {item.profile.learningLevel || "Apprentice level 1"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-700 font-bold">
                      {item.attended}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-amber-700 font-bold">
                      {item.late}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-rose-700 font-extrabold bg-rose-50/50">
                      {item.absent}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] bg-rose-100 text-rose-900 border border-rose-300 font-mono">
                        {item.rate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center print:hidden">
                      <button
                        onClick={() => handleSendAttendanceWarning(item.profile, item.absent)}
                        disabled={remindingUserId === item.profile.id}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 text-rose-600" />
                        {remindingUserId === item.profile.id ? "Sending..." : "Send Attendance Warning"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: ELIGIBLE PRESENTERS WHO HAVE NOT PRESENTED */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="non-presenters-section">
        <div className="p-4 bg-amber-500/10 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-950">
                4. Eligible Presenters Who Have Not Presented During {reportPeriodLabel}
              </h3>
              <p className="text-[11px] text-amber-800 font-medium">
                Trainees required or eligible for Knowledge Development who have not presented in this calendar month.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full self-start sm:self-auto">
            Count: {techiesWhoDidNotPresent.length}
          </span>
        </div>

        {techiesWhoDidNotPresent.length === 0 ? (
          <div className="p-8 text-center text-emerald-700 text-xs font-bold space-y-1">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-600" />
            <p>100% Presentation Compliance! All eligible techies have presented for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Track / Team</th>
                  <th className="py-3 px-4">Techie Level</th>
                  <th className="py-3 px-4 text-center">Compulsory Status</th>
                  <th className="py-3 px-4 text-center">Last Historical Presentation</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {techiesWhoDidNotPresent.map((item) => (
                  <tr key={item.profile.id} className="hover:bg-amber-50/20 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <div>{item.profile.fullName}</div>
                      <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-semibold max-w-xs truncate">
                      {item.profile.track}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] font-bold">
                        {item.profile.learningLevel || "Apprentice level 1"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        item.isCompulsory 
                          ? "bg-rose-50 text-rose-800 border-rose-200" 
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}>
                        {item.isCompulsory ? "Mandatory for Level" : "Optional"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-gray-500 font-semibold">
                      {item.lastPresDate}
                    </td>
                    <td className="py-3.5 px-4 text-center print:hidden">
                      <button
                        onClick={() => handleSendReminder(item.profile)}
                        disabled={remindingUserId === item.profile.id}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 text-amber-600" />
                        {remindingUserId === item.profile.id ? "Sending..." : "Dispatch Reminder"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5: TECHIES WHO PRESENTED DURING THE SELECTED MONTH */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="presented-techies-section">
        <div className="p-4 bg-[#F8FAF8] border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">
                5. Techies Who Presented During {reportPeriodLabel}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                List of techies who completed or are scheduled for Knowledge Development presentations in this period.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-auto">
            Total: {techiesWhoPresented.length}
          </span>
        </div>

        {techiesWhoPresented.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs font-medium space-y-2">
            <MicOff className="w-8 h-8 mx-auto text-gray-300" />
            <p>No presentation records found for the selected month/year filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Track / Team</th>
                  <th className="py-3 px-4">Techie Level</th>
                  <th className="py-3 px-4">Presentation Topic</th>
                  <th className="py-3 px-4 text-center">Presentation Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Avg Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {techiesWhoPresented.map((item) => (
                  <tr key={item.profile.id} className="hover:bg-gray-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <div>{item.profile.fullName}</div>
                      <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-semibold max-w-xs truncate">
                      {item.profile.track}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded text-[10px] font-bold">
                        {item.profile.learningLevel || "Apprentice level 1"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-800 font-medium max-w-xs truncate">
                      {item.primaryTopic}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-gray-600 font-bold">
                      {item.presentationDate}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        item.status === "Completed" 
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                          : "bg-sky-50 text-sky-800 border-sky-200"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-amber-700 font-mono">
                      {item.avgRating !== "N/A" ? `⭐ ${item.avgRating} / 5` : "Pending Rating"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 6: FULL INDIVIDUAL ATTENDANCE STATISTICS LEDGER */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" id="attendance-stats-section">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-gray-800">
            <Award className="w-5 h-5 text-[#4B5E40] shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">
                6. Complete Individual Attendance Ledger
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Punctuality logs recorded across Knowledge Development meetings in {reportPeriodLabel}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              On-Time: {attendanceStats.onTimeRate}%
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
              Late: {attendanceStats.lateRate}%
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700 font-sans whitespace-nowrap">
            <thead>
              <tr className="bg-[#F8FAF8] border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Track / Team</th>
                <th className="py-3 px-4 text-center">Attended On-Time</th>
                <th className="py-3 px-4 text-center">Late Entries</th>
                <th className="py-3 px-4 text-center">Absent / Missed</th>
                <th className="py-3 px-4 text-center">Total Sessions</th>
                <th className="py-3 px-4 text-center">Attendance Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {attendanceStats.userAttendanceLedger.map((item) => (
                <tr key={item.profile.id} className="hover:bg-gray-50/50 transition">
                  <td className="py-3 px-4 font-bold text-gray-900">
                    <div>{item.profile.fullName}</div>
                    <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 font-semibold max-w-xs truncate">
                    {item.profile.track}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                    {item.attended}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-amber-700">
                    {item.late}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                    {item.absent}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-gray-600">
                    {item.total}
                  </td>
                  <td className="py-3 px-4 text-center font-bold">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] ${
                      item.rate >= 80 
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                        : item.rate >= 50 
                        ? "bg-amber-50 text-amber-800 border border-amber-200" 
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}>
                      {item.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
