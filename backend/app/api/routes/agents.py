from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
try:
    from app.agents.crew_setup import run_farmer_query
except ImportError:
    run_farmer_query = None

router = APIRouter()

class FarmerQuery(BaseModel):
    message: str

@router.post("/chat")
async def chat_with_crew(query: FarmerQuery):
    if not run_farmer_query:
        raise HTTPException(status_code=500, detail="CrewAI agents are not properly configured.")
    
    try:
        response = run_farmer_query(query.message)
        return {"success": True, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CrewAI execution failed: {str(e)}")
