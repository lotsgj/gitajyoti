// @ts-check
import { accountAreas, currentAccountId, getAccountManifest, invalidateAccountManifest, rejectAccountSession, releaseAccountData } from "../../data/account-data-coordinator.js";
import { getSession, hasSession, setSession } from "../../core/session.js";

function announce(){if(typeof globalThis.dispatchEvent==="function"&&typeof CustomEvent!=="undefined")globalThis.dispatchEvent(new CustomEvent("mygita:private-data-updated"));}

/** @param {import('./contract.js').IdentityRepository} provider */
export function createCachedIdentityRepository(provider){
  /** @type {Map<string,import('./contract.js').User>} */
  const memory=new Map();const dirty=new Set();const refreshing=new Map();
  const remember=(user)=>{memory.set(user.id,user);return user;};

  async function fresh(accountId,options={}){
    let versioned;try{versioned=await getAccountManifest({signal:options.signal});}catch(error){if(Reflect.get(/** @type {object} */(error),"status")===401){memory.delete(accountId);rejectAccountSession(accountId);}throw error;}
    if(!versioned)return {user:memory.get(accountId)||await provider.getCurrentUser(options),changed:false};
    const version=`${versioned.manifest.accountVersion}:${versioned.manifest.profileVersion}`,area=accountAreas(accountId)?.profile;
    const previous=await area?.read("current"),cached=await area?.read("current",{version});if(cached)return {user:remember(/** @type {import('./contract.js').User} */(cached.data)),changed:false};
    const user=dirty.has(accountId)?memory.get(accountId):await provider.getCurrentUser({...options,force:true});
    if(user)await area?.write("current",{recordVersion:version,data:user});dirty.delete(accountId);return {user:user?remember(user):null,changed:Boolean(previous&&previous.recordVersion!==version)};
  }
  function background(accountId,options){if(refreshing.has(accountId))return;const pending=fresh(accountId,options).then(result=>{if(result.changed)announce();}).catch(error=>{if(Reflect.get(/** @type {object} */(error),"status")===401)announce();}).finally(()=>refreshing.delete(accountId));refreshing.set(accountId,pending);}
  function scheduleBackground(accountId,options){if(typeof globalThis.requestAnimationFrame==="function")globalThis.requestAnimationFrame(()=>background(accountId,options));else background(accountId,options);}

  return Object.freeze({
    ...provider,
    async getCurrentUser(options={}){
      if(!hasSession())return null;
      let accountId=currentAccountId();if(!accountId){const user=await provider.getCurrentUser(options);if(!user)return null;accountId=user.id;setSession({...getSession(),accountId});remember(user);dirty.add(accountId);}
      const stale=await accountAreas(accountId)?.profile.read("current");
      if(stale&&!dirty.has(accountId)){const user=remember(/** @type {import('./contract.js').User} */(stale.data));scheduleBackground(accountId,options);return user;}
      return (await fresh(accountId,options)).user;
    },
    async createPasswordAccount(credentials){const result=await provider.createPasswordAccount(credentials);remember(result.user);dirty.add(result.user.id);return result;},
    async loginWithPassword(credentials){const result=await provider.loginWithPassword(credentials);remember(result.user);dirty.add(result.user.id);return result;},
    async verifyOtp(challengeId,otp){const result=await provider.verifyOtp(challengeId,otp);remember(result.user);dirty.add(result.user.id);return result;},
    async completeOnboarding(profile){const user=remember(await provider.completeOnboarding(profile));dirty.add(user.id);await accountAreas(user.id)?.profile.remove("current");await invalidateAccountManifest(user.id);return user;},
    async updateProfile(profile){const user=remember(await provider.updateProfile(profile));dirty.add(user.id);await accountAreas(user.id)?.profile.remove("current");await invalidateAccountManifest(user.id);return user;},
    async signOut(){const accountId=currentAccountId();await provider.signOut();memory.delete(accountId);dirty.delete(accountId);releaseAccountData(accountId);},
    async reset(){const accountId=currentAccountId();await provider.reset();memory.clear();dirty.clear();releaseAccountData(accountId);},
  });
}
