export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ProfileSetup: undefined;
  Home: undefined;
  DailyRecord: undefined;
  History: undefined;
  Trends: undefined;
  Reminders: undefined;
  ReminderForm: { reminderId?: string };
  Adherence: undefined;
  DoctorPatientList: undefined;
  DoctorPatientDetail: { patientId: string; patientName: string };
  AdminStats: undefined;
};
