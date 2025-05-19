# app.py – Flask backend z nowym stylem OpenAI 1.x
import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
import azure.cognitiveservices.speech as speechsdk
from openai import AzureOpenAI

# Załaduj zmienne środowiskowe z pliku .env
load_dotenv()

app = Flask(__name__)

# Konfiguracja klienta Azure OpenAI
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),  # Poprawiona zmienna środowiskowa
    api_version="2024-12-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME")
# AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
# AZURE_REGION = os.getenv("AZURE_REGION")

# Funkcja przekształcająca tekst na mowę
# def generate_speech(text):
#     speech_config = speechsdk.SpeechConfig(subscription=AZURE_SPEECH_KEY, region=AZURE_REGION)
#     speech_config.speech_synthesis_voice_name = "pl-PL-KarolinaNeural"
#     audio_config = speechsdk.audio.AudioOutputConfig(use_default_speaker=True)
#     synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
#     synthesizer.speak_text_async(text)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/ask", methods=["POST"])
def ask():
    data = request.json
    user_input = data.get("text")

    try:
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT_NAME,
            messages=[{"role": "user", "content": user_input}]
        )
        answer = response.choices[0].message.content
        # generate_speech(answer)
        return jsonify({"response": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)