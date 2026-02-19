// Forward the /api/ai/quiz route to the existing implementation as a proper POST handler
import { action as quizAction } from "../../../routes/api.quiz.generate.jsx";

export async function POST(request) {
  const result = await quizAction({ request });
  if (result instanceof Response) return result;
  return Response.json(result ?? {});
}
