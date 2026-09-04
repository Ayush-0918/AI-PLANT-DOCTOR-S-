import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from app.agents.crew_setup import run_farmer_query

def test_crew():
    result = run_farmer_query("My wheat leaves have yellow spots and brown edges. What could be the disease and how to treat it?")
    print("Agent Result:")
    print(result)

if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not found in environment!")
    else:
        test_crew()
