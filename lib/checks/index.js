import llmsTxt, { meta as llmsTxtMeta } from './llms-txt.js';
import robotsTxt, { meta as robotsTxtMeta } from './robots-txt.js';
import agentJson, { meta as agentJsonMeta } from './agent-json.js';
import securityTxt, { meta as securityTxtMeta } from './security-txt.js';
import structuredData, { meta as structuredDataMeta } from './structured-data.js';
import metaTags, { meta as metaTagsMeta } from './meta-tags.js';
import openapi, { meta as openapiMeta } from './openapi.js';
import httpHeaders, { meta as httpHeadersMeta } from './http-headers.js';

export const checks = [
  { run: llmsTxt, meta: llmsTxtMeta },
  { run: robotsTxt, meta: robotsTxtMeta },
  { run: agentJson, meta: agentJsonMeta },
  { run: securityTxt, meta: securityTxtMeta },
  { run: structuredData, meta: structuredDataMeta },
  { run: metaTags, meta: metaTagsMeta },
  { run: openapi, meta: openapiMeta },
  { run: httpHeaders, meta: httpHeadersMeta },
];
