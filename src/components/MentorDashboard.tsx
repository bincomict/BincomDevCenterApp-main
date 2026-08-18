import React, { useState } from "react";
import { Profile, KDPresentation, WeeklyDrillSubmission, Meeting } from "../types";
import { 
  updateKDPresentation, 
  gradeDrillSubmission, 
  completeTask, 
  dismissReminder,
  dismissAllReminders
} from "../firebaseService";
import { toast } from "./Toast";
import { 
  getCleanTrackName, 
  getLagosDateString, 
  formatMeetingDates, 
  parseMeetingTimeToMinutes,
  isAuthorizedForKDTopic
} from "../utils/trackUtils";
import { 
  Users, 
  BookOpen, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Bell, 
  Calendar, 
  Video, 
  Layers, 
  Award, 
  Sparkles, 
  ChevronRight, 
  ExternalLink, 
  ShieldCheck, 
  CheckSquare, 
  FileText, 
  Filter, 
  ArrowRight, 
  X, 
  Check, 
  XCircle, 
  MessageSquare,
  Search,
  UserCheck
} from "lucide-react";

interface MentorDashboardProps {
  profile: Profile;
  state: any;
  onJoinMeeting: (meetingId: string) => void;
  setActiveTab: (tab: any) => void;
  setActiveSubTab?: (subTab: any) => void;
  setAdminTab?: (tab: any) => void;
  onStateUpdate?: () => void;
}

export default function MentorDashboard({
  profile,
  state,
  onJoinMeeting,
  setActiveTab,
  setActiveSubTab,
  setAdminTab,
  onStateUpdate,
}: MentorDashboardProps) {
  // Check authorization: Mentor or Admin only
  const isMentor =
    profile.role === "mentor" ||
    profile.role === "admin" ||
    String(profile.learningLevel || "").toLowerCase().includes("mentor") ||
    String(profile.occupation || "").toLowerCase().includes("mentor");

  if (!isMentor) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-gray-600 mb-6 leading-relaxed">
          The Mentor Dashboard is restricted to verified Mentors and Administrative Mentors. If you believe this is an error, please contact your Dev Center Administrator or update your profile onboarding details.
        </p>
        <button
          onClick={() => setActiveTab("dashboard")}
          className="px-4 py-2 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-xl transition cursor-pointer"
        >
          Return to Trainee Dashboard
        </button>
      </div>
    );
  }

  // Extract relevant state
  const {
    profiles = [],
    kdPresentations = [],
    weeklyDrills = [],
    drillSubmissions = [],
    meetings = [],
    reminders = [],
    dailyReports = [],
    standups = [],
    meetingAssignments = [],
    microserviceOwners = {},
  } = state || {};

  const mentorTrackClean = getCleanTrackName(profile.track);
  const isAdmin = profile.role === "admin" || profile.status === "admin";
  const now = new Date();
  const todayStr = getLagosDateString(now);

  // Filter 1: Trainees assigned to or on the same track as mentor
  const assignedTrainees = profiles.filter((p: Profile) => {
    if (p.role === "admin" || p.role === "mentor") return false;
    const pTrackClean = getCleanTrackName(p.track);
    if (mentorTrackClean && mentorTrackClean !== "All") {
      return pTrackClean.toLowerCase() === mentorTrackClean.toLowerCase();
    }
    return true;
  });

  // Filter 2: KD Presentations awaiting topic review for authorized users (Presenter, Assigned Mentor, Administrator, and KD Owner)
  const pendingKDTopics = kdPresentations.filter((p: KDPresentation) => {
    const isPendingOrDraftOrRejected =
      p.status === "Pending Review" ||
      p.status === "Draft" ||
      p.status === "Rejected" ||
      (p.topic && p.topic.trim() !== "" && p.status === "Awaiting topic submission");

    if (!isPendingOrDraftOrRejected) return false;

    return isAuthorizedForKDTopic(p, profile, microserviceOwners, isAdmin);
  });

  // Filter 3: Weekly Drill submissions pending grading
  const pendingDrillSubmissions = drillSubmissions.filter((s: WeeklyDrillSubmission) => {
    if (s.status !== "Pending") return false;
    const sTrackClean = getCleanTrackName(s.track);
    if (mentorTrackClean && mentorTrackClean !== "All") {
      return sTrackClean.toLowerCase() === mentorTrackClean.toLowerCase();
    }
    return true;
  });

  // Filter 4: Student Daily Reports pending review (today or recent)
  const pendingDailyReports = dailyReports.filter((r: any) => {
    if (r.reviewed) return false;
    const rTrackClean = getCleanTrackName(r.track);
    if (mentorTrackClean && mentorTrackClean !== "All") {
      return rTrackClean.toLowerCase() === mentorTrackClean.toLowerCase();
    }
    return true;
  });

  // Filter 5: Custom assigned tasks on Mentor's own profile
  const customAssignedTasks = (profile.assignedTasks || []).filter(
    (t: any) => t.status === "Pending"
  );

  // Grouped Tasks count
  const totalPendingTasksCount =
    pendingKDTopics.length +
    pendingDrillSubmissions.length +
    pendingDailyReports.length +
    customAssignedTasks.length;

  // Filter 6: Upcoming activities for mentor (meetings assigned or organized, upcoming KD presentations)
  const upcomingMentorMeetings = meetings.filter((m: Meeting) => {
    if (m.status === "Completed" || m.status === "Archived" || m.status === "Cancelled")
      return false;
    const isOrganizer =
      m.organizer &&
      (m.organizer === profile.id ||
        m.organizer.toLowerCase() === (profile.fullName || "").toLowerCase() ||
        m.organizer.toLowerCase() === (profile.email || "").toLowerCase());
    const isAssignedUser = m.assignedUserIds && m.assignedUserIds.includes(profile.id);
    const isTrackMatch =
      !mentorTrackClean ||
      mentorTrackClean === "All" ||
      m.trackId === "All" ||
      (Array.isArray(m.trackId)
        ? m.trackId.includes(mentorTrackClean)
        : m.trackId === mentorTrackClean);

    return isOrganizer || isAssignedUser || isTrackMatch;
  });

  const upcomingScheduledKD = kdPresentations.filter((p: KDPresentation) => {
    const isMyPresentation =
      p.assignedMentorUserId === profile.id ||
      p.assignedMentorName?.toLowerCase() === (profile.fullName || "").toLowerCase();
    const isScheduled =
      p.status === "Approved" || p.status === "Ready for Presentation" || p.status === "Pending Review";
    return isScheduled && (isMyPresentation || profile.role === "admin");
  });

  // Notifications relevant to mentor
  const mentorReminders = reminders.filter(
    (r: any) => !r.read && (r.userId === profile.id || r.userId === "all")
  );

  // Local Modal States
  const [activeMicroserviceTab, setActiveMicroserviceTab] = useState<
    "all" | "kd" | "drills" | "reports" | "custom"
  >("all");

  const [selectedKDModal, setSelectedKDModal] = useState<KDPresentation | null>(null);
  const [topicActionNote, setTopicActionNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [selectedDrillSubmissionModal, setSelectedDrillSubmissionModal] =
    useState<WeeklyDrillSubmission | null>(null);
  const [drillGradeFeedback, setDrillGradeFeedback] = useState("");

  // Handlers for quick actions
  const handleApproveKDTopic = async (pres: KDPresentation) => {
    try {
      setSubmittingAction(true);
      await updateKDPresentation(pres.id, {
        status: "Approved",
        notes: topicActionNote
          ? `[Mentor Approved]: ${topicActionNote}`
          : pres.notes || "Topic approved by mentor.",
      });
      toast.success(`Approved topic "${pres.topic}" for ${pres.presenterName}!`);
      setSelectedKDModal(null);
      setTopicActionNote("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to approve topic: " + err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectKDTopic = async (pres: KDPresentation) => {
    try {
      setSubmittingAction(true);
      await updateKDPresentation(pres.id, {
        status: "Rejected",
        notes: topicActionNote
          ? `[Mentor Feedback - Revision Needed]: ${topicActionNote}`
          : "Topic requires revision. Please update your topic.",
      });
      toast.success(`Topic revision requested for ${pres.presenterName}.`);
      setSelectedKDModal(null);
      setTopicActionNote("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to request topic revision: " + err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleGradeDrill = async (submission: WeeklyDrillSubmission, newStatus: "Approved" | "Rejected") => {
    try {
      setSubmittingAction(true);
      await gradeDrillSubmission(
        submission.id,
        newStatus === "Approved" ? 100 : 0,
        drillGradeFeedback || (newStatus === "Approved" ? "Great job!" : "Needs improvement."),
        newStatus
      );
      toast.success(`Drill submission marked as ${newStatus}!`);
      setSelectedDrillSubmissionModal(null);
      setDrillGradeFeedback("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to grade drill submission: " + err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCompleteCustomTask = async (taskId: string) => {
    try {
      await completeTask(profile.id, taskId);
      toast.success("Task marked as completed!");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to complete task: " + err.message);
    }
  };

  return (
    <div className="space-y-6" id="mentor-dashboard-root">
      {/* 1. MENTOR WELCOME BANNER & OVERVIEW METRICS */}
      <div className="bg-gradient-to-r from-[#4B5E40] to-[#3B4B32] rounded-2xl p-6 text-white shadow-sm border border-white/10 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/25">
                🎓 Mentor Dashboard
              </span>
              <span className="text-[10.5px] font-medium text-white/80 font-mono">
                {profile.track || "Global Mentor"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Welcome back, {profile.fullName || "Mentor"}
            </h1>
            <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
              Centralized view of your assigned trainees, pending task reviews across microservices, notifications, and scheduled mentor activities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {setAdminTab && (
              <button
                onClick={() => {
                  setActiveTab("admin");
                  setAdminTab("kd_desk");
                }}
                className="px-3.5 py-2 bg-white text-[#4B5E40] hover:bg-white/90 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#4B5E40]" />
                Admin / Mentor Controls
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs hover:border-[#4B5E40]/30 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Assigned Trainees
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#4B5E40]/10 text-[#4B5E40] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">
            {assignedTrainees.length}
          </div>
          <p className="text-[10.5px] text-gray-500 mt-1 font-medium">
            Active on {mentorTrackClean || "all tracks"}
          </p>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs hover:border-amber-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Pending Reviews
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">
            {totalPendingTasksCount}
          </div>
          <p className="text-[10.5px] text-amber-700 mt-1 font-semibold">
            {totalPendingTasksCount > 0 ? "Requires your attention" : "All caught up! 🎉"}
          </p>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Upcoming Sessions
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">
            {upcomingMentorMeetings.length + upcomingScheduledKD.length}
          </div>
          <p className="text-[10.5px] text-gray-500 mt-1 font-medium">
            Meetings & KD presentations
          </p>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs hover:border-rose-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Notifications
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">
            {mentorReminders.length}
          </div>
          <p className="text-[10.5px] text-gray-500 mt-1 font-medium">
            Unread dispatches & alerts
          </p>
        </div>
      </div>

      {/* 3. RECENT NOTIFICATIONS PANEL FOR MENTOR */}
      {mentorReminders.length > 0 && (
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-600 animate-bounce" />
              <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                Recent Mentor Dispatches ({mentorReminders.length})
              </h3>
            </div>
            <button
              onClick={() => dismissAllReminders(profile.id)}
              className="text-[10.5px] font-bold text-rose-700 hover:text-rose-900 bg-rose-100 hover:bg-rose-200/80 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              Dismiss All
            </button>
          </div>

          <div className="space-y-2">
            {mentorReminders.map((rem: any) => (
              <div
                key={rem.id}
                className="flex items-start justify-between gap-3 bg-white p-3 rounded-xl border border-rose-150/70 text-xs text-rose-900 font-medium"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-rose-500 mt-0.5">•</span>
                  <div>
                    <p>{rem.message}</p>
                    <span className="text-[9.5px] text-gray-400 font-mono mt-1 block">
                      {rem.timestamp
                        ? new Date(rem.timestamp).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Just now"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => dismissReminder(rem.id)}
                  className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer shrink-0"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. PENDING TASKS ASSIGNED TO MENTOR (GROUPED BY MICROSERVICE) */}
      <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare className="w-4.5 h-4.5 text-[#4B5E40]" />
              Pending Mentor Tasks & Reviews
            </h2>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              Grouped by microservices requiring your review, approval, or grading
            </p>
          </div>

          {/* Microservice Grouping Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveMicroserviceTab("all")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                activeMicroserviceTab === "all"
                  ? "bg-white text-[#4B5E40] shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({totalPendingTasksCount})
            </button>
            <button
              onClick={() => setActiveMicroserviceTab("kd")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                activeMicroserviceTab === "kd"
                  ? "bg-white text-[#4B5E40] shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📚 KD Topics ({pendingKDTopics.length})
            </button>
            <button
              onClick={() => setActiveMicroserviceTab("drills")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                activeMicroserviceTab === "drills"
                  ? "bg-white text-[#4B5E40] shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              🎯 Drills ({pendingDrillSubmissions.length})
            </button>
            <button
              onClick={() => setActiveMicroserviceTab("reports")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                activeMicroserviceTab === "reports"
                  ? "bg-white text-[#4B5E40] shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📈 Daily Reports ({pendingDailyReports.length})
            </button>
            <button
              onClick={() => setActiveMicroserviceTab("custom")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                activeMicroserviceTab === "custom"
                  ? "bg-white text-[#4B5E40] shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📋 Custom Tasks ({customAssignedTasks.length})
            </button>
          </div>
        </div>

        {/* EMPTY STATE IF NO PENDING TASKS */}
        {totalPendingTasksCount === 0 && (
          <div className="py-12 text-center bg-slate-50/60 rounded-xl border border-dashed border-gray-200 p-6 space-y-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-800">🎉 All Caught Up!</h3>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto font-medium">
                You have no pending tasks or reviews assigned across your microservices at this moment. New trainee topic submissions or drill solutions will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1: KNOWLEDGE DEVELOPMENT TOPIC REVIEWS */}
        {(activeMicroserviceTab === "all" || activeMicroserviceTab === "kd") &&
          pendingKDTopics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#4B5E40] uppercase tracking-wider border-b border-gray-100 pb-1.5">
                <BookOpen className="w-4 h-4 text-[#4B5E40]" />
                Microservice: Knowledge Development (KD) Presentation Topics ({pendingKDTopics.length})
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingKDTopics.map((pres: KDPresentation) => (
                  <div
                    key={pres.id}
                    className="p-4 bg-slate-50 hover:bg-white rounded-xl border border-gray-200/80 hover:border-[#4B5E40]/30 transition shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
                          Topic Review Pending
                        </span>
                        <span className="text-[10.5px] font-semibold text-gray-500">
                          📅 {pres.date} ({pres.dayOfWeek || "Scheduled"})
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-gray-900 leading-snug">
                        {pres.topic || "Untitled Presentation Topic"}
                      </h4>

                      <div className="text-[11px] text-gray-600 flex items-center gap-2">
                        <span className="font-semibold text-gray-800">
                          Presenter: {pres.presenterName}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedKDModal(pres)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        Review & Approve
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {setActiveTab && (
                        <button
                          onClick={() => {
                            setActiveTab("microservices");
                            if (setActiveSubTab) setActiveSubTab("kd");
                          }}
                          className="text-[10.5px] font-bold text-gray-500 hover:text-[#4B5E40] transition"
                        >
                          View KD Schedule →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* SECTION 2: WEEKLY DRILL SUBMISSIONS */}
        {(activeMicroserviceTab === "all" || activeMicroserviceTab === "drills") &&
          pendingDrillSubmissions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider border-b border-gray-100 pb-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Microservice: Weekly Drills Pending Grading ({pendingDrillSubmissions.length})
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingDrillSubmissions.map((sub: WeeklyDrillSubmission) => (
                  <div
                    key={sub.id}
                    className="p-4 bg-slate-50 hover:bg-white rounded-xl border border-gray-200/80 hover:border-emerald-300 transition shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {sub.track || "Tech Track"}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {sub.timestamp ? new Date(sub.timestamp).toLocaleDateString() : todayStr}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-gray-900 leading-snug">
                        {sub.drillTitle}
                      </h4>

                      <div className="text-[11px] text-gray-600">
                        <span className="font-bold text-gray-800">Trainee: {sub.fullName}</span>
                      </div>

                      {sub.solutionUrl && (
                        <a
                          href={sub.solutionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10.5px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          View Solution Code / Link
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedDrillSubmissionModal(sub)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        Grade Submission
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {setActiveTab && (
                        <button
                          onClick={() => {
                            setActiveTab("microservices");
                            if (setActiveSubTab) setActiveSubTab("drills");
                          }}
                          className="text-[10.5px] font-bold text-gray-500 hover:text-emerald-700 transition"
                        >
                          View All Drills →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* SECTION 3: DAILY REPORTS / STANDUPS */}
        {(activeMicroserviceTab === "all" || activeMicroserviceTab === "reports") &&
          pendingDailyReports.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-800 uppercase tracking-wider border-b border-gray-100 pb-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Microservice: Student Daily Reports Awaiting Review ({pendingDailyReports.length})
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingDailyReports.map((rep: any) => (
                  <div
                    key={rep.id}
                    className="p-4 bg-slate-50 hover:bg-white rounded-xl border border-gray-200/80 hover:border-indigo-300 transition shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-bold text-gray-800">{rep.fullName}</span>
                      <span className="text-[10px] font-mono text-gray-400">{rep.date}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 line-clamp-2 italic">
                      "{rep.tasksCompleted || rep.summary || "Daily report submitted"}"
                    </p>
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-indigo-600 font-bold">{rep.track}</span>
                      {setActiveTab && (
                        <button
                          onClick={() => {
                            setActiveTab("microservices");
                            if (setActiveSubTab) setActiveSubTab("daily-report");
                          }}
                          className="text-[10.5px] font-bold text-indigo-700 hover:underline"
                        >
                          Review in Daily Reports →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* SECTION 4: CUSTOM ASSIGNED TASKS */}
        {(activeMicroserviceTab === "all" || activeMicroserviceTab === "custom") &&
          customAssignedTasks.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-1.5">
                <CheckSquare className="w-4 h-4 text-[#4B5E40]" />
                Custom Tasks Assigned to You ({customAssignedTasks.length})
              </div>

              <div className="space-y-2">
                {customAssignedTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800">{task.title}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">{task.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 font-mono">
                        <span>Due: {task.dueDate || "No deadline"}</span>
                        <span>Priority: {task.priority || "Medium"}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCompleteCustomTask(task.id)}
                      className="px-3 py-1.5 bg-[#4B5E40] text-white hover:bg-[#3d4d34] rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      Mark Complete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* 5. UPCOMING ACTIVITIES REQUIRING MENTOR ATTENTION & ASSIGNED TRAINEES DIRECTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Upcoming Activities */}
        <div className="lg:col-span-2 bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4B5E40]" />
                Upcoming Activities Requiring Your Attention
              </h3>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                Scheduled meetings and Knowledge Development presentations assigned to you
              </p>
            </div>
            {setActiveTab && (
              <button
                onClick={() => setActiveTab("hub")}
                className="text-[10.5px] font-bold text-[#4B5E40] hover:underline"
              >
                View Full Calendar →
              </button>
            )}
          </div>

          {upcomingMentorMeetings.length === 0 && upcomingScheduledKD.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">
                No upcoming mentor meetings or scheduled KD presentations currently queued.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMentorMeetings.map((m: Meeting) => (
                <div
                  key={m.id}
                  className="p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-gray-200/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#4B5E40]/10 text-[#4B5E40]">
                        {m.type || "Meeting"}
                      </span>
                      <span className="text-[10.5px] text-gray-500 font-mono">
                        ⏰ {m.timeString || "09:00 AM"}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900">{m.title}</h4>
                    <p className="text-[10.5px] text-gray-500 font-medium">
                      Track: {Array.isArray(m.trackId) ? m.trackId.join(", ") : m.trackId || "All"}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => onJoinMeeting(m.id)}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join / Check In
                    </button>
                  </div>
                </div>
              ))}

              {upcomingScheduledKD.map((kd: KDPresentation) => (
                <div
                  key={kd.id}
                  className="p-3.5 bg-amber-50/50 hover:bg-amber-50 rounded-xl border border-amber-200/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-200 text-amber-900">
                        KD Session Presentation
                      </span>
                      <span className="text-[10.5px] text-amber-800 font-mono">
                        📅 {kd.date}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900">{kd.topic}</h4>
                    <p className="text-[10.5px] text-gray-600 font-medium">
                      Presenter: {kd.presenterName} | Assigned Mentor: {kd.assignedMentorName || profile.fullName}
                    </p>
                  </div>

                  {setActiveTab && (
                    <button
                      onClick={() => {
                        setActiveTab("microservices");
                        if (setActiveSubTab) setActiveSubTab("kd");
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition cursor-pointer shrink-0"
                    >
                      View Presentation Desk
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (1/3): Quick Mentor Features & Assigned Trainees */}
        <div className="space-y-6">
          {/* Quick Mentor Feature Shortcuts */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
              <Sparkles className="w-4 h-4 text-[#4B5E40]" />
              Quick Mentor Shortcuts
            </h3>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  setActiveTab("microservices");
                  if (setActiveSubTab) setActiveSubTab("kd");
                }}
                className="p-2.5 bg-slate-50 hover:bg-white border border-gray-200 hover:border-[#4B5E40] rounded-xl text-left transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#4B5E40]" />
                  <span className="text-xs font-bold text-gray-800 group-hover:text-[#4B5E40]">
                    KD Topic Review Desk
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#4B5E40]" />
              </button>

              <button
                onClick={() => {
                  setActiveTab("microservices");
                  if (setActiveSubTab) setActiveSubTab("drills");
                }}
                className="p-2.5 bg-slate-50 hover:bg-white border border-gray-200 hover:border-emerald-600 rounded-xl text-left transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-gray-800 group-hover:text-emerald-700">
                    Grade Weekly Drills
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
              </button>

              <button
                onClick={() => {
                  setActiveTab("microservices");
                  if (setActiveSubTab) setActiveSubTab("standups");
                }}
                className="p-2.5 bg-slate-50 hover:bg-white border border-gray-200 hover:border-indigo-600 rounded-xl text-left transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-gray-800 group-hover:text-indigo-700">
                    Review Daily Standups & Reports
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
              </button>

              <button
                onClick={() => {
                  setActiveTab("leaderboard");
                }}
                className="p-2.5 bg-slate-50 hover:bg-white border border-gray-200 hover:border-amber-600 rounded-xl text-left transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-gray-800 group-hover:text-amber-700">
                    Punctuality & Leaderboard Desk
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600" />
              </button>
            </div>
          </div>

          {/* Assigned Trainees Mini-Directory */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4B5E40]" />
                Assigned Trainees ({assignedTrainees.length})
              </h3>
            </div>

            {assignedTrainees.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-3 text-center">
                No trainees currently listed on your track.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {assignedTrainees.slice(0, 8).map((t: Profile) => (
                  <div
                    key={t.id}
                    className="p-2 bg-slate-50 rounded-xl border border-gray-200/60 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 truncate">{t.fullName}</h4>
                      <span className="text-[10px] text-gray-500 block truncate">
                        {t.learningLevel || "Techie"} • {getCleanTrackName(t.track)}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-gray-200/70 text-gray-700 shrink-0">
                      Score: {t.score !== undefined ? `${t.score}%` : "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: KD PRESENTATION TOPIC REVIEW & APPROVAL */}
      {selectedKDModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#4B5E40]" />
                Review KD Presentation Topic
              </h3>
              <button
                onClick={() => setSelectedKDModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Presenter:</span>
                <p className="font-bold text-gray-900">{selectedKDModal.presenterName}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Scheduled Date:</span>
                <p className="font-semibold text-gray-800">
                  {selectedKDModal.date} ({selectedKDModal.dayOfWeek || "Session Day"})
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Proposed Topic:</span>
                <p className="font-bold text-gray-900 bg-slate-50 p-2.5 rounded-xl border border-gray-200 mt-1">
                  "{selectedKDModal.topic}"
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Mentor Comments / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={topicActionNote}
                  onChange={(e) => setTopicActionNote(e.target.value)}
                  placeholder="e.g. Approved topic! Please ensure you cover hands-on demo examples..."
                  className="w-full bg-slate-50 border border-gray-250 rounded-xl p-2.5 outline-none focus:bg-white focus:border-[#4B5E40] text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleRejectKDTopic(selectedKDModal)}
                className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
              >
                Request Revision ❌
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleApproveKDTopic(selectedKDModal)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-xl transition cursor-pointer shadow-xs"
              >
                {submittingAction ? "Saving..." : "Approve Topic ✅"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WEEKLY DRILL SUBMISSION GRADING */}
      {selectedDrillSubmissionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                Grade Weekly Drill Submission
              </h3>
              <button
                onClick={() => setSelectedDrillSubmissionModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Drill:</span>
                <p className="font-bold text-gray-900">{selectedDrillSubmissionModal.drillTitle}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Trainee:</span>
                <p className="font-semibold text-gray-800">
                  {selectedDrillSubmissionModal.fullName} ({selectedDrillSubmissionModal.track})
                </p>
              </div>

              {selectedDrillSubmissionModal.solutionUrl && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Solution Repository / URL:</span>
                  <a
                    href={selectedDrillSubmissionModal.solutionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-indigo-600 font-semibold hover:underline mt-0.5 truncate"
                  >
                    {selectedDrillSubmissionModal.solutionUrl}
                  </a>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Mentor Feedback / Grade Comment
                </label>
                <textarea
                  rows={3}
                  value={drillGradeFeedback}
                  onChange={(e) => setDrillGradeFeedback(e.target.value)}
                  placeholder="e.g. Outstanding implementation! Clean architecture and great commit history..."
                  className="w-full bg-slate-50 border border-gray-250 rounded-xl p-2.5 outline-none focus:bg-white focus:border-[#4B5E40] text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleGradeDrill(selectedDrillSubmissionModal, "Rejected")}
                className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
              >
                Needs Work ❌
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleGradeDrill(selectedDrillSubmissionModal, "Approved")}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition cursor-pointer shadow-xs"
              >
                {submittingAction ? "Saving..." : "Approve & Pass Grade ✅"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
