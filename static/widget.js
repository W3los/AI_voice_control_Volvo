// Dodanie kontenera na czat:
const chatBox = document.createElement("div");
chatBox.id = "chat-box";
Object.assign(chatBox.style, {
  position: "fixed",
  bottom: "90px", // ponad micBtn
  right: "20px",
  width: "320px",
  height: "400px",
  backgroundColor: "white",
  border: "1px solid #ccc",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "10px",
  display: "none", // ukryty na start
  overflowY: "auto",
  zIndex: 1001,
  fontFamily: "Arial, sans-serif",
  fontSize: "14px",
  color: "#333",
});
document.body.appendChild(chatBox);

const inputWrapper = document.createElement("div");
inputWrapper.style.display = "flex";
inputWrapper.style.marginTop = "8px";
inputWrapper.style.marginBottom = "5px";

const micChatBtn = document.createElement("button");
micChatBtn.textContent = "🎤";
micChatBtn.style.marginLeft = "8px";
micChatBtn.style.padding = "8px 12px";
micChatBtn.style.border = "none";
micChatBtn.style.backgroundColor = "#10b981"; // zielony
micChatBtn.style.color = "white";
micChatBtn.style.borderRadius = "4px";
micChatBtn.style.cursor = "pointer";

const inputEl = document.createElement("input");
inputEl.type = "text";
inputEl.placeholder = "Napisz wiadomość...";
inputEl.style.flexGrow = "1";
inputEl.style.padding = "8px";
inputEl.style.border = "1px solid #ccc";
inputEl.style.borderRadius = "4px";

const sendBtn = document.createElement("button");
sendBtn.textContent = "Wyślij";
sendBtn.style.marginLeft = "8px";
sendBtn.style.padding = "8px 12px";
sendBtn.style.border = "none";
sendBtn.style.backgroundColor = "#4f46e5";
sendBtn.style.color = "white";
sendBtn.style.borderRadius = "4px";
sendBtn.style.cursor = "pointer";

inputWrapper.appendChild(inputEl);
inputWrapper.appendChild(sendBtn);
inputWrapper.appendChild(micChatBtn);
chatBox.appendChild(inputWrapper);

sendBtn.onclick = () => {
  sendMessage(inputEl.value);
};

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});
async function sendMessage(text) {
  if (!text.trim() || isProcessing) return;

  addMessage(text, "user");
  inputEl.value = "";
  await processTranscript(text);
}


// Funkcja dodająca wiadomości do czatu
function addMessage(text, who) {
  const msg = document.createElement("div");
  msg.textContent = `${who}: ${text}`;
  msg.style.padding = "6px 8px";
  msg.style.marginBottom = "6px";
  msg.style.borderRadius = "6px";
  msg.style.backgroundColor = who === "user" ? "#e0f7fa" : "#ede7f6";
  msg.style.alignSelf = who === "user" ? "flex-end" : "flex-start";
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; // scroll na dół
}

const transcriptEl = document.createElement("div");
const responseEl = document.createElement("div");
const micBtn = document.createElement("button");

Object.assign(micBtn.style, {
  position: "fixed",
  bottom: "20px",
  right: "20px",
  width: "60px",
  height: "60px",
  borderRadius: "50%",
  background: "#4f46e5",
  color: "white",
  border: "none",
  fontSize: "28px",
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(0,0,0,0.2)",
  zIndex: 1000,
});
micBtn.innerText = "💬";

document.body.appendChild(micBtn);
document.body.appendChild(transcriptEl);
document.body.appendChild(responseEl);

transcriptEl.style.marginTop = "20px";
responseEl.style.marginTop = "10px";
responseEl.style.fontWeight = "bold";

let recognition;
let silenceTimeout = null;
let fullTranscript = "";
let isProcessing = false; // blokada zapytań do AI
let chatHistory = [];

function getFormState() {
  return {
    title: document.getElementById("title")?.value || "",
    subtitle: document.getElementById("subtitle")?.value || "",
    author: document.getElementById("author")?.value || "",
    category: document.getElementById("category")?.value || "",
    tags: document.getElementById("tags")?.value || "",
    publish_date: document.getElementById("publish_date")?.value || "",
    summary: document.getElementById("summary")?.value || "",
    content: document.getElementById("content")?.value || "",
    conclusion: document.getElementById("conclusion")?.value || ""
  };
}

function applyFormUpdate(data) {
  for (const [key, value] of Object.entries(data)) {
    const el = document.getElementById(key);
    if (el) el.value = value;
  }
}


function detectFieldChange(text) {
  const fields = ["title", "subtitle", "author", "category", "tags", "publish_date", "summary", "content", "conclusion"];
  for (const field of fields) {
    if (text.toLowerCase().includes(field) && /zmień|ustaw|aktualizuj/.test(text.toLowerCase())) {
      return field;
    }
  }
  return null;
}

// Bardzo prosta ekstrakcja wartości: 
// zakładamy, że użytkownik mówi np. "zmień autora na Jan Kowalski"
function extractNewValue(text, field) {
  const regex = new RegExp(`${field}\\s*(na|:)\\s*(.+)`, "i");
  const match = text.match(regex);
  if (match && match[2]) {
    return match[2].trim();
  }
  // fallback: spróbuj coś zwrócić lub cały tekst jeśli nie da się rozpoznać
  return text.trim();
}

async function processTranscript(text) {
  if (isProcessing) return;
  if (!text.trim()) return;
  const navText = text.toLowerCase().trim();

if (navText === "wróć" || navText === "cofnij") {
  const backBtn = document.querySelector("button.btn-secondary, .btn-back, button[name='back']");
  if (backBtn) {
    backBtn.click(); // kliknięcie przycisku
  } else {
    window.history.back(); // fallback jeśli przycisku nie ma
  }
  addMessage("Wrócono do poprzedniej strony.", "ai");
  isProcessing = false;
  return;
}

if (navText.includes("strona główna")) {
  window.location.href = "/";
  addMessage("Przenoszę na stronę główną.", "ai");
  isProcessing = false;
  return;
}

if (navText.includes("dodaj blog") || navText.includes("nowy artykuł")) {
  window.location.href = "/blogs/new";
  addMessage("Przenoszę do formularza nowego bloga.", "ai");
  isProcessing = false;
  return;
}

  isProcessing = true;

  const path = window.location.pathname;
  const formState = getFormState();

  try {
    const lowerText = text.toLowerCase();

    // 1. Obsługa wyszukiwania słowa na artykule (np. "wyszukaj kot")
    if (path.startsWith("/blogs/") && path !== "/blogs/new" && path !== "/blogs/") {
      if (lowerText.startsWith("wyszukaj ")) {
        const word = text.substring(8).trim();
        if (word) {
          highlightWord(word);
          speakText(`Wyszukuję słowo ${word}`);
          addMessage(`Wyszukuję słowo ${word}`, "ai");
          isProcessing = false;
          return;
        }
      }
    }
    if (window.location.pathname === "/blogs/new" &&
    /(dodaj|zapisz|wyślij).*(blog|formularz|artykuł)?/.test(lowerText)) {
      addMessage("Wysyłam formularz...", "ai");
      document.querySelector("form")?.submit();
      return;
}

    // 2. Obsługa aktualizacji formularza (stary kod)
    const fieldToChange = detectFieldChange(text);

    let prompt = "";
    let body = {};

    if (path === "/blogs/new" && fieldToChange) {
      const newValue = extractNewValue(text, fieldToChange);
      
      prompt = `Masz JSON formularza: ${JSON.stringify(formState)}. Proszę, zaktualizuj tylko pole "${fieldToChange}" na "${newValue}" i zwróć wyłącznie zaktualizowany JSON z tym polem (np. {"${fieldToChange}": "..."}), bez dodatkowego tekstu.`;
      
      body = { text: prompt, mode: "partial", history: chatHistory };
    } else if (path === "/blogs/new") {

      prompt = `Na podstawie formularza: ${JSON.stringify(formState)} i wypowiedzi użytkownika: "${text}" wygeneruj pełny JSON artykułu.`;
      body = { text: prompt, mode: "full", history: chatHistory };
    } else if (path.startsWith("/blogs/") && path !== "/blogs/new" && path !== "/blogs/") {

      const blogId = parseInt(path.split("/")[2]);

      if (lowerText.includes("streść") || lowerText.includes("streszczenie") || lowerText.includes("podsumuj")) {
        prompt = `Streszczenie artykułu.`;
      } else if (lowerText.includes("przeczytaj") || lowerText.includes("czytaj") || lowerText.includes("odczytaj")) {
        prompt = `Proszę przeczytaj mi artykuł.`;
      } else {
        prompt = `Użytkownik zapytał: "${text}"`;
      }

      body = { text: prompt, mode: "article", blogId, history: chatHistory }; 
    } else {
      body = { text, history: chatHistory };
    }

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const answer = data.response || data.error || "Brak odpowiedzi.";
    chatHistory.push({ user: text, ai: answer });

    if (path === "/blogs/new") {
      let formData = null;
      let textAnswer = answer;

      try {
        const jsonMatch = answer.match(/{[\s\S]*}/);
        if (jsonMatch) {
          formData = JSON.parse(jsonMatch[0]);
          textAnswer = answer.replace(jsonMatch[0], "").trim();

          if (Object.values(formData).every(v => v === "")) {
            formData = null;
          }
        }
      } catch (e) {
        console.warn("Nie udało się sparsować JSON z odpowiedzi.");
      }

      if (formData) applyFormUpdate(formData);
      if (!textAnswer) textAnswer = formData ? "Zaktualizowano formularz." : answer;
      addMessage(textAnswer, "ai");
    } else {
      speakText(answer);
      addMessage(answer, "ai");
    }
  } catch (err) {
    addMessage("BŁĄD WIADOMOŚCI", "ai");
  } finally {
    isProcessing = false;
  }
}


if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'pl-PL';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        fullTranscript += event.results[i][0].transcript + " ";
      }
    }
    addMessage(fullTranscript.trim(), "user");

    // Restart timeru ciszy przy każdym nowym wyniku
    if (silenceTimeout) clearTimeout(silenceTimeout);

    silenceTimeout = setTimeout(() => {
      const textToProcess = fullTranscript.trim();
      fullTranscript = "";
      if (textToProcess) {
        processTranscript(textToProcess);
      }
      recognition.stop();
    }, 2000); // 2 sekundy ciszy
  };

  recognition.onerror = (e) => {
    responseEl.textContent = `Błąd mikrofonu: ${e.error}`;
  };

recognition.onend = () => {
  console.log("Nasłuchiwanie zakończone.");
};
} else {
  alert("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
}

micBtn.onclick = () => {
  if (chatBox.style.display === "none" || chatBox.style.display === "") {
    chatBox.style.display = "block";
    inputEl.focus(); // fokus do inputa po otwarciu
  } else {
    chatBox.style.display = "none";
    if (recognition) recognition.stop();
  }
};

micChatBtn.onclick = () => {
  if (recognition && !isProcessing) {
    recognition.start();
    fullTranscript = "";
    transcriptEl.textContent = "";
  }
};



// --- synteza mowy ---

let selectedVoice = null;
const voiceIndex = 1;

const getVoices = () => {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
    } else {
      speechSynthesis.onvoiceschanged = () => {
        voices = speechSynthesis.getVoices();
        resolve(voices);
      };
    }
  });
};

const initVoice = async () => {
  const voices = await getVoices();
  const filtered = voices.filter((voice) => voice.name.includes("Google polski"));
  selectedVoice = filtered[voiceIndex] || filtered[0] || null;

  if (selectedVoice) {
    console.log("Wybrany głos:", selectedVoice.name);
  } else {
    console.warn("Nie znaleziono odpowiedniego głosu.");
  }
};

initVoice();

function splitText(text, maxLen = 250) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  const chunks = [];

  let chunk = "";
  for (let sentence of sentences) {
    if ((chunk + sentence).length > maxLen) {
      if (chunk) chunks.push(chunk.trim());
      chunk = sentence;
    } else {
      chunk += sentence;
    }
  }
  if (chunk) chunks.push(chunk.trim());
  return chunks;
}

function speakText(text) {
  if (!text) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  if (recognition && recognition.stop) recognition.stop();

  const chunks = splitText(text, 250);

  let index = 0;

  function speakNext() {
    if (index >= chunks.length) return;

    const utter = new SpeechSynthesisUtterance(chunks[index]);
    utter.lang = "pl-PL";
    utter.rate = 1;
    if (selectedVoice) utter.voice = selectedVoice;

    utter.onend = () => {
      index++;
      speakNext();
    };

    utter.onerror = () => {
      index++;
      speakNext();
    };

    speechSynthesis.speak(utter);
  }

  speakNext();
}


function highlightWord(word) {
    if (!word) return;
    const container = document.getElementById("article-content");
    if (!container) return;

    // Reset poprzedniego podświetlenia
    container.innerHTML = container.textContent;

    const regex = new RegExp(`(${word})`, 'gi');
    const newHTML = container.innerHTML.replace(regex, '<span class="highlight">$1</span>');
    container.innerHTML = newHTML;
}
