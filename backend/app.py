import os
import io
import base64
import uuid
import threading
import json
import time
import logging

import numpy as np
import trimesh
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from PIL import Image
from scipy.ndimage import rotate
from joblib import Parallel, delayed

# --- Initialize Flask App and Logger ---
app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- In-memory store for job progress ---
progress_store = {}
progress_lock = threading.Lock()

# --- Constants for progress stages (improving readability) ---
PROGRESS_MESH_LOADING = 5
PROGRESS_VOXELIZING = 15
PROGRESS_PROJECTION_START = 25
PROGRESS_PROJECTION_SECTION = 60 # 25% + 60% = 85%
PROGRESS_ENCODING_START = 85
PROGRESS_ENCODING_SECTION = 15 # 85% + 15% = 100%


# --- Helper function for parallel processing ---
def process_single_angle(angle, grid):
    """Rotates the grid and computes a 2D projection."""
    # Using order=1 for linear interpolation, faster than order=3 (cubic)
    # and generally sufficient for voxel data.
    rotated_grid = rotate(grid, angle, axes=(0, 1), reshape=False, order=1)
    projection_2d = np.sum(rotated_grid, axis=1) # Sum along the 'depth' axis
    return np.flipud(projection_2d.T) # Transpose and flip for standard image orientation


# --- Slicing Algorithm with Staged Progress Reporting ---
def create_projection_stack_with_progress(job_id, mesh, pitch, num_angles, rot_x, rot_y, rot_z):
    """
    Creates projections and updates the progress_store with specific stages.
    Handles errors and reports progress including ETA.
    """
    try:
        # --- Stage 1: Loading & Centering ---
        # Check if mesh is valid before proceeding
        if mesh.is_empty:
            raise ValueError("Provided STL file resulted in an empty mesh.")

        with progress_lock:
            progress_store[job_id] = {'progress': PROGRESS_MESH_LOADING, 'stage': 'LOADING', 'status': 'Centering and rotating mesh...'}
        logger.info(f"Job {job_id}: Centering and rotating mesh.")

        center = mesh.bounds.mean(axis=0)
        transform = trimesh.transformations.translation_matrix(-center)
        mesh.apply_transform(transform)

        if rot_x != 0 or rot_y != 0 or rot_z != 0:
            transform = trimesh.transformations.euler_matrix(np.deg2rad(rot_x), np.deg2rad(rot_y), np.deg2rad(rot_z), 'sxyz')
            mesh.apply_transform(transform)

        # --- Stage 2: Voxelization ---
        with progress_lock:
            progress_store[job_id] = {'progress': PROGRESS_VOXELIZING, 'stage': 'VOXELIZING', 'status': 'Voxelizing mesh...'}
        logger.info(f"Job {job_id}: Voxelizing mesh with pitch {pitch}.")

        # Voxelize and convert to float32 for scipy.ndimage.rotate
        voxel_grid = mesh.voxelized(pitch=pitch).fill().matrix.astype(np.float32)

        # --- Stage 3: Projecting ---
        with progress_lock:
            progress_store[job_id] = {'progress': PROGRESS_PROJECTION_START, 'stage': 'PROJECTING', 'status': 'Preparing for projection...'}
        logger.info(f"Job {job_id}: Preparing for projection for {num_angles} angles.")

        # Pad the voxel grid to prevent cropping during rotation
        max_dim = max(voxel_grid.shape)
        # Calculate padding needed for a 45-degree rotation without cropping
        pad_width = int(np.ceil((np.sqrt(2) * max_dim - max_dim) / 2))
        padded_grid = np.pad(voxel_grid, pad_width, mode='constant', constant_values=0)
        
        # Angles for projection
        theta = np.linspace(0., 360., num_angles, endpoint=False)
        
        projection_start_time = time.time()
        processed_count_list = [] # Using a list to track count in parallel context

        def process_and_update(angle, grid_to_process, angle_idx):
            """Wrapper for process_single_angle to update progress."""
            result = process_single_angle(angle, grid_to_process)
            
            with progress_lock:
                processed_count_list.append(1) # Increment count
                current_count = len(processed_count_list)

                # --- ETA Calculation Logic (with division by zero prevention) ---
                elapsed_time = time.time() - projection_start_time
                avg_time_per_projection = 0
                eta_seconds = 0
                eta_str = "Calculating ETA..."

                if current_count > 0:
                    avg_time_per_projection = elapsed_time / current_count
                    remaining_projections = num_angles - current_count
                    eta_seconds = int(avg_time_per_projection * remaining_projections)
                    eta_str = f"{eta_seconds // 60}m {eta_seconds % 60}s" if eta_seconds > 0 else "Almost done..."
                
                # Progress calculation (from PROGRESS_PROJECTION_START to PROGRESS_ENCODING_START)
                progress = PROGRESS_PROJECTION_START + int((current_count / num_angles) * PROGRESS_PROJECTION_SECTION)
                progress_store[job_id] = {
                    'progress': progress, 
                    'stage': 'PROJECTING',
                    'status': f'Generating projection {current_count}/{num_angles} (ETA: {eta_str})'
                }
            return result

        # Use Parallel to process angles concurrently
        projection_stack = Parallel(n_jobs=-1, backend="threading")(
            delayed(process_and_update)(angle, padded_grid, idx) for idx, angle in enumerate(theta)
        )
        projection_stack = np.array(projection_stack)
        logger.info(f"Job {job_id}: Finished generating {len(projection_stack)} projections.")


        # --- Stage 4: Encoding ---
        with progress_lock:
            progress_store[job_id] = {'progress': PROGRESS_ENCODING_START, 'stage': 'ENCODING', 'status': 'Encoding images...'}
        logger.info(f"Job {job_id}: Starting image encoding.")

        base64_images = []
        if len(projection_stack) == 0:
            logger.warning(f"Job {job_id}: No projections to encode. Skipping encoding stage.")
        
        for i, projection_2d in enumerate(projection_stack):
            with progress_lock: # Lock for progress update in loop
                # Progress calculation (from PROGRESS_ENCODING_START to 100%)
                progress = PROGRESS_ENCODING_START + int(((i + 1) / len(projection_stack)) * PROGRESS_ENCODING_SECTION)
                progress_store[job_id] = {
                    'progress': progress, 
                    'stage': 'ENCODING',
                    'status': f'Encoding image {i+1}/{len(projection_stack)}'
                }
            
            # Normalize projection to 0-255 range for image conversion
            # Ensures division by zero is handled if min == max
            p_max = projection_2d.max()
            p_min = projection_2d.min()

            if p_max > p_min:
                p_norm = ((projection_2d - p_min) / (p_max - p_min)) * 255
            else:
                # If all values are the same (e.g., all zeros), make it a black image
                p_norm = np.zeros_like(projection_2d, dtype=np.uint8)
            
            # Convert to PIL Image and then to Base64
            img = Image.fromarray(p_norm.astype(np.uint8), 'L') # 'L' for grayscale
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
            base64_images.append(img_str)

        # --- Final result ---
        with progress_lock:
            progress_store[job_id] = {
                'progress': 100, 
                'stage': 'COMPLETE',
                'status': 'complete', 
                'images': base64_images
            }
        logger.info(f"Job {job_id}: Completed successfully.")

    except ValueError as ve:
        logger.error(f"A ValueError occurred in job {job_id}: {ve}")
        with progress_lock:
            progress_store[job_id] = {'progress': 100, 'stage': 'FAILED', 'status': 'failed', 'error': str(ve)}
    except trimesh.exceptions.FileFormatError as ffe:
        logger.error(f"A FileFormatError occurred in job {job_id} during mesh loading: {ffe}")
        with progress_lock:
            progress_store[job_id] = {'progress': 100, 'stage': 'FAILED', 'status': 'failed', 'error': f"Invalid STL file format: {ffe}"}
    except Exception as e:
        logger.error(f"An unexpected error occurred in job {job_id}: {e}", exc_info=True) # exc_info=True logs traceback
        with progress_lock:
            progress_store[job_id] = {'progress': 100, 'stage': 'FAILED', 'status': 'failed', 'error': str(e)}

# --- API Endpoints ---
@app.route('/api/slice/start', methods=['POST'])
def slice_model_start():
    if 'stl_file' not in request.files:
        return jsonify({"error": "No stl_file part"}), 400
    
    stl_file = request.files['stl_file']
    if stl_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    job_id = str(uuid.uuid4())
    try:
        # Input validation
        pitch_str = request.form.get('pitch', '1.0')
        num_angles_str = request.form.get('num_angles', '360')
        rot_x_str = request.form.get('rot_x', '0')
        rot_y_str = request.form.get('rot_y', '0')
        rot_z_str = request.form.get('rot_z', '0')

        try:
            pitch = float(pitch_str)
            if pitch <= 0:
                raise ValueError("Pitch must be a positive number.")
        except ValueError:
            return jsonify({"error": f"Invalid pitch value: '{pitch_str}'"}), 400

        try:
            num_angles = int(num_angles_str)
            if num_angles <= 0: # Ensure at least one angle for projection
                raise ValueError("Number of angles must be a positive integer.")
        except ValueError:
            return jsonify({"error": f"Invalid num_angles value: '{num_angles_str}'"}), 400

        try:
            rot_x = float(rot_x_str)
            rot_y = float(rot_y_str)
            rot_z = float(rot_z_str)
        except ValueError:
            return jsonify({"error": "Invalid rotation angle value(s)."}), 400

        stl_file_bytes = stl_file.read()
        in_memory_file = io.BytesIO(stl_file_bytes)
        mesh = trimesh.load(in_memory_file, file_type='stl')
        
        with progress_lock:
            progress_store[job_id] = {'progress': 0, 'stage': 'IDLE', 'status': 'Initializing...'}

        thread = threading.Thread(target=create_projection_stack_with_progress, args=(job_id, mesh, pitch, num_angles, rot_x, rot_y, rot_z))
        thread.start()

        logger.info(f"Started new job with ID: {job_id}")
        return jsonify({"job_id": job_id})

    except Exception as e:
        logger.error(f"Error starting job {job_id}: {e}", exc_info=True)
        # Clean up job_id from store if an error occurs during startup
        with progress_lock:
            if job_id in progress_store:
                del progress_store[job_id]
        return jsonify({"error": str(e)}), 500

@app.route('/api/slice/progress/<job_id>')
def slice_model_progress(job_id):
    def generate():
        while True:
            data = None
            with progress_lock: # Ensure thread-safe access to progress_store
                if job_id in progress_store:
                    data = progress_store[job_id]
                
            if data:
                yield f"data: {json.dumps(data)}\n\n"
                if data.get('stage') in ['COMPLETE', 'FAILED']:
                    with progress_lock: # Lock for cleanup
                        if job_id in progress_store:
                            logger.info(f"Cleaning up job {job_id} from progress store.")
                            del progress_store[job_id]
                    break
            else:
                # If job_id not found (e.g., cleaned up or never existed),
                # send a "not found" message and terminate.
                logger.warning(f"Job ID {job_id} not found in progress store for SSE.")
                yield f"data: {json.dumps({'progress': 0, 'stage': 'ERROR', 'status': 'Job not found or already completed/failed.'})}\n\n"
                break
            
            time.sleep(0.5) # Increased sleep to reduce CPU usage for polling

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, port=5000)