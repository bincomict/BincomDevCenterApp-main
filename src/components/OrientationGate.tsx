import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { ShieldCheck, LayoutDashboard } from "lucide-react";
import { clearOrientation } from "../firebaseService";

interface OrientationGateProps {
  profile: Profile;
  onOrientationCleared: (updatedProfile: Profile) => void;
}

export default function OrientationGate({ profile, onOrientationCleared }: OrientationGateProps) {
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleProceed = async () => {
    setIsClearing(true);

    try {
      const updatedProfile = await clearOrientation(profile.id);
      onOrientationCleared(updatedProfile);
    } catch (err) {
      console.error(err);
      alert("Orientation processing failed.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-8 p-1 px-4 sm:px-0" id="orientation-gate-wrapper">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-center" id="orientation-gate-card">
        
        {/* Header Block */}
        <div className="bg-[#4B5E40] p-6 text-white text-center">
          <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Workspace Clearance
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-sans">Welcome to Bincom Dev Center</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-md mx-auto">
            Your profile is ready. You can now access your student workspace, track curriculum, and attendance portal.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 text-left text-xs text-gray-700 space-y-2">
            <p className="font-semibold text-[#4B5E40]">Account Ready:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 text-[11.5px]">
              <li>Track assigned: <strong>{profile.track || "General Tech"}</strong></li>
              <li>Attendance & daily standup meetings activated</li>
              <li>Projects, assessments & microservices modules ready</li>
            </ul>
          </div>

          <button
            id="orientation-complete-dashboard-btn"
            onClick={handleProceed}
            disabled={isClearing}
            className="w-full py-3 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-xs rounded-xl shadow-sm transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
          >
            <LayoutDashboard className="w-4 h-4" /> 
            {isClearing ? "Opening Workspace..." : "Proceed to Student Workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}

