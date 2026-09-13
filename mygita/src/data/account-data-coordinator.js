// @ts-check
import { mygitaApiRequest, validateMyGitaDataManifest } from "../contracts/mygita-api.js";
import { clearSession, getSession } from "../core/session.js";
import { getBrowserMyGitaDataCache } from "./mygita-data-cache.js";

const QUIET_MS=1000;
const lastCheckedAtByAccount=new Map();
const manifestPromiseByAccount=new Map();

export function currentAccountId(){return String(getSession()?.accountId||"");}

/** @param {{signal?:AbortSignal,force?:boolean}} [options] */
export async function getAccountManifest({signal,force=false}={}){
  const accountId=currentAccountId();
  if(!accountId)return null;
  const area=getBrowserMyGitaDataCache().forAccount(accountId).manifest;
  const cached=await area.read("current");
  if(!force&&cached&&Date.now()-(lastCheckedAtByAccount.get(accountId)||0)<QUIET_MS)return cached.data;
  const inFlight=manifestPromiseByAccount.get(accountId);
  if(inFlight)return inFlight;
  const manifestPromise=(async()=>{
    const previous=/** @type {{manifest:any,etag:string|null}|undefined} */(cached?.data);
    const response=await mygitaApiRequest("/me/manifest",{authenticated:true,signal,ifNoneMatch:previous?.etag||undefined,metadata:true,validate:validateMyGitaDataManifest});
    if(response.status===304&&previous){lastCheckedAtByAccount.set(accountId,Date.now());return previous;}
    if(response.status!==200||!response.data)throw new Error("MyGita data versions could not be refreshed.");
    const value={manifest:response.data,etag:response.etag};
    await area.write("current",{recordVersion:response.etag||response.data.profileVersion,data:value});
    lastCheckedAtByAccount.set(accountId,Date.now());
    return value;
  })();
  manifestPromiseByAccount.set(accountId,manifestPromise);
  try{return await manifestPromise;}finally{
    if(manifestPromiseByAccount.get(accountId)===manifestPromise)manifestPromiseByAccount.delete(accountId);
  }
}

export function accountAreas(accountId=currentAccountId()){
  return accountId?getBrowserMyGitaDataCache().forAccount(accountId):null;
}

export function releaseAccountData(accountId){
  if(accountId)getBrowserMyGitaDataCache().releaseAccount(accountId);
  if(accountId){
    lastCheckedAtByAccount.delete(accountId);
    manifestPromiseByAccount.delete(accountId);
  }
}

/** End an invalid authenticated context without deleting its isolated durable records. */
export function rejectAccountSession(accountId=currentAccountId()){
  clearSession();
  releaseAccountData(accountId);
}

export async function invalidateAccountManifest(accountId=currentAccountId()){
  if(accountId)await getBrowserMyGitaDataCache().forAccount(accountId).manifest.remove("current");
  if(accountId)lastCheckedAtByAccount.delete(accountId);
}
