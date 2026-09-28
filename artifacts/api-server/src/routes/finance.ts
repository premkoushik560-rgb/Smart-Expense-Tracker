import { and, desc, eq, ilike, lte, gte } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  AskAdvisorBody,
  AskAdvisorResponse,
  CreateBudgetBody,
  CreateExpenseBody,
  CreateIncomeBody,
  GetAnalyticsResponse,
  GetCurrentUserResponse,
  GetDashboardResponse,
  ListBudgetsResponse,
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  UpdateBudgetBody,
  UpdateExpenseBody,
  UpdateIncomeBody,
} from "@workspace/api-zod";
import { db, budgetsTable, expensesTable, incomeTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
const categories = ["Food", "Travel", "Shopping", "Education", "Bills", "Entertainment", "Healthcare", "Other"];

function ownerId(req: Request): string {
  return (req as AuthenticatedRequest).userId;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function transactionFromExpense(expense: typeof expensesTable.$inferSelect) {
  return {
    id: expense.id,
    type: "expense" as const,
    amount: Number(expense.amount),
    date: expense.date,
    category: expense.category,
    source: null,
    paymentMethod: expense.paymentMethod,
    description: expense.description,
  };
}

function transactionFromIncome(income: typeof incomeTable.$inferSelect) {
  return {
    id: income.id,
    type: "income" as const,
    amount: Number(income.amount),
    date: income.date,
    category: "Income",
    source: income.source,
    paymentMethod: null,
    description: income.description,
  };
}

async function allTransactions(userId: string) {
  const [expenses, income] = await Promise.all([
    db.select().from(expensesTable).where(eq(expensesTable.ownerId, userId)),
    db.select().from(incomeTable).where(eq(incomeTable.ownerId, userId)),
  ]);

  return [
    ...expenses.map(transactionFromExpense),
    ...income.map(transactionFromIncome),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

async function ensureSeedData(userId: string): Promise<void> {
  const [existingExpense, existingIncome] = await Promise.all([
    db.select({ id: expensesTable.id }).from(expensesTable).where(eq(expensesTable.ownerId, userId)).limit(1),
    db.select({ id: incomeTable.id }).from(incomeTable).where(eq(incomeTable.ownerId, userId)).limit(1),
  ]);

  if (existingExpense.length || existingIncome.length) return;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const day = (offset: number) => {
    const date = new Date(now);
    date.setUTCDate(Math.max(1, date.getUTCDate() - offset));
    return isoDate(date);
  };

  await db.insert(incomeTable).values([
    { ownerId: userId, amount: 4200, date: day(3), source: "Monthly salary", description: "September pay" },
    { ownerId: userId, amount: 350, date: day(16), source: "Freelance project", description: "Design sprint" },
  ]);
  await db.insert(expensesTable).values([
    { ownerId: userId, amount: 68.4, date: day(1), category: "Food", paymentMethod: "Card", description: "Groceries" },
    { ownerId: userId, amount: 42, date: day(5), category: "Travel", paymentMethod: "UPI", description: "Metro and cab rides" },
    { ownerId: userId, amount: 124, date: day(8), category: "Bills", paymentMethod: "Bank transfer", description: "Internet and utilities" },
    { ownerId: userId, amount: 89, date: day(11), category: "Entertainment", paymentMethod: "Card", description: "Movie night" },
    { ownerId: userId, amount: 215, date: day(14), category: "Shopping", paymentMethod: "Card", description: "Home essentials" },
    { ownerId: userId, amount: 38, date: day(19), category: "Food", paymentMethod: "UPI", description: "Lunch with friends" },
  ]);
  await db.insert(budgetsTable).values([
    { ownerId: userId, name: "Monthly essentials", amount: 1800, month: currentMonth, category: null },
    { ownerId: userId, name: "Food & dining", amount: 450, month: currentMonth, category: "Food" },
    { ownerId: userId, name: "Fun money", amount: 250, month: currentMonth, category: "Entertainment" },
  ]);
}

router.use(requireAuth);

router.get("/me", (req, res): void => {
  const claims = getClaims(req);
  const name = typeof claims?.name === "string" ? claims.name : "Money planner";
  const email = typeof claims?.email === "string" ? claims.email : `${ownerId(req)}@account`;
  res.json(GetCurrentUserResponse.parse({
    id: ownerId(req),
    name,
    email,
    initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
  }));
});

router.get("/transactions", async (req, res): Promise<void> => {
  await ensureSeedData(ownerId(req));
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = parsed.data;
  let transactions = await allTransactions(ownerId(req));
  if (filters.search) {
    const query = filters.search.toLowerCase();
    transactions = transactions.filter((item) =>
      [item.category, item.source, item.description, item.paymentMethod]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }
  if (filters.category) transactions = transactions.filter((item) => item.category === filters.category);
  if (filters.type) transactions = transactions.filter((item) => item.type === filters.type);
  const startDate = filters.startDate;
  const endDate = filters.endDate;
  if (startDate) transactions = transactions.filter((item) => item.date >= isoDate(startDate));
  if (endDate) transactions = transactions.filter((item) => item.date <= isoDate(endDate));
  res.json(ListTransactionsResponse.parse(transactions));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db.insert(expensesTable).values({
    ownerId: ownerId(req),
    amount: parsed.data.amount,
    date: isoDate(parsed.data.date),
    category: parsed.data.category,
    paymentMethod: parsed.data.paymentMethod,
    description: parsed.data.description ?? "",
  }).returning();
  res.status(201).json(transactionFromExpense(expense));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid expense id" : parsed.error.message });
    return;
  }
  const [expense] = await db.update(expensesTable).set({
    amount: parsed.data.amount,
    date: isoDate(parsed.data.date),
    category: parsed.data.category,
    paymentMethod: parsed.data.paymentMethod,
    description: parsed.data.description ?? "",
  }).where(and(eq(expensesTable.id, id), eq(expensesTable.ownerId, ownerId(req)))).returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(transactionFromExpense(expense));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const [expense] = await db.delete(expensesTable)
    .where(and(eq(expensesTable.id, Number(req.params.id)), eq(expensesTable.ownerId, ownerId(req))))
    .returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/income", async (req, res): Promise<void> => {
  const parsed = CreateIncomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [income] = await db.insert(incomeTable).values({
    ownerId: ownerId(req),
    amount: parsed.data.amount,
    date: isoDate(parsed.data.date),
    source: parsed.data.source,
    description: parsed.data.description ?? "",
  }).returning();
  res.status(201).json(transactionFromIncome(income));
});

router.patch("/income/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdateIncomeBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid income id" : parsed.error.message });
    return;
  }
  const [income] = await db.update(incomeTable).set({
    amount: parsed.data.amount,
    date: isoDate(parsed.data.date),
    source: parsed.data.source,
    description: parsed.data.description ?? "",
  }).where(and(eq(incomeTable.id, id), eq(incomeTable.ownerId, ownerId(req)))).returning();
  if (!income) {
    res.status(404).json({ error: "Income not found" });
    return;
  }
  res.json(transactionFromIncome(income));
});

router.delete("/income/:id", async (req, res): Promise<void> => {
  const [income] = await db.delete(incomeTable)
    .where(and(eq(incomeTable.id, Number(req.params.id)), eq(incomeTable.ownerId, ownerId(req))))
    .returning();
  if (!income) {
    res.status(404).json({ error: "Income not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/budgets", async (req, res): Promise<void> => {
  await ensureSeedData(ownerId(req));
  const [budgets, expenses] = await Promise.all([
    db.select().from(budgetsTable).where(eq(budgetsTable.ownerId, ownerId(req))).orderBy(desc(budgetsTable.month)),
    db.select().from(expensesTable).where(eq(expensesTable.ownerId, ownerId(req))),
  ]);
  const result = budgets.map((budget) => {
    const spent = expenses
      .filter((expense) => monthKey(expense.date) === budget.month && (!budget.category || expense.category === budget.category))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { id: budget.id, name: budget.name, amount: Number(budget.amount), spent, remaining: Number(budget.amount) - spent, month: budget.month, category: budget.category };
  });
  res.json(ListBudgetsResponse.parse(result));
});

router.post("/budgets", async (req, res): Promise<void> => {
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [budget] = await db.insert(budgetsTable).values({
    ownerId: ownerId(req),
    name: parsed.data.name,
    amount: parsed.data.amount,
    month: parsed.data.month,
    category: parsed.data.category ?? null,
  }).returning();
  res.status(201).json({ id: budget.id, name: budget.name, amount: Number(budget.amount), spent: 0, remaining: Number(budget.amount), month: budget.month, category: budget.category });
});

router.patch("/budgets/:id", async (req, res): Promise<void> => {
  const parsed = UpdateBudgetBody.safeParse(req.body);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid budget id" : parsed.error.message });
    return;
  }
  const [budget] = await db.update(budgetsTable).set({
    name: parsed.data.name,
    amount: parsed.data.amount,
    month: parsed.data.month,
    category: parsed.data.category ?? null,
  }).where(and(eq(budgetsTable.id, id), eq(budgetsTable.ownerId, ownerId(req)))).returning();
  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.json({ id: budget.id, name: budget.name, amount: Number(budget.amount), spent: 0, remaining: Number(budget.amount), month: budget.month, category: budget.category });
});

router.delete("/budgets/:id", async (req, res): Promise<void> => {
  const [budget] = await db.delete(budgetsTable)
    .where(and(eq(budgetsTable.id, Number(req.params.id)), eq(budgetsTable.ownerId, ownerId(req))))
    .returning();
  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/dashboard", async (req, res): Promise<void> => {
  await ensureSeedData(ownerId(req));
  const [transactions, budgets] = await Promise.all([allTransactions(ownerId(req)), loadBudgets(ownerId(req))]);
  const nowMonth = new Date().toISOString().slice(0, 7);
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = transactions.filter((item) => item.type === "expense");
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const monthlyExpenses = expenses.filter((item) => item.date.startsWith(nowMonth)).reduce((sum, item) => sum + item.amount, 0);
  const byCategory = categoryTotals(expenses);
  const highest = byCategory[0] ?? { category: "No spending yet", amount: 0, percentage: 0 };
  const budgetRemaining = budgets.filter((budget) => budget.month === nowMonth).reduce((sum, budget) => sum + budget.remaining, 0);
  res.json(GetDashboardResponse.parse({
    totalIncome: income,
    totalExpenses,
    balance: income - totalExpenses,
    monthlyExpenses,
    savingsRate: income ? Math.round(((income - totalExpenses) / income) * 100) : 0,
    highestCategory: highest.category,
    highestCategoryAmount: highest.amount,
    budgetRemaining,
    recentTransactions: transactions.slice(0, 6),
    categoryBreakdown: byCategory,
  }));
});

router.get("/analytics", async (req, res): Promise<void> => {
  await ensureSeedData(ownerId(req));
  const transactions = await allTransactions(ownerId(req));
  const expenseItems = transactions.filter((item) => item.type === "expense");
  const months = [...new Set(transactions.map((item) => monthKey(item.date)))].sort().slice(-6);
  const monthly = months.map((month) => {
    const monthItems = transactions.filter((item) => monthKey(item.date) === month);
    const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { month, income, expenses, savings: income - expenses };
  });
  const categoriesResult = categoryTotals(expenseItems);
  const totalSavings = monthly.reduce((sum, item) => sum + item.savings, 0);
  const averageMonthlySpend = monthly.length ? expenseItems.reduce((sum, item) => sum + item.amount, 0) / monthly.length : 0;
  res.json(GetAnalyticsResponse.parse({
    monthly,
    categories: categoriesResult,
    totalSavings,
    averageMonthlySpend,
    highestCategory: categoriesResult[0]?.category ?? "No spending yet",
  }));
});

router.post("/advisor", async (req, res): Promise<void> => {
  const parsed = AskAdvisorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureSeedData(ownerId(req));
  const transactions = await allTransactions(ownerId(req));
  const expenses = transactions.filter((item) => item.type === "expense");
  const categoriesResult = categoryTotals(expenses);
  const top = categoriesResult[0];
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const answer = top
    ? `You have spent ₹${Math.round(total).toLocaleString("en-IN")} so far. ${top.category} is your biggest category at ₹${Math.round(top.amount).toLocaleString("en-IN")}, so that is the clearest place to review first.`
    : "Once you add a few expenses, I’ll be able to spot patterns and suggest practical ways to save.";
  res.json(AskAdvisorResponse.parse({
    answer,
    highlights: top ? [`Review ${top.category} spending`, "Set a category budget", "Check your recurring bills"] : ["Add your first expense"],
  }));
});

async function loadBudgets(userId: string) {
  const [budgets, expenses] = await Promise.all([
    db.select().from(budgetsTable).where(eq(budgetsTable.ownerId, userId)),
    db.select().from(expensesTable).where(eq(expensesTable.ownerId, userId)),
  ]);
  return budgets.map((budget) => {
    const spent = expenses
      .filter((expense) => monthKey(expense.date) === budget.month && (!budget.category || expense.category === budget.category))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { ...budget, amount: Number(budget.amount), spent, remaining: Number(budget.amount) - spent };
  });
}

function categoryTotals(expenses: Array<{ category: string; amount: number }>) {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount, percentage: total ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

function getClaims(req: Request): Record<string, unknown> | undefined {
  return (req as AuthenticatedRequest & { auth?: { sessionClaims?: Record<string, unknown> } }).auth?.sessionClaims;
}

export default router;