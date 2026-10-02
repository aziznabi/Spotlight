export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new AppError(`Configuration requise : ${name}`, 503);
  return v;
}
export function message(e: unknown) {
  return e instanceof AppError
    ? e.message
    : "Une erreur est survenue. Réessayez ou consultez les tâches.";
}
