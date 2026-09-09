import csv
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.agents.mandi_price_crew import (
    get_cached_mandi_price,
    run_mandi_price_crew,
    run_mandi_price_crew_sync,
    set_cached_mandi_price,
)
from app.services.system.dataset_locator_service import (
    AGRICULTURE_PRICE_DATASET_CANDIDATES,
    first_existing_path,
)

logger = logging.getLogger(__name__)


class MandiTrendService:
    @staticmethod
    def _csv_fallback_lookup(commodity: str, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Secondary fallback lookup from static CSV dataset when live search is unavailable/times out.
        Tags result with data_freshness='cached_static' and logs a clear warning.
        """
        logger.warning("⚠️ Live Mandi search failed or timed out. Falling back to CSV dataset (cached_static).")

        csv_path = first_existing_path(AGRICULTURE_PRICE_DATASET_CANDIDATES)
        if csv_path is None:
            logger.error("❌ CSV dataset unavailable. Returning honest 'unavailable' status.")
            return []

        c_target = commodity.strip().lower() if commodity else "wheat"
        loc_target = location.strip().lower() if location else ""

        data_store: Dict[str, Dict[str, List[float]]] = {}

        try:
            with open(csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    crop = row.get("Commodity", "").strip()
                    state_val = row.get("STATE", "").strip()

                    if loc_target and loc_target not in state_val.lower():
                        continue
                    if c_target and c_target not in crop.lower():
                        continue

                    raw_date = row.get("Price Date", "")
                    try:
                        date_obj = datetime.strptime(raw_date, "%d/%m/%Y")
                        month_key = date_obj.strftime("%Y-%m")
                        price = float(row["Modal_Price"])

                        if crop not in data_store:
                            data_store[crop] = {}
                        if month_key not in data_store[crop]:
                            data_store[crop][month_key] = []

                        data_store[crop][month_key].append(price)
                    except (ValueError, KeyError):
                        continue

            trends = []
            for crop, months in data_store.items():
                sorted_months = sorted(months.keys(), reverse=True)
                if len(sorted_months) < 2:
                    continue

                latest_month = sorted_months[0]
                prev_month = sorted_months[1]

                avg_latest = round(sum(months[latest_month]) / len(months[latest_month]), 2)
                avg_prev = round(sum(months[prev_month]) / len(months[prev_month]), 2)

                delta_pct = round(((avg_latest - avg_prev) / avg_prev) * 100, 1) if avg_prev > 0 else 0

                trends.append({
                    "commodity": crop,
                    "avg_price": avg_latest,
                    "modal_price": avg_latest,
                    "prev_price": avg_prev,
                    "price_range": f"{int(avg_latest*0.95)} - {int(avg_latest*1.05)} INR/quintal",
                    "delta_pct": delta_pct,
                    "trend": "rising" if delta_pct > 2 else ("falling" if delta_pct < -2 else "stable"),
                    "insight": f"Prices are {'rising' if delta_pct > 0 else 'falling'} by {abs(delta_pct)}% (historical static dataset).",
                    "data_freshness": "cached_static",
                    "source_provider": "static_csv_fallback",
                })

            return sorted(trends, key=lambda x: abs(x["delta_pct"]), reverse=True)

        except Exception as e:
            logger.error(f"Error reading CSV mandi dataset: {e}")
            return []

    @classmethod
    async def get_mandi_intelligence(cls, commodity: str, location: Optional[str] = None) -> Dict[str, Any]:
        """
        Primary entry point for Mandi price intelligence:
        1. Cache Check (TTL < 45m) -> 'live_cached'
        2. MandiPriceCrew Live Search (agmarknet.gov.in first) -> 'live'
        3. Static CSV Dataset Fallback -> 'cached_static' (softened persona prompt)
        4. Unavailable -> Honest response (no numbers fabricated)
        """
        c_target = commodity.strip() if commodity else "Wheat"

        # 1 & 2: Check cache and run live search crew with 5.0s hard timeout
        live_res = await run_mandi_price_crew(commodity=c_target, location=location, timeout_sec=5.0)
        if live_res and live_res.get("modal_price", 0) > 0:
            return live_res

        # 3. Fallback to static CSV dataset
        csv_trends = cls._csv_fallback_lookup(commodity=c_target, location=location)
        if csv_trends:
            first = csv_trends[0]
            return {
                "commodity": first.get("commodity", c_target),
                "modal_price": first.get("modal_price", 2400.0),
                "price_range": first.get("price_range", "2300 - 2500 INR/quintal"),
                "nearest_mandi": f"{location or 'Regional'} APMC Mandi (Historical)",
                "trend": first.get("trend", "stable"),
                "delta_pct": first.get("delta_pct", 0.0),
                "last_updated": "historical_dataset",
                "confidence": 0.70,
                "data_freshness": "cached_static",
                "source_provider": "static_csv_fallback",
            }

        # 4. Honest unavailable response if CSV is also missing/empty
        return {
            "commodity": c_target,
            "modal_price": 0,
            "data_freshness": "unavailable",
            "message": "ताज़ा मंडी भाव उपलब्ध नहीं है। कृपया स्थानीय मंडी समिति से संपर्क करें।",
            "confidence": 0.0,
            "source_provider": "none",
        }

    @classmethod
    def get_crop_trends(cls, state: Optional[str] = None, commodity: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Synchronous trend accessor for background or dashboard listings.
        Checks cache -> live sync -> CSV fallback.
        """
        c_target = commodity or "Wheat"
        cached = get_cached_mandi_price(c_target, state)
        if cached:
            return [{
                "commodity": cached.get("commodity", c_target),
                "avg_price": cached.get("modal_price", 2400.0),
                "prev_price": round(cached.get("modal_price", 2400.0) / 1.02, 2),
                "delta_pct": cached.get("delta_pct", 1.0),
                "trend": cached.get("trend", "stable"),
                "insight": f"Prices around {cached.get('price_range', '')}.",
                "data_freshness": cached.get("data_freshness", "live_cached"),
                "source_provider": cached.get("source_provider", "cache"),
            }]

        # Try live sync crew (if fast) or fallback to CSV
        live_sync = run_mandi_price_crew_sync(c_target, state)
        if live_sync and live_sync.get("modal_price", 0) > 0:
            set_cached_mandi_price(c_target, state, live_sync)
            return [{
                "commodity": live_sync.get("commodity", c_target),
                "avg_price": live_sync.get("modal_price", 2400.0),
                "prev_price": round(live_sync.get("modal_price", 2400.0) / 1.02, 2),
                "delta_pct": live_sync.get("delta_pct", 1.0),
                "trend": live_sync.get("trend", "stable"),
                "insight": f"Prices around {live_sync.get('price_range', '')}.",
                "data_freshness": "live",
                "source_provider": live_sync.get("source_provider", "mandi_crew"),
            }]

        return cls._csv_fallback_lookup(commodity=c_target, location=state)


mandi_trend_service = MandiTrendService()
