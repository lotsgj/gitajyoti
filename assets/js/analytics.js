(function () {
  "use strict";

  const CLARITY_PROJECT_ID = "yod8n0lesm";
  const CONSENT_KEY = "gitajyoti.analytics-consent.v1";
  const ENABLED_HOSTS = new Set(["gitajyoti.org", "www.gitajyoti.org"]);
  const ALLOWED_EVENTS = new Set([
    "landing_invitation_reached", "landing_learning_reached", "landing_purpose_reached",
    "landing_gratitude_reached", "landing_final_reached", "master_profile_opened",
    "master_source_opened", "foundation_link_opened", "mygita_header_selected",
    "mygita_final_selected", "mygita_footer_selected", "mygita_intro_reached",
    "mygita_experiences_reached", "experience_children_seen", "experience_sara_seen",
    "experience_yoga_seen", "experience_purna_seen", "mygita_return_selected",
    "mygita_foundation_opened"
  ]);
  let clarityInstalled = false;

  function readConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY); }
    catch (_error) { return null; }
  }

  function writeConsent(value) {
    try { window.localStorage.setItem(CONSENT_KEY, value); }
    catch (_error) { /* The choice still applies to this page. */ }
  }

  function isEnabledHost() {
    return ENABLED_HOSTS.has(window.location.hostname);
  }

  function installClarity() {
    if (clarityInstalled || !isEnabledHost()) return;
    clarityInstalled = true;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    window.clarity("set", "site_region", document.body.dataset.analyticsPage || "public");
  }

  function track(eventName) {
    if (!isEnabledHost() || !ALLOWED_EVENTS.has(eventName) || readConsent() !== "granted") return;
    installClarity();
    window.clarity("event", eventName);
  }

  function removeBanner() {
    document.querySelector(".analytics-consent")?.remove();
  }

  function setConsent(value) {
    if (value !== "granted" && value !== "denied") return;
    writeConsent(value);
    removeBanner();
    if (value === "granted") {
      installClarity();
    } else if (typeof window.clarity === "function") {
      window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
      window.clarity("consent", false);
    }
  }

  function showBanner() {
    if (!isEnabledHost() || readConsent() || document.body.dataset.analyticsPage === "privacy") return;
    const banner = document.createElement("aside");
    banner.className = "analytics-consent";
    banner.setAttribute("aria-label", "Analytics preferences");
    banner.innerHTML = `<div><strong>Help us improve Gita Jyoti</strong><p>We use privacy-conscious analytics to understand and improve the site experience. <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy &amp; Analytics</a></p></div><div class="analytics-consent-actions"><button type="button" data-analytics-consent="denied">Decline</button><button class="analytics-consent-accept" type="button" data-analytics-consent="granted">Accept analytics</button></div>`;
    document.body.appendChild(banner);
  }

  function observeSections() {
    if (!("IntersectionObserver" in window)) return;
    const selectors = document.body.dataset.analyticsPage === "landing" ? [
      ["#invitation", "landing_invitation_reached"],
      ["#learning", "landing_learning_reached"],
      ["#purpose", "landing_purpose_reached"],
      [".gratitude", "landing_gratitude_reached"],
      [".final", "landing_final_reached"]
    ] : document.body.dataset.analyticsPage === "mygita-overview" ? [
      [".coming-soon-intro", "mygita_intro_reached"],
      [".coming-soon-experiences", "mygita_experiences_reached"],
      [".coming-soon-grid article:nth-child(1)", "experience_children_seen"],
      [".coming-soon-grid article:nth-child(2)", "experience_sara_seen"],
      [".coming-soon-grid article:nth-child(3)", "experience_yoga_seen"],
      [".coming-soon-grid article:nth-child(4)", "experience_purna_seen"]
    ] : [];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
        track(entry.target.dataset.analyticsViewEvent);
        observer.unobserve(entry.target);
      });
    }, { threshold: [0.5] });
    selectors.forEach(([selector, eventName]) => {
      const element = document.querySelector(selector);
      if (!element) return;
      element.dataset.analyticsViewEvent = eventName;
      observer.observe(element);
    });
  }

  function eventForElement(element) {
    if (element.closest("[data-analytics-event]")) {
      return element.closest("[data-analytics-event]").dataset.analyticsEvent;
    }
    if (document.body.dataset.analyticsPage === "landing") {
      if (element.closest(".final-cta")) return "mygita_final_selected";
      if (element.closest('.footer a[href="mygita.html"]')) return "mygita_footer_selected";
      if (element.closest(".foundation-link")) return "foundation_link_opened";
      if (element.closest(".master-bubble-source")) return "master_source_opened";
    }
    if (document.body.dataset.analyticsPage === "mygita-overview") {
      if (element.closest(".brand,.coming-soon-back,.coming-soon-home")) return "mygita_return_selected";
      if (element.closest('.footer a[href^="https://lightoftheself.org"]')) return "mygita_foundation_opened";
    }
    return null;
  }

  function initialize() {
    if (readConsent() === "granted") installClarity();
    showBanner();
    observeSections();
    document.addEventListener("click", event => {
      const consentButton = event.target.closest("[data-analytics-consent]");
      if (consentButton) {
        setConsent(consentButton.dataset.analyticsConsent);
        return;
      }
      const eventName = eventForElement(event.target);
      if (eventName) track(eventName);
    });
  }

  window.gitaJyotiAnalytics = Object.freeze({ track, setConsent, getConsent: readConsent });
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
}());
