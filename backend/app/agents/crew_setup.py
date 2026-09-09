"""
CrewAI Multi-Agent Architecture for Plant Doctor AI.
NOTE: Per architecture guardrails, CrewAI multi-agent crews NEVER communicate with the farmer directly.
They generate structured data objects that are processed by AssistantOrchestrator to enforce persona,
language persistence, greeting control, and safety filtering.
"""

from app.services.agents.mandi_price_crew import run_mandi_price_crew, run_mandi_price_crew_sync
from app.services.agents.weather_advisory_crew import run_weather_advisory_crew
from app.services.agents.scheme_lookup_crew import run_scheme_lookup_crew

__all__ = [
    "run_mandi_price_crew",
    "run_mandi_price_crew_sync",
    "run_weather_advisory_crew",
    "run_scheme_lookup_crew",
]
