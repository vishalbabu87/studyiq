// Alias route to keep the original endpoint /api/ai/quiz working
// It forwards to the implementation in api.quiz.generate.jsx
export { action as action } from "./api.quiz.generate.jsx";
