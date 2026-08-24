/**
 * Feature Flags Configuration for Production Release
 * 
 * Set `ENABLE_MEETINGS_ONLY` to `true` to restrict the UI strictly to Meeting Management features
 * for the initial production deployment.
 * 
 * To re-enable all other application modules (Microservice Modules, Projects Tracker,
 * Leaderboard, Career Pathways, and non-meeting Admin desks), change `ENABLE_MEETINGS_ONLY` to `false`.
 */
export const FEATURE_FLAGS = {
  // Production Release 1.0: Enable ONLY Meeting Management
  ENABLE_MEETINGS_ONLY: true,
};
