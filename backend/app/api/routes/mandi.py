import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services.market import government_mandi_service, mandi_trend_service

router = APIRouter(prefix="/mandi", tags=["Mandi Intelligence"])
logger = logging.getLogger(__name__)


class MandiPriceItem(BaseModel):
    state: str
    district: str
    market: str
    commodity: str
    variety: str = "Other"
    min_price: float = 0.0
    max_price: float = 0.0
    modal_price: float = 0.0
    date: str = ""
    data_freshness: str = "live"
    source: str = "data.gov.in"


class MandiResponse(BaseModel):
    success: bool
    data: List[MandiPriceItem]
    count: int
    source: str = "data.gov.in"
    resource_id: Optional[str] = None
    message: Optional[str] = None


@router.get("/trends")
async def get_mandi_trends(
    state: Optional[str] = Query(None, description="State name"),
    commodity: Optional[str] = Query(None, description="Commodity name"),
):
    """
    Returns commodity price trends derived from official market data.
    """
    trends = await mandi_trend_service.get_crop_trends_async(state=state, commodity=commodity)
    return {
        "success": True,
        "trends": trends,
        "count": len(trends),
    }


@router.get("/prices", response_model=MandiResponse)
async def get_mandi_prices(
    state: Optional[str] = Query(None, description="Filter by State (e.g. Punjab, Bihar)"),
    district: Optional[str] = Query(None, description="Filter by District"),
    commodity: Optional[str] = Query(None, description="Filter by Commodity (e.g. Wheat, Rice, Tomato)"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return"),
):
    """
    Returns official commodity market prices from Data.gov.in AGMARKNET dataset
    with transparent caching and verified local historical fallback.
    """
    result = await government_mandi_service.get_prices(
        state=state,
        district=district,
        commodity=commodity,
        limit=limit,
    )

    raw_data = result.get("data", [])
    items = [MandiPriceItem(**r) for r in raw_data]

    return MandiResponse(
        success=result.get("success", False),
        data=items,
        count=len(items),
        source=result.get("source", "historical_dataset"),
        resource_id=result.get("resource_id"),
        message=result.get("message"),
    )


@router.get("/intelligence")
async def get_mandi_market_intelligence(
    commodity: str = Query("Wheat", description="Commodity name"),
    state: Optional[str] = Query(None, description="State"),
    district: Optional[str] = Query(None, description="District"),
):
    """
    Grounded market intelligence summary for a specific crop and region.
    """
    intel = await government_mandi_service.get_market_intelligence(
        commodity=commodity,
        state=state,
        district=district,
    )
    return {
        "success": intel.get("modal_price", 0) > 0,
        "data": intel,
    }

