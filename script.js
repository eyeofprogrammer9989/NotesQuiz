// NoteQuiz - script.js
// Handles note parsing, question generation, and quiz flow using sessionStorage.

// Words to ignore when picking key words for fill-in-the-blank
var commonWords = [
  "about", "after", "again", "almost", "along", "also", "always",
  "another", "because", "before", "between", "could", "during",
  "every", "first", "found", "however", "never", "other", "people",
  "really", "should", "since", "their", "there", "these", "they",
  "thing", "those", "under", "where", "which", "while", "would"
];

// Backup words if the notes don't have enough words for 3 wrong options
var backupWords = [
  "system", "process", "energy", "method", "factor",
  "structure", "condition", "element", "property", "concept"
];

// Helper to shuffle any array
function shuffle(array) {
  var copy = array.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

// Clean punctuation from around a word
function cleanWord(word) {
  return word.replace(/^[^\w]+|[^\w]+$/g, "");
}

/* ==========================================================
   PAGE 1: HOME / NOTES INPUT (index.html)
   ========================================================== */

function setupIndexPage() {
  var notesBox = document.getElementById("notesInput");
  var fileInput = document.getElementById("fileInput");
  var selectCount = document.getElementById("questionCountSelect");
  var customCountInput = document.getElementById("customCountInput");
  var startBtn = document.getElementById("startQuizBtn");
  var errorBox = document.getElementById("errorBox");

  if (!notesBox || !startBtn) {
    return;
  }

  // Show or hide the custom number box when dropdown changes
  if (selectCount && customCountInput) {
    selectCount.addEventListener("change", function () {
      if (selectCount.value === "custom") {
        customCountInput.style.display = "inline-block";
        customCountInput.focus();
      } else {
        customCountInput.style.display = "none";
      }
    });
  }

  // Read .txt or .pdf file if uploaded
  if (fileInput) {
    fileInput.addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;

      errorBox.classList.add("hidden");
      var isPdf = file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        readPdf(file);
      } else {
        var reader = new FileReader();
        reader.onload = function (event) {
          notesBox.value = event.target.result;
        };
        reader.readAsText(file);
      }
    });
  }

  // Get the text out of a PDF using PDF.js
  function readPdf(file) {
    if (typeof pdfjsLib === "undefined") {
      showError("PDF reading did not load. Check your internet connection and refresh the page.");
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    var reader = new FileReader();
    reader.onload = function (event) {
      var data = new Uint8Array(event.target.result);
      pdfjsLib.getDocument({ data: data }).promise.then(function (pdf) {
        var pagePromises = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          pagePromises.push(
            pdf.getPage(p).then(function (page) {
              return page.getTextContent().then(function (content) {
                var pageText = "";
                for (var i = 0; i < content.items.length; i++) {
                  pageText += content.items[i].str;
                  // hasEOL marks the end of a line in the PDF
                  pageText += content.items[i].hasEOL ? "\n" : " ";
                }
                return pageText;
              });
            })
          );
        }
        Promise.all(pagePromises).then(function (pages) {
          var allText = pages.join("\n").trim();
          if (allText.length === 0) {
            showError("This PDF has no readable text. Scanned PDFs and photos do not work.");
            return;
          }
          notesBox.value = allText;
        });
      }).catch(function () {
        showError("Could not read this PDF. Try a different file.");
      });
    };
    reader.readAsArrayBuffer(file);
  }

  // When user clicks Start Quiz
  startBtn.addEventListener("click", function () {
    var text = notesBox.value.trim();

    // Plain error message for empty or very short notes
    if (text.length === 0) {
      showError("Please paste some notes or upload a .txt or .pdf file first.");
      return;
    }

    if (text.length < 40) {
      showError("Your notes are too short. Please add at least a few sentences or definitions.");
      return;
    }

    // Figure out how many questions the user wants
    var desiredCount = 10;
    if (selectCount) {
      if (selectCount.value === "custom") {
        var customVal = parseInt(customCountInput.value, 10);
        if (!isNaN(customVal) && customVal > 0) {
          desiredCount = customVal;
        } else {
          showError("Please enter a valid number for custom questions.");
          return;
        }
      } else {
        desiredCount = parseInt(selectCount.value, 10);
      }
    }

    // Generate the questions from notes
    var generated = buildQuestions(text);

    if (generated.length === 0) {
      showError("Could not make questions from these notes. Try writing full sentences with periods or 'Term: definition'.");
      return;
    }

    // If notes cannot make that many questions, use maximum possible and tell the user
    var noticeMessage = "";
    var finalQuestions = [];

    if (generated.length < desiredCount) {
      finalQuestions = generated;
      noticeMessage = "Your notes only had enough material for " + generated.length + " questions (you asked for " + desiredCount + ").";
    } else {
      finalQuestions = generated.slice(0, desiredCount);
    }

    // Save everything in sessionStorage for the quiz page
    sessionStorage.setItem("noteQuiz_questions", JSON.stringify(finalQuestions));
    sessionStorage.setItem("noteQuiz_userAnswers", JSON.stringify([]));
    sessionStorage.setItem("noteQuiz_currentIndex", "0");
    sessionStorage.setItem("noteQuiz_notice", noticeMessage);
    sessionStorage.setItem("noteQuiz_savedNotes", text);

    // Go to quiz
    window.location.href = "quiz.html";
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  }
}

/* ==========================================================
   QUESTION GENERATOR (NO AI / NO API)
   ========================================================== */

function buildQuestions(text) {
  var lines = text.split("\n");
  var questions = [];

  // Pool of all words in the notes to use for wrong answers
  var rawWords = text.split(/\s+/);
  var wordPool = [];
  for (var i = 0; i < rawWords.length; i++) {
    var w = cleanWord(rawWords[i]);
    if (w.length >= 4 && commonWords.indexOf(w.toLowerCase()) === -1) {
      if (wordPool.indexOf(w) === -1) {
        wordPool.push(w);
      }
    }
  }

  // Pool of terms for definition questions
  var termPool = [];

  // 1. Look for lines that look like "Term: definition"
  var remainingLines = [];
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l].trim();
    if (line.indexOf(":") > -1) {
      var parts = line.split(":");
      var term = parts[0].trim();
      var definition = parts.slice(1).join(":").trim();

      // Check if term is 1 to 4 words and definition is not too short
      if (term.length > 1 && term.split(/\s+/).length <= 4 && definition.length >= 10) {
        termPool.push(term);
        questions.push({
          type: "definition",
          prompt: 'Which term matches this definition?\n"' + definition + '"',
          correctAnswer: term
        });
        continue;
      }
    }
    remainingLines.push(line);
  }

  // 2. Split remaining lines into sentences for fill-in-the-blank
  var leftoverText = remainingLines.join(" ");
  // Split on periods, exclamation marks, question marks
  var rawSentences = leftoverText.split(/[.!?]+/);

  for (var s = 0; s < rawSentences.length; s++) {
    var sentence = rawSentences[s].trim();
    if (sentence.length < 25) {
      continue;
    }

    var sentenceWords = sentence.split(/\s+/);
    var candidateWords = [];

    for (var w = 0; w < sentenceWords.length; w++) {
      var currentW = cleanWord(sentenceWords[w]);
      // only plain words (letters/numbers) can be hidden
      if (currentW.length >= 5 && /^\w+$/.test(currentW) && commonWords.indexOf(currentW.toLowerCase()) === -1) {
        candidateWords.push(currentW);
      }
    }

    if (candidateWords.length === 0) {
      continue;
    }

    // Pick a longer word to hide
    candidateWords.sort(function (a, b) {
      return b.length - a.length;
    });
    var hiddenWord = candidateWords[0];

    // Hide the word in the sentence
    // Escape special characters (like brackets and quotes) so the pattern does not break
    var safeWord = hiddenWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var pattern = new RegExp("(^|[^\\w])" + safeWord + "(?![\\w])", "i");
    var blankSentence = sentence.replace(pattern, function (match, before) {
      return before + "_______";
    });

    if (blankSentence.indexOf("_______") > -1) {
      questions.push({
        type: "fill-blank",
        prompt: 'Fill in the blank:\n"' + blankSentence + '"',
        correctAnswer: hiddenWord
      });
    }
  }

  // 3. Add 3 wrong options to each question
  for (var q = 0; q < questions.length; q++) {
    var currentQ = questions[q];
    var wrongOptions = [];

    // Choose pool based on question type
    var pool = (currentQ.type === "definition" && termPool.length >= 4) ? termPool : wordPool;
    var shuffledPool = shuffle(pool);

    for (var p = 0; p < shuffledPool.length; p++) {
      var candidate = shuffledPool[p];
      if (candidate.toLowerCase() !== currentQ.correctAnswer.toLowerCase()) {
        if (wrongOptions.indexOf(candidate) === -1) {
          wrongOptions.push(candidate);
        }
      }
      if (wrongOptions.length === 3) {
        break;
      }
    }

    // Use backup words if not enough words in notes
    if (wrongOptions.length < 3) {
      var shuffledBackup = shuffle(backupWords);
      for (var b = 0; b < shuffledBackup.length; b++) {
        var backWord = shuffledBackup[b];
        if (backWord.toLowerCase() !== currentQ.correctAnswer.toLowerCase() && wrongOptions.indexOf(backWord) === -1) {
          wrongOptions.push(backWord);
        }
        if (wrongOptions.length === 3) {
          break;
        }
      }
    }

    // Put correct answer and 3 wrong options together and shuffle
    var allOptions = [currentQ.correctAnswer].concat(wrongOptions);
    currentQ.options = shuffle(allOptions);
  }

  // Shuffle all questions
  return shuffle(questions);
}

/* ==========================================================
   PAGE 2: QUIZ RUNNER (quiz.html)
   ========================================================= */

function setupQuizPage() {
  var stored = sessionStorage.getItem("noteQuiz_questions");
  if (!stored) {
    window.location.href = "index.html";
    return;
  }

  var questions = JSON.parse(stored);
  var currentIndex = parseInt(sessionStorage.getItem("noteQuiz_currentIndex") || "0", 10);
  var userAnswers = JSON.parse(sessionStorage.getItem("noteQuiz_userAnswers") || "[]");

  // DOM elements
  var progressText = document.getElementById("progressText");
  var questionBox = document.getElementById("questionPrompt");
  var optionsBox = document.getElementById("optionsBox");
  var nextBtn = document.getElementById("nextBtn");
  var noticeBox = document.getElementById("noticeBox");

  // Show notice if questions were capped
  var notice = sessionStorage.getItem("noteQuiz_notice");
  if (notice && noticeBox) {
    noticeBox.textContent = notice;
    noticeBox.classList.remove("hidden");
  }

  var selectedChoice = null;

  function showQuestion() {
    var q = questions[currentIndex];
    selectedChoice = null;
    nextBtn.disabled = true;

    // "Question 3 of 10" text
    if (progressText) {
      progressText.textContent = "Question " + (currentIndex + 1) + " of " + questions.length;
    }

    // Show prompt
    if (questionBox) {
      if (q.prompt.indexOf("_______") > -1) {
        var parts = q.prompt.split("_______");
        questionBox.innerHTML = escapeHtml(parts[0]) + '<span class="blank-space">_______</span>' + escapeHtml(parts[1]);
      } else {
        questionBox.textContent = q.prompt;
      }
    }

    // Button text: "Finish quiz" on the last question, otherwise "Next"
    if (currentIndex === questions.length - 1) {
      nextBtn.textContent = "Finish quiz";
    } else {
      nextBtn.textContent = "Next";
    }

    // Render options
    if (optionsBox) {
      optionsBox.innerHTML = "";
      var letters = ["A", "B", "C", "D"];

      for (var i = 0; i < q.options.length; i++) {
        (function (optText, idx) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "option-item";
          btn.innerHTML = '<span class="option-label">' + letters[idx] + ".</span> " + escapeHtml(optText);

          btn.addEventListener("click", function () {
            selectedChoice = optText;
            nextBtn.disabled = false;

            // Update selected class
            var allButtons = optionsBox.querySelectorAll(".option-item");
            for (var b = 0; b < allButtons.length; b++) {
              allButtons[b].classList.remove("selected");
            }
            btn.classList.add("selected");
          });

          optionsBox.appendChild(btn);
        })(q.options[i], i);
      }
    }
  }

  // Next button click
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (!selectedChoice) {
        alert("Please pick an answer first.");
        return;
      }

      userAnswers[currentIndex] = selectedChoice;
      sessionStorage.setItem("noteQuiz_userAnswers", JSON.stringify(userAnswers));

      if (currentIndex < questions.length - 1) {
        currentIndex++;
        sessionStorage.setItem("noteQuiz_currentIndex", currentIndex.toString());
        showQuestion();
      } else {
        // Go to results
        window.location.href = "result.html";
      }
    });
  }

  showQuestion();
}

/* ==========================================================
   PAGE 3: RESULTS (result.html)
   ========================================================== */

function setupResultPage() {
  var storedQ = sessionStorage.getItem("noteQuiz_questions");
  var storedA = sessionStorage.getItem("noteQuiz_userAnswers");

  if (!storedQ || !storedA) {
    window.location.href = "index.html";
    return;
  }

  var questions = JSON.parse(storedQ);
  var userAnswers = JSON.parse(storedA);

  // Calculate score
  var score = 0;
  for (var i = 0; i < questions.length; i++) {
    if (userAnswers[i] && userAnswers[i].trim().toLowerCase() === questions[i].correctAnswer.trim().toLowerCase()) {
      score++;
    }
  }

  var scoreText = document.getElementById("scoreText");
  var reviewList = document.getElementById("reviewList");
  var retakeBtn = document.getElementById("retakeBtn");
  var backBtn = document.getElementById("backBtn");

  if (scoreText) {
    scoreText.textContent = score + " / " + questions.length;
  }

  // Render list of every question with answers
  if (reviewList) {
    reviewList.innerHTML = "";

    for (var j = 0; j < questions.length; j++) {
      var q = questions[j];
      var userAns = userAnswers[j] || "No answer";
      var isCorrect = userAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

      var item = document.createElement("div");
      item.className = "review-item " + (isCorrect ? "was-correct" : "was-wrong");

      var html = '<div class="review-q-title">Question ' + (j + 1) + ": " + escapeHtml(q.prompt) + "</div>";
      html += '<div class="answer-line">Your answer: <span class="user-ans ' + (isCorrect ? "correct-ans" : "wrong-ans") + '">' + escapeHtml(userAns) + "</span></div>";
      if (!isCorrect) {
        html += '<div class="answer-line">Correct answer: <span class="correct-ans">' + escapeHtml(q.correctAnswer) + "</span></div>";
      } else {
        html += '<div class="answer-line correct-ans">✓ Correct</div>';
      }

      item.innerHTML = html;
      reviewList.appendChild(item);
    }
  }

  // Retake quiz with same questions
  if (retakeBtn) {
    retakeBtn.addEventListener("click", function () {
      sessionStorage.setItem("noteQuiz_userAnswers", JSON.stringify([]));
      sessionStorage.setItem("noteQuiz_currentIndex", "0");
      window.location.href = "quiz.html";
    });
  }

  // Back to notes home page
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      window.location.href = "index.html";
    });
  }
}

// Simple HTML escaping
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Check which page we are on
document.addEventListener("DOMContentLoaded", function () {
  var path = window.location.pathname;

  if (path.indexOf("quiz.html") > -1 || document.getElementById("optionsBox")) {
    setupQuizPage();
  } else if (path.indexOf("result.html") > -1 || document.getElementById("scoreText")) {
    setupResultPage();
  } else {
    setupIndexPage();
  }
});
