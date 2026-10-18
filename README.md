# NoteQuiz

NoteQuiz is a simple quiz website made with plain HTML, CSS, and JavaScript. It runs entirely in the browser with no frameworks, build tools, or backend.

It is designed to look like a lined school notebook, with an off-white page, faint ruled lines, a red margin line, ink-blue headings, and highlighter-yellow accents.

---

## Files

- **`index.html`**: The home page where you paste notes or upload a `.txt` or `.pdf` file, choose how many questions to make (5, 10, 15, 20, or custom), and click "Start quiz".
- **`quiz.html`**: Shows questions one at a time, displays "Question X of Y", and has a Next button.
- **`result.html`**: Shows your final score and a review of every question with your answer and the correct answer.
- **`style.css`**: Styles the app to look like a lined school notebook with stationery-style buttons. Works on mobile phones and computers.
- **`script.js`**: Reads the notes, extracts definitions and sentences, creates questions and distractors without AI, and manages the quiz flow with `sessionStorage`.
- **`README.md`**: Project overview and instructions.

---

## How to Run

You can run this project without installing anything:

1. Download or open the project folder.
2. Double-click **`index.html`** to open it in your browser (Chrome, Firefox, Safari, Edge, etc.).

If you are using a local development server:
- With Python 3: `python3 -m http.server 8000` and open `http://localhost:8000`

---

PDF upload uses the PDF.js library from a CDN, so you need an internet connection for PDFs. Scanned PDFs (images of text) are not supported.

---

## How Questions Are Generated (No AI or API)

1. **Definitions**: Lines written in the format `Term: definition` turn into multiple-choice questions asking for the term.
2. **Fill-in-the-blank**: Sentences are split on punctuation (`.`, `!`, `?`). A key word of 5 or more letters is hidden and replaced with `_______`.
3. **Wrong options**: 3 wrong options are selected from other words found in your notes so all answers relate to the subject matter.
4. **Question limits**: If your notes cannot make as many questions as requested in the dropdown, NoteQuiz uses the maximum possible and displays a friendly notice at the top of the quiz.
