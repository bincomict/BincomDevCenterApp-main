import React, { useState, useMemo } from "react";
import { KDPresentation, KDLeaderboardConfig, Profile } from "../types";
import { 
  BarChart2, 
  Star, 
  Search, 
  Sliders, 
  CheckCircle2, 
  Users, 
  MessageSquare, 
  EyeOff, 
  Settings, 
  ChevronRight, 
  Award,
  RefreshCw,
  Sparkles,
  Filter
} from "lucide-react";

interface KDAggregatedFeedbackViewProps {
  presentations: KDPresentation[];
  config: KDLeaderboardConfig;
  profile: Profile;
  onUpdateConfig?: (newConfig: KDLeaderboardConfig) => Promise<void>;
  onSelectPresentation?: (pres: KDPresentation) => void;
}

export default function KDAggregatedFeedbackView({
  presentations = [],
  config,
  profile,
  onUpdateConfig,
  onSelectPresentation
}: KDAggregatedFeedbackViewProps) {
  const maxScale = config.ratingScale || 5;
  const allowAnonymous = config.allowAnonymousFeedback !== false;

  // Local Form Config for Admins
  const [editingConfig, setEditingConfig] = useState<KDLeaderboardConfig>(config);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterFeedbackStatus, setFilterFeedbackStatus] = useState<"all" | "has_feedback" | "no_feedback">("all");

  // Aggregated Calculations across all presentations
  const aggStats = useMemo(() => {
    let totalReviewsCount = 0;
    let totalStarSum = 0;
    let totalScoreSum = 0;
    let anonymousCount = 0;
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };

    let sessionsWithFeedbackCount = 0;

    presentations.forEach((p) => {
      const ratings = p.ratings || [];
      if (ratings.length > 0) {
        sessionsWithFeedbackCount++;
        ratings.forEach((r) => {
          totalReviewsCount++;
          totalStarSum += r.rating;
          totalScoreSum += r.feedbackScore || 85;
          if (r.isAnonymous) anonymousCount++;

          const starKey = Math.min(Math.max(Math.round(r.rating), 1), 10);
          ratingDistribution[starKey] = (ratingDistribution[starKey] || 0) + 1;
        });
      }
    });

    const avgPlatformRating = totalReviewsCount > 0 ? Math.round((totalStarSum / totalReviewsCount) * 10) / 10 : 0;
    const avgPlatformScore = totalReviewsCount > 0 ? Math.round(totalScoreSum / totalReviewsCount) : 0;
    const anonPercentage = totalReviewsCount > 0 ? Math.round((anonymousCount / totalReviewsCount) * 100) : 0;

    return {
      totalReviewsCount,
      avgPlatformRating,
      avgPlatformScore,
      anonymousCount,
      anonPercentage,
      sessionsWithFeedbackCount,
      ratingDistribution
    };
  }, [presentations]);

  // Filtered Sessions List
  const filteredPresentations = useMemo(() => {
    return presentations.filter((p) => {
      const ratings = p.ratings || [];
      if (filterFeedbackStatus === "has_feedback" && ratings.length === 0) return false;
      if (filterFeedbackStatus === "no_feedback" && ratings.length > 0) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (p.topic || "").toLowerCase().includes(term) ||
        (p.presenterName || "").toLowerCase().includes(term) ||
        (p.date || "").toLowerCase().includes(term)
      );
    });
  }, [presentations, filterFeedbackStatus, searchTerm]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateConfig) return;
    setSavingConfig(true);
    try {
      await onUpdateConfig(editingConfig);
      setSavingConfig(false);
      setShowConfigPanel(false);
    } catch (err: any) {
      console.error("Failed to update feedback config:", err);
      setSavingConfig(false);
      alert(err.message || "Failed to update feedback configuration.");
    }
  };

  return (
    <div className="space-y-6" id="kd-aggregated-feedback-root">
      
      {/* HEADER BAR */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-150">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#4B5E40]/10 text-[#4B5E40] text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-[#4B5E40]" /> Admin & Owner Feedback Analytics
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                Real-Time Firestore Aggregations
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              Knowledge Development Feedback Hub
            </h2>
            <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
              Monitor attendee ratings, feedback scores, ratings scale configurations, and session comments across all Knowledge Development sessions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-2xl transition flex items-center gap-2 cursor-pointer shadow-2xs border border-gray-200"
            id="btn-toggle-feedback-settings"
          >
            <Settings className="w-4 h-4 text-[#4B5E40]" />
            {showConfigPanel ? "Hide Settings" : "Configure Rating Scale & Feedback Rules"}
          </button>
        </div>

        {/* ADMIN CONFIGURATION PANEL */}
        {showConfigPanel && (
          <form onSubmit={handleSaveSettings} className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-emerald-200/60">
              <Sliders className="w-4 h-4 text-[#4B5E40]" />
              <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">
                Feedback Rules & Rating Scale Configuration
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* RATING SCALE SELECTOR */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase text-gray-800">
                  Rating Scale Range *
                </label>
                <select
                  value={editingConfig.ratingScale || 5}
                  onChange={(e) => setEditingConfig({ ...editingConfig, ratingScale: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white font-bold text-gray-800"
                >
                  <option value={5}>1 to 5 Stars (Standard Scale)</option>
                  <option value={10}>1 to 10 Scale (Extended Scale)</option>
                </select>
                <p className="text-[10px] text-gray-500">
                  Controls the maximum stars/score attendees can select when submitting feedback.
                </p>
              </div>

              {/* ANONYMOUS FEEDBACK TOGGLE */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase text-gray-800">
                  Anonymous Feedback Submissions
                </label>
                <select
                  value={editingConfig.allowAnonymousFeedback !== false ? "enabled" : "disabled"}
                  onChange={(e) => setEditingConfig({ ...editingConfig, allowAnonymousFeedback: e.target.value === "enabled" })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white font-bold text-gray-800"
                >
                  <option value="enabled">Enabled (Attendees can choose to submit anonymously)</option>
                  <option value="disabled">Disabled (All feedback submissions require name)</option>
                </select>
                <p className="text-[10px] text-gray-500">
                  When enabled, attendees can check "Submit anonymously" on the feedback form.
                </p>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                className="px-3.5 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-1.5 bg-[#4B5E40] text-white text-xs font-black rounded-xl hover:bg-[#394831] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {savingConfig && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Feedback Settings
              </button>
            </div>
          </form>
        )}

        {/* METRICS OVERVIEW GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                Platform Avg Rating
              </span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            </div>
            <div className="text-2xl font-black text-gray-900">
              {aggStats.avgPlatformRating > 0 ? aggStats.avgPlatformRating.toFixed(1) : "N/A"}
              <span className="text-xs text-gray-500 font-bold ml-1">/ {maxScale}</span>
            </div>
            <p className="text-[10px] text-amber-700 font-semibold">Across all attendee reviews</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                Avg Feedback Score
              </span>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950">
              {aggStats.avgPlatformScore > 0 ? `${aggStats.avgPlatformScore}%` : "N/A"}
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold">Quality & delivery percentage</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider">
                Total Submissions
              </span>
              <MessageSquare className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950">
              {aggStats.totalReviewsCount}
            </div>
            <p className="text-[10px] text-blue-700 font-semibold">In {aggStats.sessionsWithFeedbackCount} KD sessions</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl border border-purple-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider">
                Anonymous Ratio
              </span>
              <EyeOff className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-950">
              {aggStats.anonPercentage}%
            </div>
            <p className="text-[10px] text-purple-700 font-semibold">{aggStats.anonymousCount} anonymous reviews</p>
          </div>

        </div>

      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sessions by topic, presenter name, or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#4B5E40] focus:border-transparent font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterFeedbackStatus}
              onChange={(e) => setFilterFeedbackStatus(e.target.value as any)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 font-bold text-gray-800"
            >
              <option value="all">All Sessions ({presentations.length})</option>
              <option value="has_feedback">With Feedback Only ({aggStats.sessionsWithFeedbackCount})</option>
              <option value="no_feedback">No Feedback Recorded</option>
            </select>
          </div>

        </div>

        {/* SESSIONS TABLE / DIRECTORY */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-[10px] font-black uppercase text-gray-500 tracking-wider">
                <th className="py-3 px-4">Session Date</th>
                <th className="py-3 px-4">Topic / Title</th>
                <th className="py-3 px-4">Presenter</th>
                <th className="py-3 px-4 text-center">Feedback Count</th>
                <th className="py-3 px-4 text-center">Avg Rating</th>
                <th className="py-3 px-4 text-center">Quality Score</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-xs">
              {filteredPresentations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                    No matching Knowledge Development sessions found.
                  </td>
                </tr>
              ) : (
                filteredPresentations.map((p) => {
                  const ratings = p.ratings || [];
                  const hasRatings = ratings.length > 0;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-800 whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="py-3.5 px-4 font-black text-gray-900 max-w-xs truncate">
                        {p.topic || "KD Presentation Session"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        {p.presenterName}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {hasRatings ? (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-[11px] rounded-lg">
                            {ratings.length} reviews
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-amber-800">
                        {p.rating ? (
                          <span className="flex items-center justify-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                            {p.rating.toFixed(1)} / {maxScale}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-emerald-800">
                        {p.feedbackScore ? `${p.feedbackScore}%` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectPresentation && onSelectPresentation(p)}
                          className="px-3 py-1.5 bg-[#4B5E40] hover:bg-[#37462f] text-white text-[11px] font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          Inspect Reviews <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
