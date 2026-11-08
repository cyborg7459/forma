export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function found<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new HttpError(404, `${label} not found`);
  return value;
}
