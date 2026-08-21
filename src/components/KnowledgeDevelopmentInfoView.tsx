import React, { useState } from "react";
import { Profile, KnowledgeDevelopmentInfo, defaultKnowledgeDevelopmentInfo, AttendanceRecord, KDPresentation, defaultKDLeaderboardConfig, KDLeaderboardConfig } from "../types";
import { updateKnowledgeDevelopmentInfo } from "../firebaseService";
import { 
  BookOpen, 
  Calendar, 
  Users, 
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  FileText,
  ShieldCheck,
  Target,
  Mic,
  Award,
  CheckSquare,
  HelpCircle,
  UserCheck,
  AlertCircle,
  Trophy,
  BarChart2,
  Star
} from "lucide-react";
import KDPresentationSchedule from "./KDPresentationSchedule";
import KDLeaderboard from "./KDLeaderboard";
import KDParticipationReport from "./KDParticipationReport";
import KDAggregatedFeedbackView from "./KDAggregatedFeedbackView";

interface KnowledgeDevelopmentInfoViewProps {
  profile: Profile;
  kdInfo?: KnowledgeDevelopmentInfo;
  presentations?: KDPresentation[];
  meetings?: any[];
  attendance?: AttendanceRecord[];
  microserviceOwners?: Record<string, string>;
  profiles?: Profile[];
  onStateUpdate?: () => void;
  onJoinMeeting?: (meetingId: string) => void;
  className?: string;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export default function KnowledgeDevelopmentInfoView({
  profile,
  kdInfo,
  presentations = [],
  meetings = [],
  attendance = [],
  microserviceOwners = {},
  profiles = [],
  onStateUpdate,
  onJoinMeeting,
  className = "",
  isModal = false,
  onCloseModal
}: KnowledgeDevelopmentInfoViewProps) {
  const currentInfo = { ...defaultKnowledgeDevelopmentInfo, ...(kdInfo || {}) };
  const rawTitle = currentInfo.title || defaultKnowledgeDevelopmentInfo.title;
  const displayTitle = rawTitle.replace(/\s*Guidelines$/i, "");
  const isAdmin = profile.role === "admin" || profile.status === "admin";

  const userLevel = profile.learningLevel || profile.techExperience || "Apprentice level 1";

  const [isEditing, setIsEditing] = useState(false);
  const [kdSubTab, setKdSubTab] = useState<"schedule" | "report" | "leaderboard" | "feedback" | "info">("schedule");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [formData, setFormData] = useState<KnowledgeDevelopmentInfo>({
    title: displayTitle,
    about: currentInfo.about || defaultKnowledgeDevelopmentInfo.about,
    purpose: currentInfo.purpose || defaultKnowledgeDevelopmentInfo.purpose,
    objectives: currentInfo.objectives || defaultKnowledgeDevelopmentInfo.objectives,
    whyFacilitate: currentInfo.whyFacilitate || defaultKnowledgeDevelopmentInfo.whyFacilitate,
    whyAttend: currentInfo.whyAttend || defaultKnowledgeDevelopmentInfo.whyAttend,
    sessionInfo: currentInfo.sessionInfo || defaultKnowledgeDevelopmentInfo.sessionInfo,
    attendanceInfo: currentInfo.attendanceInfo || defaultKnowledgeDevelopmentInfo.attendanceInfo,
    presenterInfo: currentInfo.presenterInfo || defaultKnowledgeDevelopmentInfo.presenterInfo,
    learningProgress: currentInfo.learningProgress || defaultKnowledgeDevelopmentInfo.learningProgress,
    meetingLink: currentInfo.meetingLink || defaultKnowledgeDevelopmentInfo.meetingLink,
    targetSessionsPerMonth: currentInfo.targetSessionsPerMonth || 16,
    lastUpdatedBy: currentInfo.lastUpdatedBy,
    lastUpdatedAt: currentInfo.lastUpdatedAt
  });

  const handleOpenEdit = () => {
    setFormData({
      title: displayTitle,
      about: currentInfo.about || defaultKnowledgeDevelopmentInfo.about,
      purpose: currentInfo.purpose || defaultKnowledgeDevelopmentInfo.purpose,
      objectives: currentInfo.objectives || defaultKnowledgeDevelopmentInfo.objectives,
      whyFacilitate: currentInfo.whyFacilitate || defaultKnowledgeDevelopmentInfo.whyFacilitate,
      whyAttend: currentInfo.whyAttend || defaultKnowledgeDevelopmentInfo.whyAttend,
      sessionInfo: currentInfo.sessionInfo || defaultKnowledgeDevelopmentInfo.sessionInfo,
      attendanceInfo: currentInfo.attendanceInfo || defaultKnowledgeDevelopmentInfo.attendanceInfo,
      presenterInfo: currentInfo.presenterInfo || defaultKnowledgeDevelopmentInfo.presenterInfo,
      learningProgress: currentInfo.learningProgress || defaultKnowledgeDevelopmentInfo.learningProgress,
      meetingLink: currentInfo.meetingLink || defaultKnowledgeDevelopmentInfo.meetingLink,
      targetSessionsPerMonth: currentInfo.targetSessionsPerMonth || 16,
      lastUpdatedBy: currentInfo.lastUpdatedBy,
      lastUpdatedAt: currentInfo.lastUpdatedAt
    });
    setSaveError("");
    setSaveSuccess(false);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setSaveError("");
    try {
      await updateKnowledgeDevelopmentInfo(formData, profile);
      setSaving(false);
      setSaveSuccess(true);
      setIsEditing(false);
      if (onStateUpdate) onStateUpdate();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("Failed to update Knowledge Development info:", err);
      setSaving(false);
      setSaveError(err.message || "Failed to update Knowledge Development information.");
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoStr;
    }
  };

  const renderBulletList = (text?: string) => {
    if (!text) return null;
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    return (
      <ul className="space-y-2 text-xs text-gray-700">
        {lines.map((line, idx) => {
          const cleanLine = line.replace(/^[•\-\*]\s*/, "");
          return (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4B5E40] mt-1.5 shrink-0" />
              <span className="leading-relaxed">{cleanLine}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const content = (
    <div className={`space-y-6 text-gray-800 ${className}`} id="kd-info-view-container">
      {/* SUCCESS NOTIFICATION */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-900 text-xs font-semibold animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Knowledge Development information successfully updated and synced across all user sessions!</span>
          </div>
          <button onClick={() => setSaveSuccess(false)} className="text-emerald-700 hover:text-emerald-950 text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-[#4B5E40] to-[#3B4E30] text-white rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-100 text-[10px] font-bold rounded-full">
                Target: {currentInfo.targetSessionsPerMonth || 16} Sessions/Month
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-200" />
              {displayTitle}
            </h2>
            {currentInfo.lastUpdatedBy && (
              <p className="text-[11px] text-emerald-100/80 font-medium">
                Last updated by <strong className="text-white">{currentInfo.lastUpdatedBy}</strong> {currentInfo.lastUpdatedAt ? `on ${formatDate(currentInfo.lastUpdatedAt)}` : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && !isEditing && (
              <button
                type="button"
                id="btn-edit-kd-info"
                onClick={handleOpenEdit}
                className="px-3.5 py-2.5 bg-emerald-800/80 hover:bg-emerald-900 text-white border border-emerald-400/30 text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-emerald-200" />
                Edit Info
              </button>
            )}

            {isModal && onCloseModal && (
              <button
                onClick={onCloseModal}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ADMIN EDIT FORM */}
      {isEditing && isAdmin ? (
        <form onSubmit={handleSave} className="bg-white border-2 border-[#4B5E40] rounded-2xl p-6 space-y-5 shadow-md animate-fade-in" id="kd-info-edit-form">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2 text-[#4B5E40]">
              <ShieldCheck className="w-5 h-5 text-[#4B5E40]" />
              <h3 className="font-bold text-sm text-gray-900">Administrator: Update Knowledge Development Information</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Display Title
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40] font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                About Knowledge Development
              </label>
              <textarea
                rows={3}
                required
                value={formData.about}
                onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Purpose (Bullet points)
              </label>
              <textarea
                rows={4}
                required
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Objectives (Bullet points)
              </label>
              <textarea
                rows={4}
                required
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Why You Should Facilitate KD Sessions
              </label>
              <textarea
                rows={4}
                required
                value={formData.whyFacilitate}
                onChange={(e) => setFormData({ ...formData, whyFacilitate: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Why You Should Attend KD Sessions
              </label>
              <textarea
                rows={4}
                required
                value={formData.whyAttend}
                onChange={(e) => setFormData({ ...formData, whyAttend: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Session Information
              </label>
              <textarea
                rows={4}
                required
                value={formData.sessionInfo}
                onChange={(e) => setFormData({ ...formData, sessionInfo: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Attendance Information
              </label>
              <textarea
                rows={4}
                required
                value={formData.attendanceInfo}
                onChange={(e) => setFormData({ ...formData, attendanceInfo: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Presenter Information & Expectations
              </label>
              <textarea
                rows={4}
                required
                value={formData.presenterInfo}
                onChange={(e) => setFormData({ ...formData, presenterInfo: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Learning Progress Tracking
              </label>
              <textarea
                rows={4}
                required
                value={formData.learningProgress}
                onChange={(e) => setFormData({ ...formData, learningProgress: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Permanent Meeting Link
              </label>
              <input
                type="url"
                value={formData.meetingLink || ""}
                onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Monthly Target Sessions
              </label>
              <input
                type="number"
                value={formData.targetSessionsPerMonth || 16}
                onChange={(e) => setFormData({ ...formData, targetSessionsPerMonth: parseInt(e.target.value) || 16 })}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40] font-bold"
              />
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#4B5E40] hover:bg-[#3d4d34] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving Changes..." : "Save KD Information"}
            </button>
          </div>
        </form>
      ) : null}

      {/* USER ATTENDANCE EXPECTATION BANNER */}
      <div 
        id="kd-user-attendance-expectation-card"
        className="p-5 rounded-2xl border bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-xs space-y-3 animate-fade-in"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-current/15">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-[#4B5E40]" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">Your Techie Level</span>
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                {userLevel}
              </h4>
            </div>
          </div>

          <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs bg-[#4B5E40] text-white">
            <Clock className="w-3.5 h-3.5" /> Tue – Fri • 9:00 AM WAT
          </span>
        </div>

        <p className="text-xs leading-relaxed font-medium">
          Knowledge Development (KD) sessions hold Tuesday through Friday at 9:00 AM (WAT). Attendance is automatically tracked through the Meeting module and contributes directly to your Knowledge Development KPIs and monthly progression.
        </p>
      </div>

      {/* SUB-TAB NAVIGATOR */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200">
        <button
          type="button"
          onClick={() => setKdSubTab("schedule")}
          className={`flex-1 min-w-[160px] py-2 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            kdSubTab === "schedule"
              ? "bg-[#4B5E40] text-white shadow-xs"
              : "text-gray-700 hover:bg-gray-200/80"
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-300" /> Presentation Schedule & Hub
        </button>

        <button
          type="button"
          onClick={() => setKdSubTab("report")}
          className={`flex-1 min-w-[160px] py-2 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            kdSubTab === "report"
              ? "bg-[#4B5E40] text-white shadow-xs"
              : "text-gray-700 hover:bg-gray-200/80"
          }`}
        >
          <BarChart2 className="w-4 h-4 text-emerald-300" /> Participation Reports
        </button>

        <button
          type="button"
          onClick={() => setKdSubTab("leaderboard")}
          className={`flex-1 min-w-[160px] py-2 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            kdSubTab === "leaderboard"
              ? "bg-[#4B5E40] text-white shadow-xs"
              : "text-gray-700 hover:bg-gray-200/80"
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-300" /> Monthly KD Leaderboard
        </button>

        <button
          type="button"
          onClick={() => setKdSubTab("feedback")}
          className={`flex-1 min-w-[160px] py-2 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            kdSubTab === "feedback"
              ? "bg-[#4B5E40] text-white shadow-xs"
              : "text-gray-700 hover:bg-gray-200/80"
          }`}
        >
          <Star className="w-4 h-4 text-amber-300 fill-amber-300" /> Session Feedback & Analytics
        </button>

        <button
          type="button"
          onClick={() => setKdSubTab("info")}
          className={`flex-1 min-w-[160px] py-2 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            kdSubTab === "info"
              ? "bg-[#4B5E40] text-white shadow-xs"
              : "text-gray-700 hover:bg-gray-200/80"
          }`}
        >
          <FileText className="w-4 h-4 text-sky-300" /> Guidelines & Expectations
        </button>
      </div>

      {/* KNOWLEDGE DEVELOPMENT PRESENTATION SCHEDULE */}
      {kdSubTab === "schedule" && (
        <KDPresentationSchedule
          profile={profile}
          presentations={presentations}
          meetings={meetings}
          attendance={attendance}
          kdInfo={currentInfo}
          microserviceOwners={microserviceOwners}
          profiles={profiles}
          onStateUpdate={onStateUpdate}
          onJoinMeeting={onJoinMeeting}
        />
      )}

      {/* KNOWLEDGE DEVELOPMENT PARTICIPATION & COMPLIANCE REPORT */}
      {kdSubTab === "report" && (
        <KDParticipationReport
          profile={profile}
          profiles={profiles}
          presentations={presentations}
          meetings={meetings}
          attendance={attendance}
          kdInfo={currentInfo}
          microserviceOwners={microserviceOwners}
          onStateUpdate={onStateUpdate}
        />
      )}

      {/* KNOWLEDGE DEVELOPMENT MONTHLY LEADERBOARD */}
      {kdSubTab === "leaderboard" && (
        <KDLeaderboard
          profile={profile}
          profiles={profiles}
          presentations={presentations}
          attendance={attendance}
          meetings={meetings}
          kdInfo={currentInfo}
          microserviceOwners={microserviceOwners}
          onStateUpdate={onStateUpdate}
        />
      )}

      {/* KNOWLEDGE DEVELOPMENT AGGREGATED FEEDBACK ANALYTICS */}
      {kdSubTab === "feedback" && (
        <KDAggregatedFeedbackView
          presentations={presentations}
          config={currentInfo.config || defaultKDLeaderboardConfig}
          profile={profile}
          onUpdateConfig={async (newConfig: KDLeaderboardConfig) => {
            const updatedInfo = { ...currentInfo, config: newConfig };
            await updateKnowledgeDevelopmentInfo(updatedInfo, profile);
            if (onStateUpdate) onStateUpdate();
          }}
        />
      )}

      {/* DISPLAY SECTIONS GRID */}
      {(kdSubTab === "info" || kdSubTab === "schedule") && (
        <div className="space-y-5">
          {/* ABOUT KNOWLEDGE DEVELOPMENT */}
          <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
              <FileText className="w-4 h-4" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">About Knowledge Development</h3>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {currentInfo.about}
            </p>
          </div>

          {/* PURPOSE & OBJECTIVES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
                <Target className="w-4 h-4" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Purpose</h3>
              </div>
              {renderBulletList(currentInfo.purpose)}
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Objectives</h3>
              </div>
              {renderBulletList(currentInfo.objectives)}
            </div>
          </div>

          {/* WHY FACILITATE & WHY ATTEND GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-emerald-50/50 rounded-2xl border border-emerald-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-emerald-200/60 pb-2">
                <Mic className="w-4 h-4 text-[#4B5E40]" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Why You Should Facilitate KD Sessions</h3>
              </div>
              {renderBulletList(currentInfo.whyFacilitate)}
            </div>

            <div className="bg-emerald-50/50 rounded-2xl border border-emerald-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-emerald-200/60 pb-2">
                <Users className="w-4 h-4 text-[#4B5E40]" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Why You Should Attend KD Sessions</h3>
              </div>
              {renderBulletList(currentInfo.whyAttend)}
            </div>
          </div>

          {/* SESSION INFO, ATTENDANCE INFO, PRESENTER INFO & LEARNING PROGRESS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
                <Clock className="w-4 h-4" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Session Information</h3>
              </div>
              {renderBulletList(currentInfo.sessionInfo)}
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
                <CheckSquare className="w-4 h-4" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Attendance Information</h3>
              </div>
              {renderBulletList(currentInfo.attendanceInfo)}
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
                <Mic className="w-4 h-4" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Presenter Information</h3>
              </div>
              {renderBulletList(currentInfo.presenterInfo)}
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#4B5E40] border-b border-gray-100 pb-2">
                <Award className="w-4 h-4" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">Learning Progress</h3>
              </div>
              {renderBulletList(currentInfo.learningProgress)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-scale-up">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
