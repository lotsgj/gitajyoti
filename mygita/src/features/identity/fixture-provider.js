// @ts-check
import { createSessionDocumentStore } from "../../core/session-document-store.js";

/** @typedef {{user:import('./contract.js').User|null,journeys?:unknown[],interests?:string[],completed?:string[]}} FixtureDocument */
/** @type {FixtureDocument} */
const defaults={user:null};
const store = createSessionDocumentStore("mygita.fixture.v1", defaults);

export const identityFixtureProvider = Object.freeze({
  async getCurrentUser() { return /** @type {import('./contract.js').User|null} */ (store.read().user); },
  async requestOtp() { return {challengeId:"fixture-otp",expiresInSeconds:300}; },
  async verifyOtp(challengeId,otp) {
    if(challengeId!=="fixture-otp"||otp!=="123456")throw new Error("OTP is incorrect");
    const user={id:"fixture-user",personalDetails:{fullName:"",displayName:"",dateOfBirth:""},onboarding:{state:"pending"},roles:["learner"]};
    store.update(state=>({...state,user}));
    return {user,isNewUser:true};
  },
  async completeOnboarding(profile) {
    const personalDetails={fullName:profile.fullName||"Deepa Sharma",displayName:profile.displayName||"Deepa",dateOfBirth:profile.dateOfBirth||"1990-05-12",...(profile.email?{email:profile.email}:{})};
    const user={id:"fixture-user",personalDetails,onboarding:{state:"complete"},roles:["learner"]};
    store.update(state=>({...state,user}));
    return user;
  },
  async signOut() { store.update(state=>({...state,user:null})); },
  /** @param {Partial<import('./contract.js').PersonalDetails>} profile */
  async updateProfile(profile) {
    const current=store.read();
    const existing=current.user?.personalDetails||{fullName:"Deepa Sharma",displayName:"Deepa",dateOfBirth:"1990-05-12"};
    const user={...(current.user||{id:"fixture-user"}),personalDetails:{...existing,...profile},onboarding:{state:"complete"}};
    store.update(state=>({...state,user}));
    return user;
  },
  async reset() { store.update(state=>({...state,user:null})); },
});
