import { reportTerminal } from './terminal.js';
import { reportJson } from './json.js';

export function report(auditReport, format) {
  switch (format) {
    case 'json':
      reportJson(auditReport);
      break;
    case 'terminal':
    default:
      reportTerminal(auditReport);
      break;
  }
}
