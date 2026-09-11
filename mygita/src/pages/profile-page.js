// @ts-check
import { identityRepository, profileEditor } from "../features/identity/index.js";
import { statusView } from "../core/components/status-view.js";
/** @param {{signal?:AbortSignal}} [options] */
export async function profilePage({signal}={}){const user=await identityRepository.getCurrentUser({signal});if(!user)return statusView({title:"Sign in to open My profile.",message:"Your personal details are available after you sign in.",action:{label:"Sign in",href:"#/auth"}});return profileEditor(user.personalDetails);}
