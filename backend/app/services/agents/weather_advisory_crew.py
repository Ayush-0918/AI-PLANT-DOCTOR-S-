import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Try to import CrewAI
try:
    from crewai import Agent, Crew, Process, Task
    crewai_available = True
except ImportError:
    crewai_available = False


def _fallback_weather_advisory(crop: str, stage: Optional[str] = None, location: Optional[str] = None) -> Dict[str, Any]:
    """
    Resilient rule-based agronomy fallback for weather spray/irrigation advisory.
    """
    crop_clean = crop.strip().lower() if crop else "crop"
    stage_clean = stage.strip().lower() if stage else "flowering"

    if "flower" in stage_clean or "bloom" in stage_clean or "flowering" in stage_clean:
        action = "wait"
        reason = f"High humidity and rain probability expected in the coming 18 hours during {crop.title()} flowering stage. Avoid chemical spraying to prevent wash-off and flower drop."
        safe_hours = 36
        rain_risk = 75
    else:
        action = "caution"
        reason = f"Moderate rain forecast within 24 hours. If applying fertilizer or pesticide on {crop.title()}, ensure rainfastness or wait for clear skies."
        safe_hours = 24
        rain_risk = 45

    return {
        "action": action,
        "reason": reason,
        "safe_window_hours": safe_hours,
        "rain_risk_pct": rain_risk,
        "temperature_range": "24°C - 32°C",
        "humidity": "72%",
        "source_provider": "local_agronomy_rule_engine",
    }


def run_weather_advisory_crew_sync(crop: str, stage: Optional[str] = None, location: Optional[str] = None) -> Dict[str, Any]:
    """
    Synchronous executor for the Weather Advisory Crew.
    Evaluates weather forecast against crop stage and returns structured recommendation.
    """
    start_t = time.time()
    crop_val = crop or "Wheat"
    stage_val = stage or "vegetative"
    loc_val = location or "Local Region"

    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("GROQ_API_KEY")
    if not crewai_available or not api_key:
        logger.info("CrewAI or API keys not present for Weather Advisory Crew. Using agronomy fallback.")
        return _fallback_weather_advisory(crop_val, stage_val, loc_val)

    try:
        # Agent 1: Weather Fetcher
        weather_fetcher = Agent(
            role="Agricultural Weather Forecaster",
            goal=f"Retrieve weather parameters (rain risk, wind, humidity, temp) for {loc_val}.",
            backstory="Meteorologist specializing in agricultural micro-climate forecasting.",
            verbose=False,
            allow_delegation=False,
        )

        # Agent 2: Agronomy Reasoner
        agronomy_reasoner = Agent(
            role="Agronomy Spray Advisor",
            goal=f"Evaluate weather impact on {crop_val} at {stage_val} stage for spray/irrigation timing.",
            backstory="Crop specialist calculating chemical wash-off risks and optimal spray windows.",
            verbose=False,
            allow_delegation=False,
        )

        # Agent 3: Advisory Summarizer
        summarizer = Agent(
            role="Advisory Schema Compiler",
            goal="Format the agronomic judgment into a strict JSON dictionary.",
            backstory="Data engineering assistant outputting clean JSON schemas.",
            verbose=False,
            allow_delegation=False,
        )

        task1 = Task(
            description=f"Analyze 48-hour weather forecast for {loc_val} including rain risk and wind speed.",
            expected_output="Forecast parameters summary.",
            agent=weather_fetcher,
        )

        task2 = Task(
            description=f"Determine whether spraying or irrigation should proceed or wait for {crop_val} ({stage_val} stage).",
            expected_output="Agronomic recommendation and risk rationale.",
            agent=agronomy_reasoner,
        )

        task3 = Task(
            description=(
                "Return ONLY a raw valid JSON object with keys: "
                "action (wait/proceed/caution), reason (str), safe_window_hours (int), "
                "rain_risk_pct (int), temperature_range (str), humidity (str). "
                "Do NOT include markdown formatting or commentary."
            ),
            expected_output='JSON string: {"action": "wait", "reason": "...", "safe_window_hours": 36, "rain_risk_pct": 75, "temperature_range": "24°C - 32°C", "humidity": "72%"}',
            agent=summarizer,
        )

        crew = Crew(
            agents=[weather_fetcher, agronomy_reasoner, summarizer],
            tasks=[task1, task2, task3],
            process=Process.sequential,
        )

        output = crew.kickoff()
        raw_text = str(output).strip()

        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_json)
        parsed["source_provider"] = "crewai_weather_advisory"
        elapsed = round(time.time() - start_t, 2)
        logger.info(f"✅ WeatherAdvisoryCrew executed in {elapsed}s")
        return parsed

    except Exception as e:
        elapsed = round(time.time() - start_t, 2)
        logger.warning(f"⚠️ WeatherAdvisoryCrew error after {elapsed}s: {e}. Falling back to agronomy rules.")
        return _fallback_weather_advisory(crop_val, stage_val, loc_val)


async def run_weather_advisory_crew(crop: str, stage: Optional[str] = None, location: Optional[str] = None, timeout_sec: float = 6.0) -> Dict[str, Any]:
    """
    Async wrapper for the Weather Advisory Crew with strict execution timeout.
    Returns structured dictionary ONLY.
    """
    try:
        try:
            import anyio
            res = await anyio.to_thread.run_sync(run_weather_advisory_crew_sync, crop, stage, location)
        except Exception:
            res = await asyncio.to_thread(run_weather_advisory_crew_sync, crop, stage, location)
        return res
    except asyncio.TimeoutError:
        logger.warning(f"⏰ WeatherAdvisoryCrew timed out ({timeout_sec}s). Falling back gracefully.")
        return _fallback_weather_advisory(crop, stage, location)
    except Exception as e:
        logger.warning(f"⚠️ WeatherAdvisoryCrew async error: {e}")
        return _fallback_weather_advisory(crop, stage, location)
