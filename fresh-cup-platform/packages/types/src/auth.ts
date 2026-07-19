export interface RequestOtpInput {
  /** E.164 phone number. */
  phone: string;
}

export interface VerifyOtpInput {
  phone: string;
  /** 6-digit code. */
  code: string;
}

export interface StaffLoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}
