/**
 * Types for Bincom Dev Center Platform
 */

export type UserRole = "user" | "admin" | "mentor";

export type OnboardingStatus =
  | "onboarding"
  | "assessment_failed"
  | "assessment_passed"
  | "oriented"
  | "dashboard"
  | "admin";

export interface CustomTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "Completed";
  assignedAt: string;
}

export interface Profile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  password?: string;
  education: string;
  occupation: string;
  techExperience: string; // e.g. "Beginner", "Intermediate", "Advanced"
  track: string; // Selected tech track
  role: UserRole;
  status: OnboardingStatus;
  score?: number; // Score from assessment questions
  joinedAt: string;
  learningLevel?: string;
  previousCourseCompleted?: boolean;
  assignedTasks?: CustomTask[];
  validatedAt?: string;
  validatedBy?: string;
  placementConfirmed?: boolean;
  isLocked?: boolean;
  lockReason?: string;
  lockedAt?: string;
  lockedBy?: string;
}

export type MeetingType = "knowledge" | "microservice" | "project";

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType | string;
  timeString: string; // e.g. "09:00 AM" or "04:00 PM"
  trackId: string | string[]; // Backed track name, or "All"
  jitsiUrl: string;
  projectId?: string; // Optional linked project
  project_id?: string;
  groupId?: string;
  group_id?: string;
  assignedGroupId?: string;
  assignedGroupIds?: string[];
  scheduleDays?: string[];
  meetingDates?: string[];
  isActive?: boolean;
  targetTeamTrackEligibility?: string[] | null;
  userLevels?: string[] | null;
  assignedUserIds?: string[];
  duration?: string;
  organizer?: string;
  status?: string;
  description?: string;
  seriesId?: string;
  occurrenceDate?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceCustomInterval?: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  meetingId: string;
  meetingTitle: string;
  meetingType: MeetingType | string;
  timestamp: string; // UTC ISO String
  joinedAtTime?: string; // e.g. "02:57:12 AM WAT"
  status: "Attended" | "Late" | "Missed";
  track: string;
  meetingDate?: string; // Optional: to link to a specific date instance
  date?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  duration?: string;
  organizer?: string;
  userLevels?: string[];
  targetTeamTrackEligibility?: string[];
}

export interface MeetingHistoryRecord {
  id: string; // m-hist-<meetingId>-<date>
  meetingId: string;
  title: string;
  type: string;
  date: string; // YYYY-MM-DD
  scheduledStartTime: string;
  scheduledEndTime: string;
  duration: string;
  organizer: string;
  userLevels: string[];
  targetTeamTrackEligibility: string[];
}

export interface AttendanceAuditLog {
  id: string;
  timestamp: string; // UTC ISO String
  adminId: string;
  adminUsername: string;
  action: string;
  meetingId: string;
  meetingDate: string;
  targetUserId: string;
  previousStatus: string;
  newStatus: string;
}

export interface StandupLog {
  id: string;
  userId: string;
  fullName: string;
  track: string;
  date: string; // "YYYY-MM-DD"
  morningGoals?: string;
  eveningAchievements?: string;
  morningTime?: string;
  eveningTime?: string;
}

export interface PersonalDevelopmentLog {
  id: string;
  userId: string;
  fullName: string;
  track: string;
  date: string;
  summary: string; // 100-word daily overview
  timestamp: string;
}

export interface TechUpdateSubmission {
  id: string;
  userId: string;
  fullName: string;
  track: string;
  title: string;
  url: string;
  summary: string;
  timestamp: string;
}

export interface WeeklyDrill {
  id: string;
  title: string;
  description: string;
  link: string; // e.g. github challenge or reading
  postedAt: string;
}

export interface WeeklyDrillSubmission {
  id: string;
  drillId: string;
  drillTitle: string;
  userId: string;
  fullName: string;
  track: string;
  solutionUrl: string;
  feedback?: string;
  status: "Pending" | "Approved" | "Rejected";
  timestamp: string;
}

export interface SocialEventLog {
  id: string;
  userId: string;
  fullName: string;
  track: string;
  title: string;
  link: string;
  type: "blog" | "hackathon" | "public-artifact";
  timestamp: string;
}

export interface ProjectDescriptor {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Hold";
  members: string[]; // usernames or primary developer IDs
  githubUrl?: string;
  meetings: Array<{ id: string; title: string; time: string; jitsiUrl: string }>;
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  isSoftSkill?: boolean;
}

export interface AssessmentAttempt {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  track: string;
  score: number;
  status: string;
  timestamp: string;
  answers?: Record<string, number>;
  technicalScore?: number;
  softSkillsScore?: number;
}

export interface DailyReportLog {
  id: string;
  userId: string;
  fullName: string;
  track: string;
  date: string; // "YYYY-MM-DD"
  accomplishments: string;
  hoursSpent: number;
  roadblocks: string;
  takeaways: string;
  timestamp: string;
}

export interface MeetingAssignment {
  meetingId: string;
  userId: string;
}

export interface QueuedMeetingUpdate {
  id: string;
  meetingId: string;
  type: "create" | "edit" | "delete";
  meetingData?: any;
  deleteMode?: "single" | "future" | "all";
  recurrenceEditMode?: "single" | "future" | "all";
  createdAt: string;
  adminId: string;
  adminEmail: string;
  status: "pending" | "applied" | "failed" | "synced";
  error?: string;
  errorTimestamp?: string;
  syncOption?: "immediate" | "midnight";
  action?: "save" | "delete";
}

export type KDPresentationStatus =
  | "Approved"
  | "Pending Review"
  | "Awaiting topic submission"
  | "Rejected"
  | "Cancelled"
  | "Rescheduled"
  | "Completed"
  | "Ready for Presentation"
  | "Draft";

export interface KDPresentationHistoryEntry {
  previousDate: string;
  previousDayOfWeek?: string;
  newDate: string;
  newDayOfWeek?: string;
  rescheduledAt: string;
  rescheduledBy: string;
  reason?: string;
}

export interface KDPresentationComment {
  id: string;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

export interface KDPresentationRating {
  userId: string;
  userName: string;
  rating: number; // 1 to 5 stars (or 1 to max rating scale e.g. 10)
  feedbackScore?: number; // 0 to 100 percentage
  feedbackText?: string;
  createdAt: string;
  isAnonymous?: boolean;
}

export interface KDPresentation {
  id: string;
  date: string; // "YYYY-MM-DD" e.g. "2026-08-04"
  dayOfWeek?: string; // e.g. "Tuesday", "Wednesday", "Thursday", "Friday"
  topic?: string;
  presenterUserId?: string;
  presenterName: string;
  presenterEmail?: string;
  assignedMentorUserId?: string;
  assignedMentorName?: string;
  status: KDPresentationStatus;
  notes?: string;
  linkedMeetingId?: string;
  meetingLink?: string;
  submittedAt?: string;
  updatedAt?: string;
  // Presentation Materials fields
  slidesUrl?: string;
  summary?: string;
  publicArtifactLink?: string;
  materialsSubmittedAt?: string;
  materialsLocked?: boolean;
  materialsLockedBy?: string;
  materialsLockedAt?: string;
  history?: KDPresentationHistoryEntry[];
  comments?: KDPresentationComment[];
  rating?: number; // Average rating (1-5)
  feedbackScore?: number; // Average feedback score (0-100)
  ratings?: KDPresentationRating[];
}

export interface KDLeaderboardConfig {
  presenterWeights: {
    avgRatingWeight: number; // default 40
    feedbackScoreWeight: number; // default 30
    completedPresentationsWeight: number; // default 30
  };
  attendeeWeights: {
    sessionsAttendedWeight: number; // default 40
    onTimeAttendanceWeight: number; // default 40
    attendancePercentageWeight: number; // default 20
  };
  ratingScale?: number; // default 5 (options: 5 or 10)
  allowAnonymousFeedback?: boolean; // default true
  lastPublishedMonth?: string; // "YYYY-MM"
  lastPublishedAt?: string;
}

export const defaultKDLeaderboardConfig: KDLeaderboardConfig = {
  presenterWeights: {
    avgRatingWeight: 40,
    feedbackScoreWeight: 30,
    completedPresentationsWeight: 30
  },
  attendeeWeights: {
    sessionsAttendedWeight: 40,
    onTimeAttendanceWeight: 40,
    attendancePercentageWeight: 20
  },
  ratingScale: 5,
  allowAnonymousFeedback: true
};

export interface KnowledgeDevelopmentInfo {
  title?: string;
  about?: string;
  purpose?: string;
  objectives?: string;
  whyFacilitate?: string;
  whyAttend?: string;
  sessionInfo?: string;
  attendanceInfo?: string;
  presenterInfo?: string;
  learningProgress?: string;
  meetingLink?: string;
  targetSessionsPerMonth?: number;
  compulsoryLevels?: string[];
  config?: KDLeaderboardConfig;
  kdLeaderboardConfig?: KDLeaderboardConfig;
  // Legacy fields retained for backwards compatibility
  overview?: string;
  curriculumAndTopics?: string;
  scheduleDetails?: string;
  facilitatorsAndMentors?: string;
  recommendedResources?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export const DEFAULT_KD_COMPULSORY_LEVELS = [
  "Apprentice level 1",
  "Apprentice level 2",
  "Apprentice level 3",
  "Apprentice",
  "Intern",
  "Volunteer beginner level",
  "Volunteer intermediate level",
  "Volunteer advanced level",
  "Trainee Level 1",
  "Trainee Level 2",
  "Trainee Level 3",
  "Trainee",
  "Global Techie 0",
  "Global Techie 1",
  "Global Techie Level 0",
  "Global Techie Level 1"
];

export const defaultKnowledgeDevelopmentInfo: KnowledgeDevelopmentInfo = {
  title: "Knowledge Development (KD) Microservice",
  about: "Knowledge Development (KD) is a structured learning and knowledge-sharing platform within the Bincom Dev Center App that enables techies to continuously learn, share expertise, present technical topics, and broaden their knowledge across different areas of Information and Communication Technology (ICT).",
  purpose: "• Update our knowledge on the best use of technology\n• To know something about everything\n• Help the respective participants to understand new trends in the ever-growing world of ICT\n• To help participants learn more about topics within and outside their field of expertise.",
  objectives: "• To provide high-level of information about specific subject/topic/body of knowledge\n• Update our knowledge on the best use of technology\n• To know something about everything\n• Help the respective participants to understand new trends in the ever-growing world of ICT\n• To help participants learn more about topics within and outside their field of expertise.",
  whyFacilitate: "• To build communication and presentation skills\n• To know at least one thing about everything in the organization\n• To learn more while obliged to facilitate, present and teach in the KD session\n• To develop pitching confidence\n• To learn the best use of technology\n• Finally, it serves as an avenue to dig deep in a certain field of interest",
  whyAttend: "• To know at least one thing about everything in the organization\n• To further advance knowledge in certain and various field\n• To show visibility and activeness at work\n• To meet with likemind people and industry peers\n• To understand and emulate what it takes to present and share knowledge.\n• Finally it serves as an avenue to dig deep in a certain field of interest.",
  sessionInfo: "• Knowledge Development sessions hold every Tuesday to Friday.\n• Sessions begin at 9:00 AM (WAT).\n• Sessions are conducted through the Meeting module.\n• The meeting link will be available only when a session has been scheduled.",
  attendanceInfo: "• Attendance is compulsory for applicable Techie Levels (apprentices, interns, trainee, global techie level 0 and 1).\n• Attendance contributes to Knowledge Development KPIs.\n• Attendance is tracked automatically through the Meeting module.\n• Users cannot manually update their attendance.",
  presenterInfo: "• Submit a presentation topic 2 weeks before your scheduled date\n• Submit presentation slides and Presentation summary 1 week before presentation date\n• Record yourself sharing screen and making your presentation prior to your real presentation\n• Share this recorded video on your socials (this is called public artefact).\n• Share public artefact, presentation summary and slides on kd channel.",
  learningProgress: "• Users earn progress through active participation.\n• Presentation activities contribute to learning development.\n• Attendance contributes toward Knowledge Development KPIs.\n• Learning progress is tracked automatically.",
  meetingLink: "https://meet.jit.si/BincomDevCenterKDHub",
  targetSessionsPerMonth: 16,
  compulsoryLevels: DEFAULT_KD_COMPULSORY_LEVELS,
  lastUpdatedBy: "Bincom Platform Administrator",
  lastUpdatedAt: new Date().toISOString()
};



