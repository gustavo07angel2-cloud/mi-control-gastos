"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BanknoteArrowDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  Plus,
  ReceiptText,
  Target,
  Trash2,
  WalletCards,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

type Movement = {
  id: number;
  type: "income" | "expense";
  amountCents: number;
  category: string;
  note: string;
  occurredOn: string;
};

type Budget = { id: number; periodKey: string; amountCents: number };
type Goal = {
  id: number;
  kind: "saving" | "debt";
  name: string;
  targetCents: number;
  currentCents: number;
  dueDate: string | null;
};
type DashboardData = { movements: Movement[]; budgets: Budget[]; goals: Goal[] };

const EXPENSE_CATEGORIES = ["Casa", "Universidad", "Gasolina", "Alimentación", "Internet", "Transporte", "Salud", "Ocio", "Otros"];
const INCOME_CATEGORIES = ["Salario", "Comisiones", "Ventas", "Otros ingresos"];
const CHART_COLORS = ["#126a55", "#e28b3b", "#376fa3", "#8a5cad", "#d04f5e", "#45968a"];
const chartConfig = { amount: { label: "Total", color: "#126a55" } } satisfies ChartConfig;

const quetzales = (cents: number) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", minimumFractionDigits: 2 }).format(cents / 100);

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function getInitialPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), half: now.getDate() <= 15 ? 1 : 2 };
}

function shiftPeriod(period: ReturnType<typeof getInitialPeriod>, direction: -1 | 1) {
  let index = period.year * 24 + period.month * 2 + (period.half - 1) + direction;
  const year = Math.floor(index / 24);
  index -= year * 24;
  return { year, month: Math.floor(index / 2), half: (index % 2) + 1 };
}

async function api(body: unknown) {
  const response = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "No se pudo guardar.");
  return result;
}

export function ExpenseDashboard() {
  const [data, setData] = useState<DashboardData>({ movements: [], budgets: [], goals: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(getInitialPeriod);
  const [movementOpen, setMovementOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar tus datos.");
      setData(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar tus datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const periodKey = `${period.year}-${String(period.month + 1).padStart(2, "0")}-${period.half}`;
  const periodLabel = `${period.half === 1 ? "1.ª" : "2.ª"} quincena · ${new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" }).format(new Date(period.year, period.month, 1))}`;
  const periodMovements = useMemo(() => data.movements.filter((item) => {
    const [year, month, day] = item.occurredOn.split("-").map(Number);
    return year === period.year && month === period.month + 1 && (period.half === 1 ? day <= 15 : day >= 16);
  }), [data.movements, period]);

  const income = periodMovements.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amountCents, 0);
  const expense = periodMovements.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amountCents, 0);
  const balance = income - expense;
  const budget = data.budgets.find((item) => item.periodKey === periodKey)?.amountCents ?? 0;
  const available = budget - expense;
  const budgetPercent = budget > 0 ? Math.min(100, Math.round((expense / budget) * 100)) : 0;

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    periodMovements.filter((item) => item.type === "expense").forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amountCents));
    return [...totals.entries()].map(([category, cents], index) => ({ category, amount: cents / 100, cents, fill: CHART_COLORS[index % CHART_COLORS.length] })).sort((a, b) => b.cents - a.cents);
  }, [periodMovements]);

  const dayData = useMemo(() => {
    const totals = new Map<number, number>();
    periodMovements.filter((item) => item.type === "expense").forEach((item) => {
      const day = Number(item.occurredOn.slice(8, 10));
      totals.set(day, (totals.get(day) ?? 0) + item.amountCents / 100);
    });
    const start = period.half === 1 ? 1 : 16;
    const end = period.half === 1 ? 15 : new Date(period.year, period.month + 1, 0).getDate();
    return Array.from({ length: end - start + 1 }, (_, index) => ({ day: String(start + index), amount: totals.get(start + index) ?? 0 }));
  }, [periodMovements, period]);

  async function remove(resource: "movement" | "goal", id: number) {
    const response = await fetch(`/api/data?resource=${resource}&id=${id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error ?? "No se pudo eliminar.");
    toast.success("Registro eliminado");
    await load();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dcefe9_0,_transparent_32rem)] pb-16 text-foreground">
      <Toaster richColors position="top-center" />
      <header className="border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(18,106,85,.24)]"><WalletCards className="size-5" /></div>
            <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Mi Control</p><h1 className="text-xl font-bold tracking-tight">Gastos personales</h1></div>
          </div>
          <Button onClick={() => setMovementOpen(true)} className="h-11 rounded-xl px-4 shadow-sm"><Plus /> <span className="hidden sm:inline">Nuevo movimiento</span><span className="sm:hidden">Agregar</span></Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-1 text-sm font-medium text-muted-foreground">Resumen de</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Quincena anterior" onClick={() => setPeriod((value) => shiftPeriod(value, -1))}><ChevronLeft /></Button><h2 className="min-w-0 text-xl font-bold capitalize sm:text-2xl">{periodLabel}</h2><Button variant="outline" size="icon" aria-label="Quincena siguiente" onClick={() => setPeriod((value) => shiftPeriod(value, 1))}><ChevronRight /></Button></div></div>
          <Button variant="outline" onClick={() => setBudgetOpen(true)}><CalendarDays /> {budget ? "Editar presupuesto" : "Definir presupuesto"}</Button>
        </section>

        {loading ? <DashboardSkeleton /> : <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Saldo de la quincena" value={quetzales(balance)} detail="Ingresos menos gastos" icon={<CircleDollarSign />} tone={balance < 0 ? "red" : "green"} />
            <SummaryCard title="Ingresos" value={quetzales(income)} detail={`${periodMovements.filter((item) => item.type === "income").length} movimientos`} icon={<ArrowDownLeft />} tone="blue" />
            <SummaryCard title="Gastos" value={quetzales(expense)} detail={`${periodMovements.filter((item) => item.type === "expense").length} movimientos`} icon={<ArrowUpRight />} tone="orange" />
            <SummaryCard title="Presupuesto disponible" value={budget ? quetzales(available) : "Sin definir"} detail={budget ? `${budgetPercent}% utilizado` : "Agrega un límite quincenal"} icon={<Landmark />} tone={available < 0 ? "red" : "purple"} />
          </section>

          <section className="rounded-3xl bg-[#173c34] p-5 text-white shadow-[0_18px_48px_rgba(23,60,52,.18)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-white/65">Control del presupuesto</p><p className="mt-1 text-2xl font-bold">{budget ? `${quetzales(expense)} de ${quetzales(budget)}` : "Define cuánto puedes gastar"}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">{budget ? `${budgetPercent}% usado` : "Sin límite"}</span></div>
            <Progress value={budgetPercent} className="h-3 bg-white/15 [&_[data-slot=progress-indicator]]:bg-[#6bd6b8]" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
            <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5"><h3 className="text-lg font-bold">Gastos por día</h3><p className="text-sm text-muted-foreground">Comportamiento durante la quincena</p></div>
              {expense ? <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto">
                <BarChart data={dayData} margin={{ left: -12, right: 4, top: 8 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `Q${value}`} width={56} /><ChartTooltip cursor={{ fill: "#edf4f2" }} content={<ChartTooltipContent formatter={(value) => quetzales(Number(value) * 100)} />} /><Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} /></BarChart>
              </ChartContainer> : <EmptyChart />}
            </article>

            <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-4"><h3 className="text-lg font-bold">Por categoría</h3><p className="text-sm text-muted-foreground">En qué se fue el dinero</p></div>
              {categoryData.length ? <><ChartContainer config={chartConfig} className="mx-auto h-[180px] w-full max-w-[260px] aspect-auto"><PieChart><Pie data={categoryData} dataKey="amount" nameKey="category" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0} /></PieChart></ChartContainer><div className="mt-2 space-y-2">{categoryData.slice(0, 5).map((item) => <div key={item.category} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2.5 rounded-full" style={{ background: item.fill }} />{item.category}</span><strong>{quetzales(item.cents)}</strong></div>)}</div></> : <EmptyChart compact />}
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
            <article className="overflow-hidden rounded-3xl border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b p-5 sm:px-6"><div><h3 className="text-lg font-bold">Movimientos</h3><p className="text-sm text-muted-foreground">Ingresos y gastos de esta quincena</p></div><Button variant="outline" size="sm" onClick={() => setMovementOpen(true)}><Plus /> Agregar</Button></div>
              {periodMovements.length ? <div className="divide-y">{periodMovements.map((item) => <div key={item.id} className="group flex items-center gap-3 px-5 py-4 sm:px-6"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{item.type === "income" ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.note || item.category}</p><p className="text-sm text-muted-foreground">{item.category} · {new Date(`${item.occurredOn}T12:00:00`).toLocaleDateString("es-GT", { day: "numeric", month: "short" })}</p></div><strong className={item.type === "income" ? "text-emerald-700" : "text-foreground"}>{item.type === "income" ? "+" : "−"}{quetzales(item.amountCents)}</strong><Button variant="ghost" size="icon-sm" aria-label="Eliminar movimiento" className="text-muted-foreground opacity-70 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => void remove("movement", item.id)}><Trash2 /></Button></div>)}</div> : <div className="grid min-h-56 place-items-center p-8 text-center"><div><ReceiptText className="mx-auto mb-3 size-9 text-muted-foreground/55" /><p className="font-semibold">No hay movimientos en esta quincena</p><p className="mt-1 text-sm text-muted-foreground">Agrega tu primer ingreso o gasto.</p></div></div>}
            </article>

            <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Metas y deudas</h3><p className="text-sm text-muted-foreground">Avance de tus compromisos</p></div><Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}><Plus /> Nueva</Button></div>
              {data.goals.length ? <div className="space-y-4">{data.goals.map((goal) => {
                const percent = Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100));
                return <div key={goal.id} className="rounded-2xl border bg-muted/25 p-4"><div className="flex items-start gap-3"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${goal.kind === "saving" ? "bg-teal-100 text-teal-700" : "bg-rose-100 text-rose-700"}`}>{goal.kind === "saving" ? <Target className="size-5" /> : <BanknoteArrowDown className="size-5" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{goal.name}</p><span className="text-sm font-bold">{percent}%</span></div><p className="mt-0.5 text-sm text-muted-foreground">{goal.kind === "saving" ? "Ahorrado" : "Pagado"}: {quetzales(goal.currentCents)} de {quetzales(goal.targetCents)}</p>{goal.dueDate && <p className="mt-1 text-xs text-muted-foreground">Fecha objetivo: {new Date(`${goal.dueDate}T12:00:00`).toLocaleDateString("es-GT")}</p>}</div></div><Progress value={percent} className="mt-3 h-2" /><div className="mt-3 flex justify-end gap-2"><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void remove("goal", goal.id)}><Trash2 /> Eliminar</Button>{percent < 100 && <Button size="sm" variant="secondary" onClick={() => setProgressGoal(goal)}>Registrar abono</Button>}</div></div>;
              })}</div> : <div className="grid min-h-48 place-items-center text-center"><div><Target className="mx-auto mb-3 size-9 text-muted-foreground/55" /><p className="font-semibold">Todavía no hay metas ni deudas</p><p className="mt-1 text-sm text-muted-foreground">Agrégalas para visualizar tu avance.</p></div></div>}
            </article>
          </section>
        </>}
      </div>

      <MovementDialog open={movementOpen} setOpen={setMovementOpen} onSaved={load} />
      <BudgetDialog open={budgetOpen} setOpen={setBudgetOpen} periodKey={periodKey} current={budget} onSaved={load} />
      <GoalDialog open={goalOpen} setOpen={setGoalOpen} onSaved={load} />
      <ProgressDialog goal={progressGoal} setGoal={setProgressGoal} onSaved={load} />
    </main>
  );
}

function SummaryCard({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: React.ReactNode; tone: "green" | "blue" | "orange" | "purple" | "red" }) {
  const tones = { green: "bg-emerald-100 text-emerald-700", blue: "bg-sky-100 text-sky-700", orange: "bg-orange-100 text-orange-700", purple: "bg-violet-100 text-violet-700", red: "bg-rose-100 text-rose-700" };
  return <article className="rounded-3xl border bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{title}</p><div className={`grid size-10 place-items-center rounded-xl [&>svg]:size-5 ${tones[tone]}`}>{icon}</div></div><p className="text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></article>;
}

function EmptyChart({ compact = false }: { compact?: boolean }) {
  return <div className={`grid place-items-center rounded-2xl border border-dashed bg-muted/20 text-center ${compact ? "h-[250px]" : "h-[260px]"}`}><div><ReceiptText className="mx-auto mb-3 size-8 text-muted-foreground/45" /><p className="text-sm font-semibold">Sin gastos para mostrar</p><p className="mt-1 text-xs text-muted-foreground">La gráfica aparecerá al registrar gastos.</p></div></div>;
}

function DashboardSkeleton() {
  return <div className="space-y-6 animate-pulse"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 rounded-3xl bg-white/75" />)}</div><div className="h-32 rounded-3xl bg-[#173c34]/20" /><div className="grid gap-6 xl:grid-cols-2"><div className="h-80 rounded-3xl bg-white/75" /><div className="h-80 rounded-3xl bg-white/75" /></div></div>;
}

function MovementDialog({ open, setOpen, onSaved }: { open: boolean; setOpen: (value: boolean) => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try { await api({ action: "add-movement", type, amount: Number(form.get("amount")), category, note: String(form.get("note") ?? ""), occurredOn: String(form.get("date")) }); toast.success(type === "expense" ? "Gasto registrado" : "Ingreso registrado"); setOpen(false); await onSaved(); formElement.reset(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar."); } finally { setSaving(false); }
  }
  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle><DialogDescription>Registra un ingreso o gasto en pocos segundos.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1"><Button type="button" variant={type === "expense" ? "default" : "ghost"} onClick={() => { setType("expense"); setCategory(EXPENSE_CATEGORIES[0]); }}>Gasto</Button><Button type="button" variant={type === "income" ? "default" : "ghost"} onClick={() => { setType("income"); setCategory(INCOME_CATEGORIES[0]); }}>Ingreso</Button></div><Field label="Monto (Q)" id="movement-amount"><Input id="movement-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required inputMode="decimal" /></Field><Field label="Categoría" id="movement-category"><Select value={category} onValueChange={(value) => value && setCategory(value)}><SelectTrigger id="movement-category" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Descripción" id="movement-note"><Input id="movement-note" name="note" placeholder="Ej. Gasolina de la semana" /></Field><Field label="Fecha" id="movement-date"><Input id="movement-date" name="date" type="date" defaultValue={localDate()} required /></Field><DialogFooter><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? "Guardando…" : "Guardar movimiento"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function BudgetDialog({ open, setOpen, periodKey, current, onSaved }: { open: boolean; setOpen: (value: boolean) => void; periodKey: string; current: number; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); try { await api({ action: "set-budget", periodKey, amount: Number(form.get("amount")) }); toast.success("Presupuesto actualizado"); setOpen(false); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar."); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Presupuesto quincenal</DialogTitle><DialogDescription>Define el máximo que quieres gastar durante esta quincena.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Presupuesto (Q)" id="budget-amount"><Input key={`${periodKey}-${current}`} id="budget-amount" name="amount" type="number" min="0" step="0.01" defaultValue={current ? current / 100 : ""} placeholder="Ej. 1200" required inputMode="decimal" /></Field><DialogFooter><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? "Guardando…" : "Guardar presupuesto"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function GoalDialog({ open, setOpen, onSaved }: { open: boolean; setOpen: (value: boolean) => void; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<"saving" | "debt">("saving");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const formElement = event.currentTarget; const form = new FormData(formElement); try { await api({ action: "add-goal", kind, name: String(form.get("name")), target: Number(form.get("target")), current: Number(form.get("current") || 0), dueDate: String(form.get("dueDate") || "") }); toast.success(kind === "saving" ? "Meta creada" : "Deuda registrada"); setOpen(false); await onSaved(); formElement.reset(); } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar."); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nueva meta o deuda</DialogTitle><DialogDescription>Lleva el avance de lo que quieres reunir o terminar de pagar.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1"><Button type="button" variant={kind === "saving" ? "default" : "ghost"} onClick={() => setKind("saving")}>Meta de ahorro</Button><Button type="button" variant={kind === "debt" ? "default" : "ghost"} onClick={() => setKind("debt")}>Deuda</Button></div><Field label="Nombre" id="goal-name"><Input id="goal-name" name="name" placeholder={kind === "saving" ? "Ej. Computadora nueva" : "Ej. Pago pendiente"} required /></Field><div className="grid grid-cols-2 gap-3"><Field label={kind === "saving" ? "Meta total (Q)" : "Deuda total (Q)"} id="goal-target"><Input id="goal-target" name="target" type="number" min="0.01" step="0.01" required inputMode="decimal" /></Field><Field label={kind === "saving" ? "Ya ahorrado (Q)" : "Ya pagado (Q)"} id="goal-current"><Input id="goal-current" name="current" type="number" min="0" step="0.01" defaultValue="0" inputMode="decimal" /></Field></div><Field label="Fecha objetivo (opcional)" id="goal-date"><Input id="goal-date" name="dueDate" type="date" /></Field><DialogFooter><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? "Guardando…" : "Guardar"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ProgressDialog({ goal, setGoal, onSaved }: { goal: Goal | null; setGoal: (value: Goal | null) => void; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!goal) return; setSaving(true); const form = new FormData(event.currentTarget); try { await api({ action: "add-progress", id: goal.id, amount: Number(form.get("amount")) }); toast.success("Abono registrado"); setGoal(null); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar."); } finally { setSaving(false); } }
  return <Dialog open={!!goal} onOpenChange={(value) => !value && setGoal(null)}><DialogContent><DialogHeader><DialogTitle>Registrar abono</DialogTitle><DialogDescription>{goal ? `Suma un avance a “${goal.name}”.` : ""}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Monto del abono (Q)" id="progress-amount"><Input id="progress-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required autoFocus inputMode="decimal" /></Field><DialogFooter><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? "Guardando…" : "Registrar abono"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
