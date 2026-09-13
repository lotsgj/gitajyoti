import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { verifyRequestBudget } from "../../mygita/tests/helpers/request-budget.js";
import { requestBudgets } from "../../mygita/tests/request-budgets.js";

const siteUrl=process.env.MYGITA_TEST_SITE_URL;
const apiBaseUrl=process.env.MYGITA_TEST_API_BASE_URL;
const executablePath=process.env.MYGITA_TEST_CHROME;
if(!siteUrl||!apiBaseUrl||!executablePath)throw new Error("MYGITA_TEST_SITE_URL, MYGITA_TEST_API_BASE_URL, and MYGITA_TEST_CHROME are required.");

const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox"]});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.addInitScript(value=>{globalThis.MYGITA_CONFIG={apiBaseUrl:value,dataProvider:"api",requestTimeoutMs:2000};},apiBaseUrl);
  const responses=[];
  const requests=[];
  page.on("request",request=>{const url=new URL(request.url());if(url.pathname.startsWith("/api/v1/"))requests.push({method:request.method(),path:url.pathname});});
  page.on("response",response=>{const url=new URL(response.url());if(url.pathname.startsWith("/api/v1/"))responses.push({method:response.request().method(),path:url.pathname,status:response.status()});});

  const fixtureContext=await browser.newContext();
  const fixturePage=await fixtureContext.newPage();
  await fixturePage.addInitScript(value=>{globalThis.MYGITA_CONFIG={apiBaseUrl:value,dataProvider:"api",requestTimeoutMs:2000};},apiBaseUrl);
  const fixtureApiRequests=[];
  fixturePage.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/api/v1/"))fixtureApiRequests.push(request.url());});
  await fixturePage.goto(`${siteUrl}/mygita/#/discover?provider=fixture`);
  await fixturePage.getByRole("heading",{name:"Welcome Atmajyoti (Divine Self)"}).waitFor();
  assert.equal(await fixturePage.locator("article").count(),4);
  verifyRequestBudget("Chromium · fixture Discover",fixtureApiRequests.map(url=>({method:"GET",path:new URL(url).pathname})),requestBudgets.fixtureDiscover);
  await fixtureContext.close();

  await page.goto(`${siteUrl}/mygita/?provider=api#/discover`);
  await page.getByRole("heading",{name:"Welcome Atmajyoti (Divine Self)"}).waitFor();
  assert.equal(await page.getByText("Development screen map").count(),0);
  verifyRequestBudget("Chromium · cold API Discover",requests,requestBudgets.coldDiscover);
  verifyRequestBudget("Chromium · Atmajyoti sends no private requests",requests.filter(item=>item.path.startsWith("/api/v1/me")),requestBudgets.atmajyotiPrivate);
  const storedKeys=await page.evaluate(async()=>new Promise((resolve,reject)=>{
    const opened=indexedDB.open("mygita-data-cache");
    opened.onerror=()=>reject(opened.error);
    opened.onsuccess=()=>{
      const transaction=opened.result.transaction("documents","readonly");
      const request=transaction.objectStore("documents").getAllKeys();
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>resolve(request.result);
    };
  }));
  assert.ok(storedKeys.includes("public:catalogue:manifest"));
  assert.ok(storedKeys.includes("public:catalogue:summaries"));

  responses.length=0;
  requests.length=0;
  await page.waitForTimeout(1100);
  await page.reload();
  await page.getByRole("heading",{name:"Welcome Atmajyoti (Divine Self)"}).waitFor();
  await page.waitForTimeout(100);
  // Chromium exposes a cache-resolved 304 as status 200 to page observers;
  // the Flask log and lower-level integration test assert the wire status.
  verifyRequestBudget("Chromium · warm unchanged Discover",requests,requestBudgets.warmDiscover);

  responses.length=0;
  requests.length=0;
  await page.getByRole("link",{name:"Gita Sāra",exact:true}).click();
  await page.waitForURL("**#/experience/gita-sara");
  await page.locator("h1").getByText("Gita Sāra",{exact:true}).waitFor();
  assert.equal(responses.filter(item=>item.path.endsWith("/experiences/gita-sara")&&item.status===200).length,1);
  await page.goto(`${siteUrl}/mygita/?provider=api#/discover`);
  await page.getByRole("link",{name:"Gita Sāra",exact:true}).click();
  await page.waitForURL("**#/experience/gita-sara");
  await page.locator("h1").getByText("Gita Sāra",{exact:true}).waitFor();
  verifyRequestBudget("Chromium · repeated Experience detail",requests,requestBudgets.repeatedExperience);

  responses.length=0;
  requests.length=0;
  await context.setOffline(true);
  await page.goto(`${siteUrl}/mygita/?provider=api#/discover`,{waitUntil:"commit"}).catch(()=>{});
  await page.getByRole("heading",{name:"Welcome Atmajyoti (Divine Self)"}).waitFor();
  assert.equal(await page.locator("article").count(),4);
  await page.waitForTimeout(100);
  verifyRequestBudget("Chromium · offline cached Discover",requests,requestBudgets.offlineDiscover);
  await context.setOffline(false);

  const liveGreeting=page.locator(".discover-hero");
  assert.equal(await liveGreeting.getAttribute("aria-live"),"polite");
  assert.equal(await liveGreeting.getAttribute("aria-atomic"),"true");

  const challengeResponse=await fetch(`${apiBaseUrl}/auth/otp/request`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({countryCode:"+91",mobile:"9876543210"})});
  assert.equal(challengeResponse.status,201);
  const challenge=await challengeResponse.json();
  const authenticationResponse=await fetch(`${apiBaseUrl}/auth/otp/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:challenge.challengeId,otp:"123456"})});
  assert.equal(authenticationResponse.status,200);
  const authentication=await authenticationResponse.json();
  await page.evaluate(session=>sessionStorage.setItem("mygita.session.v1",JSON.stringify(session)),{accessToken:authentication.accessToken,expiresIn:authentication.expiresIn,accountId:authentication.user.id});
  await page.goto(`${siteUrl}/mygita/?provider=api#/profile`);
  await page.getByLabel("Full name").fill("Browser Quality User");
  await page.getByLabel("Display name").fill("Browser Jyoti");
  await page.getByLabel("Date of birth").fill("1980-01-01");
  await page.getByRole("button",{name:"Save profile",exact:true}).click();
  await page.getByText("Profile updated.").waitFor();
  await page.goto(`${siteUrl}/mygita/?provider=api#/discover`);
  const personalized=page.locator(".discover-hero");
  await personalized.getByRole("heading",{name:"Welcome Atmajyoti (Divine Self) Browser Jyoti"}).waitFor();
  assert.equal(await personalized.getAttribute("aria-live"),"polite");
  console.log("Verified rendered-browser IndexedDB, accessibility, offline cache, production parity, and request budgets.");
}finally{
  await browser.close();
}
