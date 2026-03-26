<div align="center">

#  VAM Web Controller 🌀
### Volumetric Additive Manufacturing (VAM) Printing

A web-based controller for a volumetric 3D printer. It handles model slicing, image projection, and hardware control, all from your browser.

</div>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript"/>
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js"/>
  <img alt="Python" src="https://img.shields.io/badge/Python-3.9-blue?style=for-the-badge&logo=python&logoColor=yellow"/>
  <img alt="Flask" src="https://img.shields.io/badge/Flask-black?style=for-the-badge&logo=flask"/>
  <img alt="Docker" src="https://img.shields.io/badge/Docker-blue?style=for-the-badge&logo=docker"/>
</p>

---

## ✨ Features

* **3D Model Handling**:
    * 📤 **Drag-and-Drop** `.stl` file uploading.
    * 👀 **Interactive 3D Preview** powered by **three.js**.
    * 🔄 **Initial Rotation** (X, Y, Z) to orient your model before slicing.
    * 📉 **Mesh Simplification (Remesh)** to optimize model quality and performance.
* **Backend Slicing**:
    * ⚙️ Configurable **Voxel Size** and **Number of Projections**.
    * 🚀 High-performance Python backend using `trimesh` for voxelization and `scipy`/`numpy` for projections.
    * ⚡ **Parallel Processing** with `joblib` for significantly faster slice generation.
    * 📊 **Real-time Progress** streamed to the frontend via Server-Sent Events (SSE), complete with ETA.
* **Preview & Alignment**:
    * 🎞️ **Live Preview** of all generated projection slices.
    * 🛠️ **Advanced Calibration Controls**:
        * Image Scale
        * Translate X/Y (with keyboard arrow controls ⌨️)
        * Contrast
* **Projection**:
    * 🖥️ Uses the **Presentation API** to project slices onto a second monitor or projector.
    * ⏱️ Multiple **Print Modes**:
        * Velocity (°/s)
        * Time-per-frame (ms)
        * Hops (for triggered systems)
* **Hardware Control**:
    * ![Bluetooth](https://img.shields.io/badge/Web_Bluetooth-blue?style=flat&logo=bluetooth)
    * 📡 Connects to printer hardware (e.g., ESP32) via **Web Bluetooth (BLE)**.
    * 📠 Sends precise print commands (total rotation, speed, vertical steps, etc.) directly to the device.
* **Job Management**:
    * 💾 **Export** a completed slicing job (settings + all projection images) as a single `.zip` file.
    * 📂 **Import** a `.zip` job file to instantly load all settings and images, skipping the slicing step.

---
## 🧠 Slicing Algorithm Deep Dive

The core of the VAM controller is its backend slicing engine, which converts a 3D mesh file (`.stl`) into a series of 2D projection images. This process is analogous to generating a set of X-rays or CT scans of the object from every angle.

The algorithm follows these main steps:

### 1. Mesh Pre-processing
* **Loading**: The `.stl` file is loaded into memory using `trimesh`.
* **Centering**: The model's center of mass is moved to the origin (0, 0, 0). This ensures that rotations are performed around the object's center.
* **Initial Rotation**: The user-defined rotations (RotX, RotY, RotZ) are applied to the mesh.

### 2. Voxelization
The continuous surface mesh is converted into a discrete 3D bitmap, or a **voxel grid**.
* **Library**: `trimesh.voxel.VoxelGrid` is used for this conversion.
* **Parameter**: The `pitch` (Voxel Size) from the UI determines the size of each cube in the grid. A smaller pitch results in higher resolution but significantly increases computation time.
* **Output**: A 3D NumPy array `V(x, y, z)` where `1` represents solid material and `0` represents empty space.

### 3. Rotation & Projection (The "Radon Transform")
This is the most computationally intensive step. To generate `N` projections (e.g., 120), the 3D voxel grid is rotated `N` times, and a 2D projection is calculated for each rotation.

* **Rotation Angles**: A set of angles `θ` is generated:
    ```
    theta = np.linspace(0., 360., num_angles, endpoint=False)
    ```
    This creates an array like `[0, 3, 6, ..., 357]` for 120 projections.

* **Padding**: Before rotation, the 3D voxel grid `V` is padded. This is crucial because rotating a square grid (e.g., 100x100) by 45° would cause the corners to be cut off. Padding ensures the entire object stays within the array boundaries during rotation.

* **Projection Loop**: The backend uses `joblib.Parallel` to run this step on all available CPU cores. For each angle `θ`:
    1.  **Rotate**: The 3D grid `V` is rotated around its central **Z-axis** by `θ` degrees. This is done using `scipy.ndimage.rotate` with the `axes=(0, 1)` parameter, which specifies rotation in the X-Y plane.
        
        *Formula (conceptual 2D rotation)*:
        ```math
        \begin{pmatrix} x' \\ y' \end{pmatrix} = \begin{pmatrix} \cos \theta & -\sin \theta \\ \sin \theta & \cos \theta \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix}
        ```
        
    3.  **Project**: A 2D projection `P(x, z)` is created by summing all voxel values along the "depth" axis (the Y-axis). This is a discrete approximation of the **Radon Transform**.
        
        ```math
        P_{\theta}(x, z) = \sum_{y} V_{\theta}(x, y, z)
        ```
        Where `V_θ` is the rotated voxel grid and `P_θ` is the resulting 2D projection at that angle.

### 4. Image Encoding
* **Normalization**: Each 2D projection `P` (which is a 2D NumPy array) is normalized. The minimum value in the array is mapped to `0` (black) and the maximum value is mapped to `255` (white).
* **Encoding**: The normalized array is converted into a PNG image using `Pillow (PIL)`.
* **Base64**: The final PNG image is encoded into a Base64 string and sent to the frontend.

This entire stack of Base64 images is then ready to be projected for printing.

---

## 🛠️ Tech Stack

### 🖥️ Frontend (Client)
* **Framework**: <img src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg" height="24" alt="React" style="vertical-align:middle"> **React 19**
* **Language**: <img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg" height="24" alt="TypeScript" style="vertical-align:middle"> **TypeScript**
* **Bundler**: <img src="https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg" height="24" alt="Vite" style="vertical-align:middle"> **Vite**
* **3D Rendering**: <img width="24" height="24" alt="image" src="https://github.com/user-attachments/assets/86650191-085e-41cf-a287-c14ce7f167da" /> **three.js**
* **Styling**: <img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg" height="24" alt="Tailwind CSS" style="vertical-align:middle"> **TailwindCSS**
* **Connectivity**:  **Web Bluetooth**, 🖥️ **Presentation API**

### ☁️ Backend (Server)
* **Framework**: <img width="24" height="24" alt="image" src="https://github.com/user-attachments/assets/b9bc7ff7-0a32-4c02-9b6f-55bd0649e94f" />
 **Flask**
* **Language**: <img src="https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg" height="24" alt="Python" style="vertical-align:middle"> **Python 3.9**
* **WSGI Server**: <img width="24" height="24" alt="gunicorn" src="https://github.com/user-attachments/assets/c489969d-adf6-4a4e-8a02-d0ab3f39a012" /> **Gunicorn**
* **Core Libraries**: 📚
    * `trimesh`: For 3D model loading and voxelization.
    * `scipy` / `numpy`: For 3D array rotation and projection.
    * `Pillow (PIL)`: For creating and encoding PNG images.
    * `joblib`: For parallel processing.
* **Containerization**: <img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg" height="24" alt="Docker" style="vertical-align:middle"> **Docker**

## 🛠️ Tech Stack

### Frontend (Client)
* **Framework**: React 19
* **Language**: TypeScript
* **Bundler**: Vite
* **3D Rendering**: three.js
* **Styling**: TailwindCSS
* **Connectivity**: Web Bluetooth, Presentation API

### Backend (Server)
* **Framework**: Flask
* **Language**: Python 3.9
* **WSGI Server**: Gunicorn
* **Core Libraries**:
    * `trimesh`: For 3D model loading and voxelization.
    * `scipy` / `numpy`: For 3D array rotation and projection.
    * `Pillow (PIL)`: For creating and encoding PNG images.
    * `joblib`: For parallel processing.
* **Containerization**: Docker

---

## 🚀 How to Run

### Backend (Python/Flask)

1.  Navigate to the `backend/` directory:
    ```bash
    cd backend
    ```
2.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Run the development server:
    ```bash
    python app.py
    ```
    The backend will run on `http://localhost:5000`.

### Frontend (React/Vite)

1.  From the project root directory, install Node.js dependencies:
    ```bash
    npm install
    ```
2.  Run the development server:
    ```bash
    npm run dev
    ```
    The frontend will be accessible at `http://localhost:3000`.

    ```
---

## 📡 API Endpoints

* `POST /api/remesh`
    * Upload an STL file and a `simplification_percentage` to get a simplified STL file back.
* `POST /api/slice/start`
    * Upload an STL file and slicing parameters (`pitch`, `num_angles`, `rot_x`, etc.) to start a slicing job. Returns a `job_id`.
* `GET /api/slice/progress/<job_id>`
    * An EventStream (SSE) endpoint that streams progress updates (percentage, stage, ETA) for the specified `job_id`.
    * On completion, it sends the full stack of base64-encoded images.
