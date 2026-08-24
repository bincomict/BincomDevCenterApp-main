import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { submitOnboarding } from "../firebaseService";
import { getCleanTrackName } from "../utils/trackUtils";

interface OnboardingFormProps {
  profile: Profile;
  onUpdateSuccess: (updated: Profile) => void;
  onNavigateToAssessment: () => void;
  onboardingSubmissions?: any[];
}

// Convert radio track options to backend technical tracks for assessment matching
const mapTrackToBackendTrack = (optionValue: string): string => {
  return optionValue;
};

export default function OnboardingForm({ 
  profile, 
  onUpdateSuccess, 
  onNavigateToAssessment,
  onboardingSubmissions = [] 
}: OnboardingFormProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const [fullName, setFullName] = useState(profile.fullName || "");
  const [education, setEducation] = useState(profile.education || "");
  const [occupation, setOccupation] = useState(profile.occupation || "");
  const [experience, setExperience] = useState(profile.techExperience || "");
  const [track, setTrack] = useState(getCleanTrackName(profile.track) || "");
  const [learningLevel, setLearningLevel] = useState(profile.learningLevel || "");
  const [prevCourse, setPrevCourse] = useState(
    profile.previousCourseCompleted !== undefined 
      ? (profile.previousCourseCompleted ? "Yes" : "No") 
      : ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const triggerError = (msg: string) => {
    setError(msg);
    setLoading(false);
    setTimeout(() => {
      const errorEl = document.getElementById("onboard-error-log");
      if (errorEl) {
        errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        document.getElementById("onboarding-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      triggerError("Please fill in your Full Name.");
      return;
    }
    if (!education) {
      triggerError("Please select your highest level of education.");
      return;
    }
    if (!occupation) {
      triggerError("Please select your current occupation & role.");
      return;
    }
    if (!experience) {
      triggerError("Please select your years of experience in tech.");
      return;
    }
    if (!track) {
      triggerError("Please select your desired knowledge track.");
      return;
    }
    if (!learningLevel) {
      triggerError("Please select your learning level.");
      return;
    }
    if (!prevCourse) {
      triggerError("Please declare whether you completed a previous course.");
      return;
    }

    const mappedBackendTrack = mapTrackToBackendTrack(track);

    try {
      const updatedProfile = await submitOnboarding(profile.id, {
        fullName: fullName,
        education: education,
        occupation: occupation,
        techExperience: experience,
        track: mappedBackendTrack,
        learningLevel: learningLevel,
        previousCourseCompleted: prevCourse === "Yes"
      });

      setSuccess("Onboarding parameters successfully matched!");
      
      setTimeout(() => {
        onUpdateSuccess(updatedProfile);
      }, 150);
    } catch (err: any) {
      console.error(err);
      triggerError(err.message || "An error occurred while saving your onboarding details.");
    } finally {
      setLoading(false);
    }
  };

  const TRACKS_OPTIONS = [
    "PMO emigr8",
    "PMO bincom dev center",
    "PMO bincom global/bincom ict",
    "Cybersecurity",
    "PHP/Backend",
    "Infrastructure/DevOps",
    "Graphics/UI/UX Design",
    "Digital Marketing",
    "Python/Data Science",
    "Mobile App / Frontend Development",
    "C#",
    "Proservices",
    "eMigr8 AI"
  ];

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
    "Global Techie 3"
  ];

  return (
    <>
    <div className="max-w-[620px] mx-auto my-6 bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden" id="onboarding-form-card">
      
      {/* Header section consistent with visual layouts */}
      <div className="p-6 pb-4 text-center border-b border-gray-100" id="onboarding-form-header">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight" id="onboarding-title">
          Onboarding Form
        </h1>
        <p className="text-[11px] text-gray-400 mt-1 font-medium leading-relaxed" id="onboarding-subtitle">
          Please complete the following information to begin your journey with Bincom Dev Center
        </p>
      </div>

      <div className="p-6 sm:p-8 pt-4">
        {error && (
          <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-lg mb-5 border border-rose-100/50 font-medium" id="onboard-error-log">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-[#4B5E40]/10 text-[#4B5E40] text-xs rounded-lg mb-5 border border-[#4B5E40]/10 font-bold" id="onboard-success-log">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" id="onboarding-aligned-form">
          
          {/* SECTION 1: Personal Background */}
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-1.5 mt-2">
              <h2 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                Personal Background
              </h2>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1.5" htmlFor="full-name">
                Full Name <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <input
                id="full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className={`w-full px-3 py-2 text-xs bg-[#EAECE6]/40 rounded border focus:outline-none focus:bg-white text-gray-800 font-medium transition ${
                  attemptedSubmit && !fullName.trim()
                    ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20"
                    : "border-transparent focus:border-[#4B5E40]"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1.5" htmlFor="education-level">
                Highest Level of Education <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <select
                id="education-level"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className={`w-full px-3 py-2 text-xs bg-[#EAECE6]/40 rounded border focus:outline-none focus:bg-white text-gray-700 font-medium transition cursor-pointer ${
                  attemptedSubmit && !education
                    ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20"
                    : "border-transparent focus:border-[#4B5E40]"
                }`}
              >
                <option value="">Select education level</option>
                <option value="High School">High School</option>
                <option value="Associate Degree">Associate Degree</option>
                <option value="Bachelor's Degree">Bachelor's Degree</option>
                <option value="Master's Degree">Master's Degree</option>
                <option value="PhD">PhD</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1.5" htmlFor="occupation-select">
                Current Occupation & Role <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <select
                id="occupation-select"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className={`w-full px-3 py-2 text-xs bg-[#EAECE6]/40 rounded border focus:outline-none focus:bg-white text-gray-700 font-medium transition cursor-pointer ${
                  attemptedSubmit && !occupation
                    ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20"
                    : "border-transparent focus:border-[#4B5E40]"
                }`}
              >
                <option value="">Select occupation</option>
                <option value="Student">Student</option>
                <option value="Employed">Employed</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Unemployed">Unemployed</option>
                <option value="Entrepreneur">Entrepreneur</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1.5" htmlFor="experience-select">
                Years of Experience in Tech <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <select
                id="experience-select"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className={`w-full px-3 py-2 text-xs bg-[#EAECE6]/40 rounded border focus:outline-none focus:bg-white text-gray-700 font-medium transition cursor-pointer ${
                  attemptedSubmit && !experience
                    ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20"
                    : "border-transparent focus:border-[#4B5E40]"
                }`}
              >
                <option value="">Select experience</option>
                <option value="No experience">No experience</option>
                <option value="1-2 years">1-2 years</option>
                <option value="3-5 years">3-5 years</option>
                <option value="5+ years">5+ years</option>
              </select>
            </div>
          </div>

          {/* SECTION 2: Knowledge Track Selection */}
          <div className="space-y-3">
            <div className="border-b border-gray-100 pb-1.5 mt-2">
              <h2 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                Knowledge Track Selection
              </h2>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-gray-500 mb-2">
                Select your desired knowledge track <span className="text-rose-500 font-bold ml-0.5">*</span>
              </span>
              <div 
                className={`space-y-2.5 max-h-56 overflow-y-auto pr-2 p-2 rounded transition ${
                  attemptedSubmit && !track
                    ? "border-2 border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/10"
                    : "border border-transparent"
                }`}
                id="track-radio-group"
              >
                {TRACKS_OPTIONS.map((tOpt) => (
                  <label key={tOpt} className="flex items-center gap-2.5 text-xs text-gray-750 font-medium cursor-pointer py-0.5 select-none hover:text-gray-900 transition">
                    <input
                      type="radio"
                      name="knowledge-track"
                      value={tOpt}
                      checked={track === tOpt}
                      onChange={() => setTrack(tOpt)}
                      className="w-3.5 h-3.5 accent-[#4B5E40]"
                    />
                    {tOpt}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3: Learning Level */}
          <div className="space-y-3">
            <div className="border-b border-gray-100 pb-1.5 mt-2">
              <h2 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                Learning Level
              </h2>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-gray-500 mb-2">
                Select your current level <span className="text-rose-500 font-bold ml-0.5">*</span>
              </span>
              <div 
                className={`space-y-2.5 max-h-64 overflow-y-auto pr-2 p-2 rounded transition ${
                  attemptedSubmit && !learningLevel
                    ? "border-2 border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/10"
                    : "border border-transparent"
                }`}
                id="level-radio-group"
              >
                {LEVELS_OPTIONS.map((lOpt) => (
                  <label key={lOpt} className="flex items-center gap-2.5 text-xs text-gray-750 font-medium cursor-pointer py-0.5 select-none hover:text-gray-900 transition">
                    <input
                      type="radio"
                      name="learning-level"
                      value={lOpt}
                      checked={learningLevel === lOpt}
                      onChange={() => setLearningLevel(lOpt)}
                      className="w-3.5 h-3.5 accent-[#4B5E40]"
                    />
                    {lOpt}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: Previous Experience */}
          <div className="space-y-3">
            <div className="border-b border-gray-100 pb-1.5 mt-2">
              <h2 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                Previous Experience
              </h2>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-gray-500 mb-2.5">
                Have you completed any previous course in your desired track? <span className="text-rose-500 font-bold ml-0.5">*</span>
              </span>
              <div 
                className={`flex flex-col gap-2 p-2 rounded transition ${
                  attemptedSubmit && !prevCourse
                    ? "border-2 border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/10"
                    : "border border-transparent"
                }`}
                id="prev-course-radio-group"
              >
                {["Yes", "No"].map((option) => (
                  <label key={option} className="flex items-center gap-2.5 text-xs text-gray-750 font-medium cursor-pointer select-none hover:text-gray-900">
                    <input
                      type="radio"
                      name="previous-course"
                      value={option}
                      checked={prevCourse === option}
                      onChange={() => setPrevCourse(option)}
                      className="w-3.5 h-3.5 accent-[#4B5E40]"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              id="onboard-submit-form-btn"
              type="submit"
              className="w-full py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white font-bold text-xs rounded transition uppercase tracking-wider cursor-pointer text-center"
            >
              {loading ? "Saving Credentials..." : "Submit"}
            </button>
          </div>

        </form>
      </div>
    </div>

      {/* PREVIOUS SUBMISSIONS FOR AUDIT */}
      {onboardingSubmissions.length > 0 && (
        <div className="max-w-[620px] mx-auto my-6 bg-white rounded-xl shadow-xs border border-gray-100 p-6 space-y-4 animate-fade-in" id="user-onboarding-history">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Onboarding Submission History
            </h3>
            <p className="text-[10px] text-gray-400 font-medium">
              Your historical onboarding submissions are archived here for audit purposes.
            </p>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {onboardingSubmissions
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((sub, idx) => (
                <div key={sub.id || idx} className="p-3 bg-gray-50 rounded-lg border border-gray-150 text-[11px] space-y-1.5 font-medium text-gray-650">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                    <span>Submission #{onboardingSubmissions.length - idx}</span>
                    <span>{sub.timestamp ? new Date(sub.timestamp).toLocaleString() : ""}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Track:</span>
                      <span className="font-extrabold text-[#4B5E40]">{sub.track}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Learning Level:</span>
                      <span className="font-bold text-gray-800">{sub.learningLevel}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Education:</span>
                      <span className="text-gray-700">{sub.education}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Experience:</span>
                      <span className="text-gray-700">{sub.techExperience}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
