import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { budgets, goals, movements } from "../../../db/schema";

type ActionPayload =
  | {
      action: "add-movement";
      type: "income" | "expense";
      amount: number;
      category: string;
      note?: string;
      occurredOn: string;
    }
  | { action: "set-budget"; periodKey: string; amount: number }
  | {
      action: "add-goal";
      kind: "saving" | "debt";
      name: string;
      target: number;
      current?: number;
      dueDate?: string;
    }
  | { action: "add-progress"; id: number; amount: number };

const moneyToCents = (value: number) => Math.round(value * 100);

function message(error: unknown) {
  const text = error instanceof Error ? error.message : "Error inesperado";
  return text.includes("no such table")
    ? "La base de datos todavía no está disponible. Intenta nuevamente en un momento."
    : text;
}

export async function GET() {
  try {
    const db = getDb();
    const [movementRows, budgetRows, goalRows] = await Promise.all([
      db.select().from(movements).orderBy(desc(movements.occurredOn), desc(movements.id)),
      db.select().from(budgets).orderBy(desc(budgets.periodKey)),
      db.select().from(goals).orderBy(asc(goals.kind), desc(goals.id)),
    ]);
    return Response.json({ movements: movementRows, budgets: budgetRows, goals: goalRows });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ActionPayload;
    const db = getDb();
    const now = new Date().toISOString();

    if (payload.action === "add-movement") {
      const category = payload.category?.trim();
      const cents = moneyToCents(Number(payload.amount));
      if (!category || !payload.occurredOn || !["income", "expense"].includes(payload.type) || cents <= 0) {
        return Response.json({ error: "Revisa los datos del movimiento." }, { status: 400 });
      }
      const [record] = await db.insert(movements).values({
        type: payload.type,
        amountCents: cents,
        category,
        note: payload.note?.trim() ?? "",
        occurredOn: payload.occurredOn,
        createdAt: now,
      }).returning();
      return Response.json({ record }, { status: 201 });
    }

    if (payload.action === "set-budget") {
      const cents = moneyToCents(Number(payload.amount));
      if (!/^\d{4}-\d{2}-[12]$/.test(payload.periodKey) || cents < 0) {
        return Response.json({ error: "El presupuesto no es válido." }, { status: 400 });
      }
      await db.insert(budgets).values({
        periodKey: payload.periodKey,
        amountCents: cents,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: budgets.periodKey,
        set: { amountCents: cents, updatedAt: now },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "add-goal") {
      const target = moneyToCents(Number(payload.target));
      const current = moneyToCents(Number(payload.current ?? 0));
      const name = payload.name?.trim();
      if (!name || !["saving", "debt"].includes(payload.kind) || target <= 0 || current < 0) {
        return Response.json({ error: "Revisa los datos de la meta o deuda." }, { status: 400 });
      }
      const [record] = await db.insert(goals).values({
        kind: payload.kind,
        name,
        targetCents: target,
        currentCents: Math.min(current, target),
        dueDate: payload.dueDate || null,
        createdAt: now,
      }).returning();
      return Response.json({ record }, { status: 201 });
    }

    if (payload.action === "add-progress") {
      const amount = moneyToCents(Number(payload.amount));
      if (!Number.isInteger(payload.id) || amount <= 0) {
        return Response.json({ error: "El abono no es válido." }, { status: 400 });
      }
      const [goal] = await db.select().from(goals).where(eq(goals.id, payload.id));
      if (!goal) return Response.json({ error: "No se encontró el registro." }, { status: 404 });
      const [record] = await db.update(goals)
        .set({ currentCents: Math.min(goal.targetCents, goal.currentCents + amount) })
        .where(eq(goals.id, payload.id))
        .returning();
      return Response.json({ record });
    }

    return Response.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "Registro inválido." }, { status: 400 });
    const db = getDb();
    if (resource === "movement") await db.delete(movements).where(eq(movements.id, id));
    else if (resource === "goal") await db.delete(goals).where(eq(goals.id, id));
    else return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
