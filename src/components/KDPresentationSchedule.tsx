import React, { useState } from "react";
import { 
  Profile, 
  KDPresentation, 
  KDPresentationStatus,
  KDPresentationComment,
  AttendanceRecord,
  KnowledgeDevelopmentInfo,
  KDLeaderboardConfig,
  defaultKDLeaderboardConfig
} from "../types";
import { 
  createKDPresentation, 
  updateKDPresentation, 
  deleteKDPresentation,
  sendReminder,
  updateKnowledgeDevelopmentInfo
} from "../firebaseService";
import { getLagosDateString, checkIsKDOwner, isAuthorizedForKDTopic } from "../utils/trackUtils";
import KDSessionFeedbackModal from "./KDSessionFeedbackModal";
import KDAggregatedFeedbackView from "./KDAggregatedFeedbackView";
import { 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Lock, 
  Edit3, 
  Plus, 
  Sparkles, 
  RefreshCw, 
  ChevronRight, 
  UserCheck, 
  ShieldCheck, 
  FileText, 
  X, 
  Save, 
  HelpCircle,
  Award,
  CalendarCheck,
  Tag,
  Eye,
  SlidersHorizontal,
  Link2,
  CalendarRange,
  RotateCcw,
  History,
  UserX,
  UserMinus,
  UserPlus,
  Users,
  MessageSquare,
  Send,
  MessageCircle,
  Video,
  ExternalLink,
  Copy,
  Check,
  Star
} from "lucide-react";

export const DEFAULT_KD_PRESENTATIONS: KDPresentation[] = [];

interface KDPresentationScheduleProps {
  profile: Profile;
  presentations?: KDPresentation[];
  meetings?: any[];
  attendance?: AttendanceRecord[];
  kdInfo?: KnowledgeDevelopmentInfo;
  microserviceOwners?: Record<string, string>;
  profiles?: Profile[];
  onStateUpdate?: () => void;
  onJoinMeeting?: (meetingId: string) => void;
  className?: string;
}

export default function KDPresentationSchedule({
  profile,
  presentations = [],
  meetings = [],
  attendance = [],
  kdInfo,
  microserviceOwners = {},
  profiles = [],
  onStateUpdate,
  onJoinMeeting,
  className = ""
}: KDPresentationScheduleProps) {
  // Use state items directly without mock fallback
  const rawList = presentations || [];

  const todayStr = getLagosDateString(new Date());

  // Role Checks
  const isAdmin = profile.role === "admin" || profile.status === "admin";
  const isKDOwner = checkIsKDOwner(profile, microserviceOwners, isAdmin);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeframeFilter, setTimeframeFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  // Modals & Reschedule & Removal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<KDPresentation | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: todayStr,
    newDayOfWeek: "Tuesday",
    reason: "",
    meetingLink: ""
  });

  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  const [showRemovePresenterModal, setShowRemovePresenterModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<KDPresentation | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  // Material Submission Modal States
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [materialsForm, setMaterialsForm] = useState({
    slidesUrl: "",
    summary: "",
    publicArtifactLink: ""
  });
  const [materialsValidationErrors, setMaterialsValidationErrors] = useState<{ slidesUrl?: string; summary?: string }>({});

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentTextMap, setCommentTextMap] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  const [selectedPres, setSelectedPres] = useState<KDPresentation | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // Feedback Modal States
  const [feedbackTargetPres, setFeedbackTargetPres] = useState<KDPresentation | null>(null);
  const [showAggregatedFeedback, setShowAggregatedFeedback] = useState<boolean>(false);

  const currentLeaderboardConfig: KDLeaderboardConfig = kdInfo?.config || defaultKDLeaderboardConfig;

  const handleUpdateFeedbackConfig = async (newConfig: KDLeaderboardConfig) => {
    if (!kdInfo) return;
    const updatedKdInfo = { ...kdInfo, config: newConfig };
    await updateKnowledgeDevelopmentInfo(updatedKdInfo, profile);
    if (onStateUpdate) onStateUpdate();
  };

  // Form state for creating/editing presentation
  const [presForm, setPresForm] = useState<Partial<KDPresentation>>({
    date: todayStr,
    dayOfWeek: "Tuesday",
    topic: "",
    presenterName: "",
    presenterUserId: "",
    assignedMentorName: "",
    assignedMentorUserId: "",
    status: "Awaiting topic submission",
    notes: "",
    meetingLink: `https://meet.jit.si/BincomDevCenter_KD_${todayStr.replace(/-/g, "")}`
  });

  // Check if a meeting linked to date is cancelled or rescheduled in Meeting Module
  const getSyncedPresentation = (item: KDPresentation): KDPresentation => {
    let syncedStatus = item.status;
    let isMeetingSynced = false;
    let resolvedMeetingLink = item.meetingLink || "";

    if (meetings && meetings.length > 0) {
      const linkedMeeting = meetings.find(
        (m) =>
          m.id === item.linkedMeetingId ||
          (m.meetingDates && m.meetingDates.includes(item.date) && (m.type === "knowledge" || m.type === "Knowledge Track"))
      );

      if (linkedMeeting) {
        if (linkedMeeting.status === "Cancelled" || linkedMeeting.status === "Inactive") {
          syncedStatus = "Cancelled";
          isMeetingSynced = true;
        } else if (linkedMeeting.status === "Rescheduled") {
          syncedStatus = "Rescheduled";
          isMeetingSynced = true;
        }
        if (linkedMeeting.jitsiUrl) {
          resolvedMeetingLink = linkedMeeting.jitsiUrl;
        }
      }
    }

    if (!resolvedMeetingLink) {
      resolvedMeetingLink = `https://meet.jit.si/BincomDevCenter_KD_${item.date.replace(/-/g, "")}`;
    }

    return {
      ...item,
      status: syncedStatus,
      meetingLink: resolvedMeetingLink,
      notes: isMeetingSynced ? `${item.notes || ""} [Synced from Meeting Module]` : item.notes
    };
  };

  const processedList = rawList.map(getSyncedPresentation);

  // Authorized user check for topic visibility (Presenter, Assigned Mentor, Administrator, and Knowledge Development Microservice Owner)
  const isUserAuthorizedForTopic = (p: KDPresentation): boolean => {
    return isAuthorizedForKDTopic(p, profile, microserviceOwners, isAdmin);
  };

  // Helper to check if a presentation topic is approved
  const isTopicApproved = (p: KDPresentation): boolean => {
    return Boolean(p.topic && p.topic.trim() !== "" && (p.status === "Approved" || p.status === "Ready for Presentation" || p.status === "Completed"));
  };

  // Get topic display text and badge state
  const getTopicDisplay = (p: KDPresentation) => {
    const isAuth = isUserAuthorizedForTopic(p);
    const hasTopic = p.topic && p.topic.trim() !== "";

    if (!hasTopic) {
      return {
        text: "Topic Not Yet Submitted",
        isPlaceholder: true,
        type: "not_submitted",
        badge: "Not Submitted"
      };
    }

    if (p.status === "Approved" || p.status === "Ready for Presentation" || p.status === "Completed") {
      return {
        text: p.topic,
        isPlaceholder: false,
        type: "approved",
        badge: p.status === "Ready for Presentation" ? "Ready for Presentation" : "Approved"
      };
    }

    // Status is Pending Review, Awaiting topic submission, Rejected, etc.
    if (isAuth) {
      return {
        text: p.topic,
        isPlaceholder: false,
        type: p.status.toLowerCase().replace(" ", "_"),
        badge: `${p.status} (Visible to Presenter/Mentor/Admin)`
      };
    }

    // Standard User sees "Topic Awaiting Approval"
    return {
      text: "Topic Awaiting Approval",
      isPlaceholder: true,
      type: "awaiting",
      badge: "Awaiting Approval"
    };
  };

  // Helper to compute submission deadline (two weeks / 14 days prior to presentation date)
  const getSubmissionDeadline = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      d.setDate(d.getDate() - 14);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      return `${year}-${month}-${day} (${dayName}) by 09:00 AM WAT`;
    } catch {
      return `${dateStr} (14 days prior) at 09:00 AM WAT`;
    }
  };

  // Helper to resolve presenter user ID from profile list
  const findPresenterUserId = (pName: string, pEmail?: string, pUserId?: string): string | null => {
    if (pUserId) return pUserId;
    if (!profiles || profiles.length === 0) return null;
    if (pEmail) {
      const byEmail = profiles.find(p => p.email && p.email.toLowerCase().trim() === pEmail.toLowerCase().trim());
      if (byEmail) return byEmail.id;
    }
    if (pName) {
      const nameTrim = pName.toLowerCase().trim();
      const byName = profiles.find(p => 
        (p.fullName && p.fullName.toLowerCase().trim() === nameTrim) || 
        (p.username && p.username.toLowerCase().trim() === nameTrim)
      );
      if (byName) return byName.id;
    }
    return null;
  };

  // Check if user is eligible to present (eligible only from 2nd month after joining)
  const checkPresenterEligibility = (prof: Profile, presentationDateStr: string) => {
    if (!prof || !prof.joinedAt || !presentationDateStr) {
      return { eligible: true, reason: "" };
    }
    const joinDate = new Date(prof.joinedAt);
    if (isNaN(joinDate.getTime())) {
      return { eligible: true, reason: "" };
    }

    const presDate = new Date(presentationDateStr + "T00:00:00");
    if (isNaN(presDate.getTime())) {
      return { eligible: true, reason: "" };
    }

    const joinYear = joinDate.getFullYear();
    const joinMonth = joinDate.getMonth(); // 0-indexed
    const presYear = presDate.getFullYear();
    const presMonth = presDate.getMonth(); // 0-indexed

    const monthDiff = (presYear - joinYear) * 12 + (presMonth - joinMonth);

    if (monthDiff < 1) {
      const joinMonthName = joinDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const eligibleDate = new Date(joinYear, joinMonth + 1, 1);
      const eligibleMonthName = eligibleDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      return {
        eligible: false,
        reason: `Techie joined in ${joinMonthName} (1st month). Users become eligible to present only from their 2nd month after joining (eligible starting ${eligibleMonthName}).`
      };
    }

    return { eligible: true, reason: "" };
  };

  // Check if presenter is already assigned a presentation in the same month
  const checkSameMonthDuplicate = (presenterUserId: string, presenterName: string, presentationDateStr: string, currentPresId?: string) => {
    if (!presentationDateStr) return { hasDuplicate: false, existingDate: "" };
    const targetMonthKey = presentationDateStr.substring(0, 7); // "YYYY-MM"
    const targetNameNorm = presenterName ? presenterName.toLowerCase().trim() : "";

    const existing = processedList.find((p) => {
      if (currentPresId && p.id === currentPresId) return false;
      if (p.status === "Cancelled" || p.status === "Rejected") return false;
      if (!p.date || p.date.substring(0, 7) !== targetMonthKey) return false;

      const sameId = presenterUserId && p.presenterUserId && p.presenterUserId === presenterUserId;
      const sameName = targetNameNorm !== "" && p.presenterName.toLowerCase().trim() === targetNameNorm;

      return sameId || sameName;
    });

    if (existing) {
      return {
        hasDuplicate: true,
        existingDate: existing.date,
        existingTopic: existing.topic || "KD Session"
      };
    }

    return { hasDuplicate: false, existingDate: "" };
  };

  // Helper to get active presenters assigned to a specific date (excluding cancelled/rejected)
  const getPresentersForDate = (dateStr: string, excludePresId?: string) => {
    if (!dateStr) return [];
    return processedList.filter((p) => {
      if (excludePresId && p.id === excludePresId) return false;
      if (p.status === "Cancelled" || p.status === "Rejected") return false;
      return p.date === dateStr;
    });
  };

  // Effective status calculation (Pending Review status is hidden from non-authorized users)
  const getEffectiveStatus = (p: KDPresentation): string => {
    if (p.status === "Pending Review") {
      const isAuth = isUserAuthorizedForTopic(p);
      if (!isAuth) {
        return "Awaiting topic submission";
      }
    }
    return p.status;
  };

  // Filter list
  const filteredPresentations = processedList.filter((p) => {
    // 1. Timeframe Filter
    if (timeframeFilter === "upcoming" && p.date < todayStr) return false;
    if (timeframeFilter === "past" && p.date >= todayStr) return false;

    // 2. Status Filter
    if (statusFilter !== "all") {
      const effectiveStatus = getEffectiveStatus(p);
      if (effectiveStatus.toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    // 3. Search Filter (topic or presenter name)
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase().trim();
      const nameMatch = p.presenterName.toLowerCase().includes(q);
      const isTopicVisible = isTopicApproved(p) || isUserAuthorizedForTopic(p);
      const topicMatch = (p.topic && isTopicVisible) ? p.topic.toLowerCase().includes(q) : false;
      const mentorMatch = p.assignedMentorName ? p.assignedMentorName.toLowerCase().includes(q) : false;
      if (!nameMatch && !topicMatch && !mentorMatch) return false;
    }

    return true;
  });

  // Sort by date ascending for upcoming, descending for past/all
  const sortedPresentations = [...filteredPresentations].sort((a, b) => {
    if (timeframeFilter === "past") return b.date.localeCompare(a.date);
    return a.date.localeCompare(b.date);
  });

  // Handlers for Admin/Authorized actions
  const handleOpenScheduleModal = (item?: KDPresentation) => {
    if (item) {
      setSelectedPres(item);
      setPresForm({
        ...item,
        meetingLink: item.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${item.date.replace(/-/g, "")}`
      });
    } else {
      setSelectedPres(null);
      setPresForm({
        date: todayStr,
        dayOfWeek: "Tuesday",
        topic: "",
        presenterName: "",
        presenterUserId: "",
        assignedMentorName: "",
        assignedMentorUserId: "",
        status: "Awaiting topic submission",
        notes: "",
        meetingLink: `https://meet.jit.si/BincomDevCenter_KD_${todayStr.replace(/-/g, "")}`
      });
    }
    setActionError("");
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isKDOwner) return;
    if (!presForm.date || !presForm.presenterName) {
      setActionError("Date and Presenter Name are required.");
      return;
    }

    const targetPresenterId = findPresenterUserId(
      presForm.presenterName || "",
      presForm.presenterEmail,
      presForm.presenterUserId
    );

    // 1. VALIDATION: Check Eligibility (Users are eligible from their 2nd month after joining)
    const matchedProfile = profiles.find(p => p.id === targetPresenterId || p.id === presForm.presenterUserId) ||
                           profiles.find(p => (p.fullName && p.fullName.toLowerCase().trim() === presForm.presenterName?.toLowerCase().trim()) || (p.username && p.username.toLowerCase().trim() === presForm.presenterName?.toLowerCase().trim()));

    if (matchedProfile) {
      const eligibility = checkPresenterEligibility(matchedProfile, presForm.date);
      if (!eligibility.eligible) {
        setActionError(`Ineligible Presenter Error: ${presForm.presenterName} cannot be assigned to ${presForm.date}. ${eligibility.reason}`);
        return;
      }
    }

    // 2. VALIDATION: Check Same-Month Duplicate Presentation Slot
    const dupCheck = checkSameMonthDuplicate(
      targetPresenterId || presForm.presenterUserId || "",
      presForm.presenterName,
      presForm.date,
      selectedPres?.id
    );
    if (dupCheck.hasDuplicate) {
      const monthName = new Date(presForm.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
      setActionError(`Duplicate Assignment Error: ${presForm.presenterName} is already assigned a Knowledge Development presentation slot in ${monthName} (on ${dupCheck.existingDate}). Users cannot be assigned more than one presentation within the same month.`);
      return;
    }

    // 3. VALIDATION: Check Maximum Capacity (Max 2 Presenters per Date)
    const activeOnDate = getPresentersForDate(presForm.date, selectedPres?.id);
    if (activeOnDate.length >= 2) {
      const presenterNames = activeOnDate.map(p => p.presenterName).join(" & ");
      setActionError(`Maximum Capacity Reached: The date ${presForm.date} already has 2 assigned presenters (${presenterNames}) and is fully booked. A maximum of two presenters can be assigned to the same KD presentation date.`);
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const calcDay = presForm.dayOfWeek || new Date(presForm.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });

      const isNew = !selectedPres?.id;
      const isDateRescheduled = Boolean(selectedPres?.id && selectedPres.date !== presForm.date);
      const isScheduleChanged = selectedPres?.id && (
        isDateRescheduled ||
        selectedPres.presenterName !== presForm.presenterName ||
        selectedPres.status !== presForm.status ||
        selectedPres.topic !== presForm.topic
      );

      let updatedHistory = selectedPres?.history || [];
      if (selectedPres?.id && isDateRescheduled) {
        const historyEntry = {
          previousDate: selectedPres.date,
          previousDayOfWeek: selectedPres.dayOfWeek || "",
          newDate: presForm.date!,
          newDayOfWeek: calcDay,
          rescheduledAt: new Date().toISOString(),
          rescheduledBy: profile.fullName || profile.username || "Administrator",
          reason: presForm.notes || "Schedule adjusted via Management panel"
        };
        updatedHistory = [...updatedHistory, historyEntry];
      }

      const finalPayload = {
        ...presForm,
        presenterUserId: targetPresenterId || presForm.presenterUserId || "",
        dayOfWeek: calcDay,
        history: updatedHistory,
        status: isDateRescheduled ? "Rescheduled" as const : (presForm.status || "Awaiting topic submission"),
        updatedAt: new Date().toISOString()
      };

      if (selectedPres?.id) {
        await updateKDPresentation(selectedPres.id, finalPayload);
      } else {
        await createKDPresentation(finalPayload);
      }

      // DISPATCH NOTIFICATION TO PRESENTER
      if (targetPresenterId) {
        const presentationTimeStr = "09:00 AM WAT";
        const deadlineStr = getSubmissionDeadline(presForm.date!);
        const requirementsText = `1) Submit presentation topic for mentor review at least 2 weeks prior to presentation date (Deadline: ${deadlineStr} by 09:00 AM WAT); 2) Prepare slides; 3) Prepare two paragraph summary of the topic; 4) Submit link to public artefacts; 5) Submit professional photograph.`;

        let notificationMsg = "";
        if (isNew) {
          notificationMsg = `📢 KD Presentation Assigned: You have been assigned a presentation session on ${presForm.date} (${calcDay}). 🕒 Presentation Time: ${presentationTimeStr}. ⏰ Submission Deadline: ${deadlineStr}. 📋 Requirements: ${requirementsText}`;
        } else if (isDateRescheduled) {
          notificationMsg = `🔔 Presentation Rescheduled: Your assigned presentation "${selectedPres.topic || "KD Session"}" previously scheduled for ${selectedPres.date} has been moved to ${presForm.date} (${calcDay}). 🕒 Presentation Time: ${presentationTimeStr}. ⏰ New Submission Deadline: ${deadlineStr}. 📋 Requirements: ${requirementsText}`;
        } else if (isScheduleChanged) {
          notificationMsg = `🔔 Updated KD Schedule: Your presentation schedule details have been updated for ${presForm.date} (${calcDay}). Status: ${presForm.status || "Awaiting topic submission"}. 🕒 Presentation Time: ${presentationTimeStr}. ⏰ Submission Deadline: ${deadlineStr}. 📋 Requirements: ${requirementsText}`;
        }

        if (notificationMsg) {
          if (isDateRescheduled) {
            const recipients = new Set<string>();
            if (targetPresenterId) recipients.add(targetPresenterId);
            profiles.forEach((p) => {
              if (p.role === "admin" || p.status === "admin") {
                recipients.add(p.id);
              }
            });
            for (const recipientId of Array.from(recipients)) {
              if (recipientId) {
                await sendReminder(recipientId, notificationMsg);
              }
            }
          } else {
            await sendReminder(targetPresenterId, notificationMsg);
          }
        }
      }

      setSaving(false);
      setShowScheduleModal(false);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to save presentation schedule:", err);
      setSaving(false);
      setActionError(err.message || "Failed to save presentation schedule.");
    }
  };

  const handleOpenRescheduleModal = (p: KDPresentation) => {
    if (!isAdmin && !isKDOwner) return;
    setRescheduleTarget(p);
    setRescheduleForm({
      newDate: p.date,
      newDayOfWeek: p.dayOfWeek || "Tuesday",
      reason: "",
      meetingLink: p.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${p.date.replace(/-/g, "")}`
    });
    setActionError("");
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isKDOwner) return;
    if (!rescheduleTarget) return;
    if (!rescheduleForm.newDate) {
      setActionError("Please select a new date for rescheduling.");
      return;
    }

    const targetPresenterId = findPresenterUserId(
      rescheduleTarget.presenterName,
      rescheduleTarget.presenterEmail,
      rescheduleTarget.presenterUserId
    );

    // 1. VALIDATION: Check Eligibility for new date
    const matchedProfile = profiles.find(p => p.id === targetPresenterId || p.id === rescheduleTarget.presenterUserId) ||
                           profiles.find(p => (p.fullName && p.fullName.toLowerCase().trim() === rescheduleTarget.presenterName.toLowerCase().trim()) || (p.username && p.username.toLowerCase().trim() === rescheduleTarget.presenterName.toLowerCase().trim()));

    if (matchedProfile) {
      const eligibility = checkPresenterEligibility(matchedProfile, rescheduleForm.newDate);
      if (!eligibility.eligible) {
        setActionError(`Ineligible Presenter Error: ${rescheduleTarget.presenterName} cannot be rescheduled to ${rescheduleForm.newDate}. ${eligibility.reason}`);
        return;
      }
    }

    // 2. VALIDATION: Check Same-Month Duplicate
    const dupCheck = checkSameMonthDuplicate(
      targetPresenterId || rescheduleTarget.presenterUserId || "",
      rescheduleTarget.presenterName,
      rescheduleForm.newDate,
      rescheduleTarget.id
    );
    if (dupCheck.hasDuplicate) {
      const monthName = new Date(rescheduleForm.newDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
      setActionError(`Duplicate Assignment Error: ${rescheduleTarget.presenterName} is already assigned a presentation slot in ${monthName} (on ${dupCheck.existingDate}). Users cannot be assigned more than one presentation within the same month.`);
      return;
    }

    // 3. VALIDATION: Check Maximum Capacity for new date (Max 2 Presenters per Date)
    const activeOnNewDate = getPresentersForDate(rescheduleForm.newDate, rescheduleTarget.id);
    if (activeOnNewDate.length >= 2) {
      const presenterNames = activeOnNewDate.map(p => p.presenterName).join(" & ");
      setActionError(`Maximum Capacity Reached: The selected date ${rescheduleForm.newDate} is fully booked with 2 assigned presenters (${presenterNames}). A maximum of two presenters can be assigned to the same KD presentation date.`);
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const calcDay = rescheduleForm.newDayOfWeek || new Date(rescheduleForm.newDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });

      const historyEntry = {
        previousDate: rescheduleTarget.date,
        previousDayOfWeek: rescheduleTarget.dayOfWeek || "",
        newDate: rescheduleForm.newDate,
        newDayOfWeek: calcDay,
        rescheduledAt: new Date().toISOString(),
        rescheduledBy: profile.fullName || profile.username || "Administrator",
        reason: rescheduleForm.reason || "Schedule adjusted by Administrator/KD Owner"
      };

      const updatedHistory = [...(rescheduleTarget.history || []), historyEntry];

      const newLink = rescheduleForm.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${rescheduleForm.newDate.replace(/-/g, "")}`;

      await updateKDPresentation(rescheduleTarget.id, {
        date: rescheduleForm.newDate,
        dayOfWeek: calcDay,
        meetingLink: newLink,
        status: "Rescheduled",
        history: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      // DISPATCH NOTIFICATION TO ADMIN AND KD PRESENTER ONLY
      const recipients = new Set<string>();
      if (targetPresenterId) recipients.add(targetPresenterId);
      profiles.forEach((p) => {
        if (p.role === "admin" || p.status === "admin") {
          recipients.add(p.id);
        }
      });

      if (recipients.size > 0) {
        const presentationTimeStr = "09:00 AM WAT";
        const deadlineStr = getSubmissionDeadline(rescheduleForm.newDate);
        const requirementsText = `1) Submit presentation topic for mentor review at least 2 weeks prior to presentation date (Deadline: ${deadlineStr} by 09:00 AM WAT); 2) Prepare slides; 3) Prepare two paragraph summary of the topic; 4) Submit link to public artefacts; 5) Submit professional photograph.`;
        const reasonText = rescheduleForm.reason ? ` Reason: ${rescheduleForm.reason}.` : "";

        const notificationMsg = `🔔 Presentation Rescheduled: Your assigned Knowledge Development presentation "${rescheduleTarget.topic || "KD Session"}" previously scheduled for ${rescheduleTarget.date} (${rescheduleTarget.dayOfWeek || ""}) has been rescheduled to ${rescheduleForm.newDate} (${calcDay}).${reasonText} 🕒 Presentation Time: ${presentationTimeStr}. ⏰ New Submission Deadline: ${deadlineStr}. 📋 Requirements: ${requirementsText}`;

        for (const recipientId of Array.from(recipients)) {
          if (recipientId) {
            await sendReminder(recipientId, notificationMsg);
          }
        }
      }

      setSaving(false);
      setShowRescheduleModal(false);
      setRescheduleTarget(null);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to reschedule presentation:", err);
      setSaving(false);
      setActionError(err.message || "Failed to reschedule presentation.");
    }
  };

  const handleOpenRemovePresenterModal = (p: KDPresentation) => {
    if (!isAdmin && !isKDOwner) return;
    setRemoveTarget(p);
    setRemoveReason("");
    setActionError("");
    setShowRemovePresenterModal(true);
  };

  const handleRemovePresenterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isKDOwner) return;
    if (!removeTarget) return;

    if (!removeReason || removeReason.trim() === "") {
      setActionError("A reason for presenter removal is required.");
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const calcDay = removeTarget.dayOfWeek || new Date(removeTarget.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
      const targetPresenterId = findPresenterUserId(
        removeTarget.presenterName,
        removeTarget.presenterEmail,
        removeTarget.presenterUserId
      );

      const removedPresenterName = removeTarget.presenterName || "Assigned Presenter";
      const cleanReason = removeReason.trim();

      const historyEntry = {
        previousDate: removeTarget.date,
        previousDayOfWeek: removeTarget.dayOfWeek || "",
        newDate: removeTarget.date,
        newDayOfWeek: calcDay,
        rescheduledAt: new Date().toISOString(),
        rescheduledBy: profile.fullName || profile.username || "Administrator",
        reason: `Presenter (${removedPresenterName}) removed: ${cleanReason}`
      };

      const updatedHistory = [...(removeTarget.history || []), historyEntry];

      // Update Firestore document: unassign presenter and reset status to Awaiting topic submission so slot becomes available for reassignment
      await updateKDPresentation(removeTarget.id, {
        presenterUserId: "",
        presenterName: "",
        presenterEmail: "",
        topic: "",
        status: "Awaiting topic submission",
        history: updatedHistory,
        notes: removeTarget.notes ? `${removeTarget.notes} [Presenter ${removedPresenterName} removed: ${cleanReason}]` : `[Presenter ${removedPresenterName} removed: ${cleanReason}]`,
        updatedAt: new Date().toISOString()
      });

      // DISPATCH NOTIFICATION TO REMOVED PRESENTER IMMEDIATELY
      if (targetPresenterId) {
        const notificationMsg = `🚫 Presentation Assignment Removed: You have been removed from your scheduled Knowledge Development presentation on ${removeTarget.date} (${calcDay}) for topic "${removeTarget.topic || "KD Session"}". Reason: ${cleanReason}. The presentation slot has been made available for reassignment.`;
        await sendReminder(targetPresenterId, notificationMsg);
      }

      setSaving(false);
      setShowRemovePresenterModal(false);
      setRemoveTarget(null);
      setRemoveReason("");
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to remove presenter:", err);
      setSaving(false);
      setActionError(err.message || "Failed to remove presenter from schedule.");
    }
  };

  const canUserComment = (p: KDPresentation): boolean => {
    if (isAdmin || isKDOwner) return true;
    const isPresenter =
      (p.presenterUserId && p.presenterUserId === profile.id) ||
      (profile.fullName && p.presenterName && p.presenterName.toLowerCase().trim() === profile.fullName.toLowerCase().trim()) ||
      (profile.username && p.presenterName && p.presenterName.toLowerCase().trim() === profile.username.toLowerCase().trim()) ||
      (p.presenterEmail && profile.email && p.presenterEmail.toLowerCase().trim() === profile.email.toLowerCase().trim());
    if (isPresenter) return true;
    if (p.assignedMentorUserId && p.assignedMentorUserId === profile.id) return true;
    if (p.assignedMentorName && profile.fullName && p.assignedMentorName.toLowerCase().trim() === profile.fullName.toLowerCase().trim()) return true;
    if (p.assignedMentorName && profile.username && p.assignedMentorName.toLowerCase().trim() === profile.username.toLowerCase().trim()) return true;
    return false;
  };

  const handleAddComment = async (p: KDPresentation) => {
    const text = (commentTextMap[p.id] || "").trim();
    if (!text) return;

    if (!canUserComment(p)) {
      setActionError("Comments are private and can only be accessed by Administrators, KD Microservice Owners, or the assigned Presenter.");
      return;
    }

    setSubmittingCommentId(p.id);
    setActionError("");

    try {
      const isPresenter =
        (p.presenterUserId && p.presenterUserId === profile.id) ||
        (profile.fullName && p.presenterName && p.presenterName.toLowerCase().trim() === profile.fullName.toLowerCase().trim()) ||
        (profile.username && p.presenterName && p.presenterName.toLowerCase().trim() === profile.username.toLowerCase().trim()) ||
        (p.presenterEmail && profile.email && p.presenterEmail.toLowerCase().trim() === profile.email.toLowerCase().trim());

      const isAssignedMentor = 
        (p.assignedMentorUserId && p.assignedMentorUserId === profile.id) ||
        (p.assignedMentorName && profile.fullName && p.assignedMentorName.toLowerCase().trim() === profile.fullName.toLowerCase().trim()) ||
        (p.assignedMentorName && profile.username && p.assignedMentorName.toLowerCase().trim() === profile.username.toLowerCase().trim());

      let authorRole = "Presenter";
      if (isAdmin) authorRole = "Administrator";
      else if (isKDOwner) authorRole = "KD Microservice Owner";
      else if (isPresenter) authorRole = "Presenter";
      else if (isAssignedMentor) authorRole = "Assigned Mentor";

      const newComment: KDPresentationComment = {
        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        authorUserId: profile.id,
        authorName: profile.fullName || profile.username || (isPresenter ? "Presenter" : "Admin"),
        authorRole: authorRole,
        content: text,
        createdAt: new Date().toISOString()
      };

      const updatedComments = [...(p.comments || []), newComment];

      await updateKDPresentation(p.id, {
        comments: updatedComments,
        updatedAt: new Date().toISOString()
      });

      // Send notification: if presenter posted, notify mentor/admin; if admin/owner posted, notify presenter
      if (isPresenter) {
        if (p.assignedMentorUserId) {
          await sendReminder(p.assignedMentorUserId, `💬 Presenter Comment from ${p.presenterName} on KD Session (${p.date}): "${text.length > 80 ? text.substring(0, 80) + "..." : text}"`);
        }
      } else {
        const targetPresenterId = findPresenterUserId(
          p.presenterName,
          p.presenterEmail,
          p.presenterUserId
        );

        if (targetPresenterId) {
          const notificationMsg = `💬 Private Comment on KD Presentation (${p.date}): ${profile.fullName || profile.username} (${authorRole}) added a comment: "${text.length > 80 ? text.substring(0, 80) + "..." : text}"`;
          await sendReminder(targetPresenterId, notificationMsg);
        }
      }

      setCommentTextMap((prev) => ({ ...prev, [p.id]: "" }));
      setSubmittingCommentId(null);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to add comment:", err);
      setSubmittingCommentId(null);
      setActionError(err.message || "Failed to post comment.");
    }
  };

  const handleOpenSubmitTopic = (p: KDPresentation) => {
    setSelectedPres(p);
    setPresForm({ ...p });
    setActionError("");
    setShowTopicModal(true);
  };

  const handleSubmitTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPres) return;
    if (!presForm.topic || presForm.topic.trim() === "") {
      setActionError("Please enter a valid presentation topic.");
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      await updateKDPresentation(selectedPres.id, {
        topic: presForm.topic,
        notes: presForm.notes,
        status: "Pending Review",
        submittedAt: new Date().toISOString()
      });

      setSaving(false);
      setShowTopicModal(false);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to submit topic:", err);
      setSaving(false);
      setActionError(err.message || "Failed to submit topic.");
    }
  };

  const handleOpenSubmitMaterials = (p: KDPresentation) => {
    if (!isTopicApproved(p)) {
      setActionError("Presentation topic must be approved by a Mentor or Administrator before submitting presentation materials.");
      return;
    }
    setSelectedPres(p);
    setMaterialsForm({
      slidesUrl: p.slidesUrl || "",
      summary: p.summary || "",
      publicArtifactLink: p.publicArtifactLink || ""
    });
    setMaterialsValidationErrors({});
    setActionError("");
    setShowMaterialsModal(true);
  };

  const handleSubmitMaterials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPres) return;

    // Validate mandatory fields
    const errors: { slidesUrl?: string; summary?: string } = {};
    if (!materialsForm.slidesUrl || materialsForm.slidesUrl.trim() === "") {
      errors.slidesUrl = "Presentation slides link (URL) is required.";
    }
    if (!materialsForm.summary || materialsForm.summary.trim() === "") {
      errors.summary = "Presentation summary / abstract is required.";
    }

    if (Object.keys(errors).length > 0) {
      setMaterialsValidationErrors(errors);
      setActionError("Please fill in all required presentation material fields.");
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const submissionTimestamp = new Date().toISOString();

      await updateKDPresentation(selectedPres.id, {
        slidesUrl: materialsForm.slidesUrl.trim(),
        summary: materialsForm.summary.trim(),
        publicArtifactLink: materialsForm.publicArtifactLink.trim(),
        materialsSubmittedAt: submissionTimestamp,
        status: "Ready for Presentation",
        updatedAt: submissionTimestamp
      });

      // Dispatch notifications to Mentors and Administrators
      const notifTargets = new Set<string>();

      const mentorId = selectedPres.assignedMentorUserId || findPresenterUserId(selectedPres.assignedMentorName || "", "", "");
      if (mentorId) notifTargets.add(mentorId);

      if (microserviceOwners?.kd) notifTargets.add(microserviceOwners.kd);

      profiles.forEach((prof) => {
        if (prof.role === "admin" || prof.status === "admin" || prof.role === "mentor") {
          notifTargets.add(prof.id);
        }
      });

      const calcDay = selectedPres.dayOfWeek || new Date(selectedPres.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
      const notifMsg = `📦 KD Presentation Materials Submitted: Presenter ${selectedPres.presenterName} has submitted presentation materials for topic "${selectedPres.topic}" scheduled for ${selectedPres.date} (${calcDay}). Status is now "Ready for Presentation".`;

      for (const targetId of Array.from(notifTargets)) {
        if (targetId && targetId !== profile.id) {
          await sendReminder(targetId, notifMsg);
        }
      }

      setSaving(false);
      setShowMaterialsModal(false);
      setSelectedPres(null);
      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Failed to submit materials:", err);
      setSaving(false);
      setActionError(err.message || "Failed to submit presentation materials.");
    }
  };

  const handleToggleLockMaterials = async (p: KDPresentation) => {
    if (!isAdmin && !isKDOwner && profile.role !== "mentor") return;
    try {
      const newLockState = !p.materialsLocked;
      await updateKDPresentation(p.id, {
        materialsLocked: newLockState,
        materialsLockedBy: profile.fullName || profile.username || "Mentor/Admin",
        materialsLockedAt: new Date().toISOString()
      });

      const presenterId = findPresenterUserId(p.presenterName, p.presenterEmail, p.presenterUserId);
      if (presenterId) {
        const lockMsg = newLockState
          ? `🔒 Presentation Materials Locked: An Administrator or Mentor has locked material submissions for your presentation scheduled on ${p.date}.`
          : `🔓 Presentation Materials Unlocked: You can now update material submissions for your presentation scheduled on ${p.date}.`;
        await sendReminder(presenterId, lockMsg);
      }

      if (onStateUpdate) onStateUpdate();
    } catch (err) {
      console.error("Failed to toggle materials lock:", err);
    }
  };

  const handleQuickStatusUpdate = async (p: KDPresentation, newStatus: KDPresentationStatus) => {
    if (!isAdmin && !isKDOwner && profile.role !== "mentor") return;
    try {
      await updateKDPresentation(p.id, { status: newStatus });

      const presenterId = findPresenterUserId(p.presenterName, p.presenterEmail, p.presenterUserId);
      if (presenterId) {
        const calcDay = p.dayOfWeek || new Date(p.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const deadlineStr = getSubmissionDeadline(p.date);
        const presentationTimeStr = "09:00 AM WAT";
        const requirementsText = `1) Submit presentation topic for mentor review at least 2 weeks prior to presentation date (Deadline: ${deadlineStr} by 09:00 AM WAT); 2) Prepare slides; 3) Prepare two paragraph summary of the topic; 4) Submit link to public artefacts; 5) Submit professional photograph.`;

        const msg = `🔔 Updated KD Schedule: Your presentation for ${p.date} (${calcDay}) status was updated to "${newStatus}". 🕒 Presentation Time: ${presentationTimeStr}. ⏰ Submission Deadline: ${deadlineStr}. 📋 Requirements: ${requirementsText}`;
        await sendReminder(presenterId, msg);
      }

      if (onStateUpdate) onStateUpdate();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this scheduled presentation?")) return;
    try {
      await deleteKDPresentation(id);
      if (onStateUpdate) onStateUpdate();
    } catch (err) {
      console.error("Failed to delete presentation:", err);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`space-y-6 ${className}`} id="kd-presentation-schedule-container">
      {/* HEADER SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#4B5E40]/10 text-[#4B5E40] text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                <CalendarCheck className="w-3 h-3 text-[#4B5E40]" /> KD Microservice Schedule
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                {sortedPresentations.length} Sessions Found
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-gray-950 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#4B5E40]" /> Knowledge Development Presentation Schedule
            </h3>
            <p className="text-xs text-gray-500 max-w-2xl">
              View upcoming and past Knowledge Development sessions, scheduled presenters, topics, and topic review statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-kd-aggregated-feedback-analytics"
              onClick={() => setShowAggregatedFeedback(true)}
              className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black rounded-xl shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              Feedback Analytics
            </button>

            {(isAdmin || isKDOwner) && (
              <button
                type="button"
                id="btn-schedule-new-presentation"
                onClick={() => handleOpenScheduleModal()}
                className="px-4 py-2.5 bg-[#4B5E40] hover:bg-[#3B4E30] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" /> Schedule Session
              </button>
            )}
          </div>
        </div>

        {/* FILTERS & SEARCH TOOLBAR */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* SEARCH INPUT */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-search-kd-schedule"
              placeholder="Search topic or presenter name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-55 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4B5E40] focus:border-[#4B5E40] text-gray-800 font-medium outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* TIMEFRAME TABS */}
          <div className="md:col-span-4 flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              id="tab-filter-upcoming"
              onClick={() => setTimeframeFilter("upcoming")}
              className={`flex-1 py-1.5 px-2 text-center text-xs font-bold rounded-lg transition cursor-pointer ${
                timeframeFilter === "upcoming"
                  ? "bg-white text-[#4B5E40] shadow-2xs font-extrabold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              id="tab-filter-past"
              onClick={() => setTimeframeFilter("past")}
              className={`flex-1 py-1.5 px-2 text-center text-xs font-bold rounded-lg transition cursor-pointer ${
                timeframeFilter === "past"
                  ? "bg-white text-[#4B5E40] shadow-2xs font-extrabold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Past
            </button>
            <button
              type="button"
              id="tab-filter-all"
              onClick={() => setTimeframeFilter("all")}
              className={`flex-1 py-1.5 px-2 text-center text-xs font-bold rounded-lg transition cursor-pointer ${
                timeframeFilter === "all"
                  ? "bg-white text-[#4B5E40] shadow-2xs font-extrabold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All
            </button>
          </div>

          {/* STATUS DROPDOWN FILTER */}
          <div className="md:col-span-3">
            <div className="relative">
              <select
                id="select-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-55 border border-gray-200 rounded-xl text-gray-800 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#4B5E40]"
              >
                <option value="all">All Statuses</option>
                <option value="ready for presentation">Ready for Presentation</option>
                <option value="approved">Approved</option>
                <option value="pending review">Pending Review</option>
                <option value="awaiting topic submission">Awaiting topic submission</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULE LIST PRESENTATION */}
      {sortedPresentations.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto" />
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">No Presentations Found</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {searchTerm
              ? `No sessions match search query "${searchTerm}". Try resetting search or status filters.`
              : `No ${timeframeFilter} Knowledge Development sessions are currently scheduled.`}
          </p>
          {(searchTerm || statusFilter !== "all" || timeframeFilter !== "upcoming") && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setTimeframeFilter("all");
              }}
              className="mt-2 text-xs font-bold text-[#4B5E40] hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3" id="kd-schedule-cards-list">
          {sortedPresentations.map((p) => {
            const topicInfo = getTopicDisplay(p);
            const isToday = p.date === todayStr;
            const isPresenterSelf = Boolean(
              (p.presenterUserId && profile.id && p.presenterUserId === profile.id) || 
              (p.presenterName && profile.fullName && p.presenterName.toLowerCase().trim() === profile.fullName.toLowerCase().trim()) ||
              (p.presenterName && profile.username && p.presenterName.toLowerCase().trim() === profile.username.toLowerCase().trim()) ||
              (p.presenterEmail && profile.email && p.presenterEmail.toLowerCase().trim() === profile.email.toLowerCase().trim())
            );
            const canManage = isAdmin || isKDOwner || (profile.role === "mentor" && p.assignedMentorUserId === profile.id);
            const effectiveStatus = getEffectiveStatus(p);

            return (
              <div
                key={p.id}
                id={`kd-pres-card-${p.id}`}
                className={`p-5 rounded-2xl border transition-all shadow-2xs space-y-3 ${
                  isToday 
                    ? "bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30" 
                    : effectiveStatus === "Approved" || effectiveStatus === "Completed"
                      ? "bg-white border-gray-200 hover:border-gray-300"
                      : "bg-gray-50/60 border-gray-200"
                }`}
              >
                {/* TOP BAR: DATE, DAY & STATUS */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 bg-[#4B5E40]/10 text-[#4B5E40] rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#4B5E40]" />
                      {p.dayOfWeek || "Tuesday"}
                    </span>
                    <span className="text-xs font-extrabold text-gray-900">
                      {formatDateLabel(p.date)}
                    </span>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-amber-400 text-amber-950 text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse">
                        Today's Session
                      </span>
                    )}
                    {(() => {
                      const presentersOnThisDate = getPresentersForDate(p.date);
                      const totalOnDate = presentersOnThisDate.length;
                      return (
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 border ${
                            totalOnDate >= 2
                              ? "bg-purple-100 text-purple-900 border-purple-200"
                              : "bg-blue-100 text-blue-900 border-blue-200"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 text-current shrink-0" />
                          {totalOnDate >= 2 ? (
                            <span>2/2 Presenters (Fully Booked)</span>
                          ) : (
                            <span>1/2 Presenter (1 Slot Available)</span>
                          )}
                        </span>
                      );
                    })()}
                  </div>

                  {/* STATUS BADGE */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                        effectiveStatus === "Ready for Presentation"
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-black shadow-2xs"
                          : effectiveStatus === "Approved"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : effectiveStatus === "Pending Review"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : effectiveStatus === "Completed"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : effectiveStatus === "Rescheduled"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : effectiveStatus === "Cancelled" || effectiveStatus === "Rejected"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {(effectiveStatus === "Approved" || effectiveStatus === "Ready for Presentation") && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {effectiveStatus === "Pending Review" && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                      {effectiveStatus === "Completed" && <Award className="w-3.5 h-3.5 text-blue-600" />}
                      {effectiveStatus === "Rescheduled" && <RefreshCw className="w-3.5 h-3.5 text-purple-600" />}
                      {(effectiveStatus === "Cancelled" || effectiveStatus === "Rejected") && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      {effectiveStatus === "Awaiting topic submission" && <Edit3 className="w-3.5 h-3.5 text-gray-500" />}
                      {effectiveStatus}
                    </span>
                  </div>
                </div>

                {/* MIDDLE CONTENT: PRESENTER & TOPIC */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* PRESENTER INFO */}
                  <div className="md:col-span-4 space-y-1 bg-gray-50/80 p-3 rounded-xl border border-gray-150">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      Presenter & Mentor
                    </span>
                    {p.presenterName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#4B5E40] text-white flex items-center justify-center font-extrabold text-xs shrink-0">
                          {p.presenterName.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <h5 className="text-xs font-extrabold text-gray-900 truncate flex items-center gap-1">
                            {p.presenterName}
                            {isPresenterSelf && (
                              <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                                You
                              </span>
                            )}
                          </h5>
                          <p className="text-[11px] text-gray-500 truncate">
                            {p.presenterEmail || "Scheduled Techie Presenter"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          <UserPlus className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Slot Available for Reassignment</span>
                        </div>
                        <p className="text-[10px] text-amber-800">
                          No presenter is currently assigned to this session slot.
                        </p>
                      </div>
                    )}
                    {p.assignedMentorName && (
                      <p className="text-[11px] text-gray-600 pt-1 border-t border-gray-200/60 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#4B5E40]" /> Mentor: <strong>{p.assignedMentorName}</strong>
                      </p>
                    )}
                    {(() => {
                      const coPresenters = getPresentersForDate(p.date).filter(item => item.id !== p.id);
                      if (coPresenters.length > 0) {
                        return (
                          <p className="text-[11px] text-purple-900 pt-1 border-t border-purple-200/60 flex items-center gap-1 font-extrabold">
                            <Users className="w-3 h-3 text-purple-600 shrink-0" /> Co-Presenter: <strong>{coPresenters.map(c => c.presenterName).join(", ")}</strong>
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* TOPIC CARD */}
                  <div className="md:col-span-8 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[#4B5E40]" /> Presentation Topic
                      </span>
                      {topicInfo.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          topicInfo.type === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : topicInfo.type === "awaiting"
                              ? "bg-amber-50 text-amber-800 font-extrabold"
                              : "bg-gray-100 text-gray-600"
                        }`}>
                          {topicInfo.badge}
                        </span>
                      )}
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      topicInfo.isPlaceholder
                        ? "bg-amber-50/50 border-amber-200 text-amber-900 italic"
                        : "bg-white border-gray-200 text-gray-900 font-bold"
                    }`}>
                      <p className="text-xs leading-relaxed flex items-start gap-2">
                        {topicInfo.isPlaceholder ? (
                          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#4B5E40] shrink-0 mt-0.5" />
                        )}
                        <span>{topicInfo.text}</span>
                      </p>
                    </div>

                    {p.notes && (
                      <p className="text-[11px] text-gray-500 italic pl-1">
                        Note: {p.notes}
                      </p>
                    )}

                    {/* TWO-WEEK SUBMISSION DEADLINE & REQUIREMENTS (Visible only to the presenter) */}
                    {isPresenterSelf && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#4B5E40]" /> 2-Week Submission Deadline
                          </span>
                          <span className="text-[11px] font-extrabold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                            {getSubmissionDeadline(p.date)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-normal">
                          <strong>Requirements:</strong> 1) Submit presentation topic for mentor review at least 2 weeks prior to presentation date (Deadline: <strong>{getSubmissionDeadline(p.date)} by 09:00 AM WAT</strong>); 2) Prepare slides; 3) Prepare two paragraph summary of the topic; 4) Submit link to public artefacts; 5) Submit professional photograph.
                        </p>
                      </div>
                    )}

                    {/* PRESENTATION MATERIALS DISPLAY BLOCK */}
                    {(p.slidesUrl || p.summary || p.publicArtifactLink || p.status === "Ready for Presentation") && (
                      <div className="mt-2.5 p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-2">
                          <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-emerald-700" />
                            Presentation Materials & Resources
                          </span>
                          <div className="flex items-center gap-1.5">
                            {p.materialsSubmittedAt && (
                              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                                Submitted: {new Date(p.materialsSubmittedAt).toLocaleDateString()} {new Date(p.materialsSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {p.materialsLocked && (
                              <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-rose-600" /> Locked by Mentor/Admin
                              </span>
                            )}
                          </div>
                        </div>

                        {p.summary && (
                          <div className="text-gray-800 space-y-0.5">
                            <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider">Presentation Summary / Abstract:</span>
                            <p className="text-xs leading-relaxed bg-white/80 p-2.5 rounded-lg border border-emerald-150 font-medium">
                              {p.summary}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {p.slidesUrl && (
                            <a
                              href={p.slidesUrl.startsWith("http") ? p.slidesUrl : `https://${p.slidesUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                            >
                              <FileText className="w-3.5 h-3.5" /> View Presentation Slides
                            </a>
                          )}
                          {p.publicArtifactLink && (
                            <a
                              href={p.publicArtifactLink.startsWith("http") ? p.publicArtifactLink : `https://${p.publicArtifactLink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                            >
                              <Link2 className="w-3.5 h-3.5" /> Public Artefact Link
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* KD PRESENTATION MEETING LINK DISPLAY BLOCK */}
                    <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-200/90 rounded-xl space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 pb-1.5">
                        <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                          <Video className="w-4 h-4 text-indigo-700" />
                          KD Presentation Meeting Link
                        </span>
                        <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-indigo-600" /> Synced with Schedule & Meeting Module
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] font-mono font-medium text-indigo-950 truncate max-w-[280px] sm:max-w-[380px] bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100">
                          {p.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${p.date.replace(/-/g, "")}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={p.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${p.date.replace(/-/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onJoinMeeting?.(p.id || "meet_2")}
                            className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Session
                            <ExternalLink className="w-3 h-3 text-indigo-200" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const targetLink = p.meetingLink || `https://meet.jit.si/BincomDevCenter_KD_${p.date.replace(/-/g, "")}`;
                              navigator.clipboard.writeText(targetLink);
                              setCopySuccessId(p.id);
                              setTimeout(() => setCopySuccessId(null), 2500);
                            }}
                            className="px-2.5 py-1.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Copy Meeting URL"
                          >
                            {copySuccessId === p.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-extrabold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>Session Time: <strong>9:00 AM WAT</strong></span>
                  </div>

                  {/* ACTIONS FOR PRESENTER AND AUTHORIZED USERS */}
                  <div className="flex items-center gap-2">
                    {/* SUBMIT / UPDATE PRESENTATION MATERIALS BUTTON */}
                    {(isPresenterSelf || canManage) && (
                      <button
                        type="button"
                        onClick={() => handleOpenSubmitMaterials(p)}
                        disabled={!isTopicApproved(p) || (p.materialsLocked && !canManage) || (p.date < todayStr && !canManage)}
                        className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                          !isTopicApproved(p)
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
                            : p.materialsLocked && !canManage
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : p.slidesUrl
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
                        }`}
                        title={
                          !isTopicApproved(p)
                            ? "Topic must be approved before submitting materials"
                            : p.materialsLocked
                              ? "Submission locked by Administrator/Mentor"
                              : "Submit or update presentation slides, summary, & artefact link"
                        }
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {!isTopicApproved(p)
                          ? "Submit Materials (Approval Required)"
                          : p.slidesUrl
                            ? "Update Materials"
                            : "Submit Presentation Materials"}
                      </button>
                    )}

                    {/* MENTOR / ADMIN LOCK MATERIALS TOGGLE */}
                    {canManage && isTopicApproved(p) && (
                      <button
                        type="button"
                        onClick={() => handleToggleLockMaterials(p)}
                        className={`px-2.5 py-1.5 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                          p.materialsLocked
                            ? "bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                        }`}
                        title={p.materialsLocked ? "Unlock material submissions" : "Lock material submissions"}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {p.materialsLocked ? "Unlock Materials" : "Lock Materials"}
                      </button>
                    )}

                    {/* PRESENTER CAN SUBMIT / EDIT TOPIC */}
                    {isPresenterSelf && (
                      <button
                        type="button"
                        onClick={() => handleOpenSubmitTopic(p)}
                        className="px-3 py-1.5 bg-[#4B5E40] hover:bg-[#3B4E30] text-white text-xs font-extrabold rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {p.topic ? "Update My Topic" : "Submit Presentation Topic"}
                      </button>
                    )}

                    {/* MENTOR / ADMIN QUICK APPROVE */}
                    {canManage && p.status === "Pending Review" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusUpdate(p, "Approved")}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve Topic
                      </button>
                    )}

                    {/* ADMIN / KD OWNER RESCHEDULE BUTTON */}
                    {(isAdmin || isKDOwner) && (
                      <button
                        type="button"
                        onClick={() => handleOpenRescheduleModal(p)}
                        className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        title="Reschedule Presentation Date"
                      >
                        <CalendarRange className="w-3.5 h-3.5 text-purple-700" /> Reschedule
                      </button>
                    )}

                    {/* ADMIN / KD OWNER REMOVE PRESENTER BUTTON */}
                    {(isAdmin || isKDOwner) && (p.presenterName || p.presenterUserId) && (
                      <button
                        type="button"
                        onClick={() => handleOpenRemovePresenterModal(p)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        title="Remove Presenter from Schedule"
                      >
                        <UserX className="w-3.5 h-3.5 text-rose-700" /> Remove Presenter
                      </button>
                    )}

                    {/* HISTORY BUTTON IF RESCHEDULED */}
                    {p.history && p.history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(expandedHistoryId === p.id ? null : p.id)}
                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        title="View Schedule History"
                      >
                        <History className="w-3.5 h-3.5 text-purple-600" />
                        History ({p.history.length})
                      </button>
                    )}

                    {/* PRIVATE COMMENTS BUTTON (ONLY VISIBLE TO ADMIN, KD OWNER, ASSIGNED MENTOR, AND PRESENTER) */}
                    {canUserComment(p) && (
                      <button
                        type="button"
                        onClick={() => setExpandedCommentsId(expandedCommentsId === p.id ? null : p.id)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        title="View or Add Private Guidance Comments"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        Private Comments ({p.comments?.length || 0})
                      </button>
                    )}

                    {/* SESSION FEEDBACK BUTTON */}
                    <button
                      type="button"
                      id={`btn-kd-feedback-${p.id}`}
                      onClick={() => setFeedbackTargetPres(p)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Provide or View Session Feedback"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      Feedback ({p.ratings?.length || 0})
                    </button>

                    {/* ADMIN / KD OWNER EDIT */}
                    {(isAdmin || isKDOwner) && (
                      <button
                        type="button"
                        onClick={() => handleOpenScheduleModal(p)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-gray-600" /> Manage
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete Session"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* EXPANDABLE SCHEDULE HISTORY DRAWER */}
                {expandedHistoryId === p.id && p.history && p.history.length > 0 && (
                  <div className="mt-3 p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-2 text-xs animate-fade-in">
                    <div className="flex items-center justify-between text-purple-900 font-extrabold pb-1.5 border-b border-purple-200/60">
                      <span className="flex items-center gap-1.5">
                        <History className="w-4 h-4 text-purple-600" />
                        Schedule History & Changes
                      </span>
                      <span className="text-[10px] text-purple-700 font-semibold">{p.history.length} Record(s)</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {p.history.map((hist, idx) => (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-purple-150 text-gray-800 space-y-1 shadow-2xs">
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                            <span className="font-bold text-gray-800">
                              Previously: <span className="line-through text-rose-600 font-medium">{hist.previousDate} ({hist.previousDayOfWeek || "N/A"})</span> → Rescheduled to <span className="text-emerald-700 font-extrabold">{hist.newDate} ({hist.newDayOfWeek || "N/A"})</span>
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(hist.rescheduledAt).toLocaleDateString()} {new Date(hist.rescheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-600 flex flex-wrap items-center justify-between gap-1">
                            <span>By: <strong>{hist.rescheduledBy}</strong></span>
                            {hist.reason && <span className="italic text-purple-900 font-medium bg-purple-100/60 px-2 py-0.5 rounded-md">"{hist.reason}"</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EXPANDABLE COMMENTS DRAWER */}
                {expandedCommentsId === p.id && canUserComment(p) && (
                  <div className="mt-3 p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl space-y-3 text-xs animate-fade-in">
                    <div className="flex items-center justify-between text-blue-900 font-extrabold pb-2 border-b border-blue-200/60">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        Private Comments (Admin, Microservice Owner & Presenter)
                      </span>
                      <span className="text-[10px] text-blue-700 font-semibold">
                        {p.comments?.length || 0} Comment(s)
                      </span>
                    </div>

                    {/* LIST OF COMMENTS IN CHRONOLOGICAL ORDER */}
                    {p.comments && p.comments.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {[...p.comments]
                          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                          .map((c) => (
                            <div key={c.id} className="p-3 bg-white rounded-xl border border-blue-100 text-gray-800 space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-gray-900 text-xs">{c.authorName}</span>
                                  <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full border border-blue-200">
                                    {c.authorRole}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {new Date(c.createdAt).toLocaleDateString()} at {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap pt-1 border-t border-gray-100">
                                {c.content}
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white/80 rounded-xl text-center text-gray-500 text-xs italic border border-blue-100">
                        No comments added yet for this presentation session.
                      </div>
                    )}

                    {/* ADD COMMENT FORM FOR AUTHORIZED USERS */}
                    {canUserComment(p) ? (
                      <div className="pt-2 border-t border-blue-200/60 space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-blue-900">
                          Add Guidance / Instruction Comment
                        </label>
                        <div className="flex gap-2">
                          <textarea
                            rows={2}
                            placeholder="Type guidance, feedback, or instructions for the presenter..."
                            value={commentTextMap[p.id] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCommentTextMap((prev) => ({ ...prev, [p.id]: val }));
                              if (actionError) setActionError("");
                            }}
                            className="flex-1 px-3 py-2 text-xs border border-blue-200 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          />
                          <button
                            type="button"
                            disabled={submittingCommentId === p.id || !(commentTextMap[p.id] || "").trim()}
                            onClick={() => handleAddComment(p)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 self-end disabled:opacity-50 cursor-pointer"
                          >
                            {submittingCommentId === p.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Post
                          </button>
                        </div>
                        <p className="text-[10px] text-blue-700">
                          📢 The presenter will receive an immediate notification when a new comment is posted.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 italic text-center pt-1">
                        Only Administrators, KD Owners, or the Assigned Mentor can add comments.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: SCHEDULE / EDIT SESSION (ADMIN / KD OWNER) */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4B5E40]" />
                {selectedPres ? "Edit Scheduled Session" : "Schedule KD Presentation"}
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                    Presentation Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={presForm.date || ""}
                    onChange={(e) => {
                      const dVal = e.target.value;
                      const day = new Date(dVal + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
                      setPresForm({ ...presForm, date: dVal, dayOfWeek: day });
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                    Day of Presentation
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={presForm.dayOfWeek || "Tuesday"}
                    className="w-full px-3 py-2 text-xs border border-gray-200 bg-gray-100 rounded-xl font-bold text-gray-600"
                  />
                </div>
              </div>

              {presForm.date && (() => {
                const assigned = getPresentersForDate(presForm.date, selectedPres?.id);
                const count = assigned.length;
                if (count >= 2) {
                  const names = assigned.map(a => a.presenterName).join(" & ");
                  return (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                      <p className="font-extrabold flex items-center gap-1 text-rose-950">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Date Fully Booked (2/2 Presenters Assigned):
                      </p>
                      <p className="text-[11px] text-rose-800 leading-normal">
                        Currently assigned: <strong>{names}</strong>. This date has reached its maximum capacity of 2 presenters. You cannot assign a 3rd presenter to this date.
                      </p>
                    </div>
                  );
                } else if (count === 1) {
                  return (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-0.5">
                      <p className="font-extrabold flex items-center gap-1 text-blue-950">
                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Date Capacity: 1/2 Presenter Assigned (1 Slot Available):
                      </p>
                      <p className="text-[11px] text-blue-800 leading-normal">
                        Currently assigned: <strong>{assigned[0].presenterName}</strong>. 1 additional presenter slot remains available for this date.
                      </p>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-950 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Date Capacity: 0/2 Presenters Assigned
                      </span>
                      <span className="text-[10px] font-extrabold bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-md">
                        2 Slots Available
                      </span>
                    </div>
                  );
                }
              })()}

              {presForm.date && (
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl space-y-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      Two-Week Submission Deadline:
                    </span>
                    <span className="text-[11px] font-black bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-md">
                      {getSubmissionDeadline(presForm.date)}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-normal">
                    <strong>Scheduled Requirements:</strong> 1) Submit presentation topic for mentor review at least 2 weeks prior to presentation date (Deadline: <strong>{getSubmissionDeadline(presForm.date)} by 09:00 AM WAT</strong>); 2) Prepare slides; 3) Prepare two paragraph summary of the topic; 4) Submit link to public artefacts; 5) Submit professional photograph.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Presenter *
                </label>
                {profiles && profiles.length > 0 && (
                  <select
                    value={presForm.presenterUserId || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matched = profiles.find((prof) => prof.id === selectedId);
                      if (matched) {
                        setPresForm({
                          ...presForm,
                          presenterUserId: matched.id,
                          presenterName: matched.fullName || matched.username,
                          presenterEmail: matched.email
                        });
                      } else {
                        setPresForm({
                          ...presForm,
                          presenterUserId: "",
                          presenterName: ""
                        });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800 mb-1.5 focus:ring-2 focus:ring-[#4B5E40]"
                  >
                    <option value="">-- Select Registered Presenter --</option>
                    {profiles.map((prof) => {
                      const isEligible = presForm.date ? checkPresenterEligibility(prof, presForm.date).eligible : true;
                      const dup = presForm.date ? checkSameMonthDuplicate(prof.id, prof.fullName || prof.username, presForm.date, selectedPres?.id).hasDuplicate : false;
                      let tag = "";
                      if (!isEligible) tag = " ⚠️ [INELIGIBLE - 1st Month]";
                      else if (dup) tag = " 🚫 [ASSIGNED THIS MONTH]";

                      return (
                        <option key={prof.id} value={prof.id}>
                          {prof.fullName || prof.username} ({prof.email}) - {prof.track || prof.learningLevel || "Techie"}{tag}
                        </option>
                      );
                    })}
                  </select>
                )}
                <input
                  type="text"
                  required
                  placeholder="e.g. Chidi Okonkwo (or type custom name)"
                  value={presForm.presenterName || ""}
                  onChange={(e) => setPresForm({ ...presForm, presenterName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800"
                />

                {(() => {
                  const matched = profiles.find(p => p.id === presForm.presenterUserId || (p.fullName && p.fullName.toLowerCase().trim() === presForm.presenterName?.toLowerCase().trim()));
                  if (matched && presForm.date) {
                    const eligibility = checkPresenterEligibility(matched, presForm.date);
                    const dup = checkSameMonthDuplicate(matched.id, matched.fullName || matched.username, presForm.date, selectedPres?.id);
                    if (!eligibility.eligible) {
                      return (
                        <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-0.5">
                          <p className="font-extrabold flex items-center gap-1 text-amber-950">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Ineligible Techie (1st Month):
                          </p>
                          <p className="text-[11px] text-amber-800 leading-normal">{eligibility.reason}</p>
                        </div>
                      );
                    }
                    if (dup.hasDuplicate) {
                      return (
                        <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                          <p className="font-extrabold flex items-center gap-1 text-rose-950">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            Duplicate Assignment Warning:
                          </p>
                          <p className="text-[11px] text-rose-800 leading-normal">
                            {presForm.presenterName} is already assigned a presentation on <strong>{dup.existingDate}</strong> in this same month. A user cannot be assigned more than one presentation within the same month.
                          </p>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Assigned Mentor (Optional)
                </label>
                {profiles && profiles.filter(p => p.role === "admin" || p.role === "mentor").length > 0 && (
                  <select
                    value={presForm.assignedMentorUserId || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matched = profiles.find((prof) => prof.id === selectedId);
                      if (matched) {
                        setPresForm({
                          ...presForm,
                          assignedMentorUserId: matched.id,
                          assignedMentorName: matched.fullName || matched.username
                        });
                      } else {
                        setPresForm({
                          ...presForm,
                          assignedMentorUserId: "",
                          assignedMentorName: ""
                        });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800 mb-1.5 focus:ring-2 focus:ring-[#4B5E40]"
                  >
                    <option value="">-- Select Mentor / Admin --</option>
                    {profiles.filter(p => p.role === "admin" || p.role === "mentor").map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.fullName || prof.username} ({prof.email})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="e.g. Evelyn Reed"
                  value={presForm.assignedMentorName || ""}
                  onChange={(e) => setPresForm({ ...presForm, assignedMentorName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Presentation Topic (Leave blank if awaiting submission)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Microservices Architecture with Docker"
                  value={presForm.topic || ""}
                  onChange={(e) => setPresForm({ ...presForm, topic: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-medium text-gray-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Presentation Status
                </label>
                <select
                  value={presForm.status || "Awaiting topic submission"}
                  onChange={(e) => setPresForm({ ...presForm, status: e.target.value as KDPresentationStatus })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800"
                >
                  <option value="Approved">Approved</option>
                  <option value="Ready for Presentation">Ready for Presentation</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Awaiting topic submission">Awaiting topic submission</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Rescheduled">Rescheduled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase text-indigo-900">
                    KD Presentation Meeting Link *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const generated = `https://meet.jit.si/BincomDevCenter_KD_${(presForm.date || todayStr).replace(/-/g, "")}`;
                        setPresForm({ ...presForm, meetingLink: generated });
                      }}
                      className="text-[10px] font-extrabold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" /> Auto-Generate Jitsi Link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPresForm({ ...presForm, meetingLink: "https://meet.jit.si/BincomDevCenterKDHub" });
                      }}
                      className="text-[10px] font-extrabold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md border border-gray-300 transition cursor-pointer"
                    >
                      Main KD Room
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://meet.jit.si/BincomDevCenter_KD_Session"
                    value={presForm.meetingLink || ""}
                    onChange={(e) => setPresForm({ ...presForm, meetingLink: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-indigo-200 rounded-xl font-bold text-indigo-950 bg-indigo-50/30 focus:ring-2 focus:ring-[#4B5E40]"
                  />
                  <Video className="w-4 h-4 text-indigo-600 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  This meeting URL is automatically linked with the KD presentation schedule and synced with the Meetings Module.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Notes or Meeting Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Session link in Meeting module"
                  value={presForm.notes || ""}
                  onChange={(e) => setPresForm({ ...presForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-medium text-gray-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#4B5E40] text-white text-xs font-extrabold rounded-xl hover:bg-[#3B4E30] transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Save Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SUBMIT / EDIT TOPIC (PRESENTER) */}
      {showTopicModal && selectedPres && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#4B5E40]" />
                Submit Presentation Topic
              </h3>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 space-y-1">
              <p className="font-bold">Scheduled Session: {selectedPres.dayOfWeek}, {formatDateLabel(selectedPres.date)}</p>
              <p className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                Two-Week Submission Deadline: <span className="bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-md">{getSubmissionDeadline(selectedPres.date)}</span>
              </p>
              <p className="text-[11px] text-emerald-800">
                <strong>Requirement:</strong> Presentation topics must be submitted for mentor review at least 2 weeks prior to your presentation date. Submitting your topic places it in <strong>Pending Review</strong> status.
              </p>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTopic} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Presentation Topic *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Microservices Architecture with Docker & Kubernetes Containerization"
                  value={presForm.topic || ""}
                  onChange={(e) => setPresForm({ ...presForm, topic: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#4B5E40]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Additional Notes / Resource Links (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GitHub repo link, presentation slides link"
                  value={presForm.notes || ""}
                  onChange={(e) => setPresForm({ ...presForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-medium text-gray-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#4B5E40] text-white text-xs font-extrabold rounded-xl hover:bg-[#3B4E30] transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Submitting..." : "Submit Topic for Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESCHEDULE PRESENTATION (ADMIN / KD OWNER) */}
      {showRescheduleModal && rescheduleTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Reschedule Presentation
                  </h3>
                  <p className="text-xs text-gray-500">
                    Change assigned presentation date & notify presenter
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleTarget(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            {/* CURRENT PRESENTER AND TOPIC OVERVIEW */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-xs">
              <div className="flex justify-between font-extrabold text-gray-800">
                <span>Presenter: {rescheduleTarget.presenterName}</span>
                <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 text-[10px]">
                  {rescheduleTarget.status}
                </span>
              </div>
              <div className="text-gray-600 text-[11px] truncate">
                Topic: {rescheduleTarget.topic || "Topic Not Yet Submitted"}
              </div>
              <div className="text-gray-500 text-[11px] pt-1 border-t border-gray-200/60">
                Current Date: <strong className="text-gray-900">{rescheduleTarget.date} ({rescheduleTarget.dayOfWeek})</strong>
              </div>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  New Presentation Date *
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.newDate}
                  onChange={(e) => {
                    const dVal = e.target.value;
                    const calcD = dVal ? new Date(dVal + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }) : "Tuesday";
                    setRescheduleForm({
                      ...rescheduleForm,
                      newDate: dVal,
                      newDayOfWeek: calcD
                    });
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#4B5E40]"
                />

                {(() => {
                  if (rescheduleTarget && rescheduleForm.newDate) {
                    const targetPresenterId = findPresenterUserId(rescheduleTarget.presenterName, rescheduleTarget.presenterEmail, rescheduleTarget.presenterUserId);
                    const matchedProfile = profiles.find(p => p.id === targetPresenterId || p.id === rescheduleTarget.presenterUserId) ||
                                           profiles.find(p => (p.fullName && p.fullName.toLowerCase().trim() === rescheduleTarget.presenterName.toLowerCase().trim()));

                    if (matchedProfile) {
                      const eligibility = checkPresenterEligibility(matchedProfile, rescheduleForm.newDate);
                      if (!eligibility.eligible) {
                        return (
                          <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-0.5">
                            <p className="font-extrabold flex items-center gap-1 text-amber-950">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Ineligible Presenter (1st Month):
                            </p>
                            <p className="text-[11px] text-amber-800 leading-normal">{eligibility.reason}</p>
                          </div>
                        );
                      }
                    }

                    const dup = checkSameMonthDuplicate(targetPresenterId || rescheduleTarget.presenterUserId || "", rescheduleTarget.presenterName, rescheduleForm.newDate, rescheduleTarget.id);
                    if (dup.hasDuplicate) {
                      return (
                        <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                          <p className="font-extrabold flex items-center gap-1 text-rose-950">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            Duplicate Assignment Warning:
                          </p>
                          <p className="text-[11px] text-rose-800 leading-normal">
                            {rescheduleTarget.presenterName} is already assigned a presentation on <strong>{dup.existingDate}</strong> in this same month. A user cannot be assigned more than one presentation within the same month.
                          </p>
                        </div>
                      );
                    }

                    const assignedOnNewDate = getPresentersForDate(rescheduleForm.newDate, rescheduleTarget.id);
                    const countOnNewDate = assignedOnNewDate.length;
                    if (countOnNewDate >= 2) {
                      const names = assignedOnNewDate.map(a => a.presenterName).join(" & ");
                      return (
                        <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                          <p className="font-extrabold flex items-center gap-1 text-rose-950">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            New Date Fully Booked (2/2 Presenters Assigned):
                          </p>
                          <p className="text-[11px] text-rose-800 leading-normal">
                            Currently assigned on {rescheduleForm.newDate}: <strong>{names}</strong>. This date has reached its maximum capacity of 2 presenters. You cannot reschedule a 3rd presenter to this date.
                          </p>
                        </div>
                      );
                    } else if (countOnNewDate === 1) {
                      return (
                        <div className="mt-1.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-0.5">
                          <p className="font-extrabold flex items-center gap-1 text-blue-950">
                            <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            New Date Capacity: 1/2 Presenter Assigned (1 Slot Available):
                          </p>
                          <p className="text-[11px] text-blue-800 leading-normal">
                            Currently assigned on {rescheduleForm.newDate}: <strong>{assignedOnNewDate[0].presenterName}</strong>. 1 additional presenter slot remains available for this date.
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                          <span className="font-extrabold flex items-center gap-1 text-emerald-950 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            New Date Capacity: 0/2 Presenters Assigned
                          </span>
                          <span className="text-[10px] font-extrabold bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-md">
                            2 Slots Available
                          </span>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Day of Week
                </label>
                <select
                  value={rescheduleForm.newDayOfWeek}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, newDayOfWeek: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#4B5E40]"
                >
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                </select>
              </div>

              {rescheduleForm.newDate && (
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl space-y-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      New Two-Week Submission Deadline:
                    </span>
                    <span className="text-[11px] font-black bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-md">
                      {getSubmissionDeadline(rescheduleForm.newDate)}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-normal">
                    <strong>Updated Requirements:</strong> 1) Submit presentation topic for mentor review at least 2 weeks prior to new presentation date (Deadline: <strong>{getSubmissionDeadline(rescheduleForm.newDate)} by 09:00 AM WAT</strong>); 2) Prepare slides; 3) Prepare two paragraph summary of the topic; 4) Submit link to public artefacts; 5) Submit professional photograph.
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase text-indigo-900">
                    Meeting Link for Rescheduled Session *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = `https://meet.jit.si/BincomDevCenter_KD_${(rescheduleForm.newDate || todayStr).replace(/-/g, "")}`;
                      setRescheduleForm({ ...rescheduleForm, meetingLink: generated });
                    }}
                    className="text-[10px] font-extrabold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-600" /> Auto-Generate Link
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://meet.jit.si/BincomDevCenter_KD_Session"
                    value={rescheduleForm.meetingLink || ""}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, meetingLink: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-indigo-200 rounded-xl font-bold text-indigo-950 bg-indigo-50/30 focus:ring-2 focus:ring-[#4B5E40]"
                  />
                  <Video className="w-4 h-4 text-indigo-600 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Reason for Rescheduling (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Schedule conflict, public holiday, or mentor request..."
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#4B5E40]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Presenter Notification
                </p>
                <p className="text-[10px] text-amber-800">
                  Rescheduling will send an immediate notification to Administrator(s) and the KD presenter (<strong>{rescheduleTarget.presenterName}</strong>) with the new presentation date, time, submission deadline, and requirements. The change will also be saved to presentation history.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleTarget(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CalendarRange className="w-3.5 h-3.5" />}
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REMOVE PRESENTER FROM SCHEDULE (ADMIN / KD OWNER) */}
      {showRemovePresenterModal && removeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Remove Scheduled Presenter
                  </h3>
                  <p className="text-xs text-gray-500">
                    Unassign presenter, notify them, & open slot for reassignment
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRemovePresenterModal(false);
                  setRemoveTarget(null);
                  setRemoveReason("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            {/* CURRENT PRESENTER AND SESSION SUMMARY */}
            <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-1 text-xs">
              <div className="flex justify-between font-extrabold text-gray-900">
                <span>Presenter: {removeTarget.presenterName}</span>
                <span className="text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300 text-[10px]">
                  {removeTarget.status}
                </span>
              </div>
              <div className="text-gray-600 text-[11px] truncate">
                Topic: {removeTarget.topic || "Topic Not Yet Submitted"}
              </div>
              <div className="text-gray-500 text-[11px] pt-1 border-t border-rose-200/60">
                Session Date: <strong className="text-gray-900">{removeTarget.date} ({removeTarget.dayOfWeek || "N/A"})</strong>
              </div>
            </div>

            <form onSubmit={handleRemovePresenterSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-700 mb-1">
                  Reason for Removal * <span className="text-rose-600">(Required)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State why this presenter is being removed (e.g. Presenter request, unavailability, assignment change, track change)..."
                  value={removeReason}
                  onChange={(e) => {
                    setRemoveReason(e.target.value);
                    if (actionError) setActionError("");
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-900">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Presenter & Audit Log Action
                </p>
                <ul className="text-[10px] text-amber-800 space-y-0.5 list-disc pl-4">
                  <li><strong>{removeTarget.presenterName}</strong> will receive an immediate notification explaining the removal and the reason provided.</li>
                  <li>The presentation slot will become available for reassignment.</li>
                  <li>This action and reason will be permanently recorded in the presentation audit history.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowRemovePresenterModal(false);
                    setRemoveTarget(null);
                    setRemoveReason("");
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !removeReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Confirm Presenter Removal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: SUBMIT PRESENTATION MATERIALS */}
      {showMaterialsModal && selectedPres && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Submit Presentation Materials
                  </h3>
                  <p className="text-xs text-gray-500">
                    Required slides & summary for session review
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMaterialsModal(false);
                  setSelectedPres(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRESENTER & SESSION CONTEXT BANNER */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1 text-xs">
              <div className="flex justify-between font-extrabold text-emerald-950">
                <span>Topic: {selectedPres.topic}</span>
                <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] border border-emerald-300 font-extrabold">
                  Topic Approved
                </span>
              </div>
              <div className="text-emerald-800 text-[11px]">
                Scheduled Date: <strong>{selectedPres.date} ({selectedPres.dayOfWeek || "Tuesday"})</strong>
              </div>
              <div className="text-emerald-700 text-[10px] pt-1 border-t border-emerald-200/60">
                Presenter: <strong>{selectedPres.presenterName}</strong>
              </div>
            </div>

            {/* CHECK TOPIC APPROVAL REQUIREMENT */}
            {!isTopicApproved(selectedPres) ? (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Topic Approval Required</span>
                </div>
                <p className="leading-relaxed">
                  Presentation materials can only be submitted after your presentation topic has been approved by a Knowledge Development Mentor or Administrator.
                </p>
                <p className="text-[11px] font-bold text-amber-800">
                  Current Topic Status: <span className="underline">{selectedPres.status}</span>
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMaterialsModal(false)}
                    className="px-4 py-2 bg-amber-800 text-white rounded-xl font-bold text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitMaterials} className="space-y-4">
                {actionError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* SLIDES URL (REQUIRED) */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-700 mb-1">
                    Presentation Slides Link * <span className="text-rose-600">(Required)</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://docs.google.com/presentation/d/... or https://slides.com/..."
                    value={materialsForm.slidesUrl}
                    onChange={(e) => {
                      setMaterialsForm({ ...materialsForm, slidesUrl: e.target.value });
                      if (materialsValidationErrors.slidesUrl) {
                        setMaterialsValidationErrors({ ...materialsValidationErrors, slidesUrl: undefined });
                      }
                    }}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-emerald-600 ${
                      materialsValidationErrors.slidesUrl ? "border-rose-500 bg-rose-50/30" : "border-gray-300"
                    }`}
                  />
                  {materialsValidationErrors.slidesUrl && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">{materialsValidationErrors.slidesUrl}</p>
                  )}
                </div>

                {/* SUMMARY (REQUIRED) */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-700 mb-1">
                    Presentation Summary / Abstract * <span className="text-rose-600">(Required)</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide a concise summary of key concepts, goals, and technical insights covered in this presentation..."
                    value={materialsForm.summary}
                    onChange={(e) => {
                      setMaterialsForm({ ...materialsForm, summary: e.target.value });
                      if (materialsValidationErrors.summary) {
                        setMaterialsValidationErrors({ ...materialsValidationErrors, summary: undefined });
                      }
                    }}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-emerald-600 ${
                      materialsValidationErrors.summary ? "border-rose-500 bg-rose-50/30" : "border-gray-300"
                    }`}
                  />
                  {materialsValidationErrors.summary && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">{materialsValidationErrors.summary}</p>
                  )}
                </div>

                {/* PUBLIC ARTEFACT LINK (OPTIONAL) */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-700 mb-1">
                    Public Artefact Link <span className="text-gray-400 font-normal">(Optional - GitHub Repo, Demo App, Article, or Output)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/username/repository or https://myproject.demo.app"
                    value={materialsForm.publicArtifactLink}
                    onChange={(e) => setMaterialsForm({ ...materialsForm, publicArtifactLink: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-emerald-950">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto-Status & Mentor Notification
                  </p>
                  <p className="text-[10px] text-emerald-800">
                    Upon submission, the presentation status will automatically update to <strong>Ready for Presentation</strong> and immediate notifications will be sent to KD Mentors and Administrators.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMaterialsModal(false);
                      setSelectedPres(null);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Submit Materials
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* INDIVIDUAL SESSION FEEDBACK MODAL */}
      {feedbackTargetPres && (
        <KDSessionFeedbackModal
          presentation={feedbackTargetPres}
          profile={profile}
          attendanceRecords={attendance}
          config={currentLeaderboardConfig}
          isAdmin={isAdmin}
          isKDOwner={isKDOwner}
          onClose={() => setFeedbackTargetPres(null)}
          onSuccess={() => {
            if (onStateUpdate) onStateUpdate();
          }}
        />
      )}

      {/* AGGREGATED FEEDBACK ANALYTICS MODAL / DRAWER */}
      {showAggregatedFeedback && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-aggregated-feedback-overlay">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl relative border border-gray-200">
            <button
              onClick={() => setShowAggregatedFeedback(false)}
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <KDAggregatedFeedbackView
              presentations={presentations}
              config={currentLeaderboardConfig}
              profile={profile}
              onUpdateConfig={handleUpdateFeedbackConfig}
              onSelectPresentation={(p) => {
                setShowAggregatedFeedback(false);
                setFeedbackTargetPres(p);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
