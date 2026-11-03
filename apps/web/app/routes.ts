import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // The flow: address check, the report on your ground, then the plot planner.
  route("start", "routes/start.tsx"),
  route("report", "routes/report.tsx"),
  route("plan", "routes/plan.tsx"),
] satisfies RouteConfig;
