import os
import io
import base64
import uuid
import threading
import json
import time

import numpy as np
import trimesh
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from PIL import Image
from scipy.ndimage import rotate
from joblib import Parallel, delayed

# --- Initialize Flask App ---
app = Flask(__name__)
CORS(app)

# --- In-memory store for job progress ---
progress_store = {}

# --- Helper function for parallel processing ---
def process_single_angle(angle, grid):
    rotated_grid = rotate(grid, angle, axes=(0, 1), reshape=False, order=1)
    projection_2d = np.sum(rotated_grid, axis=1)
    return np.flipud(projection_2d.T)

# --- Slicing Algorithm with Staged Progress Reporting ---
def create_projection_stack_with_progress(job_id, mesh, pitch, num_angles, rot_x, rot_y, rot_z):
    """
    Creates projections and updates the progress_store with specific stages.
    """
    try:
        # --- Stage 1: Loading & Centering ---
        progress_store[job_id] = {'progress': 5, 'stage': 'LOADING', 'status': 'Centering and rotating mesh...'}
        center = mesh.bounds.mean(axis=0)
        transform = trimesh.transformations.translation_matrix(-center)
        mesh.apply_transform(transform)
        if rot_x != 0 or rot_y != 0 or rot_z != 0:
            transform = trimesh.transformations.euler_matrix(np.deg2rad(rot_x), np.deg2rad(rot_y), np.deg2rad(rot_z), 'sxyz')
            mesh.apply_transform(transform)

        # --- Stage 2: Voxelization ---
        progress_store[job_id] = {'progress': 15, 'stage': 'VOXELIZING', 'status': 'Voxelizing mesh...'}
        voxel_grid = mesh.voxelized(pitch=pitch).fill().matrix.astype(np.float32)

        # --- Stage 3: Projecting ---
        progress_store[job_id] = {'progress': 25, 'stage': 'PROJECTING', 'status': 'Preparing for projection...'}
        max_dim = max(voxel_grid.shape)
        pad_width = int(np.ceil((np.sqrt(2) * max_dim - max_dim) / 2))
        padded_grid = np.pad(voxel_grid, pad_width, mode='constant', constant_values=0)
        
        theta = np.linspace(0., 360., num_angles, endpoint=False)
        
        processed_count = []
        def process_and_update(angle, grid):
            result = process_single_angle(angle, grid)
            processed_count.append(1)
            # This part accounts for 60% of progress (from 25% to 85%).
            progress = 25 + int((len(processed_count) / num_angles) * 60)
            progress_store[job_id] = {
                'progress': progress, 
                'stage': 'PROJECTING',
                'status': f'Generating projection {len(processed_count)}/{num_angles}'
            }
            return result

        projection_stack = Parallel(n_jobs=-1)(
            delayed(process_and_update)(angle, padded_grid) for angle in theta
        )
        projection_stack = np.array(projection_stack)

        # --- Stage 4: Encoding ---
        progress_store[job_id] = {'progress': 85, 'stage': 'ENCODING', 'status': 'Encoding images...'}
        base64_images = []
        for i, projection_2d in enumerate(projection_stack):
            # This part accounts for 15% of progress (from 85% to 100%).
            progress = 85 + int(((i + 1) / len(projection_stack)) * 15)
            progress_store[job_id] = {
                'progress': progress, 
                'stage': 'ENCODING',
                'status': f'Encoding image {i+1}/{len(projection_stack)}'
            }
            
            p_norm = (projection_2d - projection_2d.min()) / (projection_2d.max() - projection_2d.min()) * 255 if projection_2d.max() > projection_2d.min() else np.zeros_like(projection_2d)
            
            img = Image.fromarray(p_norm.astype(np.uint8), 'L')
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
            base64_images.append(img_str)

        # --- Final result ---
        progress_store[job_id] = {
            'progress': 100, 
            'stage': 'COMPLETE',
            'status': 'complete', 
            'images': base64_images
        }

    except Exception as e:
        print(f"An error occurred in job {job_id}: {e}")
        progress_store[job_id] = {'progress': 100, 'stage': 'FAILED', 'status': 'failed', 'error': str(e)}

# --- API Endpoints ---
@app.route('/api/slice/start', methods=['POST'])
def slice_model_start():
    if 'stl_file' not in request.files:
        return jsonify({"error": "No stl_file part"}), 400
    
    stl_file = request.files['stl_file']
    if stl_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        pitch = float(request.form.get('pitch', 1.0))
        num_angles = int(request.form.get('num_angles', 360))
        rot_x = float(request.form.get('rot_x', 0))
        rot_y = float(request.form.get('rot_y', 0))
        rot_z = float(request.form.get('rot_z', 0))

        stl_file_bytes = stl_file.read()
        in_memory_file = io.BytesIO(stl_file_bytes)
        mesh = trimesh.load(in_memory_file, file_type='stl')
        
        job_id = str(uuid.uuid4())
        progress_store[job_id] = {'progress': 0, 'stage': 'IDLE', 'status': 'Initializing...'}

        thread = threading.Thread(target=create_projection_stack_with_progress, args=(job_id, mesh, pitch, num_angles, rot_x, rot_y, rot_z))
        thread.start()

        return jsonify({"job_id": job_id})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/slice/progress/<job_id>')
def slice_model_progress(job_id):
    def generate():
        while True:
            if job_id in progress_store:
                data = progress_store[job_id]
                yield f"data: {json.dumps(data)}\n\n"
                if data.get('stage') in ['COMPLETE', 'FAILED']:
                    if job_id in progress_store:
                        # Clean up the store after the job is done
                        del progress_store[job_id]
                    break
            time.sleep(0.2) 

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, port=5000)