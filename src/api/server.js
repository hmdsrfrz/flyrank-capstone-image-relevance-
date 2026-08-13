import express from "express";
import "dotenv/config";
import { postsRouter } from "./routes/posts.js";
import { guardRouter } from "./routes/guard.js";
import { suggestionsRouter } from "./routes/suggestions.js";
import { costRouter } from "./routes/cost.js";

const app = express();
app.use(express.json());

app.use("/posts", postsRouter);
app.use("/guard", guardRouter);
app.use("/suggestions", suggestionsRouter);
app.use("/cost", costRouter);

app.get("/", (_req, res) => res.json({ status: "ok" }));

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Zod/DB errors that escape a route handler land here as clean 4xx/5xx JSON
// instead of an unhandled crash or a raw stack trace.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
