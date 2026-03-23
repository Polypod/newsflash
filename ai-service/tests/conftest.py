import sys
import os
from unittest.mock import MagicMock

# Add ai-service/src/ to sys.path so tests can import as: from config.database import ...
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Stub out heavy ML/LangChain packages that are not installed in the test environment.
# The functions under test (e.g. output_formatter) do not invoke these at runtime —
# they are only referenced at module import time.
_STUB_MODULES = [
    "langgraph",
    "langgraph.graph",
    "langgraph.types",
    "langchain_anthropic",
    "langchain_openai",
    "langchain_chroma",
]
for _mod in _STUB_MODULES:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

# Provide specific attributes that situational_awareness.py references at import time.
sys.modules["langgraph.graph"].StateGraph = MagicMock()
sys.modules["langgraph.graph"].START = "START"
sys.modules["langgraph.graph"].END = "END"
sys.modules["langgraph.types"].Send = MagicMock()
sys.modules["langchain_anthropic"].ChatAnthropic = MagicMock()
sys.modules["langchain_openai"].ChatOpenAI = MagicMock()
sys.modules["langchain_openai"].OpenAIEmbeddings = MagicMock()
sys.modules["langchain_chroma"].Chroma = MagicMock()
