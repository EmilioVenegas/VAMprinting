# projector_server.py

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- VAM Hardware Import ---
from dlp import dlpc350

# --- Initialize Flask App and Logger ---
app = Flask(__name__)

# Allow requests from your React frontend
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"], supports_credentials=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Singleton for Projector Hardware ---
projector = None
# Store current settings to re-apply when toggling light
current_led_settings = {
    "uv": True,
    "green": False,
    "blue": False,
    "uvCurrent": 45,
    "greenCurrent": 0,
    "blueCurrent": 0
}

def get_projector():
    """Initializes and returns a singleton projector instance."""
    global projector
    if projector is None:
        projector = dlpc350()
    return projector

# --- API Endpoints for Projector Control ---

@app.route('/api/projector/connect', methods=['POST'])
def connect_projector():
    """Establishes a connection with the projector hardware."""
    proj = get_projector()
    if proj.connected:
        return jsonify({"status": "Already connected"}), 200
    try:
        proj.Connect()
        if proj.connected:
            logger.info("Projector connection successful.")
            return jsonify({"status": "Connection successful"}), 200
        else:
            logger.warning("Failed to connect to projector.")
            return jsonify({"error": "Failed to connect. Is the device plugged in?"}), 500
    except Exception as e:
        logger.error(f"Error connecting to projector: {e}", exc_info=True)
        # Reset the singleton if connection fails badly
        global projector
        projector = None
        return jsonify({"error": str(e)}), 500

@app.route('/api/projector/disconnect', methods=['POST'])
def disconnect_projector():
    """Disconnects from the projector and resets the instance."""
    global projector
    if projector and projector.connected:
        try:
            projector.disable_LEDs()
        except Exception as e:
            logger.error(f"Could not disable LEDs on disconnect: {e}")
    projector = None # Destroy the instance
    logger.info("Projector instance destroyed and disconnected.")
    return jsonify({"status": "Disconnected"}), 200

@app.route('/api/projector/status', methods=['GET'])
def projector_status():
    """Returns the current connection status and LED settings."""
    proj = get_projector()
    return jsonify({
        "connected": proj.connected,
        "settings": current_led_settings
    }), 200

@app.route('/api/projector/settings', methods=['POST'])
def projector_settings():
    """Updates the projector's LED current intensities."""
    global current_led_settings
    proj = get_projector()
    if not proj.connected:
        return jsonify({"error": "Projector not connected"}), 400
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
        
    current_led_settings = data # Update global settings
    
    try:
        proj.set_current_RGB(
            red=data.get('uvCurrent', 0), 
            green=data.get('greenCurrent', 0), 
            blue=data.get('blueCurrent', 0)
        )
        logger.info(f"Set projector currents to: UV={data.get('uvCurrent')}, G={data.get('greenCurrent')}, B={data.get('blueCurrent')}")
        return jsonify({"status": "Settings updated"}), 200
    except Exception as e:
        logger.error(f"Error setting projector currents: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/projector/light', methods=['POST'])
def projector_light_toggle():
    """Toggles the projector's light source on or off."""
    proj = get_projector()
    if not proj.connected:
        return jsonify({"error": "Projector not connected"}), 400
        
    data = request.get_json()
    state = data.get('state') # "on" or "off"

    try:
        if state == 'on':
            settings = current_led_settings
            proj.enable_LEDs(
                red=settings.get('uv', False), 
                green=settings.get('green', False), 
                blue=settings.get('blue', False)
            )
            logger.info(f"Enabled LEDs with settings: UV={settings.get('uv')}, G={settings.get('green')}, B={settings.get('blue')}")
        elif state == 'off':
            proj.disable_LEDs()
            logger.info("Disabled LEDs.")
        else:
            return jsonify({"error": "Invalid state specified"}), 400
        
        return jsonify({"status": f"Light turned {state}"}), 200
    except Exception as e:
        logger.error(f"Error toggling projector light: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint."""
    logger.info("Projector server health check was hit.")
    return jsonify({"status": "healthy", "service": "projector-control"}), 200

if __name__ == '__main__':
    # Run this server on a different port, e.g., 5001
    app.run(debug=True, port=5001)