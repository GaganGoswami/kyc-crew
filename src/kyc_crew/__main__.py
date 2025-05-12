#!/usr/bin/env python

import uvicorn
from kyc_crew.main_api import app, shared_llm

if __name__ == "__main__":
    print("Starting KYC Agentic System API...")
    if not shared_llm:
        print("WARNING: LLM is not available. API will run but KYC processing will fail.")
    
    # Run the FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
