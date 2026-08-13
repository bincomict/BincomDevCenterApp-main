import React, { useState } from "react";
import { KDPresentation, Profile, AttendanceRecord, KDLeaderboardConfig, KDPresentationRating } from "../types";
import { updateKDPresentation } from "../firebaseService";
import { getLagosDateString } from "../utils/trackUtils";
import { 
  Star, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  Lock, 
  User, 
  EyeOff, 
  BarChart2, 
  RefreshCw, 
  Award,
  Calendar,
  Clock,
  Sparkles
} from "lucide-react";

interface KDSessionFeedbackModalProps {
  presentation: KDPresentation;
  profile: Profile;
  attendanceRecords?: AttendanceRecord[];
  config?: KDLeaderboardConfig;
  isAdmin?: boolean;
  isKDOwner?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTab?: "submit" | "reviews";
}

export default function KDSessionFeedbackModal({
  presentation,
  profile,
  attendanceRecords = [],
  config,
  isAdmin = false,
  isKDOwner = false,
  onClose,
  onSuccess,
  initialTab = "submit"
}: KDSessionFeedbackModalProps) {
  const maxScale = config?.ratingScale || 5;
  const allowAnonymous = config?.allowAnonymousFeedback !== false;

  // Check if session has ended
  const sessionEnded = React.useMemo(() => {
    if (presentation.status === "Completed") return true;
    const lagosToday = getLagosDateString(new Date());
    if (presentation.date < lagosToday) return true;
    return false;
  }, [presentation]);

  // Attendance Verification
  const userAttended = React.useMemo(() => {
    if (isAdmin || isKDOwner) return true;
    if (!attendanceRecords || attendanceRecords.length === 0) return true; // Fallback if record stream offline

    return attendanceRecords.some((rec) => {
      if (rec.userId !== profile.id) return false;
      if (rec.status !== "Attended" && rec.status !== "Late") return false;
      if (presentation.linkedMeetingId && rec.meetingId === presentation.linkedMeetingId) return true;
      if (rec.meetingDate && rec.meetingDate === presentation.date) return true;
      if (rec.timestamp && rec.timestamp.startsWith(presentation.date)) return true;
      const typeLower = String(rec.meetingType || "").toLowerCase();
      if ((typeLower.includes("knowledge") || typeLower.includes("kd")) && rec.timestamp?.startsWith(presentation.date)) {
        return true;
      }
      return false;
    });
  }, [attendanceRecords, profile.id, presentation, isAdmin, isKDOwner]);

  // Check Presenter identity
  const isPresenter = React.useMemo(() => {
    if (presentation.presenterUserId && presentation.presenterUserId === profile.id) return true;
    if (presentation.presenterEmail && profile.email && presentation.presenterEmail.toLowerCase() === profile.email.toLowerCase()) return true;
    if (presentation.presenterName && profile.fullName && presentation.presenterName.toLowerCase() === profile.fullName.toLowerCase()) return true;
    return false;
  }, [presentation, profile]);

  // Check if user already submitted feedback
  const existingFeedback = React.useMemo(() => {
    if (!presentation.ratings) return null;
    return presentation.ratings.find(r => r.userId === profile.id) || null;
  }, [presentation.ratings, profile.id]);

  // State
  const [activeTab, setActiveTab] = useState<"submit" | "reviews">(
    isPresenter || (initialTab === "reviews" && (isAdmin || isKDOwner || isPresenter)) ? "reviews" : "submit"
  );
  
  const [ratingStars, setRatingStars] = useState<number>(existingFeedback?.rating || maxScale);
  const [feedbackScore, setFeedbackScore] = useState<number>(existingFeedback?.feedbackScore || 90);
  const [feedbackText, setFeedbackText] = useState<string>(existingFeedback?.feedbackText || "");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(existingFeedback?.isAnonymous || false);
  const [saving, setSaving] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionEnded) {
      alert("Feedback can only be submitted after the Knowledge Development session has ended.");
      return;
    }
    if (!userAttended) {
      alert("Only verified attendees who attended this session can submit feedback.");
      return;
    }

    setSaving(true);
    try {
      const displayName = isAnonymous ? "Anonymous Attendee" : (profile.fullName || profile.username || "Techie Attendee");
      const newRatingEntry: KDPresentationRating = {
        userId: profile.id,
        userName: displayName,
        rating: ratingStars,
        feedbackScore,
        feedbackText: feedbackText.trim(),
        createdAt: new Date().toISOString(),
        isAnonymous
      };

      // Remove previous entry if updating existing
      const existingRatings = presentation.ratings || [];
      const filteredRatings = existingRatings.filter(r => r.userId !== profile.id);
      const updatedRatings = [...filteredRatings, newRatingEntry];

      // Calculate Averages
      const totalStars = updatedRatings.reduce((sum, r) => sum + r.rating, 0);
      const avgStars = Math.round((totalStars / updatedRatings.length) * 10) / 10;

      const totalFeedback = updatedRatings.reduce((sum, r) => sum + (r.feedbackScore || 85), 0);
      const avgFeedback = Math.round(totalFeedback / updatedRatings.length);

      await updateKDPresentation(presentation.id, {
        ratings: updatedRatings,
        rating: avgStars,
        feedbackScore: avgFeedback,
        updatedAt: new Date().toISOString()
      });

      setSaving(false);
      setSubmitSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Failed to save feedback:", err);
      setSaving(false);
      alert(err.message || "Failed to submit feedback.");
    }
  };

  // Rating Distribution for Reviews Tab
  const ratings = presentation.ratings || [];
  const distribution = React.useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= maxScale; i++) counts[i] = 0;
    ratings.forEach(r => {
      const clamped = Math.min(Math.max(Math.round(r.rating), 1), maxScale);
      counts[clamped] = (counts[clamped] || 0) + 1;
    });
    return counts;
  }, [ratings, maxScale]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="kd-feedback-modal-overlay">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-150 overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-5 bg-gradient-to-r from-[#4B5E40] to-[#36452f] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-200 text-[10px] font-black uppercase tracking-wider rounded-md border border-amber-400/30">
                  KD Session Feedback
                </span>
                {sessionEnded ? (
                  <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" /> Session Ended
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-300" /> Pending Completion
                  </span>
                )}
              </div>
              <h2 className="text-base font-black text-white mt-1 line-clamp-1">
                {presentation.topic || "Knowledge Development Presentation"}
              </h2>
              <p className="text-xs text-emerald-100 flex items-center gap-2 mt-0.5">
                <span>Presenter: <strong className="text-white">{presentation.presenterName}</strong></span>
                <span>•</span>
                <span>Date: <strong>{presentation.date}</strong></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            id="btn-close-kd-feedback-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-5 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("submit")}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === "submit"
                ? "bg-white text-[#4B5E40] border-[#4B5E40] shadow-2xs"
                : "text-gray-500 hover:text-gray-800 border-transparent"
            }`}
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            {existingFeedback ? "My Feedback Submission" : "Submit Feedback"}
          </button>

          {(isAdmin || isKDOwner || isPresenter || ratings.length > 0) && (
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
                activeTab === "reviews"
                  ? "bg-white text-[#4B5E40] border-[#4B5E40] shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <BarChart2 className="w-4 h-4 text-[#4B5E40]" />
              Session Feedback Reviews ({ratings.length})
            </button>
          )}
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: SUBMIT FEEDBACK */}
          {activeTab === "submit" && (
            <div className="space-y-5">
              
              {/* WARNING 1: SESSION NOT ENDED */}
              {!sessionEnded && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      Session Pending Completion
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      Feedback opens automatically after the Knowledge Development session has ended ({presentation.date}). Please check back after attending the session.
                    </p>
                  </div>
                </div>
              )}

              {/* WARNING 2: NOT ATTENDED */}
              {sessionEnded && !userAttended && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide">
                      Attendee Verification Required
                    </h4>
                    <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                      Only verified attendees who checked in to this session can submit feedback. If you attended but checked in under a different ID, please contact the KD Microservice Owner.
                    </p>
                  </div>
                </div>
              )}

              {/* SUCCESS STATE */}
              {submitSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                    Feedback Successfully Submitted!
                  </h3>
                  <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
                    Thank you for supporting presenter growth and quality standards at Bincom Dev Center.
                  </p>
                  <button
                    onClick={() => setActiveTab("reviews")}
                    className="px-4 py-2 bg-[#4B5E40] text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-[#3b4b32] transition cursor-pointer"
                  >
                    View All Session Reviews
                  </button>
                </div>
              ) : (
                /* FEEDBACK FORM OR EXISTING VIEW */
                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* EXISTING SUBMISSION BANNER */}
                  {existingFeedback && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">
                            You previously submitted feedback for this session
                          </p>
                          <p className="text-[10px] text-emerald-700">
                            Submitted on {new Date(existingFeedback.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg">
                        Update Submission Below
                      </span>
                    </div>
                  )}

                  {/* ATTENDANCE STATUS BADGE */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-xs font-extrabold text-gray-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#4B5E40]" /> Attendee Verification
                    </span>
                    {userAttended ? (
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Attendance Verified
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Unverified
                      </span>
                    )}
                  </div>

                  {/* 1. STAR RATING CONTROL */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-gray-800 tracking-wider">
                      Overall Session Rating (1 to {maxScale} Stars) *
                    </label>
                    <div className="flex items-center gap-2 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60">
                      {Array.from({ length: maxScale }, (_, i) => i + 1).map((star) => (
                        <button
                          key={star}
                          type="button"
                          disabled={!sessionEnded || !userAttended}
                          onClick={() => setRatingStars(star)}
                          className="p-1 transition-all hover:scale-125 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Star className={`w-8 h-8 ${star <= ratingStars ? "text-amber-500 fill-amber-400 drop-shadow-2xs" : "text-gray-300"}`} />
                        </button>
                      ))}
                      <div className="ml-auto text-right">
                        <span className="text-sm font-black text-amber-900">{ratingStars} / {maxScale}</span>
                        <p className="text-[10px] text-amber-700 font-semibold">
                          {ratingStars === maxScale ? "Exceptional" : ratingStars >= maxScale - 1 ? "Great Session" : ratingStars >= 3 ? "Satisfactory" : "Needs Improvement"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. FEEDBACK SCORE SLIDER (0-100%) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black uppercase text-gray-800 tracking-wider">
                        Domain & Delivery Feedback Score (0 - 100%)
                      </label>
                      <span className="text-xs font-black px-2.5 py-0.5 bg-[#4B5E40]/10 text-[#4B5E40] rounded-full">
                        {feedbackScore}% Score
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      disabled={!sessionEnded || !userAttended}
                      value={feedbackScore}
                      onChange={(e) => setFeedbackScore(parseInt(e.target.value) || 0)}
                      className="w-full accent-[#4B5E40] cursor-pointer disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium px-1">
                      <span>50% Poor</span>
                      <span>75% Good</span>
                      <span>90% Excellent</span>
                      <span>100% Outstanding</span>
                    </div>
                  </div>

                  {/* 3. WRITTEN COMMENTS */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
                      Optional Written Feedback & Comments
                    </label>
                    <textarea
                      rows={3}
                      disabled={!sessionEnded || !userAttended}
                      placeholder="Share constructive insights on content clarity, technical depth, slide design, Q&A engagement, or speech..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-2xl focus:ring-2 focus:ring-[#4B5E40] focus:border-transparent font-medium text-gray-800 disabled:bg-gray-100 disabled:opacity-60"
                    />
                  </div>

                  {/* 4. ANONYMOUS CHECKBOX */}
                  {allowAnonymous && (
                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-gray-600 shrink-0" />
                        <div>
                          <label htmlFor="chk-anonymous" className="text-xs font-extrabold text-gray-800 cursor-pointer">
                            Submit Feedback Anonymously
                          </label>
                          <p className="text-[10px] text-gray-500">
                            Your name will be hidden from the presenter and other attendees.
                          </p>
                        </div>
                      </div>
                      <input
                        id="chk-anonymous"
                        type="checkbox"
                        disabled={!sessionEnded || !userAttended}
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="w-4 h-4 accent-[#4B5E40] rounded-md cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  )}

                  {/* FORM ACTIONS */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !sessionEnded || !userAttended}
                      className="px-5 py-2.5 bg-[#4B5E40] hover:bg-[#384730] text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      id="btn-submit-kd-feedback"
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Star className="w-4 h-4 fill-white text-amber-300" />
                      )}
                      {existingFeedback ? "Update Feedback" : "Submit Session Feedback"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: REVIEWS & ANALYTICS */}
          {activeTab === "reviews" && (
            <div className="space-y-6">
              
              {/* SESSION FEEDBACK SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 text-center">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">
                    Average Rating
                  </span>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
                    <span className="text-2xl font-black text-gray-900">
                      {presentation.rating ? presentation.rating.toFixed(1) : "N/A"}
                    </span>
                    <span className="text-xs text-gray-500 font-bold">/ {maxScale}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                    Feedback Score
                  </span>
                  <span className="text-2xl font-black text-emerald-900 mt-1 block">
                    {presentation.feedbackScore ? `${presentation.feedbackScore}%` : "N/A"}
                  </span>
                </div>

                <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 text-center">
                  <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider block">
                    Total Submissions
                  </span>
                  <span className="text-2xl font-black text-blue-900 mt-1 block">
                    {ratings.length}
                  </span>
                </div>
              </div>

              {/* RATING DISTRIBUTION CHART */}
              {ratings.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                  <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
                    Rating Distribution
                  </h4>
                  {Array.from({ length: maxScale }, (_, i) => maxScale - i).map((star) => {
                    const count = distribution[star] || 0;
                    const pct = ratings.length > 0 ? Math.round((count / ratings.length) * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-12 font-extrabold text-gray-700 flex items-center gap-1">
                          {star} <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-bold text-gray-500 text-[11px]">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* REVIEWS LIST */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#4B5E40]" />
                  Attendee Feedback Submissions ({ratings.length})
                </h4>

                {ratings.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-500">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-600">No feedback entries recorded yet.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Attendees can submit feedback once the session ends.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {ratings.map((rev, idx) => (
                      <div key={rev.userId || idx} className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-[#4B5E40]/10 text-[#4B5E40] rounded-full flex items-center justify-center font-bold text-xs">
                              {rev.isAnonymous ? <EyeOff className="w-3.5 h-3.5" /> : (rev.userName?.[0] || "U")}
                            </div>
                            <div>
                              <p className="text-xs font-black text-gray-900">
                                {rev.isAnonymous ? "Anonymous Attendee" : rev.userName}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(rev.createdAt).toLocaleDateString()} at {new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                            <span className="text-xs font-black text-amber-900">{rev.rating} / {maxScale}</span>
                            {rev.feedbackScore && (
                              <span className="text-[10px] font-bold text-emerald-700 ml-1">
                                ({rev.feedbackScore}%)
                              </span>
                            )}
                          </div>
                        </div>

                        {rev.feedbackText ? (
                          <p className="text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed italic">
                            "{rev.feedbackText}"
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400 italic">No written comment provided.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
