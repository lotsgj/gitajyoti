import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";

/** @param {{method?:string,path:string,status?:number}|string} request */
function keyOf(request){
  if(typeof request==="string")return request;
  return `${request.method||"GET"} ${request.path}`;
}

/**
 * Verifies an exact HTTP request budget and records evidence for the generated report.
 * CORS preflight requests are transport noise and are deliberately excluded.
 * @param {string} scenario
 * @param {Array<{method?:string,path:string,status?:number}|string>} requests
 * @param {Record<string,number>} expected
 */
export function verifyRequestBudget(scenario,requests,expected){
  const relevant=requests.filter(request=>!keyOf(request).startsWith("OPTIONS "));
  const actual=Object.fromEntries([...new Set(relevant.map(keyOf))].sort().map(key=>[key,relevant.filter(item=>keyOf(item)===key).length]));
  try{assert.deepEqual(actual,expected,`${scenario} exceeded its request budget`);}
  catch(error){
    error.message+=`\nExpected: ${JSON.stringify(expected,null,2)}\nActual: ${JSON.stringify(actual,null,2)}`;
    throw error;
  }
  const reportPath=process.env.MYGITA_REQUEST_BUDGET_EVIDENCE;
  if(reportPath)appendFileSync(reportPath,`${JSON.stringify({scenario,expected,actual,result:"PASS"})}\n`);
}
