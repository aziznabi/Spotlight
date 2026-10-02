import { z, ZodError } from "zod";
import { checkOrigin, login, logout } from "@/modules/auth/server";
import { AppError, message } from "@/lib/errors";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const b = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(200),
      })
      .parse(await req.json());
    return Response.json(await login(b.email, b.password));
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ZodError ? "Email et mot de passe requis." : message(e),
      },
      { status: e instanceof AppError ? e.status : 400 },
    );
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    await logout();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: message(e) }, { status: 403 });
  }
}
