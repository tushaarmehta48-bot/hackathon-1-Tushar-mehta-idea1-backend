export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export type UserProfile = {
  id: string;
  displayName: string | null;
  role: UserRole;
  preferredLocale: string;
  active: boolean;
};

export type AuthenticatedUser = {
  id: string;
  email: string | undefined;
  profile: UserProfile;
};
