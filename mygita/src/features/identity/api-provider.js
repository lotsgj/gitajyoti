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
  return Object.freeze({
    async getCurrentUser() {
      if (!hasSession()) return null;
      return /** @type {import('./contract.js').User} */ (
        await request("/me", { authenticated: true, validate: validateUser })
      );
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
      setSession({ accessToken: payload.accessToken, expiresIn: payload.expiresIn });
      return { user: payload.user, isNewUser: payload.isNewUser };
    },
    async completeOnboarding(profile) {
      return /** @type {import('./contract.js').User} */ (await request("/me/onboarding", {
        method: "PATCH",
        authenticated: true,
        body: profile,
        validate: validateUser,
      }));
    },
    async signOut() { clearSession(); },
    async updateProfile(profile) {
      return /** @type {import('./contract.js').User} */ (await request("/me", {
        method: "PATCH",
        authenticated: true,
        body: profile,
        validate: validateUser,
      }));
    },
    async reset() { clearSession(); },
  });
}

export const identityApiProvider = createIdentityApiProvider();
