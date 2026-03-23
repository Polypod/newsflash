import sys
import os

# Add ai-service/src/ to sys.path so tests can import as: from config.database import ...
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
