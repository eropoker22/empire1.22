export interface AccountRegistrationPolicyView {
  registrationEnabled: boolean;
  inviteRequired: boolean;
  mode: "closed_alpha" | "closed";
  passwordMinimumLength: number;
}
