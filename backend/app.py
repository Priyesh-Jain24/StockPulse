from flask import Flask
from flask_cors import CORS
from backend.routes import api
from backend.cache.screener_cache import start_cache_thread

def create_app():
    app_instance = Flask(__name__)
    CORS(app_instance)
    
    app_instance.register_blueprint(api)
    
    start_cache_thread()
    
    return app_instance

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5050)
