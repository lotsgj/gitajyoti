import { defineRoute, navigate, startRouter } from "./core/router.js";
import { setDocumentTitle } from "./core/dom.js";
import { setState } from "./core/store.js";
import { renderShell } from "./shell/app-shell.js";
import { discoverPage } from "./features/discover/discover-page.js";
import { experiencePage } from "./features/experience/experience-page.js";
import { confirmationPage, enrolPage } from "./features/experience/enrol-page.js";
import { authMethodsPage, mobilePage, onboardingPage, otpPage } from "./features/auth/auth-page.js";
import { journeyPage } from "./features/journey/journey-page.js";
import { activityPage, sessionPage } from "./features/activity/activity-page.js";
import { profilePage } from "./features/profile/profile-page.js";
import { reviewPage, systemPage } from "./features/system/system-pages.js";
import { fixtureService } from "./features/fixtures/fixture-service.js";

const root=document.querySelector("#app");
let outlet;

function render({title,content,route}) {
  const state=fixtureService.state();
  outlet=renderShell(root,state.user);
  setDocumentTitle(title);
  setState({route,user:state.user});
  outlet.innerHTML=content;
  outlet.focus({preventScroll:true});
}

function page(title,content) { return ({path})=>render({title,content:typeof content==="function"?content():content,route:path}); }
function feature(title,factory) { return ({path,params})=>render({title,content:factory(params)||systemPage("not-found"),route:path}); }

defineRoute("/discover",page("Discover",discoverPage));
defineRoute("/experience/:slug",feature("Experience",params=>experiencePage(params.slug)));
defineRoute("/experience/:slug/enrol",feature("Choose your path",params=>enrolPage(params.slug)));
defineRoute("/experience/:slug/enrolled",feature("Enrolment confirmed",params=>confirmationPage(params.slug,"enrol")));
defineRoute("/experience/:slug/interested",feature("Interest registered",params=>confirmationPage(params.slug,"interest")));
defineRoute("/auth",page("Sign up or sign in",authMethodsPage));
defineRoute("/auth/mobile",page("Your mobile number",mobilePage));
defineRoute("/auth/otp",page("Verify OTP",()=>otpPage(sessionStorage.getItem("mygita.pending.mobile")||"")));
defineRoute("/onboarding",page("Complete your profile",()=>onboardingPage(fixtureService.state().user?.personalDetails)));
defineRoute("/journey",page("My Journey",journeyPage));
defineRoute("/activity/:id",feature("Activity",params=>activityPage(params.id)));
defineRoute("/activity/:id/session",feature("Activity session",params=>sessionPage(params.id)));
defineRoute("/profile",page("Profile",profilePage));
defineRoute("/states/:type",feature("System state",params=>systemPage(params.type)));
defineRoute("/review",page("Prototype screen map",reviewPage));
defineRoute("/not-found",({path})=>render({title:"Page not found",content:systemPage("not-found"),route:path}));

document.addEventListener("click",event=>{
  const action=event.target.closest("[data-action]");
  if(!action)return;
  const name=action.dataset.action;
  if(name==="toggle-menu"||name==="toggle-mobile-menu") {
    const target=document.getElementById(name==="toggle-menu"?"account-menu":"mobile-menu");
    const opening=target.hidden;
    target.hidden=!opening;
    action.setAttribute("aria-expanded",String(opening));
  }
  if(name==="sign-out") { fixtureService.signOut(); navigate("/discover"); }
  if(name==="reset-fixtures") { fixtureService.reset(); navigate("/review"); }
});

document.addEventListener("submit",event=>{
  const form=event.target.closest("form[data-form]");
  if(!form)return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const type=form.dataset.form;
  const error=form.querySelector("[data-form-error]");
  if(type==="mobile") { sessionStorage.setItem("mygita.pending.mobile",data.mobile); navigate("/auth/otp"); }
  if(type==="otp") {
    if(data.otp!=="123456") { if(error){error.textContent="Use prototype OTP 123456.";error.hidden=false;} return; }
    navigate("/onboarding");
  }
  if(type==="onboarding") {
    fixtureService.signIn(data);
    const destination=sessionStorage.getItem("mygita.pending.destination")||"/discover";
    sessionStorage.removeItem("mygita.pending.destination");
    navigate(destination);
  }
  if(type==="enrol") {
    if(!fixtureService.state().user) { sessionStorage.setItem("mygita.pending.destination",`/experience/${form.dataset.slug}/enrol`); navigate("/auth"); return; }
    fixtureService.enrol(form.dataset.experience,data.batchId);
    navigate(`/experience/${form.dataset.slug}/enrolled`);
  }
  if(type==="interest") {
    if(!fixtureService.state().user) { sessionStorage.setItem("mygita.pending.destination",`/experience/${form.dataset.slug}/enrol`); navigate("/auth"); return; }
    fixtureService.interest(form.dataset.experience);
    navigate(`/experience/${form.dataset.slug}/interested`);
  }
  if(type==="complete-activity") { fixtureService.complete(form.dataset.activity); navigate(`/activity/${form.dataset.activity}/session`); }
  if(type==="profile") {
    fixtureService.updateProfile(data);
    render({title:"Profile",content:profilePage(),route:"/profile"});
    const notice=document.querySelector("[data-profile-notice]");
    if(notice)notice.hidden=false;
  }
});

window.addEventListener("unhandledrejection",event=>{console.error(event.reason);render({title:"Something went wrong",route:"error",content:systemPage("error")});});
startRouter();
