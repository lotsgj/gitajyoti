// @ts-check
import {
  mygitaApiRequest,
  validateAuthSession,
  validateOtpChallenge,
  validateUser,
} from "../../contracts/mygita-api.js";
import { clearSession, hasSession, setSession } from "../../core/session.js";

/** @param {typeof mygitaApiRequest} request */
export function createIdentityApiProvider(request = mygitaApiRequest) {
  let currentUser=null;
  return Object.freeze({
    async getCurrentUser(options={}) {
      if (!hasSession()) return null;
      if(currentUser&&!options.force)return currentUser;
      currentUser=/** @type {import('./contract.js').User} */ (
        await request("/me", { signal:options.signal,authenticated: true, validate: validateUser })
      );
      return currentUser;
    },
    async createPasswordAccount(credentials) {
      const payload = await request("/auth/accounts", {
        method: "POST",
        body: credentials,
        validate: validateAuthSession,
      });
      currentUser=payload.user;
      setSession({ accessToken: payload.accessToken, expiresIn: payload.expiresIn, accountId:payload.user.id });
      return { user: payload.user, isNewUser: payload.isNewUser };
    },
    async loginWithPassword(credentials) {
      const payload = await request("/auth/password/login", {
        method: "POST",
        body: credentials,
        validate: validateAuthSession,
      });
      currentUser=payload.user;
      setSession({ accessToken: payload.accessToken, expiresIn: payload.expiresIn, accountId:payload.user.id });
      return { user: payload.user, isNewUser: payload.isNewUser };
    },
    async requestOtp(mobile) {
      const payload = await request("/auth/otp/request", {
        method: "POST",
        body: { countryCode: "+91", mobile },
        validate: validateOtpChallenge,
      });
      return { challengeId: payload.challengeId, expiresInSeconds: payload.expiresInSeconds };
    },
    async verifyOtp(challengeId, otp) {
      const payload = await request("/auth/otp/verify", {
        method: "POST",
        body: { challengeId, otp },
        validate: validateAuthSession,
      });
      currentUser=payload.user;
      setSession({ accessToken: payload.accessToken, expiresIn: payload.expiresIn, accountId:payload.user.id });
      return { user: payload.user, isNewUser: payload.isNewUser };
    },
    async completeOnboarding(profile) {
      currentUser=/** @type {import('./contract.js').User} */ (await request("/me/onboarding", {
        method: "PATCH",
        authenticated: true,
        body: profile,
        validate: validateUser,
      }));return currentUser;
    },
    async signOut() { currentUser=null;clearSession(); },
    async updateProfile(profile) {
      currentUser=/** @type {import('./contract.js').User} */ (await request("/me", {
        method: "PATCH",
        authenticated: true,
        body: profile,
        validate: validateUser,
      }));return currentUser;
    },
    async reset() { currentUser=null;clearSession(); },
  });
}

export const identityApiProvider = createIdentityApiProvider();
