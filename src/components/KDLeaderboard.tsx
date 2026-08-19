import React, { useState, useMemo } from "react";
import { 
  Profile, 
  KDPresentation, 
  AttendanceRecord, 
  Meeting, 
  KnowledgeDevelopmentInfo, 
  KDLeaderboardConfig, 
  defaultKDLeaderboardConfig,
  KDPresentationRating 
} from "../types";
import { updateKnowledgeDevelopmentInfo, updateKDPresentation, sendReminder } from "../firebaseService";
import { getLagosDateString, checkIsKDOwner } from "../utils/trackUtils";
import KDSessionFeedbackModal from "./KDSessionFeedbackModal";
import { 
  Trophy, 
  Medal, 
  Award, 
  Star, 
  Users, 
  Mic, 
  Calendar, 
  Settings, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Percent, 
  UserCheck, 
  MessageSquare, 
  Save, 
  X, 
  Sparkles, 
  BarChart3, 
  Sliders, 
  TrendingUp,
  ChevronRight,
  ThumbsUp,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface KDLeaderboardProps {
  profile: Profile;
  profiles: Profile[];
  presentations?: KDPresentation[];
  attendance?: AttendanceRecord[];
  meetings?: Meeting[];
  kdInfo?: KnowledgeDevelopmentInfo;
  microserviceOwners?: Record<string, string>;
  onStateUpdate?: () => void;
}

export default function KDLeaderboard({
  profile,
  profiles,
  presentations = [],
  attendance = [],
  meetings = [],
  kdInfo,
  microserviceOwners = {},
  onStateUpdate
}: KDLeaderboardProps) {
  const isAdmin = profile.role === "admin" || profile.status === "admin";
  const isKDOwner = checkIsKDOwner(profile, microserviceOwners, isAdmin);

  // Current month string "YYYY-MM"
  const currentLagosMonth = getLagosDateString(new Date()).substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentLagosMonth);

  // Sub-tab: Presenter vs Attendee
  const [activeBoard, setActiveBoard] = useState<"presenter" | "attendee">("presenter");

  // Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const config = kdInfo?.kdLeaderboardConfig || defaultKDLeaderboardConfig;

  const [formConfig, setFormConfig] = useState<KDLeaderboardConfig>({
    presenterWeights: {
      avgRatingWeight: config.presenterWeights?.avgRatingWeight ?? 40,
      feedbackScoreWeight: config.presenterWeights?.feedbackScoreWeight ?? 30,
      completedPresentationsWeight: config.presenterWeights?.completedPresentationsWeight ?? 30
    },
    attendeeWeights: {
      sessionsAttendedWeight: config.attendeeWeights?.sessionsAttendedWeight ?? 40,
      onTimeAttendanceWeight: config.attendeeWeights?.onTimeAttendanceWeight ?? 40,
      attendancePercentageWeight: config.attendeeWeights?.attendancePercentageWeight ?? 20
    }
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState("");
  const [notifySuccess, setNotifySuccess] = useState("");

  // Rating Modal
  const [ratingTarget, setRatingTarget] = useState<KDPresentation | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingFeedbackScore, setRatingFeedbackScore] = useState<number>(90);
  const [ratingFeedbackText, setRatingFeedbackText] = useState<string>("");
  const [savingRating, setSavingRating] = useState(false);

  // Generate list of months for filter (past 12 months)
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      months.push(`${y}-${m}`);
    }
    if (!months.includes(selectedMonth)) {
      months.push(selectedMonth);
    }
    return months;
  }, [selectedMonth]);

  const monthLabel = (mStr: string) => {
    try {
      const [y, m] = mStr.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return mStr;
    }
  };

  // Helper to check if a presentation or meeting is KD related
  const isKDMeeting = (m: Meeting) => {
    const title = (m.title || "").toLowerCase();
    const type = (m.type || "").toLowerCase();
    return title.includes("kd") || title.includes("knowledge") || type.includes("kd") || type.includes("knowledge");
  };

  // Filter KD meetings in selected month
  const monthKDMeetings = useMemo(() => {
    return meetings.filter(m => {
      const dateStr = (m as any).date || m.occurrenceDate || m.recurrenceStartDate || (m as any).timestamp?.substring(0, 10) || "";
      return dateStr.startsWith(selectedMonth) && isKDMeeting(m);
    });
  }, [meetings, selectedMonth]);

  const totalKDMeetingsCount = monthKDMeetings.length || 1;

  // Filter KD presentations in selected month
  const monthKDPresentations = useMemo(() => {
    return presentations.filter(p => p.date.startsWith(selectedMonth));
  }, [presentations, selectedMonth]);

  // --- COMPUTE PRESENTER LEADERBOARD ---
  const presenterLeaderboard = useMemo(() => {
    const techieProfiles = profiles.filter(p => p.role === "user" || p.role === "admin" || p.role === "mentor");

    // Group presentations by presenter
    const presenterStatsMap: Record<string, {
      profile: Profile;
      completedCount: number;
      approvedCount: number;
      ratingsList: number[];
      feedbackScoresList: number[];
    }> = {};

    techieProfiles.forEach(p => {
      presenterStatsMap[p.id] = {
        profile: p,
        completedCount: 0,
        approvedCount: 0,
        ratingsList: [],
        feedbackScoresList: []
      };
    });

    monthKDPresentations.forEach(pres => {
      if (pres.status === "Completed" || pres.status === "Approved") {
        // Find matching profile by presenterUserId or presenterEmail or presenterName
        let pId = pres.presenterUserId;
        if (!pId) {
          const matchedProfile = techieProfiles.find(tp => 
            (pres.presenterEmail && tp.email?.toLowerCase() === pres.presenterEmail.toLowerCase()) ||
            (tp.fullName && tp.fullName.toLowerCase().trim() === pres.presenterName.toLowerCase().trim())
          );
          if (matchedProfile) pId = matchedProfile.id;
        }

        if (pId && presenterStatsMap[pId]) {
          const entry = presenterStatsMap[pId];
          if (pres.status === "Completed") entry.completedCount += 1;
          if (pres.status === "Approved") entry.approvedCount += 1;

          // Process ratings
          if (pres.ratings && pres.ratings.length > 0) {
            pres.ratings.forEach(r => {
              entry.ratingsList.push(r.rating);
              if (r.feedbackScore !== undefined) entry.feedbackScoresList.push(r.feedbackScore);
            });
          } else if (pres.rating) {
            entry.ratingsList.push(pres.rating);
            if (pres.feedbackScore !== undefined) entry.feedbackScoresList.push(pres.feedbackScore);
          }
        }
      }
    });

    // Compute final weighted presenter score for each techie
    const { avgRatingWeight, feedbackScoreWeight, completedPresentationsWeight } = config.presenterWeights;

    const results = Object.values(presenterStatsMap).map(entry => {
      const totalDelivered = entry.completedCount + entry.approvedCount;

      // Avg Rating (1-5) -> converted to % ( rating / 5 * 100 )
      const avgRatingRaw = entry.ratingsList.length > 0 
        ? entry.ratingsList.reduce((a, b) => a + b, 0) / entry.ratingsList.length 
        : 4.0; // Default baseline if delivered without ratings
      const avgRatingPct = (avgRatingRaw / 5) * 100;

      // Avg Feedback Score (0-100)
      const avgFeedbackPct = entry.feedbackScoresList.length > 0
        ? entry.feedbackScoresList.reduce((a, b) => a + b, 0) / entry.feedbackScoresList.length
        : 85;

      // Completed presentations score (cap at 4 sessions per month = 100%)
      const completedPct = Math.min(100, (totalDelivered / 2) * 100);

      // Total Weighted Score
      const totalScore = totalDelivered === 0 ? 0 : Math.round(
        (avgRatingPct * (avgRatingWeight / 100)) +
        (avgFeedbackPct * (feedbackScoreWeight / 100)) +
        (completedPct * (completedPresentationsWeight / 100))
      );

      return {
        profile: entry.profile,
        totalDelivered,
        completedCount: entry.completedCount,
        avgRatingRaw: Math.round(avgRatingRaw * 10) / 10,
        avgFeedbackPct: Math.round(avgFeedbackPct),
        avgFeedbackPctRaw: Math.round(avgFeedbackPct),
        score: totalScore
      };
    });

    // Sort descending by score, then totalDelivered
    return results
      .filter(r => r.totalDelivered > 0 || r.score > 0)
      .sort((a, b) => b.score - a.score || b.totalDelivered - a.totalDelivered);
  }, [profiles, monthKDPresentations, config.presenterWeights]);

  // --- COMPUTE ATTENDEE LEADERBOARD ---
  const attendeeLeaderboard = useMemo(() => {
    const techieProfiles = profiles.filter(p => p.role === "user");

    const kdMeetingIds = new Set(monthKDMeetings.map(m => m.id));

    const results = techieProfiles.map(p => {
      // Find user attendance records for month KD meetings
      const userAtt = attendance.filter(a => a.userId === p.id && (kdMeetingIds.has(a.meetingId) || (a.meetingDate && a.meetingDate.startsWith(selectedMonth)) || (a.timestamp && a.timestamp.startsWith(selectedMonth))));
      
      const attendedCount = userAtt.filter(a => a.status === "Attended" || a.status === "Late").length;
      const onTimeCount = userAtt.filter(a => a.status === "Attended").length;
      
      const attPct = Math.min(100, Math.round((attendedCount / totalKDMeetingsCount) * 100));

      const { sessionsAttendedWeight, onTimeAttendanceWeight, attendancePercentageWeight } = config.attendeeWeights;

      // Normalize sessions attended (target 12 per month = 100%)
      const sessionsAttendedPct = Math.min(100, (attendedCount / 12) * 100);
      const onTimePct = Math.min(100, (onTimeCount / 10) * 100);

      let totalScore = 0;
      if (attendedCount > 0) {
        totalScore = Math.round(
          (sessionsAttendedPct * (sessionsAttendedWeight / 100)) +
          (onTimePct * (onTimeAttendanceWeight / 100)) +
          (attPct * (attendancePercentageWeight / 100))
        );
      }

      return {
        profile: p,
        attendedCount,
        onTimeCount,
        attendancePercentage: attPct,
        score: Math.min(100, totalScore)
      };
    });

    return results
      .sort((a, b) => b.score - a.score || b.attendedCount - a.attendedCount);
  }, [profiles, attendance, monthKDMeetings, selectedMonth, totalKDMeetingsCount, config.attendeeWeights]);

  // Current User Ranks
  const userPresenterRankIndex = presenterLeaderboard.findIndex(r => r.profile.id === profile.id);
  const userPresenterRank = userPresenterRankIndex !== -1 ? `#${userPresenterRankIndex + 1}` : "Unranked";
  const userPresenterData = userPresenterRankIndex !== -1 ? presenterLeaderboard[userPresenterRankIndex] : null;

  const userAttendeeRankIndex = attendeeLeaderboard.findIndex(r => r.profile.id === profile.id);
  const userAttendeeRank = userAttendeeRankIndex !== -1 ? `#${userAttendeeRankIndex + 1}` : "Unranked";
  const userAttendeeData = userAttendeeRankIndex !== -1 ? attendeeLeaderboard[userAttendeeRankIndex] : null;

  // Save Config Handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isKDOwner) return;

    const pSum = formConfig.presenterWeights.avgRatingWeight + formConfig.presenterWeights.feedbackScoreWeight + formConfig.presenterWeights.completedPresentationsWeight;
    const aSum = formConfig.attendeeWeights.sessionsAttendedWeight + formConfig.attendeeWeights.onTimeAttendanceWeight + formConfig.attendeeWeights.attendancePercentageWeight;

    if (pSum !== 100) {
      setConfigError(`Presenter weights must sum to 100% (currently ${pSum}%).`);
      return;
    }
    if (aSum !== 100) {
      setConfigError(`Attendee weights must sum to 100% (currently ${aSum}%).`);
      return;
    }

    setSavingConfig(true);
    setConfigError("");

    try {
      const updatedKdInfo: KnowledgeDevelopmentInfo = {
        ...(kdInfo || {}),
        kdLeaderboardConfig: formConfig
      };

      await updateKnowledgeDevelopmentInfo(updatedKdInfo, profile);
      setSavingConfig(false);
      setShowConfigModal(false);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to save KD Leaderboard criteria:", err);
      setSavingConfig(false);
      setConfigError(err.message || "Failed to update configuration.");
    }
  };

  // Publish Monthly Leaderboard & Notify Techies
  const handlePublishLeaderboard = async () => {
    if (!isAdmin && !isKDOwner) return;
    setSavingConfig(true);
    setNotifySuccess("");

    try {
      const topPresenter = presenterLeaderboard[0]?.profile.fullName || "N/A";
      const topAttendee = attendeeLeaderboard[0]?.profile.fullName || "N/A";

      const notifyMsg = `🏆 Knowledge Development Leaderboard Published for ${monthLabel(selectedMonth)}! Top Presenter: ${topPresenter} | Top Attendee: ${topAttendee}. View your rank on the KD Leaderboard now!`;

      // Dispatch notifications to all techie profiles
      const techieProfiles = profiles.filter(p => p.role === "user");
      for (const tProfile of techieProfiles) {
        await sendReminder(tProfile.id, notifyMsg);
      }

      // Record last published timestamp
      const updatedKdInfo: KnowledgeDevelopmentInfo = {
        ...(kdInfo || {}),
        kdLeaderboardConfig: {
          ...config,
          lastPublishedMonth: selectedMonth,
          lastPublishedAt: new Date().toISOString()
        }
      };

      await updateKnowledgeDevelopmentInfo(updatedKdInfo, profile);
      setSavingConfig(false);
      setNotifySuccess(`Successfully published leaderboard and sent notifications to ${techieProfiles.length} techies!`);
      if (onStateUpdate) onStateUpdate();
      setTimeout(() => setNotifySuccess(""), 5000);
    } catch (err: any) {
      console.error("Failed to publish leaderboard notifications:", err);
      setSavingConfig(false);
      alert(err.message || "Failed to broadcast notifications.");
    }
  };

  // Submit Rating Handler
  const handleSaveRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingTarget) return;

    setSavingRating(true);
    try {
      const newRating: KDPresentationRating = {
        userId: profile.id,
        userName: profile.fullName || profile.username || "Techie Attendee",
        rating: ratingStars,
        feedbackScore: ratingFeedbackScore,
        feedbackText: ratingFeedbackText.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedRatings = [...(ratingTarget.ratings || []), newRating];

      // Calculate new overall averages
      const totalStars = updatedRatings.reduce((sum, r) => sum + r.rating, 0);
      const avgStars = Math.round((totalStars / updatedRatings.length) * 10) / 10;

      const totalFeedback = updatedRatings.reduce((sum, r) => sum + (r.feedbackScore || 85), 0);
      const avgFeedback = Math.round(totalFeedback / updatedRatings.length);

      await updateKDPresentation(ratingTarget.id, {
        ratings: updatedRatings,
        rating: avgStars,
        feedbackScore: avgFeedback,
        updatedAt: new Date().toISOString()
      });

      setSavingRating(false);
      setRatingTarget(null);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to submit rating:", err);
      setSavingRating(false);
      alert(err.message || "Failed to submit rating.");
    }
  };

  return (
    <div className="space-y-6" id="kd-leaderboard-root">
      
      {/* HEADER & MONTH SELECTOR */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-150">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#4B5E40]/10 text-[#4B5E40] text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                <Trophy className="w-3 h-3 text-[#4B5E40]" /> High Accountability Rankings
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                Auto-Resets Monthly
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Knowledge Development (KD) Monthly Leaderboard
            </h2>
            <p className="text-xs text-gray-500">
              Tracking top-performing presentation facilitators and most active session attendees for <strong>{monthLabel(selectedMonth)}</strong>.
            </p>
          </div>

          {/* MONTH FILTER & ADMIN CONTROLS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {monthLabel(m)} {m === currentLagosMonth ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {(isAdmin || isKDOwner) && (
              <>
                <button
                  onClick={() => {
                    setFormConfig(config);
                    setConfigError("");
                    setShowConfigModal(true);
                  }}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-gray-200"
                  title="Configure Ranking Criteria Weights"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#4B5E40]" /> Configure Criteria
                </button>

                <button
                  onClick={handlePublishLeaderboard}
                  disabled={savingConfig}
                  className="px-3.5 py-2 bg-[#4B5E40] hover:bg-[#3B4E30] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Publish & Send Leaderboard Notification to Techies"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-300" /> Publish & Notify
                </button>
              </>
            )}
          </div>
        </div>

        {notifySuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notifySuccess}</span>
          </div>
        )}

        {/* CURRENT USER RANKING BANNER */}
        <div className="p-4 bg-gradient-to-r from-emerald-900 to-[#4B5E40] text-white rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center font-black text-amber-300 text-base border border-white/20 shrink-0">
              {profile.fullName?.charAt(0).toUpperCase() || "Y"}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                Your Monthly Standing ({monthLabel(selectedMonth)})
              </div>
              <h4 className="text-sm font-extrabold text-white">
                {profile.fullName || profile.username} ({profile.track || "Techie"})
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-6 text-center sm:text-right">
            <div className="p-2 bg-white/10 rounded-xl border border-white/10 min-w-[110px]">
              <span className="text-[10px] font-bold text-emerald-100 block uppercase tracking-wider">
                Presenter Rank
              </span>
              <span className="text-base font-black text-amber-300">
                {userPresenterRank}
              </span>
              {userPresenterData && (
                <span className="text-[9px] text-emerald-200 block font-mono">
                  Score: {userPresenterData.score}%
                </span>
              )}
            </div>

            <div className="p-2 bg-white/10 rounded-xl border border-white/10 min-w-[110px]">
              <span className="text-[10px] font-bold text-emerald-100 block uppercase tracking-wider">
                Attendee Rank
              </span>
              <span className="text-base font-black text-emerald-300">
                {userAttendeeRank}
              </span>
              {userAttendeeData && (
                <span className="text-[9px] text-emerald-200 block font-mono">
                  Score: {userAttendeeData.score}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SUB-TAB TOGGLE: PRESENTER vs ATTENDEE */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setActiveBoard("presenter")}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeBoard === "presenter"
                ? "bg-[#4B5E40] text-white shadow-xs"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Mic className="w-4 h-4" /> Presenter Leaderboard ({presenterLeaderboard.length})
          </button>

          <button
            onClick={() => setActiveBoard("attendee")}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeBoard === "attendee"
                ? "bg-[#4B5E40] text-white shadow-xs"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Users className="w-4 h-4" /> Attendee Leaderboard ({attendeeLeaderboard.length})
          </button>
        </div>
      </div>

      {/* --- TAB 1: PRESENTER LEADERBOARD --- */}
      {activeBoard === "presenter" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* CRITERIA INFORMATION BADGE */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Configured Presenter Ranking Weights:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="bg-amber-100 px-2 py-0.5 rounded-md font-semibold text-amber-950">
                Avg Rating: <strong>{config.presenterWeights.avgRatingWeight}%</strong>
              </span>
              <span className="bg-amber-100 px-2 py-0.5 rounded-md font-semibold text-amber-950">
                Feedback Score: <strong>{config.presenterWeights.feedbackScoreWeight}%</strong>
              </span>
              <span className="bg-amber-100 px-2 py-0.5 rounded-md font-semibold text-amber-950">
                Approved Sessions: <strong>{config.presenterWeights.completedPresentationsWeight}%</strong>
              </span>
            </div>
          </div>

          {/* TOP 3 PRESENTER PODIUM */}
          {presenterLeaderboard.length > 0 && (
            <div className="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-6 pt-8 pb-4 max-w-2xl mx-auto">
              
              {/* 2ND PLACE PRESENTER */}
              {presenterLeaderboard[1] && (
                <div className="w-full sm:w-44 flex flex-col items-center order-2 sm:order-1">
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center mx-auto shadow-xs">
                      <Medal className="w-5 h-5 text-slate-500" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-xs truncate max-w-[130px]">
                      {presenterLeaderboard[1].profile.fullName}
                    </h4>
                    <span className="text-[10px] text-gray-500 block truncate max-w-[130px]">
                      {presenterLeaderboard[1].profile.track}
                    </span>
                  </div>

                  <div className="w-full h-24 bg-slate-100 rounded-t-xl border border-slate-200 flex flex-col justify-center items-center p-3 text-center shadow-2xs">
                    <span className="font-mono text-xl font-extrabold text-slate-700">2nd</span>
                    <span className="text-xs font-black text-slate-800 mt-0.5">
                      {presenterLeaderboard[1].score}% score
                    </span>
                    <span className="text-[9px] text-slate-600 font-mono mt-0.5">
                      {presenterLeaderboard[1].totalDelivered} sessions • ⭐ {presenterLeaderboard[1].avgRatingRaw}
                    </span>
                  </div>
                </div>
              )}

              {/* 1ST PLACE PRESENTER */}
              {presenterLeaderboard[0] && (
                <div className="w-full sm:w-48 flex flex-col items-center order-1 sm:order-2 z-10 -mt-6">
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-400 flex items-center justify-center mx-auto shadow-md relative">
                      <Trophy className="w-6 h-6 text-amber-500" />
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 absolute -top-1 -right-1" />
                    </div>
                    <h4 className="font-black text-gray-900 text-sm truncate max-w-[150px]">
                      {presenterLeaderboard[0].profile.fullName}
                    </h4>
                    <span className="text-[10px] text-[#4B5E40] font-semibold block truncate max-w-[150px]">
                      {presenterLeaderboard[0].profile.track}
                    </span>
                  </div>

                  <div className="w-full h-32 bg-[#4B5E40] rounded-t-xl border border-[#4B5E40]/90 flex flex-col justify-center items-center p-3 text-center shadow-md relative">
                    <div className="absolute top-2 px-2 py-0.5 bg-amber-400/30 text-[8px] font-black tracking-wider text-amber-200 rounded">
                      TOP PRESENTER
                    </div>
                    <span className="font-mono text-2xl font-black text-white">1st</span>
                    <span className="text-sm font-black text-amber-300 mt-0.5">
                      {presenterLeaderboard[0].score}% score
                    </span>
                    <span className="text-[10px] text-emerald-100 font-mono mt-0.5">
                      {presenterLeaderboard[0].totalDelivered} sessions • ⭐ {presenterLeaderboard[0].avgRatingRaw}
                    </span>
                  </div>
                </div>
              )}

              {/* 3RD PLACE PRESENTER */}
              {presenterLeaderboard[2] && (
                <div className="w-full sm:w-44 flex flex-col items-center order-3 sm:order-3">
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-10 h-10 rounded-full bg-orange-50 border-2 border-amber-300 flex items-center justify-center mx-auto shadow-xs">
                      <Award className="w-5 h-5 text-amber-700" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-xs truncate max-w-[130px]">
                      {presenterLeaderboard[2].profile.fullName}
                    </h4>
                    <span className="text-[10px] text-gray-500 block truncate max-w-[130px]">
                      {presenterLeaderboard[2].profile.track}
                    </span>
                  </div>

                  <div className="w-full h-20 bg-orange-50 rounded-t-xl border border-orange-100 flex flex-col justify-center items-center p-3 text-center shadow-2xs">
                    <span className="font-mono text-lg font-extrabold text-amber-800">3rd</span>
                    <span className="text-xs font-black text-amber-900 mt-0.5">
                      {presenterLeaderboard[2].score}% score
                    </span>
                    <span className="text-[9px] text-amber-700 font-mono mt-0.5">
                      {presenterLeaderboard[2].totalDelivered} sessions • ⭐ {presenterLeaderboard[2].avgRatingRaw}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PRESENTER TABLE */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-[#4B5E40]" /> Complete Monthly Presenter Rankings ({monthLabel(selectedMonth)})
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">
                Showing {presenterLeaderboard.length} presenter(s)
              </span>
            </div>

            {presenterLeaderboard.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-gray-500">
                <Mic className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs font-bold">No completed presentations recorded yet for {monthLabel(selectedMonth)}.</p>
                <p className="text-[11px] text-gray-400">Presenters will appear here automatically once Knowledge Development sessions are completed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-3 px-4 text-center font-mono w-14">Rank</th>
                      <th className="py-3 px-4">Presenter Name</th>
                      <th className="py-3 px-4">Track</th>
                      <th className="py-3 px-4 text-center">Sessions Delivered</th>
                      <th className="py-3 px-4 text-center">Avg Rating (⭐ 1-5)</th>
                      <th className="py-3 px-4 text-center">Feedback Score</th>
                      <th className="py-3 px-4 text-center">Weighted Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {presenterLeaderboard.map((item, idx) => {
                      const rankNum = idx + 1;
                      const isSelf = item.profile.id === profile.id;

                      return (
                        <tr 
                          key={item.profile.id}
                          className={`transition ${isSelf ? "bg-amber-50/60 font-bold" : "hover:bg-gray-50/50"}`}
                        >
                          <td className="py-3 px-4 text-center font-mono font-bold text-gray-700">
                            {rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : `#${rankNum}`}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-900 block">{item.profile.fullName}</span>
                              {isSelf && (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-medium">
                            {item.profile.track}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-gray-800">
                            {item.totalDelivered} session(s)
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-700">
                            ⭐ {item.avgRatingRaw} / 5
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-blue-700">
                            {item.avgFeedbackPct}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 bg-[#4B5E40] text-white text-xs font-black rounded-lg shadow-2xs font-mono">
                              {item.score}%
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

          {/* RATE COMPLETED PRESENTATIONS BANNER */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    Rate & Leave Presentation Feedback
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Your attendee ratings and feedback directly power the monthly Presenter Leaderboard rankings.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {monthKDPresentations
                .filter(p => p.status === "Completed" || p.status === "Approved")
                .slice(0, 4)
                .map(p => (
                  <div key={p.id} className="p-3 bg-white rounded-xl border border-emerald-150 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="overflow-hidden">
                      <h5 className="text-xs font-bold text-gray-900 truncate">{p.topic || "KD Session"}</h5>
                      <p className="text-[10px] text-gray-500 truncate">Presenter: {p.presenterName} ({p.date})</p>
                    </div>
                    <button
                      onClick={() => {
                        setRatingTarget(p);
                        setRatingStars(5);
                        setRatingFeedbackScore(90);
                        setRatingFeedbackText("");
                      }}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3 h-3 fill-white" /> Rate Session
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: ATTENDEE LEADERBOARD --- */}
      {activeBoard === "attendee" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* CRITERIA INFORMATION BADGE */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Configured Attendee Ranking Weights:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="bg-blue-100 px-2 py-0.5 rounded-md font-semibold text-blue-950">
                Sessions Attended: <strong>{config.attendeeWeights.sessionsAttendedWeight}%</strong>
              </span>
              <span className="bg-blue-100 px-2 py-0.5 rounded-md font-semibold text-blue-950">
                On-Time Punctuality: <strong>{config.attendeeWeights.onTimeAttendanceWeight}%</strong>
              </span>
              <span className="bg-blue-100 px-2 py-0.5 rounded-md font-semibold text-blue-950">
                Attendance %: <strong>{config.attendeeWeights.attendancePercentageWeight}%</strong>
              </span>
            </div>
          </div>

          {/* TOP 3 ATTENDEE PODIUM */}
          {attendeeLeaderboard.length > 0 && (
            <div className="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-6 pt-8 pb-4 max-w-2xl mx-auto">
              
              {/* 2ND PLACE ATTENDEE */}
              {attendeeLeaderboard[1] && (
                <div className="w-full sm:w-44 flex flex-col items-center order-2 sm:order-1">
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center mx-auto shadow-xs">
                      <Medal className="w-5 h-5 text-slate-500" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-xs truncate max-w-[130px]">
                      {attendeeLeaderboard[1].profile.fullName}
                    </h4>
                    <span className="text-[10px] text-gray-500 block truncate max-w-[130px]">
                      {attendeeLeaderboard[1].profile.track}
                    </span>
                  </div>

                  <div className="w-full h-24 bg-slate-100 rounded-t-xl border border-slate-200 flex flex-col justify-center items-center p-3 text-center shadow-2xs">
                    <span className="font-mono text-xl font-extrabold text-slate-700">2nd</span>
                    <span className="text-xs font-black text-slate-800 mt-0.5">
                      {attendeeLeaderboard[1].score}% rating
                    </span>
                    <span className="text-[9px] text-slate-600 font-mono mt-0.5">
                      {attendeeLeaderboard[1].attendedCount} attended • {attendeeLeaderboard[1].onTimeCount} on-time
                    </span>
                  </div>
                </div>
              )}

              {/* 1ST PLACE ATTENDEE */}
              {attendeeLeaderboard[0] && (
                <div className="w-full sm:w-48 flex flex-col items-center order-1 sm:order-2 z-10 -mt-6">
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-400 flex items-center justify-center mx-auto shadow-md relative">
                      <Trophy className="w-6 h-6 text-blue-600" />
                      <Star className="w-3.5 h-3.5 text-blue-500 fill-blue-400 absolute -top-1 -right-1" />
                    </div>
                    <h4 className="font-black text-gray-900 text-sm truncate max-w-[150px]">
                      {attendeeLeaderboard[0].profile.fullName}
                    </h4>
                    <span className="text-[10px] text-blue-800 font-semibold block truncate max-w-[150px]">
                      {attendeeLeaderboard[0].profile.track}
                    </span>
                  </div>

                  <div className="w-full h-32 bg-blue-900 rounded-t-xl border border-blue-800 flex flex-col justify-center items-center p-3 text-center shadow-md relative text-white">
                    <div className="absolute top-2 px-2 py-0.5 bg-blue-400/30 text-[8px] font-black tracking-wider text-blue-100 rounded">
                      MOST ACTIVE ATTENDEE
                    </div>
                    <span className="font-mono text-2xl font-black text-white">1st</span>
                    <span className="text-sm font-black text-blue-200 mt-0.5">
                      {attendeeLeaderboard[0].score}% rating
                    </span>
                    <span className="text-[10px] text-blue-100 font-mono mt-0.5">
                      {attendeeLeaderboard[0].attendedCount} attended • {attendeeLeaderboard[0].onTimeCount} on-time
                    </span>
                  </div>
                </div>
              )}

              {/* 3RD PLACE ATTENDEE */}
              {attendeeLeaderboard[2] && (
                <div className="w-full sm:w-44 flex flex-col items-center order-3 sm:order-3">
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-10 h-10 rounded-full bg-orange-50 border-2 border-amber-300 flex items-center justify-center mx-auto shadow-xs">
                      <Award className="w-5 h-5 text-amber-700" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-xs truncate max-w-[130px]">
                      {attendeeLeaderboard[2].profile.fullName}
                    </h4>
                    <span className="text-[10px] text-gray-500 block truncate max-w-[130px]">
                      {attendeeLeaderboard[2].profile.track}
                    </span>
                  </div>

                  <div className="w-full h-20 bg-orange-50 rounded-t-xl border border-orange-100 flex flex-col justify-center items-center p-3 text-center shadow-2xs">
                    <span className="font-mono text-lg font-extrabold text-amber-800">3rd</span>
                    <span className="text-xs font-black text-amber-900 mt-0.5">
                      {attendeeLeaderboard[2].score}% rating
                    </span>
                    <span className="text-[9px] text-amber-700 font-mono mt-0.5">
                      {attendeeLeaderboard[2].attendedCount} attended • {attendeeLeaderboard[2].onTimeCount} on-time
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ATTENDEE TABLE */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-700" /> Complete Monthly Attendee Rankings ({monthLabel(selectedMonth)})
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">
                Showing {attendeeLeaderboard.length} techie(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4 text-center font-mono w-14">Rank</th>
                    <th className="py-3 px-4">Techie Name</th>
                    <th className="py-3 px-4">Registered Track</th>
                    <th className="py-3 px-4 text-center">Sessions Attended</th>
                    <th className="py-3 px-4 text-center">On-Time Count</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-center">Weighted Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {attendeeLeaderboard.map((item, idx) => {
                    const rankNum = idx + 1;
                    const isSelf = item.profile.id === profile.id;

                    return (
                      <tr 
                        key={item.profile.id}
                        className={`transition ${isSelf ? "bg-blue-50/70 font-bold" : "hover:bg-gray-50/50"}`}
                      >
                        <td className="py-3 px-4 text-center font-mono font-bold text-gray-700">
                          {rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : `#${rankNum}`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-gray-900 block">{item.profile.fullName}</span>
                            {isSelf && (
                              <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">@{item.profile.username}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-medium">
                          {item.profile.track}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-800">
                          {item.attendedCount} session(s)
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                          {item.onTimeCount} on-time
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-blue-700">
                          {item.attendancePercentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 bg-blue-700 text-white text-xs font-black rounded-lg shadow-2xs font-mono">
                            {item.score}%
                          </span>
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

      {/* MODAL 1: CONFIGURE RANKING CRITERIA WEIGHTS (ADMIN / KD OWNER) */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#4B5E40] text-white rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Configure Leaderboard Criteria
                  </h3>
                  <p className="text-xs text-gray-500">
                    Adjust criteria percentage weights for presenters & attendees
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {configError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{configError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-5">
              
              {/* PRESENTER WEIGHTS CONFIG */}
              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-amber-700" /> Presenter Ranking Criteria Weights (Total = 100%)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-700 mb-1">
                      Avg Rating Weight (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formConfig.presenterWeights.avgRatingWeight}
                      onChange={(e) => setFormConfig({
                        ...formConfig,
                        presenterWeights: { ...formConfig.presenterWeights, avgRatingWeight: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-700 mb-1">
                      Feedback Score Weight (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formConfig.presenterWeights.feedbackScoreWeight}
                      onChange={(e) => setFormConfig({
                        ...formConfig,
                        presenterWeights: { ...formConfig.presenterWeights, feedbackScoreWeight: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-700 mb-1">
                      Delivered Sessions Weight (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formConfig.presenterWeights.completedPresentationsWeight}
                      onChange={(e) => setFormConfig({
                        ...formConfig,
                        presenterWeights: { ...formConfig.presenterWeights, completedPresentationsWeight: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* ATTENDEE WEIGHTS CONFIG */}
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                <h4 className="text-xs font-black uppercase text-blue-950 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-700" /> Attendee Ranking Criteria Weights (Total = 100%)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-700 mb-1">
                      Sessions Attended Weight (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formConfig.attendeeWeights.sessionsAttendedWeight}
                      onChange={(e) => setFormConfig({
                        ...formConfig,
                        attendeeWeights: { ...formConfig.attendeeWeights, sessionsAttendedWeight: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-700 mb-1">
                      On-Time Weight (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formConfig.attendeeWeights.onTimeAttendanceWeight}
                      onChange={(e) => setFormConfig({
                        ...formConfig,
                        attendeeWeights: { ...formConfig.attendeeWeights, onTimeAttendanceWeight: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-700 mb-1">
                      Attendance % Weight (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formConfig.attendeeWeights.attendancePercentageWeight}
                      onChange={(e) => setFormConfig({
                        ...formConfig,
                        attendeeWeights: { ...formConfig.attendeeWeights, attendancePercentageWeight: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-[#4B5E40] hover:bg-[#3B4E30] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RATE & FEEDBACK PRESENTATION SESSION */}
      {ratingTarget && (
        <KDSessionFeedbackModal
          presentation={ratingTarget}
          profile={profile}
          attendanceRecords={attendance}
          config={config}
          isAdmin={isAdmin}
          isKDOwner={isKDOwner}
          onClose={() => setRatingTarget(null)}
          onSuccess={() => {
            setRatingTarget(null);
            if (onStateUpdate) onStateUpdate();
          }}
        />
      )}
    </div>
  );
}
