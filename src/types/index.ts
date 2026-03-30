export type Role = "ADMIN" | "EMPLOYEE";
export type TaskCategory = "WORK" | "PERSONAL";
export type TaskStatus = "PENDING" | "ACTIVE" | "PAUSED" | "COMPLETED";
export type TaskEvent = "CREATED" | "STARTED" | "PAUSED" | "RESUMED" | "COMPLETED";
export type ReviewStatus = "APPROVED" | "REJECTED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Shift {
  id: string;
  userId: string;
  user?: User;
  startTime: string;
  endTime?: string | null;
  createdAt: string;
  taskEntries?: TaskEntry[];
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string | null;
  category: TaskCategory;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface TaskEventLog {
  id: string;
  taskEntryId: string;
  event: TaskEvent;
  timestamp: string;
  note?: string | null;
}

export interface Review {
  id: string;
  taskEntryId: string;
  adminId: string;
  admin?: User;
  status: ReviewStatus;
  comment?: string | null;
  reviewedAt: string;
}

export interface TaskEntry {
  id: string;
  userId: string;
  user?: User;
  shiftId: string;
  shift?: Shift;
  taskDefinitionId?: string | null;
  taskDefinition?: TaskDefinition | null;
  name: string;
  description?: string | null;
  category: TaskCategory;
  isCustom: boolean;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  activeIntervalStart?: string | null;
  totalActiveTime: number;
  events?: TaskEventLog[];
  review?: Review | null;
  // Computed
  currentActiveTime?: number;
}

export interface LastShiftTaskReview {
  id: string;
  name: string;
  category: TaskCategory;
  totalActiveTime: number;
  startedAt?: string | null;
  completedAt?: string | null;
  review: {
    status: ReviewStatus;
    comment?: string | null;
    adminName: string;
    reviewedAt: string;
  } | null;
}

export interface LastShiftReview {
  id: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  workSeconds: number;
  personalSeconds: number;
  tasks: LastShiftTaskReview[];
}

export interface EmployeeDashboardData {
  activeShift: Shift | null;
  activeTask: TaskEntry | null;
  pausedTasks: TaskEntry[];
  completedTasks: TaskEntry[];
  pendingReviewTasks: TaskEntry[];
  reviewedTasks: TaskEntry[];
  taskDefinitions: TaskDefinition[];
  productiveSeconds: number;
  personalSeconds: number;
  shiftDuration: number;
  lastShiftReview: LastShiftReview | null;
}

export interface AdminDashboardData {
  totalEmployees: number;
  activeShifts: number;
  pendingReviews: number;
  todayCompletedTasks: number;
  recentShifts: ShiftWithStats[];
  pendingReviewTasks: TaskEntryWithUser[];
}

export interface ShiftWithStats {
  id: string;
  user: User;
  startTime: string;
  endTime?: string | null;
  productiveSeconds: number;
  personalSeconds: number;
  totalTasks: number;
}

export interface TaskEntryWithUser extends TaskEntry {
  user: User;
  shift: Shift;
}
