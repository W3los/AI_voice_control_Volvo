import os
import sqlite3
from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, jsonify, g
from openai import AzureOpenAI
from datetime import date

load_dotenv()

app = Flask(__name__)
DATABASE = 'blog.db'

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-12-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.execute("""
            CREATE TABLE IF NOT EXISTS blogs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                subtitle TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT NOT NULL,
                publish_date TEXT NOT NULL,
                summary TEXT NOT NULL,
                content TEXT NOT NULL,
                conclusion TEXT NOT NULL);
        """)

        db.commit()

@app.route("/")
def index():
    db = get_db()
    blogs = db.execute("SELECT * FROM blogs").fetchall()
    return render_template("index.html", blogs=blogs)

@app.route("/api/ask", methods=["POST"])
def ask():
    data = request.json
    user_input = data.get("text")
    mode = data.get("mode")        # np. "article" albo None
    blog_id = data.get("blogId")   # np. 1 albo None

    try:
        if mode == "article" and blog_id:
            db = get_db()
            blog = db.execute("SELECT title, author, content FROM blogs WHERE id = ?", (blog_id,)).fetchone()
            if blog is None:
                return jsonify({"error": "Blog nie znaleziony."})

            article_text = f"""
            Tytuł: {blog['title']}
            Autor: {blog['author']}
            Treść: {blog['content']}
            """

            prompt = f"{user_input}\n\nArtykuł:\n{article_text}"

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {'role': 'system', 'content': '''
                    Jesteś asystentem pomagającym użytkownikowi. Użytkownik poprosił o przeczytanie lub streszczenie artykułu.
                    Użytkownik może cie też poprosić o znalezienie jakiegoś słowa w artykule.
                    Jeżeli prosi cie o przeczytanie artykułu przeczytaj cały artykuł bez zmiany jakich kolwiek danych.
                    Na podstawie poniższego artykułu odpowiedz na jego prośbę w języku polskim.
                    Nie generuj nic poza odpowiedzią.
                    '''},
                    {'role': 'user', 'content': prompt}
                ]
            )
        else:
            # domyślna odpowiedź - normalna rozmowa / tworzenie bloga
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {'role': 'system', 'content': '''
                     Jesteś asystentem, który zasila stronę Internetową z artykułami, blogami, wpisami.
                     Użytkownik może po prostu chcieć wejść z tobą w interakcję, poprosić o przeczytanie czy streszczenie artykułu, może też prosić o tłumaczenie.
                     Kolejnym zadaniem jakie możesz wykonać, to pomóc uzytkownikowi uzupełniać formularz bloga.
                     W tym i tylko w tym przypadku odpowiadaj w formacie JSON z odpowiednimi polami: title, subtitle, author, category, tags, summary, content, conclusion.
                     Podaj kategorię wybierając jedną z: ["Technologia", "AI", "Poradnik", "Biznes", "Inne"]
                     Pole kategorii jest case-sensitive, więc podaj dokładną wartość, uwzględniając wielkość liter i polskie znaki.
                     Nie dołączaj niczego poza JSON.
                     '''
                    },
                    {'role': 'user', 'content': user_input}
                ]
            )

        answer = response.choices[0].message.content
        return jsonify({"response": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/blogs/<int:blog_id>")
def view_blog(blog_id):
    db = get_db()
    blog = db.execute("SELECT * FROM blogs WHERE id = ?", (blog_id,)).fetchone()
    if blog is None:
        return "Blog nie znaleziony", 404
    return render_template("view_blog.html", blog=blog)

@app.route("/blogs/<int:blog_id>/delete", methods=["POST"])
def delete_blog(blog_id):
    db = get_db()
    db.execute("DELETE FROM blogs WHERE id = ?", (blog_id,))
    db.commit()
    return redirect(url_for('index'))

@app.route("/blogs/new", methods=["GET", "POST"])
def new_blog():
    if request.method == "POST":
        title = request.form["title"]
        content = request.form["content"]
        subtitle = request.form.get("subtitle", "")
        author = request.form.get("author", "")
        category = request.form.get("category", "")
        tags = request.form.get("tags", "")
        publish_date = request.form.get("publish_date") or str(date.today())
        summary = request.form.get("summary", "")
        conclusion = request.form.get("conclusion", "")

        conn = get_db()
        conn.execute(
            """
            INSERT INTO blogs (title, content, subtitle, author, category, tags, publish_date, summary, conclusion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (title, content, subtitle, author, category, tags, publish_date, summary, conclusion)
        )
        conn.commit()
        conn.close()
        return redirect("/")

    return render_template("new_blog.html", today=str(date.today()))

if __name__ == "__main__":
    
    init_db()
    app.run(debug=True)