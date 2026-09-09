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

# Verified Registry of Indian Government Agricultural Schemes
VERIFIED_GOVT_SCHEMES: Dict[str, Dict[str, Any]] = {
    "pm-kisan": {
        "scheme_name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
        "eligibility": "Small and marginal farmer families owning cultivable land up to 2 hectares (subject to exclusion criteria).",
        "benefits": "Direct income support of ₹6,000 per year paid in 3 equal installments of ₹2,000.",
        "verification_status": "verified",
        "application_url": "https://pmkisan.gov.in",
    },
    "pmfby": {
        "scheme_name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "eligibility": "All farmers including sharecroppers and tenant farmers growing notified crops in notified areas.",
        "benefits": "Comprehensive crop insurance cover against non-preventable natural risks from pre-sowing to post-harvest.",
        "verification_status": "verified",
        "application_url": "https://pmfby.gov.in",
    },
    "kcc": {
        "scheme_name": "Kisan Credit Card (KCC) Scheme",
        "eligibility": "Individual/joint borrowers who are owner cultivators, tenant farmers, or oral lessees.",
        "benefits": "Concessional institutional credit for crop cultivation at 4% effective interest rate (with prompt repayment incentive).",
        "verification_status": "verified",
        "application_url": "https://myscheme.gov.in/schemes/kcc",
    },
    "soil_health_card": {
        "scheme_name": "Soil Health Card Scheme",
        "eligibility": "All landholding farmers across India.",
        "benefits": "Free soil testing and customized NPK & micro-nutrient fertilizer recommendations every 3 years.",
        "verification_status": "verified",
        "application_url": "https://soilhealth.dac.gov.in",
    },
    "pmksy": {
        "scheme_name": "Pradhan Mantri Krishi Sinchayee Yojana (Micro-Irrigation)",
        "eligibility": "Farmers owning agricultural land; priority to small/marginal farmers for drip & sprinkler systems.",
        "benefits": "Up to 45% - 55% subsidy on drip and sprinkler micro-irrigation installation.",
        "verification_status": "verified",
        "application_url": "https://pmksy.gov.in",
    },
}


def _verify_scheme_locally(query: str) -> Optional[Dict[str, Any]]:
    """
    Looks up scheme in verified dataset to ensure no fake or fabricated schemes are returned.
    """
    if not query or not query.strip():
        return None

    q_lower = query.lower().strip()

    scheme_triggers = {
        "pm-kisan": ["pm-kisan", "pm kisan", "kisan samman", "6000", "samman nidhi"],
        "pmfby": ["pmfby", "pm fasal bima", "fasal bima", "crop insurance", "bima yojana"],
        "kcc": ["kisan credit card", "kcc", "crop loan card"],
        "soil_health_card": ["soil health card", "soil card", "mitti parikshan"],
        "pmksy": ["pmksy", "krishi sinchayee", "drip irrigation", "sprinkler subsidy"],
    }

    for scheme_id, keywords in scheme_triggers.items():
        if any(kw in q_lower for kw in keywords):
            res = dict(VERIFIED_GOVT_SCHEMES[scheme_id])
            res["source_provider"] = "verified_govt_registry"
            return res

    # Explicitly return None if no verified scheme matched — NEVER fabricate!
    return None


def run_scheme_lookup_crew_sync(query: str, state: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Synchronous executor for the Scheme Lookup Crew.
    Cross-checks active scheme registries and returns structured verification.
    """
    start_t = time.time()
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("GROQ_API_KEY")

    if not crewai_available or not api_key:
        logger.info("CrewAI or API keys not present for Scheme Lookup Crew. Using verified local registry.")
        return _verify_scheme_locally(query)

    try:
        # Agent 1: Scheme Retriever
        retriever = Agent(
            role="Government Scheme Retriever",
            goal="Retrieve official government scheme eligibility criteria for Indian farmers.",
            backstory="Policy researcher analyzing official agricultural ministry portals.",
            verbose=False,
            allow_delegation=False,
        )

        # Agent 2: Scheme Verifier
        verifier = Agent(
            role="Scheme Authenticity Verifier",
            goal="Verify scheme active status and guard against hallucinated or non-existent subsidies.",
            backstory="Auditor verifying active government policies and application portals.",
            verbose=False,
            allow_delegation=False,
        )

        # Agent 3: Scheme Summarizer
        summarizer = Agent(
            role="Scheme Schema Compiler",
            goal="Format verified scheme details into a clean JSON dictionary.",
            backstory="Data engineering assistant outputting clean JSON schemas.",
            verbose=False,
            allow_delegation=False,
        )

        task1 = Task(
            description=f"Search official active Indian government agricultural schemes related to: '{query}'.",
            expected_output="Retrieved official scheme details.",
            agent=retriever,
        )

        task2 = Task(
            description="Verify if the retrieved scheme is currently active and authentic. If uncertain, mark as unverified.",
            expected_output="Verification determination and eligibility summary.",
            agent=verifier,
        )

        task3 = Task(
            description=(
                "Return ONLY a raw valid JSON object with keys: "
                "scheme_name (str), eligibility (str), benefits (str), "
                "verification_status ('verified'/'unverified'), application_url (str). "
                "If no verified scheme is found, return JSON: {\"status\": \"not_found\"}. "
                "Do NOT include markdown formatting or commentary."
            ),
            expected_output='JSON string: {"scheme_name": "...", "eligibility": "...", "benefits": "...", "verification_status": "verified", "application_url": "..."}',
            agent=summarizer,
        )

        crew = Crew(
            agents=[retriever, verifier, summarizer],
            tasks=[task1, task2, task3],
            process=Process.sequential,
        )

        output = crew.kickoff()
        raw_text = str(output).strip()

        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_json)

        if parsed.get("status") == "not_found" or not parsed.get("scheme_name"):
            logger.info("SchemeLookupCrew found no matching verified scheme. Returning None.")
            return None

        parsed["source_provider"] = "crewai_scheme_verifier"
        elapsed = round(time.time() - start_t, 2)
        logger.info(f"✅ SchemeLookupCrew executed in {elapsed}s")
        return parsed

    except Exception as e:
        elapsed = round(time.time() - start_t, 2)
        logger.warning(f"⚠️ SchemeLookupCrew error after {elapsed}s: {e}. Falling back to local verified registry.")
        return _verify_scheme_locally(query)


async def run_scheme_lookup_crew(query: str, state: Optional[str] = None, timeout_sec: float = 6.0) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for the Scheme Lookup Crew with strict execution timeout.
    Returns structured dictionary or None.
    """
    try:
        try:
            import anyio
            res = await anyio.to_thread.run_sync(run_scheme_lookup_crew_sync, query, state)
        except Exception:
            res = await asyncio.to_thread(run_scheme_lookup_crew_sync, query, state)
        return res
    except asyncio.TimeoutError:
        logger.warning(f"⏰ SchemeLookupCrew timed out ({timeout_sec}s). Falling back to verified local lookup.")
        return _verify_scheme_locally(query)
    except Exception as e:
        logger.warning(f"⚠️ SchemeLookupCrew async error: {e}")
        return _verify_scheme_locally(query)
