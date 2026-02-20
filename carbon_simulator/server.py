from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from fastapi.middleware.cors import CORSMiddleware
from graph_engine import OperationsGraph, process_dynamic_graph
import uvicorn
import os

app = FastAPI(title="Carbon Operations Map Engine", description="Dynamic simulation of carbon value chain with jurisdictional gap filling")

# Add CORS middleware to allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Carbon Operations Engine Running"}

@app.post("/simulate")
def simulate_graph(ops_graph: OperationsGraph, readings: int = 720):
    """
    Simulates data generation, gap-filling, and flow calculation
    for a provided operations graph.
    """
    try:
        result = process_dynamic_graph(ops_graph, n_readings=readings)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
    )
