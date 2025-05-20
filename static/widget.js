const transcriptEl = document.createElement("div");
const responseEl = document.createElement("div");
const micBtn = document.createElement("button");

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
let silenceTimeout;
let fullTranscript = "";

if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'pl-PL';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onspeechstart = () => {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
    console.log("Mowa rozpoczęta – kasuję timer ciszy");
  };

  recognition.onspeechend = () => {
    console.log("Mowa zakończona – start liczenia 10 s ciszy");
    silenceTimeout = setTimeout(() => {
      console.log("3 s ciszy – zatrzymuję rozpoznawanie");
      recognition.stop();
    }, 3000);
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        fullTranscript += event.results[i][0].transcript + " ";
      }
    }
    transcriptEl.textContent = `Ty: ${fullTranscript.trim()}`;
  };

  recognition.onend = async () => {
    console.log("Recognition zakończone, wysyłam do AI:", fullTranscript.trim());
    if (!fullTranscript.trim()) return;

    const text = fullTranscript.trim();
    fullTranscript = "";

    const formState = getFormState();

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Aktualny formularz wygląda tak: ${JSON.stringify(formState)}. Użytkownik powiedział: ${text}`
        })
      });

      const data = await res.json();
      const answer = data.response || data.error || "Brak odpowiedzi.";

      try {
        const jsonMatch = answer.match(/{[\s\S]*}/);
        if (jsonMatch) {
          const aiFormData = JSON.parse(jsonMatch[0]);
          applyFormUpdate(aiFormData);
        }
      } catch (e) {
        console.warn("Nie udało się sparsować danych formularza z odpowiedzi AI.");
      }

      if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
        speakText(answer);
        responseEl.textContent = `AI: ${answer}`;
      }
    } catch (err) {
      responseEl.textContent = "Błąd zapytania.";
    }
  };

  recognition.onerror = (e) => {
    responseEl.textContent = `Błąd mikrofonu: ${e.error}`;
  };
} else {
  alert("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
}

micBtn.onclick = () => {
  if (recognition) recognition.start();
};

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

function speakText(text) {
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pl-PL";
  utter.rate = 1;

  if (selectedVoice) {
    utter.voice = selectedVoice;
  } else {
    console.warn("Brak wybranego głosu — używam domyślnego.");
  }
  synth.speak(utter);
}
