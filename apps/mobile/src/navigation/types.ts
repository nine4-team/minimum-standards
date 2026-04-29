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

// Suggestor flow param list
export type SuggestorFlowParamList = {
  SuggestorChat: undefined;
};

// Individual tab stack param lists
export type StandardsStackParamList = {
  ActiveStandardsDashboard: undefined;
};

export type ScorecardStackParamList = {
  ScorecardSummary: undefined;
  ScorecardDetail: { standardId: string };
};

export type SettingsStackParamList = {
  SettingsRoot: undefined;
  StandardsLibrary: undefined;
  Snapshots: undefined;
  SnapshotCreate: undefined;
  SnapshotDetail: { snapshotId: string };
  SnapshotEdit: { snapshotId: string };
};

export type GroupsStackParamList = {
  GroupsList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
  MemberDashboard: { groupId: string; memberUid: string; displayName: string };
  MemberStandardDetail: {
    groupId: string;
    memberUid: string;
    standardId: string;
    standardName: string;
  };
};

// Bottom tab navigator param list
export type BottomTabParamList = {
  Standards: NavigatorScreenParams<StandardsStackParamList>;
  Scorecards: NavigatorScreenParams<ScorecardStackParamList>;
  Groups: NavigatorScreenParams<GroupsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
  Create: undefined;
};

// Main stack now contains the bottom tab navigator
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<BottomTabParamList>;
  CreateStandardFlow:
    | (NavigatorScreenParams<CreateStandardFlowParamList> & {
        initialRoute?: 'SelectActivity' | 'SetVolume';
      })
    | undefined;
  EditStandard: undefined;
  SuggestorFlow: NavigatorScreenParams<SuggestorFlowParamList> | undefined;
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
