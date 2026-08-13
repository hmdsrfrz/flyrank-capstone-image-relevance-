import { Router } from "express";
import { pool } from "../../db/pool.js";

export const costRouter = Router();

costRouter.get("/", async (_req, res) => {
  const { rows: totals } = await pool.query(
    `SELECT count(*) AS total_calls, COALESCE(sum(cost_usd), 0) AS total_cost_usd, COALESCE(sum(duration_ms), 0) AS total_duration_ms
     FROM cost_log`
  );
  const { rows: byModel } = await pool.query(
    `SELECT call_type, model, count(*) AS calls, COALESCE(sum(cost_usd), 0) AS cost_usd, COALESCE(avg(duration_ms), 0)::int AS avg_duration_ms
     FROM cost_log GROUP BY call_type, model ORDER BY call_type, model`
  );

  res.json({ ...totals[0], breakdown: byModel });
});
