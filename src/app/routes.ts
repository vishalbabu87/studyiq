import { index, route } from "@react-router/dev/routes";

export default [
  index("./page.jsx"),
  route("home", "./home/page.jsx"),
  route("quiz", "./quiz/page.jsx"),
  route("craft", "./craft/page.jsx"),
  route("library", "./library/page.jsx"),
  route("tracker", "./tracker/page.jsx"),
  route("upload", "./upload/page.jsx"),
  route("settings", "./settings/page.jsx"),
  route("api/extract", "./routes/api.extract.jsx"),
  route("api/parse", "./routes/api.parse.jsx"),
  route("api/ai/quiz", "./routes/api.quiz.generate.jsx"),
];
