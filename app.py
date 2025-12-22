from flask import Flask, render_template


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static")

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5600)
