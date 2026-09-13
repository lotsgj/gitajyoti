import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";
import { build } from "esbuild";
import YAML from "yaml";

const contractUrl = new URL("../../contracts/mygita-api/openapi.yaml", import.meta.url);
const outputUrl = new URL("../../mygita/src/contracts/generated/mygita-api-validators.js", import.meta.url);
const contract = YAML.parse(await readFile(contractUrl, "utf8"));
const schemaNames = [
  "ErrorEnvelope",
  "ExperienceCatalogueManifest",
  "ExperienceCatalogueSummary",
  "ExperienceList",
  "Experience",
  "BatchList",
  "OtpChallenge",
  "AuthSession",
  "User",
  "JourneyCollection",
  "JourneyRecordList",
  "InterestList",
  "ActivityStateList",
  "Journey",
  "Interest",
  "LearnerActivity",
  "MyGitaDataManifest",
];

const ajv = new Ajv2020({ code: { esm: true, source: true }, strict: false });
addFormats(ajv);
ajv.addSchema(contract, "mygita-api");
const validators = Object.fromEntries(
  schemaNames.map((name) => {
    const schemaId = `mygita-api-${name}`;
    ajv.addSchema({ $ref: `mygita-api#/components/schemas/${name}` }, schemaId);
    return [`validate${name}`, schemaId];
  }),
);
const source = standaloneCode(ajv, validators);
const bundle = await build({
  bundle: true,
  format: "esm",
  legalComments: "none",
  minify: true,
  platform: "browser",
  stdin: {
    contents: source,
    loader: "js",
    resolveDir: dirname(fileURLToPath(import.meta.url)),
    sourcefile: "mygita-api-validators.generated.js",
  },
  write: false,
});
const generated = `// Generated from contracts/mygita-api/openapi.yaml. Do not edit.\n// @ts-nocheck\n${bundle.outputFiles[0].text}`;

if (process.argv.includes("--check")) {
  const current = await readFile(outputUrl, "utf8").catch(() => "");
  if (current !== generated) {
    console.error("Generated API validators are out of date. Run pnpm run generate:api-validators.");
    process.exitCode = 1;
  } else {
    console.log(`Verified ${schemaNames.length} generated API validators.`);
  }
} else {
  await writeFile(outputUrl, generated);
  console.log(`Generated ${schemaNames.length} browser API validators.`);
}
