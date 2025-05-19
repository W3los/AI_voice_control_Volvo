# app.py – Flask backend z nowym stylem OpenAI 1.x
import os
#from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, jsonify
#import azure.cognitiveservices.speech as speechsdk
#from openai import AzureOpenAI

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


BLOGS = [
    {
        'id': 1, 
        'title': 'Lorem Ipsum', 
        'content': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
    }
]

@app.route("/blogs")
def blogs():
    return render_template("blogs.html", blogs=BLOGS)

@app.route("/blogs/<int:blog_id>")
def view_blog(blog_id):
    blog = next((b for b in BLOGS if b["id"] == blog_id), None)
    if blog is None:
        return "Blog nie znaleziony", 404
    return render_template("view_blog.html", blog=blog)

@app.route("/blogs/new", methods=["GET", "POST"])
def new_blog():
    if request.method == "POST":
        title = request.form["title"]
        content = request.form["content"]
        new_id = BLOGS[-1]["id"] + 1 if BLOGS else 1
        BLOGS.append({"id": new_id, "title": title, "content": content})
        return redirect(url_for("blogs"))
    
    return render_template("new_blog.html")

if __name__ == "__main__":
    app.run(debug=True)