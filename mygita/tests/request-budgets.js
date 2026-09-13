export const requestBudgets=Object.freeze({
  fixtureDiscover:{},
  coldDiscover:{
    "GET /api/v1/experience-catalogue/manifest":1,
    "GET /api/v1/experience-catalogue/summaries":1,
  },
  warmDiscover:{"GET /api/v1/experience-catalogue/manifest":1},
  repeatedExperience:{
    "GET /api/v1/experience-catalogue/manifest":2,
    "GET /api/v1/experiences/gita-sara":1,
  },
  offlineDiscover:{},
  atmajyotiPrivate:{},
  firstPrivateComposition:{
    "GET /api/v1/me/activity-state":1,
    "GET /api/v1/me/interests":1,
    "GET /api/v1/me/journeys":1,
    "GET /api/v1/me/manifest":1,
  },
  mutationResponseReuse:{
    "GET /api/v1/me/activity-state":1,
    "GET /api/v1/me/interests":1,
    "GET /api/v1/me/journeys":1,
    "POST /api/v1/me/activities/activity-sara-teaching/complete":1,
    "POST /api/v1/me/interests":1,
    "POST /api/v1/me/journey":1,
  },
  selectiveInterestRefresh:{
    "GET /api/v1/me/interests":1,
    "GET /api/v1/me/manifest":1,
  },
  selectiveProfileRefresh:{
    "GET /api/v1/me":1,
    "GET /api/v1/me/manifest":1,
  },
});
