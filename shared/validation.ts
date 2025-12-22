import type { ZodError } from "zod";

export function formatZodError(error: ZodError): string {
  if (!error.issues || error.issues.length === 0) {
    return "Validation error occurred";
  }

  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ")
    .trim();
}
