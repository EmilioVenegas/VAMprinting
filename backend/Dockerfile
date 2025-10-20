FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application's code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Run the app. Gunicorn is a production-ready WSGI server.
# We use 4 workers and set a long timeout (30 minutes) for potentially long slicing jobs.
CMD ["gunicorn", "--workers", "4", "--timeout", "1800", "--bind", "0.0.0.0:5000", "backend:app"]