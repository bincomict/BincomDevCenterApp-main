import React, { useState, useEffect } from "react";
import { Profile, AssessmentQuestion } from "../types";
import { TRACK_QUESTIONS, TECH_TRACKS, COMMON_SOFT_SKILLS_QUESTIONS } from "../data/assessmentQuestions";
import { getLongTrackName, getCleanTrackName } from "../utils/trackUtils";
import { resetProfileToOnboarding, submitAssessment, retakeAssessment, clearOrientation } from "../firebaseService";
import { 
  XSquare, 
  CheckCircle2, 
  ArrowLeft, 
  HelpCircle, 
  Award,
  ArrowRight
} from "lucide-react";

interface RandomizedQuestion extends AssessmentQuestion {
  displayOptions: {
    text: string;
    originalIndex: number;
  }[];
}

const shuffleOptions = (qList: AssessmentQuestion[]): RandomizedQuestion[] => {
  return qList.map((q) => {
    const displayOptions = q.options.map((opt, index) => ({
      text: opt,
      originalIndex: index
    }));
    for (let i = displayOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = displayOptions[i];
      displayOptions[i] = displayOptions[j];
      displayOptions[j] = temp;
    }
    return {
      ...q,
      displayOptions
    };
  });
};

interface TrackAssessmentProps {
  profile: Profile;
  onAssessmentCompleted: (updatedProfile: Profile) => void;
  onPivotTrack: (updatedProfile: Profile) => void;
  assessmentAttempts?: any[];
}

export default function TrackAssessment({ 
  profile, 
  onAssessmentCompleted, 
  onPivotTrack,
  assessmentAttempts = []
}: TrackAssessmentProps) {
  const dbTrackName = profile.track || "Frontend Development (React, Vue, HTML, CSS)";
  const longTrack = getLongTrackName(dbTrackName);
  const cleanTrack = getCleanTrackName(dbTrackName);

  // Smart normalized track mapping resolving to track questions safely without cross-track leakage
  let resolvedKey = longTrack;
  if (!TRACK_QUESTIONS[resolvedKey]) {
    const cleanLower = cleanTrack.toLowerCase();
    const longLower = longTrack.toLowerCase();

    if (cleanLower.includes("pmo") || longLower.includes("project management")) {
      resolvedKey = "Project Management (Tech)";
    } else if (cleanLower.includes("proservice") || longLower.includes("proservice")) {
      resolvedKey = "Proservices";
    } else if (cleanLower.includes("frontend") || cleanLower.includes("mobile") || longLower.includes("frontend")) {
      resolvedKey = "Frontend Development (React, Vue, HTML, CSS)";
    } else if (cleanLower.includes("php") || cleanLower.includes("laravel") || longLower.includes("php")) {
      resolvedKey = "Backend Development (PHP / Laravel)";
    } else if (cleanLower.includes("python") || longLower.includes("python")) {
      resolvedKey = "Backend Development (Python / Django)";
    } else if (cleanLower.includes("node") || longLower.includes("node")) {
      resolvedKey = "Backend Development (Node.js / Express)";
    } else if (cleanLower.includes("cyber") || longLower.includes("cyber")) {
      resolvedKey = "Cybersecurity";
    } else if (cleanLower.includes("devops") || cleanLower.includes("infrastructure") || longLower.includes("devops")) {
      resolvedKey = "DevOps & Cloud Engineering";
    } else if (cleanLower.includes("design") || cleanLower.includes("ui") || cleanLower.includes("ux") || longLower.includes("design")) {
      resolvedKey = "UI/UX Design";
    } else if (cleanLower.includes("qa") || cleanLower.includes("testing") || longLower.includes("qa")) {
      resolvedKey = "QA Testing & Automation";
    } else if (cleanLower.includes("marketing") || longLower.includes("marketing")) {
      resolvedKey = "Digital Marketing";
    } else if (cleanLower.includes("c#") || longLower.includes("c-sharp")) {
      resolvedKey = "C# Backend Development";
    }
  }

  // Strictly assign questions mapping to actual track - no random cross-track leakage. If no questions exist, we fall back to an empty array.
  const rawTrackQuestions: AssessmentQuestion[] = TRACK_QUESTIONS[resolvedKey] || [];
  // Filter out any track-specific questions that are marked as soft skills (if any exist) to get pure technical track questions
  const trackTechnicalQuestions = rawTrackQuestions.filter(q => !q.isSoftSkill);
  // Single assessment combines technical and common soft skills questions
  const questions: AssessmentQuestion[] = [...trackTechnicalQuestions, ...COMMON_SOFT_SKILLS_QUESTIONS];

  const userAttempts = (assessmentAttempts || []).filter(att => att.userId === profile.id);
  const latestAttempt = userAttempts.length > 0 
    ? [...userAttempts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    : null;

  // Selected option indices
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [randomizedQuestions, setRandomizedQuestions] = useState<RandomizedQuestion[]>(() => {
    return shuffleOptions(questions);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isClearingOrientation, setIsClearingOrientation] = useState(false);

  useEffect(() => {
    setRandomizedQuestions(shuffleOptions(questions));
  }, [resolvedKey, profile.status, profile.score]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [profile.status, profile.score]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleBackToOnboarding = async () => {
    try {
      const updatedProfile = await resetProfileToOnboarding(profile.id);
      onPivotTrack(updatedProfile);
    } catch (err) {
      console.error(err);
      setError("An error occurred while resetting.");
    }
  };

  const handleSubmitScore = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert(`Please answer all questions before submitting. You have answered ${Object.keys(answers).length} out of ${questions.length} questions.`);
      return;
    }

    setIsSubmitting(true);
    let technicalCorrect = 0;
    let technicalTotal = 0;
    let softSkillsCorrect = 0;
    let softSkillsTotal = 0;

    questions.forEach((q) => {
      const isCorrect = answers[q.id] === q.correctAnswerIndex;
      if (q.isSoftSkill) {
        softSkillsTotal++;
        if (isCorrect) softSkillsCorrect++;
      } else {
        technicalTotal++;
        if (isCorrect) technicalCorrect++;
      }
    });

    const technicalScore = technicalTotal > 0 ? Math.round((technicalCorrect / technicalTotal) * 100) : 0;
    const softSkillsScore = softSkillsTotal > 0 ? Math.round((softSkillsCorrect / softSkillsTotal) * 100) : 0;

    const overallCorrectCount = technicalCorrect + softSkillsCorrect;
    const overallTotal = technicalTotal + softSkillsTotal;
    const scorePercentage = Math.round((overallCorrectCount / overallTotal) * 100);
    const calculatedStatus = scorePercentage >= 70 ? "assessment_passed" : "assessment_failed";

    try {
      const updatedProfile = await submitAssessment(
        profile.id,
        scorePercentage,
        calculatedStatus,
        answers,
        technicalScore,
        softSkillsScore
      );
      onAssessmentCompleted(updatedProfile);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Could not process assessment scores.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = async () => {
    try {
      const updatedProfile = await retakeAssessment(profile.id);
      setAnswers({});
      onPivotTrack(updatedProfile);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProceedToDashboard = async () => {
    setIsClearingOrientation(true);

    try {
      const updatedProfile = await clearOrientation(profile.id);
      onAssessmentCompleted(updatedProfile);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to proceed to dashboard.");
    } finally {
      setIsClearingOrientation(false);
    }
  };

  // Check state directly
  const hasPassed = profile.status === "assessment_passed" || (profile.score !== undefined && profile.score >= 70);
  const showReviewUi = profile.status === "assessment_failed" && profile.score !== undefined;

  return (
    <div className="max-w-2xl mx-auto my-6 px-4 sm:px-0" id="assessment-main-container">
      
      {/* 1. RENDER FAIL VIEW (IMAGE 1 SPEC) */}
      {showReviewUi && (
        <div className="flex items-center justify-center min-h-[450px]">
          <div className="bg-white rounded-xl border border-rose-100 p-8 sm:p-10 shadow-xs max-w-lg w-full text-center space-y-6" id="fail-view-card">
            
            {/* Red circle Cross icon matches mockup perfectly */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border border-rose-200 bg-rose-50 flex items-center justify-center">
                <span className="text-rose-500 font-bold text-xl">✕</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-[20px] font-bold text-gray-800 tracking-tight">
                Assessment Not Passed
              </h2>
              <p className="text-[12.5px] text-gray-500 leading-relaxed font-medium">
                Sorry, you did not meet the minimum requirements for the <strong className="text-gray-800">{cleanTrack}</strong> track.
              </p>

              <div className="py-2.5 bg-rose-50/50 rounded-xl border border-rose-100/50 p-4 max-w-sm mx-auto grid grid-cols-3 gap-2 text-center" id="score-breakdown-box">
                <div>
                  <span className="text-[9px] text-rose-800/65 font-extrabold block uppercase tracking-wider">Overall</span>
                  <span className="font-black text-rose-600 text-lg">{profile.score !== undefined ? `${profile.score}%` : "0%"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-rose-800/65 font-extrabold block uppercase tracking-wider">Technical</span>
                  <span className="font-semibold text-gray-700 text-sm">
                    {latestAttempt && latestAttempt.technicalScore !== undefined && latestAttempt.technicalScore !== null ? `${latestAttempt.technicalScore}%` : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-rose-800/65 font-extrabold block uppercase tracking-wider">Soft Skills</span>
                  <span className="font-semibold text-gray-700 text-sm">
                    {latestAttempt && latestAttempt.softSkillsScore !== undefined && latestAttempt.softSkillsScore !== null ? `${latestAttempt.softSkillsScore}%` : "N/A"}
                  </span>
                </div>
              </div>

              <p className="text-[12px] text-gray-400 font-semibold italic pt-2">
                We recommend you do one of the following:
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* Button A: Retake Assessment */}
              <button
                id="fail-action-retake-btn"
                onClick={handleRetake}
                className="w-full py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white font-bold text-xs rounded transition uppercase tracking-wider cursor-pointer"
              >
                Retake Assessment
              </button>

              {/* Button B: Pivot to New Knowledge Track */}
              <button
                id="fail-action-onboarding-btn"
                onClick={handleBackToOnboarding}
                className="w-full py-2.5 bg-[#F4F5F2] hover:bg-[#EAECE6] text-gray-700 font-bold text-xs rounded border border-gray-200 transition uppercase tracking-wider cursor-pointer"
              >
                Choose a New Knowledge Track
              </button>
            </div>

            {/* Previous Attempts Section */}
            {assessmentAttempts && assessmentAttempts.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100 text-left space-y-3" id="previous-attempts-section">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Previous Attempt History ({assessmentAttempts.length})
                </h4>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {assessmentAttempts
                    .slice()
                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                    .map((attempt) => (
                      <div 
                        key={attempt.id} 
                        className="p-2.5 bg-[#F9FAFB] rounded border border-gray-200 flex justify-between items-center text-[11px]"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-700">{attempt.track ? attempt.track.replace(/\(.*?\)/g, "").trim() : "Track Assessment"}</p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(attempt.timestamp).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded-full font-bold text-[9px] ${
                            attempt.score >= 70 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                              : "bg-rose-50 text-rose-700 border border-rose-150"
                          }`}>
                            Score: {attempt.score}%
                          </span>
                          {attempt.technicalScore !== undefined && attempt.softSkillsScore !== undefined && attempt.technicalScore !== null && attempt.softSkillsScore !== null && (
                            <div className="text-[9px] text-gray-400 mt-0.5 font-mono">
                              Tech: {attempt.technicalScore}% | Soft: {attempt.softSkillsScore}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. RENDER SUCCESS PASS CONGRATS SCREEN */}
      {hasPassed && (
        <div className="space-y-6" id="pass-view-container">
          
          {/* Congrats banner card */}
          <div className="bg-white rounded-xl border border-emerald-100 p-8 sm:p-10 shadow-xs text-center space-y-5" id="congrats-status-card">
            
            {/* Green circle checkmark icon */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-200 flex items-center justify-center">
                <span className="text-xl font-bold">✓</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-[22px] font-extrabold text-gray-800 tracking-tight">
                Congratulations! 🎉
              </h2>
              <p className="text-[12.5px] text-gray-500 font-medium">
                You've passed the <span className="text-emerald-600 font-bold">{cleanTrack}</span> basic assessment.
              </p>
              
              <div className="py-1">
                <span className="inline-block bg-emerald-50 border border-emerald-100 text-emerald-700 font-mono text-sm uppercase px-4 py-1 rounded font-bold">
                  Score: <strong className="text-emerald-600 font-extrabold">{profile.score || 100}%</strong>
                </span>
              </div>

              <div className="py-3 bg-emerald-50/45 rounded-xl border border-emerald-100 p-4 max-w-sm mx-auto grid grid-cols-3 gap-2 text-center" id="score-breakdown-box-pass">
                <div>
                  <span className="text-[9px] text-emerald-800/60 font-extrabold block uppercase tracking-wider">Overall</span>
                  <span className="font-black text-emerald-600 text-base">{profile.score || 100}%</span>
                </div>
                <div>
                  <span className="text-[9px] text-emerald-800/60 font-extrabold block uppercase tracking-wider">Technical</span>
                  <span className="font-semibold text-gray-700 text-sm">
                    {latestAttempt && latestAttempt.technicalScore !== undefined && latestAttempt.technicalScore !== null ? `${latestAttempt.technicalScore}%` : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-emerald-800/60 font-extrabold block uppercase tracking-wider">Soft Skills</span>
                  <span className="font-semibold text-gray-700 text-sm">
                    {latestAttempt && latestAttempt.softSkillsScore !== undefined && latestAttempt.softSkillsScore !== null ? `${latestAttempt.softSkillsScore}%` : "N/A"}
                  </span>
                </div>
              </div>
              
              <p className="text-[12px] text-gray-400 font-medium">
                You have now been placed in the <strong className="text-gray-700">{cleanTrack}</strong> knowledge track.
              </p>
            </div>

            {/* Direct Proceed to Workspace / Dashboard */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <button
                id="onboard-proceed-dashboard-btn"
                onClick={handleProceedToDashboard}
                disabled={isClearingOrientation}
                className="w-full py-3 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-sm transition uppercase tracking-wider cursor-pointer text-center"
              >
                {isClearingOrientation ? "Opening Workspace..." : "Proceed to Dashboard"}
              </button>

              <div className="pt-1 text-center" id="congrats-reopen-onboard-box">
                <button
                  id="reopen-onboarding-btn-pass"
                  type="button"
                  onClick={handleBackToOnboarding}
                  className="text-[11px] text-gray-550 hover:text-[#4B5E40] hover:underline font-bold transition cursor-pointer"
                >
                  ← Update Onboarding Form & Track Selection
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 3. ACTIVE QUIZ SHEETS SCREEN (IMAGE 3 SPEC) */}
      {!showReviewUi && !hasPassed && (
        questions.length === 0 ? (
          <div className="bg-white rounded-xl border border-amber-200 p-8 sm:p-10 shadow-xs text-center space-y-6" id="empty-questions-state">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center">
                <span className="text-amber-500 font-bold text-xl">⚠️</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-[20px] font-bold text-gray-800 tracking-tight">
                No Questions Available
              </h2>
              <p className="text-[12.5px] text-gray-500 leading-relaxed font-semibold">
                We currently do not have assessment questions configured for the <strong className="text-gray-800">{cleanTrack}</strong> track.
              </p>
              <p className="text-[12px] text-gray-400 font-medium">
                Please click below to go back and choose a different track.
              </p>
            </div>
            <div className="pt-2">
              <button
                id="empty-action-onboarding-btn"
                onClick={handleBackToOnboarding}
                className="w-full py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] text-white font-bold text-xs rounded transition uppercase tracking-wider cursor-pointer"
              >
                Choose a New Knowledge Track
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-6 sm:p-8 space-y-6 shadow-2xs" id="active-assessment-sheet">
            
            {/* Top Back navigation - implements direct "also create a navigation, to go back back to onboarding" requested constraint */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <button
                id="assessment-go-back-link"
                onClick={handleBackToOnboarding}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4B5E40] hover:text-[#3d4d34] transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Onboarding Form
              </button>
              <span className="text-[9.5px] font-mono text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-150">
                {questions.length} Q-List Sheet
              </span>
            </div>

            {/* Form Header area matching Image 3 spec exactly */}
            <div className="space-y-1.5" id="assessment-sheet-header">
              <h1 className="text-lg font-bold text-gray-800 tracking-tight" id="assessment-sheet-title">
                Assessment for {cleanTrack}
              </h1>
              <p className="text-[11px] text-gray-400 font-medium" id="assessment-sheet-subtitle">
                Kindly answer these questions so we can place you in the right track
              </p>
            </div>

            {/* Display instructions validation error logs */}
            {error && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-100/50 font-medium">
                {error}
              </div>
            )}

            {/* Questions list styled perfectly after Image 3 */}
            <div className="space-y-6 pt-3" id="assessment-questions-block">
              {randomizedQuestions.map((q, qIndex) => {
                const questionNum = qIndex + 1;
                const isFirstTechnical = qIndex === 0 && !q.isSoftSkill;
                const isFirstSoftSkill = q.isSoftSkill && (qIndex === 0 || !randomizedQuestions[qIndex - 1].isSoftSkill);

                return (
                  <React.Fragment key={q.id}>
                    {isFirstTechnical && (
                      <div className="border-b border-gray-100 pb-2 mb-2" id="technical-section-header">
                        <span className="text-[10px] font-bold text-[#4B5E40] uppercase tracking-wider bg-[#4B5E40]/5 px-2.5 py-1 rounded">
                          Section A: Technical Knowledge Track
                        </span>
                      </div>
                    )}
                    {isFirstSoftSkill && (
                      <div className="border-b border-gray-100 pb-2 mt-6 mb-2 pt-4" id="softskills-section-header">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded">
                          Section B: Professional Soft Skills (Common across tracks)
                        </span>
                      </div>
                    )}
                    <div className="py-4 border-b border-gray-100 last:border-0 animate-fade-in" id={`q-container-${q.id}`}>
                      
                      {/* Question header font weight/tracking */}
                      <div className="space-y-1">
                        <h3 className="font-bold text-gray-800 text-[12.5px] sm:text-[13px] leading-snug">
                          {questionNum}. {q.question}
                        </h3>
                      </div>

                      {/* Options layout centering unfilled circles exactly like mockups */}
                      <div className="mt-3.5 space-y-2">
                        {q.displayOptions.map((opt, oIndex) => {
                          const isSelected = answers[q.id] === opt.originalIndex;
                          return (
                            <button
                              key={oIndex}
                              id={`assessment-option-${q.id}-${oIndex}`}
                              type="button"
                              onClick={() => handleSelectOption(q.id, opt.originalIndex)}
                              className="w-full text-left py-1.5 px-1.5 transition text-xs sm:text-[12.5px] cursor-pointer flex items-center gap-3 hover:text-gray-900 group"
                            >
                              {/* Beautiful radio bullet circle styling */}
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${
                                isSelected 
                                  ? "border-[#4B5E40] bg-[#4B5E40]/10 text-[#4B5E40]" 
                                  : "border-gray-300 bg-white group-hover:border-gray-450"
                              }`}>
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#4B5E40]"></span>
                                )}
                              </span>
                              
                              <span className={`font-semibold ${isSelected ? "text-[#4B5E40]" : "text-gray-600 group-hover:text-gray-800"}`}>
                                <span className="inline-block w-5 text-gray-400 font-mono text-[11px] font-bold uppercase mr-1">{["A", "B", "C", "D"][oIndex]}.</span> {opt.text}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Submit assessment button styled exactly like screenshot */}
            <div className="pt-4 border-t border-gray-100">
              <button
                id="assessment-submit-final-btn"
                type="button"
                onClick={handleSubmitScore}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#4B5E40] hover:bg-[#3d4d34] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded transition uppercase tracking-wider cursor-pointer text-center shadow-xs"
              >
                {isSubmitting ? "Scoring Submissions..." : "Submit Assessment"}
              </button>
            </div>

          </div>
        )
      )}

    </div>
  );
}
