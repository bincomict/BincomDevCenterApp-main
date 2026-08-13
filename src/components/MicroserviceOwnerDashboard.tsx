import React, { useState } from "react";
import { 
  Profile, 
  KDPresentation, 
  WeeklyDrillSubmission, 
  Meeting, 
  StandupLog, 
  DailyReportLog, 
  SocialEventLog 
} from "../types";
import { 
  updateKDPresentation, 
  gradeDrillSubmission, 
  sendReminder, 
  dismissReminder,
  dismissAllReminders
} from "../firebaseService";
import { toast } from "./Toast";
import { 
  getUserAssignedMicroservices, 
  ALL_MICROSERVICES_LIST, 
  MicroserviceDef, 
  getCleanTrackName, 
  getLagosDateString,
  isAuthorizedForKDTopic
} from "../utils/trackUtils";
import { 
  Layers, 
  BookOpen, 
  Award, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Bell, 
  FileText, 
  Filter, 
  BarChart3, 
  Sliders, 
  Send, 
  RefreshCw, 
  ChevronRight, 
  ExternalLink, 
  ShieldCheck, 
  UserCheck, 
  X, 
  Check, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Trophy, 
  PieChart, 
  Sparkles,
  Settings,
  HelpCircle,
  Video
} from "lucide-react";

interface MicroserviceOwnerDashboardProps {
  profile: Profile;
  state: any;
  onJoinMeeting?: (meetingId: string) => void;
  setActiveTab: (tab: any) => void;
  setActiveSubTab?: (subTab: any) => void;
  setAdminTab?: (tab: any) => void;
  onStateUpdate?: () => void;
}

export default function MicroserviceOwnerDashboard({
  profile,
  state,
  onJoinMeeting,
  setActiveTab,
  setActiveSubTab,
  setAdminTab,
  onStateUpdate,
}: MicroserviceOwnerDashboardProps) {
  const {
    profiles = [],
    microserviceOwners = {},
    kdPresentations = [],
    weeklyDrills = [],
    drillSubmissions = [],
    dailyReports = [],
    standups = [],
    meetings = [],
    reminders = [],
    socialLogs = [],
    techUpdates = [],
  } = state || {};

  const isAdmin = profile?.role === "admin" || profile?.status === "admin";

  // Determine which microservices this user owns
  const assignedServices = getUserAssignedMicroservices(profile, microserviceOwners);
  const isOwner = assignedServices.length > 0;

  // Selected active microservice state
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    assignedServices[0]?.id || "kd"
  );

  // Configurable Widgets State
  const [widgetConfig, setWidgetConfig] = useState({
    showOverview: true,
    showActivities: true,
    showPending: true,
    showNotifications: true,
    showReports: true,
    showAnalytics: true,
    showLeaderboard: true,
    showReminders: true,
  });

  const [showConfigModal, setShowConfigModal] = useState(false);

  // Reminder Dispatcher Modal State
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderTarget, setReminderTarget] = useState<"all" | "track">("all");
  const [sendingReminder, setSendingReminder] = useState(false);

  // Action Modals State
  const [selectedKDModal, setSelectedKDModal] = useState<KDPresentation | null>(null);
  const [kdActionNote, setKdActionNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [selectedDrillModal, setSelectedDrillModal] = useState<WeeklyDrillSubmission | null>(null);
  const [drillFeedbackNote, setDrillFeedbackNote] = useState("");

  if (!isOwner) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 shadow-sm space-y-4">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto font-bold">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">Microservice Access Restricted</h2>
          <p className="text-xs text-gray-600 max-w-lg mx-auto leading-relaxed">
            Only assigned Microservice Owners can access the management dashboard. You have not been assigned as an owner for any active microservice yet.
          </p>
        </div>
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveTab("dashboard")}
            className="px-4 py-2 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-xl transition cursor-pointer"
          >
            Return to Trainee Dashboard
          </button>
          <button
            onClick={() => setActiveTab("microservices")}
            className="px-4 py-2 text-xs font-bold text-[#4B5E40] bg-[#4B5E40]/10 hover:bg-[#4B5E40]/20 rounded-xl transition cursor-pointer"
          >
            Explore Microservices
          </button>
        </div>
      </div>
    );
  }

  const currentServiceDef =
    ALL_MICROSERVICES_LIST.find((s) => s.id === selectedServiceId) || assignedServices[0];

  const now = new Date();
  const todayStr = getLagosDateString(now);

  // FILTERED DATA FOR SELECTED MICROSERVICE
  // 1. Pending Reviews / Approvals
  const pendingKDTopics = kdPresentations.filter(
    (p: KDPresentation) => {
      const isPendingOrDraftOrRejected =
        p.status === "Pending Review" ||
        p.status === "Draft" ||
        p.status === "Rejected" ||
        (p.topic && p.topic.trim() !== "" && p.status === "Awaiting topic submission");

      if (!isPendingOrDraftOrRejected) return false;

      return isAuthorizedForKDTopic(p, profile, microserviceOwners, isAdmin);
    }
  );

  const pendingDrills = drillSubmissions.filter(
    (s: WeeklyDrillSubmission) => s.status === "Pending"
  );

  const pendingReports = dailyReports.filter((r: any) => !r.reviewed);

  let currentPendingList: any[] = [];
  if (selectedServiceId === "kd") currentPendingList = pendingKDTopics;
  else if (selectedServiceId === "wd") currentPendingList = pendingDrills;
  else if (selectedServiceId === "standups") currentPendingList = pendingReports;
  else currentPendingList = [];

  // 2. Upcoming Activities for selected microservice
  const upcomingMeetings = meetings.filter((m: Meeting) => {
    if (m.status === "Completed" || m.status === "Archived" || m.status === "Cancelled")
      return false;
    if (selectedServiceId === "kd") return m.type === "microservice" || m.title?.toLowerCase().includes("kd");
    if (selectedServiceId === "standups") return m.type === "standup" || m.title?.toLowerCase().includes("standup");
    return true;
  });

  const upcomingKD = kdPresentations.filter(
    (p: KDPresentation) => p.status === "Approved" || p.status === "Ready for Presentation"
  );

  // 3. Leaderboard calculation for selected microservice
  const serviceLeaderboard = profiles
    .map((p: Profile) => {
      let score = p.score || 0;
      let count = 0;
      if (selectedServiceId === "kd") {
        count = kdPresentations.filter((k: KDPresentation) => k.presenterUserId === p.id).length;
      } else if (selectedServiceId === "wd") {
        count = drillSubmissions.filter(
          (d: WeeklyDrillSubmission) => d.userId === p.id && d.status === "Approved"
        ).length;
      } else if (selectedServiceId === "standups") {
        count = dailyReports.filter((r: any) => r.userId === p.id).length;
      } else {
        count = Math.floor(score / 10);
      }
      return { ...p, serviceActivityCount: count };
    })
    .sort((a, b) => b.serviceActivityCount - a.serviceActivityCount || (b.score || 0) - (a.score || 0))
    .slice(0, 10);

  // 4. Notifications relevant to this owner
  const unreadReminders = reminders.filter(
    (r: any) => !r.read && (r.userId === profile.id || r.userId === "all")
  );

  // Handlers for Microservice Owner Operations
  const handleApproveKDTopic = async (pres: KDPresentation) => {
    try {
      setSubmittingAction(true);
      await updateKDPresentation(pres.id, {
        status: "Approved",
        notes: kdActionNote
          ? `[Owner Approved]: ${kdActionNote}`
          : pres.notes || "Topic approved by Microservice Owner.",
      });
      toast.success(`Approved topic "${pres.topic}" for ${pres.presenterName}!`);
      setSelectedKDModal(null);
      setKdActionNote("");
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
        notes: kdActionNote
          ? `[Owner Feedback]: ${kdActionNote}`
          : "Topic requires revision.",
      });
      toast.success(`Topic rejected/revision requested for ${pres.presenterName}.`);
      setSelectedKDModal(null);
      setKdActionNote("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to reject topic: " + err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleGradeDrill = async (
    sub: WeeklyDrillSubmission,
    status: "Approved" | "Rejected"
  ) => {
    try {
      setSubmittingAction(true);
      await gradeDrillSubmission(
        sub.id,
        status === "Approved" ? 100 : 0,
        drillFeedbackNote || (status === "Approved" ? "Great execution!" : "Needs work."),
        status
      );
      toast.success(`Drill marked as ${status}!`);
      setSelectedDrillModal(null);
      setDrillFeedbackNote("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to grade drill: " + err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSendMicroserviceReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderMessage.trim()) {
      toast.error("Please enter a reminder message.");
      return;
    }
    try {
      setSendingReminder(true);
      const prefix = `[Microservice Notice - ${currentServiceDef?.name}]: `;
      const fullMsg = prefix + reminderMessage.trim();

      if (reminderTarget === "all") {
        await sendReminder("all", fullMsg);
      } else {
        // Send to active trainees
        const targetProfiles = profiles.filter((p: Profile) => p.role !== "admin");
        for (const p of targetProfiles) {
          await sendReminder(p.id, fullMsg);
        }
      }

      toast.success(`Microservice dispatch sent successfully!`);
      setReminderMessage("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      toast.error("Failed to send reminder: " + err.message);
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="space-y-6" id="microservice-owner-dashboard-root">
      {/* 1. TOP OWNER HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#1E293B] via-[#334155] to-[#0F172A] rounded-2xl p-6 text-white shadow-sm border border-slate-700/80 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🛠️ Microservice Operations Desk
              </span>
              <span className="text-[10.5px] font-medium text-slate-300 font-mono">
                Owner: {profile.fullName}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-emerald-400" />
              {currentServiceDef?.name || "Microservice Dashboard"}
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {currentServiceDef?.description || "Manage operations, monitor student activities, review pending submissions, and dispatch microservice reminders."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/80 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Configure Widgets
            </button>

            {onStateUpdate && (
              <button
                onClick={() => {
                  onStateUpdate();
                  toast.success("Dashboard data synchronized!");
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Synchronize Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. MICROSERVICE SELECTOR (If owner manages multiple microservices) */}
      <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#4B5E40]" />
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Managed Microservices ({assignedServices.length})
            </h3>
            <p className="text-[10.5px] text-gray-500 font-medium">
              Switch view between microservices you are authorized to manage
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {assignedServices.map((ms) => {
            const isSelected = ms.id === selectedServiceId;
            return (
              <button
                key={ms.id}
                onClick={() => setSelectedServiceId(ms.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#4B5E40] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <span>{ms.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. WIDGET: DASHBOARD OVERVIEW METRICS */}
      {widgetConfig.showOverview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Pending Reviews
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 font-mono">
              {currentPendingList.length}
            </div>
            <p className="text-[10.5px] text-amber-700 font-semibold mt-1">
              Awaiting owner review
            </p>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Active Participants
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 font-mono">
              {profiles.filter((p: Profile) => p.role !== "admin").length}
            </div>
            <p className="text-[10.5px] text-gray-500 font-medium mt-1">
              Enrolled students
            </p>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Upcoming Sessions
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 font-mono">
              {selectedServiceId === "kd"
                ? upcomingKD.length
                : upcomingMeetings.length}
            </div>
            <p className="text-[10.5px] text-gray-500 font-medium mt-1">
              Scheduled activities
            </p>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Dispatches / Alerts
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 font-mono">
              {unreadReminders.length}
            </div>
            <p className="text-[10.5px] text-gray-500 font-medium mt-1">
              System & owner notices
            </p>
          </div>
        </div>
      )}

      {/* 4. WIDGET: PENDING APPROVALS & REVIEWS FOR SELECTED MICROSERVICE */}
      {widgetConfig.showPending && (
        <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-4.5 h-4.5 text-[#4B5E40]" />
                Pending Approvals & Reviews ({currentPendingList.length})
              </h2>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                Submissions requiring owner approval, grading, or feedback for {currentServiceDef?.name}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              Operational Gate
            </span>
          </div>

          {currentPendingList.length === 0 ? (
            <div className="py-10 text-center bg-slate-50/60 rounded-xl border border-dashed border-gray-200 p-6 space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-xs font-bold text-gray-800">No Pending Reviews</h3>
              <p className="text-[11px] text-gray-500 max-w-sm mx-auto font-medium">
                All submissions for {currentServiceDef?.name} have been reviewed and approved!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedServiceId === "kd" &&
                pendingKDTopics.map((pres: KDPresentation) => (
                  <div
                    key={pres.id}
                    className="p-4 bg-slate-50 hover:bg-white rounded-xl border border-gray-200 hover:border-[#4B5E40]/30 transition shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          KD Topic Review
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">
                          📅 {pres.date}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900">{pres.topic}</h4>
                      <p className="text-[11px] text-gray-600 font-medium">
                        Presenter: {pres.presenterName}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedKDModal(pres)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        Review & Approve Topic
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {selectedServiceId === "wd" &&
                pendingDrills.map((sub: WeeklyDrillSubmission) => (
                  <div
                    key={sub.id}
                    className="p-4 bg-slate-50 hover:bg-white rounded-xl border border-gray-200 hover:border-emerald-300 transition shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Drill Solution
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {sub.timestamp ? new Date(sub.timestamp).toLocaleDateString() : todayStr}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900">{sub.drillTitle}</h4>
                      <p className="text-[11px] text-gray-600 font-medium">
                        Trainee: {sub.fullName} ({sub.track})
                      </p>
                      {sub.solutionUrl && (
                        <a
                          href={sub.solutionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10.5px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          View Solution URL <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedDrillModal(sub)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition cursor-pointer"
                      >
                        Grade Submission
                      </button>
                    </div>
                  </div>
                ))}

              {selectedServiceId === "standups" &&
                pendingReports.map((rep: any) => (
                  <div
                    key={rep.id}
                    className="p-4 bg-slate-50 rounded-xl border border-gray-200 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{rep.fullName}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{rep.date}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 italic">
                      "{rep.tasksCompleted || rep.summary || "Daily Report Log"}"
                    </p>
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-indigo-600 font-bold">{rep.track}</span>
                      <button
                        onClick={() => {
                          setActiveTab("microservices");
                          if (setActiveSubTab) setActiveSubTab("daily-report");
                        }}
                        className="text-[10.5px] text-indigo-700 font-bold hover:underline"
                      >
                        Review in Reports →
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 5. WIDGET: REMINDER & DISPATCH MANAGEMENT */}
      {widgetConfig.showReminders && (
        <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-[#4B5E40]" />
                Microservice Reminder & Dispatch Center
              </h3>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                Broadcast deadline reminders, announcements, and operational notices to trainees
              </p>
            </div>
          </div>

          <form onSubmit={handleSendMicroserviceReminder} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <textarea
                  rows={2}
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder={`Type microservice notice... e.g. "Reminder: KD Presentation topic submission deadline is at 5:00 PM today."`}
                  className="w-full bg-slate-50 border border-gray-250 rounded-xl p-3 text-xs outline-none focus:bg-white focus:border-[#4B5E40] font-medium"
                />
              </div>

              <div className="flex flex-col justify-between gap-2 sm:w-48">
                <select
                  value={reminderTarget}
                  onChange={(e: any) => setReminderTarget(e.target.value)}
                  className="bg-slate-50 border border-gray-250 rounded-xl p-2.5 text-xs font-semibold text-gray-800 outline-none"
                >
                  <option value="all">Broadcast to All Students</option>
                  <option value="track">Active Trainees Only</option>
                </select>

                <button
                  type="submit"
                  disabled={sendingReminder}
                  className="px-4 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingReminder ? "Dispatching..." : "Send Reminder"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 6. GRID: UPCOMING ACTIVITIES & LEADERBOARD / ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: UPCOMING ACTIVITIES */}
        {widgetConfig.showActivities && (
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4B5E40]" />
                Upcoming Activities for {currentServiceDef?.name}
              </h3>
            </div>

            {upcomingMeetings.length === 0 && upcomingKD.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">
                No upcoming sessions scheduled for this microservice.
              </p>
            ) : (
              <div className="space-y-2.5">
                {selectedServiceId === "kd" &&
                  upcomingKD.map((kd: KDPresentation) => (
                    <div
                      key={kd.id}
                      className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          📅 {kd.date}
                        </span>
                        <h4 className="font-bold text-gray-900 mt-1">{kd.topic}</h4>
                        <p className="text-[10.5px] text-gray-500 font-medium">
                          Presenter: {kd.presenterName}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab("microservices");
                          if (setActiveSubTab) setActiveSubTab("kd");
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold text-[#4B5E40] bg-[#4B5E40]/10 hover:bg-[#4B5E40]/20 rounded-lg transition shrink-0 cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  ))}

                {upcomingMeetings.map((m: Meeting) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] font-bold text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                          {m.type}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">
                          ⏰ {m.timeString}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 mt-1">{m.title}</h4>
                    </div>
                    {onJoinMeeting && (
                      <button
                        onClick={() => onJoinMeeting(m.id)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        <Video className="w-3 h-3" /> Join
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RIGHT COLUMN: MICROSERVICE LEADERBOARD */}
        {widgetConfig.showLeaderboard && (
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Microservice Leaderboard & Top Activity
              </h3>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {serviceLeaderboard.map((student: any, idx: number) => (
                <div
                  key={student.id}
                  className="p-2.5 bg-slate-50 rounded-xl border border-gray-200/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        idx === 0
                          ? "bg-amber-400 text-amber-950"
                          : idx === 1
                          ? "bg-slate-300 text-slate-800"
                          : idx === 2
                          ? "bg-amber-700 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-900">{student.fullName}</h4>
                      <span className="text-[10px] text-gray-500 font-medium">
                        {student.learningLevel || "Techie"} • {getCleanTrackName(student.track)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px]">
                    <span className="font-bold text-[#4B5E40] block">
                      {student.serviceActivityCount} Items
                    </span>
                    <span className="text-[9.5px] text-gray-400">
                      Score: {student.score || 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: WIDGET CONFIGURATION DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#4B5E40]" />
                Configure Dashboard Widgets
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {Object.entries({
                showOverview: "Overview Metrics Bar",
                showPending: "Pending Approvals & Reviews",
                showReminders: "Microservice Reminder & Dispatch Center",
                showActivities: "Upcoming Activities Panel",
                showLeaderboard: "Microservice Leaderboard",
              }).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl cursor-pointer transition"
                >
                  <span className="font-bold text-gray-800">{label}</span>
                  <input
                    type="checkbox"
                    checked={(widgetConfig as any)[key]}
                    onChange={(e) =>
                      setWidgetConfig((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-[#4B5E40] focus:ring-[#4B5E40]"
                  />
                </label>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-[#4B5E40] text-white text-xs font-bold rounded-xl hover:bg-[#3d4d34] transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KD TOPIC REVIEW & APPROVAL */}
      {selectedKDModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#4B5E40]" />
                Review KD Topic
              </h3>
              <button
                onClick={() => setSelectedKDModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <p>
                <strong className="text-gray-900">Presenter:</strong> {selectedKDModal.presenterName}
              </p>
              <p>
                <strong className="text-gray-900">Proposed Topic:</strong> "{selectedKDModal.topic}"
              </p>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Owner Feedback / Notes
                </label>
                <textarea
                  rows={3}
                  value={kdActionNote}
                  onChange={(e) => setKdActionNote(e.target.value)}
                  placeholder="Enter comments or revision requests..."
                  className="w-full bg-slate-50 border border-gray-250 rounded-xl p-2.5 outline-none focus:bg-white text-xs font-medium"
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
                Request Revision
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleApproveKDTopic(selectedKDModal)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#4B5E40] hover:bg-[#3d4d34] rounded-xl transition cursor-pointer"
              >
                {submittingAction ? "Saving..." : "Approve Topic"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DRILL SUBMISSION GRADING */}
      {selectedDrillModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                Grade Weekly Drill Submission
              </h3>
              <button
                onClick={() => setSelectedDrillModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <p>
                <strong className="text-gray-900">Drill:</strong> {selectedDrillModal.drillTitle}
              </p>
              <p>
                <strong className="text-gray-900">Trainee:</strong> {selectedDrillModal.fullName} ({selectedDrillModal.track})
              </p>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Owner Feedback / Grade Comments
                </label>
                <textarea
                  rows={3}
                  value={drillFeedbackNote}
                  onChange={(e) => setDrillFeedbackNote(e.target.value)}
                  placeholder="Enter evaluation notes..."
                  className="w-full bg-slate-50 border border-gray-250 rounded-xl p-2.5 outline-none focus:bg-white text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleGradeDrill(selectedDrillModal, "Rejected")}
                className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
              >
                Reject / Revision
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleGradeDrill(selectedDrillModal, "Approved")}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition cursor-pointer"
              >
                {submittingAction ? "Saving..." : "Approve & Pass"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
