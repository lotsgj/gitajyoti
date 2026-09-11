// @ts-check
import { setDocumentTitle } from "./core/dom.js";
import { config } from "./config.js";
import { rememberDestination, takeDestination } from "./core/auth-navigation.js";
import { isAuthenticationError, isCancellation } from "./core/errors.js";
import { beginFormSubmission, showFormError } from "./core/form-state.js";
import { requestFailureView } from "./core/components/request-failure-view.js";
import { defineRoute, getCurrentPath, navigate, resolveRoute, startRouter } from "./core/router.js";
import { identityRepository } from "./features/identity/index.js";
import { journeyRepository } from "./features/journey/index.js";
import { activityPage, sessionPage } from "./pages/activity-page.js";
import { createAccountPage, mobilePage, onboardingPage, otpPage, signInPage } from "./pages/authentication-page.js";
import { discoverPage } from "./pages/discover-page.js";
import { enrolPage, confirmationPage } from "./pages/enrolment-page.js";
import { experiencePage } from "./pages/experience-page.js";
import { journeyPage } from "./pages/journey-page.js";
import { profilePage } from "./pages/profile-page.js";
import { reviewPage } from "./pages/review-page.js";
import { systemPage } from "./pages/system-page.js";
import { renderShell } from "./shell/app-shell.js";

const rootElement=document.querySelector("#app");
if(!(rootElement instanceof HTMLElement))throw new Error("MyGita application root was not found.");
const root=rootElement;
/** @type {import('./features/identity/contract.js').User|null} */
let renderedUser=null;

/** @param {string} title @param {string} content */
function renderContent(title,content){const outlet=renderShell(root,renderedUser);setDocumentTitle(title);outlet.innerHTML=content;outlet.focus({preventScroll:true});}

/** @param {{title:string,content:string,route:string,signal?:AbortSignal}} view */
async function render({title,content,route,signal}){const user=await identityRepository.getCurrentUser({signal});if(signal?.aborted)return;renderedUser=user;renderContent(title,content);}
/** @param {string} title @param {string} path @param {(signal:AbortSignal)=>Promise<string|null>|string|null} content @param {{signal:AbortSignal,isCurrent:()=>boolean}} navigation */
async function loadRoute(title,path,content,{signal,isCurrent}){
  const loadingTimer=setTimeout(()=>{if(isCurrent())renderContent(title,systemPage("loading"));},150);
  try{
    const result=await content(signal);
    clearTimeout(loadingTimer);
    if(!isCurrent())return;
    await render({title,content:result||systemPage("not-found"),route:path,signal});
  }catch(error){
    clearTimeout(loadingTimer);
    if(isCancellation(error)||!isCurrent())return;
    console.error(error);
    if(isAuthenticationError(error)){rememberDestination(path);navigate("/auth");return;}
    await render({title:"Something went wrong",content:requestFailureView(error,{online:navigator.onLine}),route:path,signal});
  }
}
function page(title,content){return ({path,signal,isCurrent})=>loadRoute(title,path,signal=>typeof content==="function"?content({signal}):content,{signal,isCurrent});}
function feature(title,factory){return ({path,params,signal,isCurrent})=>loadRoute(title,path,signal=>factory(params,{signal}),{signal,isCurrent});}

defineRoute("/discover",page("Discover",discoverPage));
defineRoute("/experience/:slug",feature("Experience",(params,options)=>experiencePage(params.slug,options)));
defineRoute("/experience/:slug/enrol",feature("Choose your path",(params,options)=>enrolPage(params.slug,options)));
defineRoute("/experience/:slug/enrolled",feature("Enrolment confirmed",(params,options)=>confirmationPage(params.slug,"enrol",options)));
defineRoute("/experience/:slug/interested",feature("Interest registered",(params,options)=>confirmationPage(params.slug,"interest",options)));
defineRoute("/auth",page("Sign in",signInPage));
defineRoute("/auth/create",page("Create an account",createAccountPage));
if(config.features.prototypeOtp){
  defineRoute("/auth/mobile",page("Your mobile number",mobilePage));
  defineRoute("/auth/otp",page("Verify OTP",()=>otpPage(sessionStorage.getItem("mygita.pending.mobile")||"")));
}
defineRoute("/onboarding",page("Set up your profile",async({signal})=>onboardingPage((await identityRepository.getCurrentUser({signal}))?.personalDetails)));
defineRoute("/journey",page("My Journey",journeyPage));
defineRoute("/activity/:id",feature("Activity",(params,options)=>activityPage(params.id,options)));
defineRoute("/activity/:id/session",feature("Activity session",(params,options)=>sessionPage(params.id,options)));
defineRoute("/profile",page("My profile",profilePage));
if(config.features.developerTools){
  defineRoute("/states/:type",feature("System state",params=>systemPage(params.type)));
  defineRoute("/review",page("Development screen map",reviewPage));
}
defineRoute("/not-found",({path,signal})=>render({title:"Page not found",content:systemPage("not-found"),route:path,signal}));

function continueAfterIdentity(){navigate(takeDestination());}

document.addEventListener("click",async event=>{const target=event.target;if(!(target instanceof Element))return;const action=target.closest("[data-action]");if(!(action instanceof HTMLElement))return;const name=action.dataset.action;if(name==="toggle-menu"||name==="toggle-mobile-menu"){const menu=document.getElementById(name==="toggle-menu"?"account-menu":"mobile-menu");if(!menu)return;const opening=menu.hidden;menu.hidden=!opening;action.setAttribute("aria-expanded",String(opening));}if(name==="toggle-password"){const input=document.getElementById(action.dataset.target||"");if(!(input instanceof HTMLInputElement))return;const showing=input.type==="text";input.type=showing?"password":"text";action.textContent=showing?"Show":"Hide";action.setAttribute("aria-label",`${showing?"Show":"Hide"} password`);action.setAttribute("aria-pressed",String(!showing));}if(name==="retry-route")void resolveRoute();if(name==="skip-profile")continueAfterIdentity();if(name==="sign-out"){await identityRepository.signOut();navigate("/discover");}if(name==="reset-fixtures"){await Promise.all([identityRepository.reset(),journeyRepository.reset()]);navigate("/review");}});

document.addEventListener("submit",async event=>{
  const target=event.target;
  if(!(target instanceof HTMLFormElement)||!target.matches("form[data-form]"))return;
  event.preventDefault();
  const form=target;
  const finishSubmission=beginFormSubmission(form);
  if(!finishSubmission)return;
  const data=Object.fromEntries(new FormData(form));
  const type=form.dataset.form;
  try{
    if(type==="password-account"){
      const password=String(data.password||"");
      if(password!==String(data.confirmPassword||""))throw new Error("The passwords do not match.");
      await identityRepository.createPasswordAccount({username:String(data.username||""),password});
      navigate("/onboarding");
    }
    if(type==="password-login"){
      await identityRepository.loginWithPassword({username:String(data.username||""),password:String(data.password||"")});
      continueAfterIdentity();
    }
    if(type==="mobile"){
      const mobile=String(data.mobile||"").replace(/\D/g,"");
      const challenge=await identityRepository.requestOtp(mobile);
      sessionStorage.setItem("mygita.pending.mobile",mobile);
      sessionStorage.setItem("mygita.pending.otpChallenge",challenge.challengeId);
      navigate("/auth/otp");
    }
    if(type==="otp"){
      const challengeId=sessionStorage.getItem("mygita.pending.otpChallenge")||"";
      const result=await identityRepository.verifyOtp(challengeId,String(data.otp||""));
      sessionStorage.removeItem("mygita.pending.otpChallenge");
      if(result.isNewUser)navigate("/onboarding");
      else continueAfterIdentity();
    }
    if(type==="onboarding"){
      await identityRepository.completeOnboarding(data);
      continueAfterIdentity();
    }
    if(type==="enrol"){
      if(!await identityRepository.getCurrentUser()){rememberDestination(`/experience/${form.dataset.slug}/enrol`);navigate("/auth");return;}
      await journeyRepository.enrol(String(form.dataset.experience),String(data.batchId||""));
      navigate(`/experience/${form.dataset.slug}/enrolled`);
    }
    if(type==="interest"){
      if(!await identityRepository.getCurrentUser()){rememberDestination(`/experience/${form.dataset.slug}/enrol`);navigate("/auth");return;}
      await journeyRepository.registerInterest(String(form.dataset.experience));
      navigate(`/experience/${form.dataset.slug}/interested`);
    }
    if(type==="complete-activity"){await journeyRepository.completeActivity(String(form.dataset.activity));navigate(`/activity/${form.dataset.activity}/session`);}
    if(type==="profile"){await identityRepository.updateProfile(data);await render({title:"My profile",content:await profilePage(),route:"/profile"});const notice=document.querySelector("[data-profile-notice]");if(notice instanceof HTMLElement){notice.hidden=false;notice.setAttribute("role","status");notice.setAttribute("aria-live","polite");}}
  }catch(error){
    console.error(error);
    if(isAuthenticationError(error)&&type!=="password-login"){rememberDestination(getCurrentPath());navigate("/auth");}
    else if(!showFormError(form,error))await render({title:"Something went wrong",route:"error",content:requestFailureView(error,{online:navigator.onLine})});
  }finally{
    finishSubmission();
  }
});

window.addEventListener("unhandledrejection",event=>{console.error(event.reason);void render({title:"Something went wrong",route:"error",content:systemPage("error")});});
window.addEventListener("online",()=>void resolveRoute());
startRouter();
