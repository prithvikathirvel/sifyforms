export function createError(statusCode: number, message: string ): Error {
  return Object.assign(new Error(message), { statusCode });
}
