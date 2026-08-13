import React, { useState } from "react";
import { Profile } from "../types";
import { resetStudentForOnboarding, resetStudentForAssessment } from "../firebaseService";
import { ShieldAlert, Lock, AlertCircle, RefreshCw, FileEdit, CheckSquare, Users } from "lucide-react";

interface LockedDashboardNoticeProps {
  profile: Profile;
  onProfileUpdated?: () => void;
}

export const LockedDashboardNotice: React.FC<LockedDashboardNoticeProps> = ({
  profile,
  onProfileUpdated,
}) => {
  const [loadingAction, setLoadingAction] = useState<"onboarding" | "assessment" | null>(null);

  const handleRefillOnboarding = async () => {
    setLoadingAction("onboarding");
    try {
      await resetStudentForOnboarding(profile.id);
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (err) {
      console.error("Failed to reset onboarding state:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRetakeAssessment = async () => {
    setLoadingAction("assessment");
    try {
      await resetStudentForAssessment(profile.id);
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (err) {
      console.error("Failed to reset assessment state:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      className="max-w-2xl mx-auto my-6 p-6 sm:p-8 bg-white border border-rose-200 rounded-2xl shadow-xl space-y-6 animate-fade-in font-sans"
      id="locked-dashboard-container"
    >
      {/* Immediate Notification Header Banner */}
      <div className="flex items-start gap-4 border-b border-rose-100 pb-5">
        <div className="p-3.5 bg-rose-100 text-rose-700 rounded-2xl shrink-0 shadow-2xs">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Dashboard Access Locked
            </h2>
            <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black text-[10px] uppercase rounded-full tracking-wider animate-pulse">
              ACTION REQUIRED
            </span>
          </div>
          <p className="text-xs text-rose-700 font-medium leading-relaxed">
            Your dashboard has been locked by a mentor or admin. Please review the reason below and select an option to update your placement or retake your assessment.
          </p>
        </div>
      </div>

      {/* Mandatory Reason Box */}
      <div className="bg-rose-50/90 border border-rose-200 p-4.5 rounded-xl space-y-2.5">
        <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Reason for Dashboard Lock:</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-150 shadow-2xs">
          <p className="text-sm text-gray-900 font-bold leading-relaxed">
            "{profile.lockReason || "Dashboard locked pending knowledge track placement or validation correction."}"
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-800 font-mono pt-1">
          <span>Locked By: <strong className="text-rose-950">{profile.lockedBy || "Tech Mentor"}</strong></span>
          <span>Date: <strong className="text-rose-950">{profile.lockedAt ? new Date(profile.lockedAt).toLocaleString() : "Recently"}</strong></span>
        </div>
      </div>

      {/* Advisory Notice to Confirm with Team Lead */}
      <div className="bg-blue-50/90 border border-blue-200 p-4 rounded-xl space-y-2 text-xs text-blue-950">
        <div className="flex items-center gap-2 font-black text-blue-900 text-xs uppercase tracking-wider">
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Advisory Notice: Confirm Knowledge Track</span>
        </div>
        <p className="text-xs font-semibold leading-relaxed text-blue-900">
          ⚠️ Please confirm your assigned knowledge track with your <strong>Team Lead</strong> or <strong>Tech Mentor</strong> before retaking your assessment or refilling your onboarding information to ensure correct placement and avoid recurring dashboard locks.
        </p>
      </div>

      {/* Action Options */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">
          Select Correction Method:
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option 1: Refill Onboarding Form */}
          <button
            type="button"
            id="auth-refill-onboarding-btn"
            onClick={handleRefillOnboarding}
            disabled={loadingAction !== null}
            className="p-4 bg-white hover:bg-emerald-50/60 border-2 border-emerald-200 hover:border-emerald-400 rounded-xl cursor-pointer text-left transition space-y-2 group shadow-2xs disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                <FileEdit className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Update Track & Bio
              </span>
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-gray-900 group-hover:text-emerald-950">
                1. Refill Onboarding Form
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                Update your selected track, experience level, and profiling information.
              </p>
            </div>
            {loadingAction === "onboarding" && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold pt-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Redirecting to Onboarding...</span>
              </div>
            )}
          </button>

          {/* Option 2: Retake Assessment */}
          <button
            type="button"
            id="auth-retake-assessment-btn"
            onClick={handleRetakeAssessment}
            disabled={loadingAction !== null}
            className="p-4 bg-white hover:bg-blue-50/60 border-2 border-blue-200 hover:border-blue-400 rounded-xl cursor-pointer text-left transition space-y-2 group shadow-2xs disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                <CheckSquare className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Knowledge Test
              </span>
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-gray-900 group-hover:text-blue-950">
                2. Retake Track Assessment
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                Retake the technical assessment for your knowledge track to verify proficiency.
              </p>
            </div>
            {loadingAction === "assessment" && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold pt-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Redirecting to Assessment...</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Footer Refresh Note */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
          <span>Real-time status updates enabled</span>
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] rounded-lg cursor-pointer transition flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh Page</span>
        </button>
      </div>
    </div>
  );
};
