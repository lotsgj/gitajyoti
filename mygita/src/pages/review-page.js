// @ts-check
export function reviewPage(){
  /** @type {Array<[string,Array<[string,string]>]>} */
  const groups=[
    ["Discover & experiences",[["Discover","#/discover"],["Gita for Children","#/experience/gita-for-children"],["Gita Sāra","#/experience/gita-sara"],["Choose batch","#/experience/gita-sara/enrol"],["Register interest","#/experience/purna-yoga-darsana/enrol"]]],
    ["Authentication",[["Choose sign-in method","#/auth"],["Mobile number","#/auth/mobile"],["OTP","#/auth/otp"],["Onboarding","#/onboarding"]]],
    ["Journey & profile",[["My Journey","#/journey"],["Activity detail","#/activity/activity-sara-teaching"],["Activity session","#/activity/activity-sara-teaching/session"],["Profile","#/profile"]]],
    ["System states",[["Loading","#/states/loading"],["Empty","#/states/empty"],["Error","#/states/error"],["Offline","#/states/offline"],["Not found","#/unknown"]]],
  ];
  return `<section class="review-page"><p class="eyebrow">Phase 2 review</p><h1>Screen map</h1><p>Open every distinct MyGita screen from one place using the selected data provider.</p><div class="review-grid">${groups.map(([title,links])=>`<section class="panel"><h2>${title}</h2><ul>${links.map(([label,href])=>`<li><a href="${href}">${label}</a></li>`).join("")}</ul></section>`).join("")}</div><button class="button button--secondary" type="button" data-action="reset-fixtures">Reset local prototype state</button></section>`;
}
