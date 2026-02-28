import { NavigatorScreenParams } from '@react-navigation/native';
import type { ActivityHistoryStandardSnapshot } from '@minimum-standards/shared-model';

export const SETTINGS_TAB_ROUTE_NAME = 'SettingsTab' as const;
export const SETTINGS_STACK_ROOT_SCREEN_NAME = 'SettingsRoot' as const;

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  PasswordReset: undefined;
};

// Create Standard flow param list
export type CreateStandardFlowParamList = {
  SelectActivity: undefined;
  SetVolume: undefined;
  SetPeriod: undefined;
};

// Individual tab stack param lists
export type StandardsStackParamList = {
  ActiveStandardsDashboard: undefined;
  StandardsBuilder: { standardId?: string };
  StandardDetail: { standardId: string };
};

export type ScorecardStackParamList = {
  ScorecardSummary: undefined;
  ScorecardDetail: { activityId: string };
};

export type SettingsStackParamList = {
  SettingsRoot: undefined;
  Categories: { backTo?: 'Dashboard' } | undefined;
  Activities: { backTo?: 'Dashboard' } | undefined;
  StandardsLibrary: undefined;
  Snapshots: undefined;
  SnapshotCreate: undefined;
  SnapshotDetail: { snapshotId: string };
  SnapshotEdit: { snapshotId: string };
};

// Bottom tab navigator param list
export type BottomTabParamList = {
  Standards: NavigatorScreenParams<StandardsStackParamList>;
  Scorecard: NavigatorScreenParams<ScorecardStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
  Create: undefined;
};

// Main stack now contains the bottom tab navigator
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<BottomTabParamList>;
  CreateStandardFlow: NavigatorScreenParams<CreateStandardFlowParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
  StandardPeriodActivityLogs: {
    standardId: string;
    periodStartMs?: number;
    periodEndMs?: number;
    periodStandardSnapshot?: ActivityHistoryStandardSnapshot;
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
