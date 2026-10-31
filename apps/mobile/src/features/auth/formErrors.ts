// Turns validation problems into { "fieldName": "message" } so each input can show its own error.
// Works for both client-side zod issues (path is an array) and API errors (path is "business.name").
type Issue = { path: PropertyKey[] | string; message: string };

export function toFieldErrors(issues: Issue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = (Array.isArray(issue.path) ? issue.path.map(String).join(".") : issue.path) || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
