// @ts-check

/** @typedef {{fullName:string, displayName:string, dateOfBirth:string, email?:string}} PersonalDetails */
/** @typedef {{id:string, personalDetails:PersonalDetails, onboarding?:{state:string}, roles?:string[]}} User */
/** @typedef {{challengeId:string,expiresInSeconds:number}} OtpChallenge */
/** @typedef {{user:User,isNewUser:boolean}} AuthenticationResult */
/** @typedef {{username:string,password:string}} PasswordCredentials */
/**
 * @typedef {Object} IdentityRepository
 * @property {() => Promise<User|null>} getCurrentUser
 * @property {(credentials:PasswordCredentials) => Promise<AuthenticationResult>} createPasswordAccount
 * @property {(credentials:PasswordCredentials) => Promise<AuthenticationResult>} loginWithPassword
 * @property {(mobile:string) => Promise<OtpChallenge>} requestOtp
 * @property {(challengeId:string,otp:string) => Promise<AuthenticationResult>} verifyOtp
 * @property {(profile:Partial<PersonalDetails>) => Promise<User>} completeOnboarding
 * @property {() => Promise<void>} signOut
 * @property {(profile:Partial<PersonalDetails>) => Promise<User>} updateProfile
 * @property {() => Promise<void>} reset
 */

export {};
