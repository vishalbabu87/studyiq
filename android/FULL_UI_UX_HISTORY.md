# StudyIQ: Full UI/UX and Feature Evolution

This document provides a detailed history of the UI/UX design and feature implementation for the Home and Quiz pages, based on the project's source code.

---

## 🏠 Home Page (`home/page.jsx`)

### Initial State (Conceptual)
*   **Layout:** A basic, centered column with a title and a simple grid of statistics.
*   **Colors:** Black text on a white background, using default browser styles.
*   **Features:** Displayed 6 core statistics (Files, Terms, etc.) and had two simple links for "Upload" and "Start Quiz".

### Current (PEAK) Version
*   **Layout:** The layout is now dynamic and visually structured using TailwindCSS's `flex` and `grid`.
    *   The welcome message is centered and prominent.
    *   The stats grid is a `3x2` layout, designed to be responsive (`max-w-2xl`).
    *   The main action cards ("Upload" and "Start Quiz") are in a `md:grid-cols-2` layout, meaning they stack vertically on mobile for easier tapping.

*   **Colors & Effects:** The UI has a rich, modern, and engaging color palette.
    *   **Gradient Text:** The "StudyIQ" title uses a `bg-gradient-to-r` from purple to orange, with `bg-clip-text text-transparent` to create a striking visual effect.
    *   **Glassmorphism:** The stat cards use a `glass-card` style with a semi-transparent background (`bg-white/20`), a border (`border-white/20`), and a shadow, giving a modern, layered feel.
    *   **Unique Gradients per Stat:** Each of the 6 stat cards has its own unique gradient (e.g., `from-blue-500 to-cyan-500` for "Files"), making the dashboard vibrant and easy to scan.
    *   **Dark Mode:** The page is fully dark-mode aware, using the `useTheme` hook to switch text colors (`isDark ? "#ffffff" : "#000000"`) and card backgrounds (`dark:bg-gray-900`).

*   **Features & Animations:** The page feels interactive and alive.
    *   **Iconography:** Uses the `lucide-react` library for clean, professional icons like `FileText`, `Brain`, and `Target`.
    *   **Micro-interactions:** Cards have a `group-hover:scale-110` and `active-scale` effect, providing tactile feedback to the user.
    *   **Data-Driven Stats:** The statistics are not hardcoded; they are fetched asynchronously from the database using `useEffect` and `getAllEntries`, then displayed via the `useState` hook.

---

## ❓ Quiz Page (`quiz/page.jsx`)

### Initial State (Conceptual)
*   **Layout:** A single, long form to configure a quiz, followed by the quiz questions.
*   **Colors:** Default HTML styles for dropdowns and buttons.
*   **Features:** A basic "Start" button that would trigger the quiz.

### Current (PEAK) Version
*   **Layout:** The page is architected around a state machine with three distinct stages: `setup`, `quiz`, and `results`. This provides a clean, step-by-step user flow.
    *   The `setup` stage prominently features two large, visually appealing action cards at the top for "Upload" and "AI Quiz", guiding the user to the most important actions.
    *   The configuration form itself is presented within its own styled "glass card".

*   **Colors & Effects:** The design is consistent with the home page, reinforcing the app's brand.
    *   **Gradients & Glass:** The action cards and headers use the same gradient and glassmorphism effects.
    *   **Floating Action Button (FAB):** A standout feature is the floating AI button, which uses a strong gradient, a `Sparkles` icon, and a `hover:scale-110` animation to draw attention. Its `fixed` position keeps it accessible at all times.
    *   **Dark Mode:** The entire page, including the AI chat modal, respects the app's theme.

*   **Features & Animations:** The quiz page is highly functional and intelligent.
    *   **AI Chat Integration:** The `AIChat` component opens as a modal, allowing users to generate a quiz using natural language. It can either start an AI-generated quiz directly or pre-fill the main setup form.
    *   **Quiz Lifecycle Management:** The page manages the entire quiz lifecycle:
        1.  `startQuiz`: Transitions from `setup` to `quiz`.
        2.  `onComplete`: Saves the results to the database (`addQuizHistory`) and transitions to the `results` stage.
        3.  `continueSequence` & `retestWrong`: The results page offers intelligent next steps, like continuing a sequential quiz or re-testing only the questions the user got wrong.
    *   **Stateful Prefill:** The form remembers the last quiz's settings (`setPrefill`), making it easy for users to start another round without re-configuring everything.
    *   **Component-Based Architecture:** The logic is cleanly separated into components like `QuizSetup`, `QuizSession`, and `QuizResults`, making the code maintainable and scalable.

---

## 🎨 Overall UI/UX Theme

*   **Branding:** The app has a strong, consistent visual identity defined by **gradients (purple-pink-orange)**, **glassmorphism**, and **clean iconography** (`lucide-react`).
*   **Modern Feel:** The use of smooth transitions (`transition-colors duration-300`), micro-interactions, and a dark mode theme makes the app feel modern and professional.
*   **User-Centric Design:** Features like the floating AI button, intelligent quiz continuation, and stateful form pre-filling demonstrate a focus on providing a smart and efficient user experience.
