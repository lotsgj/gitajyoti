// @ts-check

/** @typedef {{fullName:string, displayName:string, dateOfBirth:string, email?:string}} PersonalDetails */
/** @typedef {{id:string, personalDetails:PersonalDetails, onboarding?:{state:string}, roles?:string[]}} User */
/**
 * @typedef {Object} IdentityRepository
 * @property {() => Promise<User|null>} getCurrentUser
 * @property {(profile?:Partial<PersonalDetails>) => Promise<User>} signIn
 * @property {() => Promise<void>} signOut
 * @property {(profile:Partial<PersonalDetails>) => Promise<User>} updateProfile
 * @property {() => Promise<void>} reset
 */

export {};
