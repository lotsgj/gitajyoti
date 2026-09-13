import { readFile } from "node:fs/promises";
import process from "node:process";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const contractUrl = new URL("../../contracts/mygita-api/openapi.yaml", import.meta.url);
const contract = YAML.parse(await readFile(contractUrl, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(contract, "mygita-api");

function resolveReference(value) {
  if (!value?.$ref) return value;
  if (!value.$ref.startsWith("#/")) {
    throw new Error(`Only local OpenAPI references are supported: ${value.$ref}`);
  }
  return value.$ref
    .slice(2)
    .split("/")
    .reduce((current, segment) => current[segment.replaceAll("~1", "/").replaceAll("~0", "~")], contract);
}

function schemaValidator(schema) {
  if (schema?.$ref) {
    return ajv.getSchema(`mygita-api${schema.$ref}`) ?? ajv.compile({ $ref: `mygita-api${schema.$ref}` });
  }
  return ajv.compile(schema);
}

function assertValid(schema, value, label) {
  const validate = schemaValidator(schema);
  if (!validate(value)) {
    throw new Error(`${label} does not match its schema:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  }
}

function exampleValues(mediaType) {
  const values = [];
  if (Object.hasOwn(mediaType, "example")) values.push(mediaType.example);
  for (const candidate of Object.values(mediaType.examples ?? {})) {
    const example = resolveReference(candidate);
    values.push(example.value);
  }
  return values;
}

function validateDocumentExamples() {
  let count = 0;
  for (const [path, pathItem] of Object.entries(contract.paths)) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const operation = pathItem[method];
      if (!operation) continue;
      const requestBody = resolveReference(operation.requestBody);
      for (const mediaType of Object.values(requestBody?.content ?? {})) {
        for (const value of exampleValues(mediaType)) {
          assertValid(mediaType.schema, value, `${method.toUpperCase()} ${path} request example`);
          count += 1;
        }
      }
      for (const [status, responseReference] of Object.entries(operation.responses)) {
        const response = resolveReference(responseReference);
        for (const mediaType of Object.values(response.content ?? {})) {
          for (const value of exampleValues(mediaType)) {
            assertValid(mediaType.schema, value, `${method.toUpperCase()} ${path} ${status} response example`);
            count += 1;
          }
        }
      }
    }
  }
  return count;
}

function matchingOperation(method, actualPath) {
  for (const [template, pathItem] of Object.entries(contract.paths)) {
    const pattern = new RegExp(`^${template.replaceAll(/\{[^}]+\}/g, "[^/]+")}$`);
    if (pattern.test(actualPath) && pathItem[method.toLowerCase()]) {
      return { operation: pathItem[method.toLowerCase()], template };
    }
  }
  throw new Error(`No OpenAPI operation matches ${method} ${actualPath}`);
}

function validateCapturedResponses(captures) {
  const coveredOperations = new Set();
  for (const capture of captures) {
    const { operation, template } = matchingOperation(capture.method, capture.path);
    coveredOperations.add(`${capture.method.toLowerCase()} ${template}`);
    const responseReference = operation.responses[String(capture.status)] ?? operation.responses.default;
    if (!responseReference) {
      throw new Error(`No ${capture.status} response is declared for ${capture.method} ${template}`);
    }
    const response = resolveReference(responseReference);
    const mediaType = response.content?.["application/json"];
    if (!mediaType) {
      throw new Error(`No application/json response is declared for ${capture.method} ${template} ${capture.status}`);
    }
    assertValid(mediaType.schema, capture.body, `${capture.method} ${capture.path} ${capture.status}`);
  }
  const declaredOperations = new Set();
  for (const [template, pathItem] of Object.entries(contract.paths)) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      if (pathItem[method] && pathItem[method]["x-implementation-status"] !== "planned") {
        declaredOperations.add(`${method} ${template}`);
      }
    }
  }
  const missing = [...declaredOperations].filter((operation) => !coveredOperations.has(operation));
  if (missing.length) {
    throw new Error(`Mock response validation did not exercise: ${missing.join(", ")}`);
  }
}

const exampleCount = validateDocumentExamples();
if (process.argv[2] === "--responses") {
  const captures = JSON.parse(await readFile(process.argv[3], "utf8"));
  validateCapturedResponses(captures);
  console.log(`Validated ${captures.length} mock API responses against the OpenAPI contract.`);
} else {
  console.log(`Validated ${exampleCount} OpenAPI request and response examples.`);
}
