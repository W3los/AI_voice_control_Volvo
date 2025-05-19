const transcriptEl = document.createElement("div");
const responseEl = document.createElement("div");
const micBtn = document.createElement("button");

// Stylowanie widgeta
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
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'pl-PL';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    transcriptEl.textContent = `Ty: ${text}`;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      const answer = data.response || data.error || "Brak odpowiedzi.";
      responseEl.textContent = `AI: ${answer}`;
      // Odtwarzanie odpowiedzi audio
      speakText(answer);
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

// Funkcja odtwarzająca odpowiedź jako dźwięk
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

// Od razu inicjalizujemy głos przy starcie strony
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


// // Nasłuchiwanie zdarzenia załadowania głosów
// window.speechSynthesis.onvoiceschanged = () => {
//   const voices = window.speechSynthesis.getVoices();
//   console.log("Dostępne głosy do wyboru:", voices.map(voice => ({
//     name: voice.name,
//     lang: voice.lang,
//     default: voice.default
//   })));
// };

