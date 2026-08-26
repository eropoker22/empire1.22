export interface AccountRegistrationPolicyView {
  registrationEnabled: boolean;
  mode: "open" | "closed";
  /** Null means the enabled public-registration policy is permanent. */
  expiresAt: string | null;
  passwordMinimumLength: number;
  minimumAgeYears: number;
  termsAcceptanceRequired: boolean;
  termsVersion: string | null;
}

export interface AccountRegistrationRequest {
  username: string;
  gangName: string;
  dateOfBirth: string;
  password: string;
  passwordConfirmation: string;
  termsAccepted: true;
  termsVersion: string;
}
