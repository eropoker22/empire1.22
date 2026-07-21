export interface AccountRegistrationPolicyView {
  registrationEnabled: boolean;
  mode: "open" | "closed";
  passwordMinimumLength: number;
  minimumAgeYears: number;
}

export interface AccountRegistrationRequest {
  username: string;
  gangName: string;
  dateOfBirth: string;
  password: string;
  passwordConfirmation: string;
}
