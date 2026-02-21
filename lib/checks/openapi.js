export const meta = {
  id: 'openapi',
  name: 'OpenAPI Spec',
  description: 'Checks /.well-known/openapi.json presence and validity',
  weight: 10,
};

export default async function check(ctx) {
  const start = performance.now();
  const findings = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/.well-known/openapi.json`);

  if (!res.ok) {
    findings.push({ status: 'fail', message: '/.well-known/openapi.json not found', detail: `HTTP ${res.status || 'network error'}` });
    return result(0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/openapi.json exists' });

  // Valid JSON
  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({ status: 'fail', message: 'Invalid JSON' });
    return result(10, findings, start);
  }
  findings.push({ status: 'pass', message: 'Valid JSON' });

  // OpenAPI version field
  if (data.openapi) {
    findings.push({ status: 'pass', message: `OpenAPI version: ${data.openapi}` });
  } else if (data.swagger) {
    findings.push({ status: 'warn', message: `Swagger version: ${data.swagger} (consider upgrading to OpenAPI 3.x)` });
    score -= 10;
  } else {
    findings.push({ status: 'fail', message: 'No openapi or swagger version field' });
    score -= 20;
  }

  // Info object
  if (data.info && data.info.title) {
    findings.push({ status: 'pass', message: `API title: "${data.info.title}"` });
  } else {
    findings.push({ status: 'warn', message: 'Missing info.title' });
    score -= 10;
  }

  if (data.info?.description) {
    findings.push({ status: 'pass', message: 'API description present' });
  } else {
    findings.push({ status: 'warn', message: 'Missing info.description' });
    score -= 5;
  }

  // Paths
  if (data.paths && Object.keys(data.paths).length > 0) {
    findings.push({ status: 'pass', message: `${Object.keys(data.paths).length} path(s) documented` });
  } else {
    findings.push({ status: 'warn', message: 'No paths documented' });
    score -= 15;
  }

  // Servers
  if (Array.isArray(data.servers) && data.servers.length > 0) {
    findings.push({ status: 'pass', message: `${data.servers.length} server(s) defined` });
  } else {
    findings.push({ status: 'warn', message: 'No servers defined' });
    score -= 5;
  }

  return result(Math.max(0, score), findings, start);
}

function result(score, findings, start) {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}
