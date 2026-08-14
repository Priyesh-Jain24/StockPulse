from flask import Flask
from flask_cors import CORS
from backend.routes import api
from backend.cache.screener_cache import start_cache_thread

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    app.register_blueprint(api)
    
    start_cache_thread()
    
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5050)
