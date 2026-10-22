import type { ValidationIssue } from "./types";

export function fieldMessage(issues: ValidationIssue[], field: string, severity: ValidationIssue["severity"]): string | undefined {
  const messages = issues.filter(issue => issue.field === field && issue.severity === severity).map(issue => issue.message);
  return messages.length > 0 ? [...new Set(messages)].join(" ") : undefined;
}

export function sectionErrorCount(issues: ValidationIssue[], fields: string[]): number {
  return new Set(issues.filter(issue => issue.severity === "error" && issue.field !== null && fields.some(field =>
    field.endsWith("*") ? issue.field!.startsWith(field.slice(0, -1)) : issue.field === field,
  )).map(issue => issue.field)).size;
}
