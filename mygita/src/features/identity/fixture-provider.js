// @ts-check
import { createSessionDocumentStore } from "../../core/session-document-store.js";

/** @typedef {{username:string,user:import('./contract.js').User}} FixtureAccount */
/** @typedef {{user:import('./contract.js').User|null,accounts:FixtureAccount[],journeys?:unknown[],interests?:string[],completed?:string[]}} FixtureDocument */
/** @type {FixtureDocument} */
const defaults={user:null,accounts:[]};
const store = createSessionDocumentStore("mygita.fixture.v1", defaults);

/** @param {string} value */
function normalizedUsername(value){return value.trim().toLowerCase();}

/** @param {string} username */
function pendingUser(username){return {id:`fixture-user-${username}`,personalDetails:{fullName:"",displayName:"",dateOfBirth:""},onboarding:{state:"pending"},roles:["learner"]};}

export const identityFixtureProvider = Object.freeze({
  async getCurrentUser() { return /** @type {import('./contract.js').User|null} */ (store.read().user); },
  async createPasswordAccount({username,password}) {
    const normalized=normalizedUsername(username);
    if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized))throw new Error("Choose a username with 3–32 letters, numbers, dots, hyphens or underscores.");
    if(password.length<15)throw new Error("Use a password of at least 15 characters.");
    const current=store.read();
    if(current.accounts.some(account=>account.username===normalized))throw new Error("Choose a different username.");
    const user=pendingUser(normalized);
    store.update(state=>({...state,user,accounts:[...state.accounts,{username:normalized,user}]}));
    return {user,isNewUser:true};
  },
  async loginWithPassword({username,password}) {
    const current=store.read();
    const account=current.accounts.find(candidate=>candidate.username===normalizedUsername(username));
    // Fixtures deliberately store no password or password-derived material.
    if(!account||password.length<15)throw new Error("Username or password is incorrect.");
    store.update(state=>({...state,user:account.user}));
    return {user:account.user,isNewUser:false};
  },
  async requestOtp() { return {challengeId:"fixture-otp",expiresInSeconds:300}; },
  async verifyOtp(challengeId,otp) {
    if(challengeId!=="fixture-otp"||otp!=="123456")throw new Error("OTP is incorrect");
    const user={id:"fixture-user",personalDetails:{fullName:"",displayName:"",dateOfBirth:""},onboarding:{state:"pending"},roles:["learner"]};
    store.update(state=>({...state,user}));
    return {user,isNewUser:true};
  },
  async completeOnboarding(profile) {
    const current=store.read();
    const personalDetails={fullName:profile.fullName||"Deepa Sharma",displayName:profile.displayName||"Deepa",dateOfBirth:profile.dateOfBirth||"1990-05-12",...(profile.email?{email:profile.email}:{})};
    const user={...(current.user||{id:"fixture-user",roles:["learner"]}),personalDetails,onboarding:{state:"complete"}};
    store.update(state=>({...state,user,accounts:state.accounts.map(account=>account.user.id===user.id?{...account,user}:account)}));
    return user;
  },
  async signOut() { store.update(state=>({...state,user:null})); },
  /** @param {Partial<import('./contract.js').PersonalDetails>} profile */
  async updateProfile(profile) {
    const current=store.read();
    const existing=current.user?.personalDetails||{fullName:"Deepa Sharma",displayName:"Deepa",dateOfBirth:"1990-05-12"};
    const user={...(current.user||{id:"fixture-user"}),personalDetails:{...existing,...profile},onboarding:{state:"complete"}};
    store.update(state=>({...state,user,accounts:state.accounts.map(account=>account.user.id===user.id?{...account,user}:account)}));
    return user;
  },
  async reset() { store.update(state=>({...state,user:null,accounts:[]})); },
});
