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
micBtn.innerText = "🎤";

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

  isProcessing = true;
  responseEl.textContent = "AI przetwarza...";

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
          responseEl.textContent = `Wyszukuję słowo: "${word}"`;
          speakText(`Wyszukuję słowo ${word}`);
          isProcessing = false;
          return;
        }
      }
    }

    // 2. Obsługa aktualizacji formularza (stary kod)
    const fieldToChange = detectFieldChange(text);

    let prompt = "";
    let body = {};

    if (path === "/blogs/new" && fieldToChange) {
      const newValue = extractNewValue(text, fieldToChange);
      
      prompt = `Masz JSON formularza: ${JSON.stringify(formState)}. Proszę, zaktualizuj tylko pole "${fieldToChange}" na "${newValue}" i zwróć wyłącznie zaktualizowany JSON z tym polem (np. {"${fieldToChange}": "..."}), bez dodatkowego tekstu.`;
      
      body = { text: prompt, mode: "partial" };
    } else if (path === "/blogs/new") {

      prompt = `Na podstawie formularza: ${JSON.stringify(formState)} i wypowiedzi użytkownika: "${text}" wygeneruj pełny JSON artykułu.`;
      body = { text: prompt, mode: "full" };
    } else if (path.startsWith("/blogs/") && path !== "/blogs/new" && path !== "/blogs/") {

      const blogId = parseInt(path.split("/")[2]);

      if (lowerText.includes("streść") || lowerText.includes("streszczenie") || lowerText.includes("podsumuj")) {
        prompt = `Streszczenie artykułu.`;
      } else if (lowerText.includes("przeczytaj") || lowerText.includes("czytaj") || lowerText.includes("odczytaj")) {
        prompt = `Proszę przeczytaj mi artykuł.`;
      } else {
        prompt = `Użytkownik zapytał: "${text}"`;
      }

      body = { text: prompt, mode: "article", blogId }; 
    } else {
      body = { text };
    }

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const answer = data.response || data.error || "Brak odpowiedzi.";

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
      responseEl.textContent = `AI: ${textAnswer}`;
    } else {
      responseEl.textContent = `AI: ${answer}`;
      speakText(answer);
    }
  } catch (err) {
    responseEl.textContent = "Błąd zapytania.";
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
    transcriptEl.textContent = `Ty: ${fullTranscript.trim()}`;

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
  if (recognition && !isProcessing) {
    recognition.start();
    responseEl.textContent = "Słucham...";
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

  const container = responseEl; // <- tam gdzie pokazujesz odpowiedź AI
  const chunks = splitText(text, 250);

  // Wyczyść i przygotuj tekst do podświetlania
  container.innerHTML = "";
  const spans = chunks.map(chunk => {
    const span = document.createElement("span");
    span.textContent = chunk + " ";
    container.appendChild(span);
    return span;
  });

  let index = 0;

    function speakNext() {
    if (index >= spans.length) {
        return; // 🛑 Nie uruchamiaj rozpoznawania mowy po zakończeniu
    }

    const utter = new SpeechSynthesisUtterance(spans[index].textContent.trim());
    utter.lang = "pl-PL";
    utter.rate = 1;
    if (selectedVoice) utter.voice = selectedVoice;

    spans.forEach((s, i) => s.classList.toggle("highlight", i === index));

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
