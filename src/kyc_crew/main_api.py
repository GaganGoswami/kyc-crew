# --- main_api.py ---
# Main FastAPI application file

import os
import uuid
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field # Use Pydantic for request body validation
from typing import Dict, List, Any, Callable, Coroutine
import uvicorn # For running the app

# Import CrewAI and related components
from crewai import Agent, Task, Crew, Process, LLM  
from langchain_community.llms import Ollama # Use the community Ollama integration
from langchain_core.exceptions import OutputParserException # Handle potential LLM parsing errors

# --- Configuration ---
# Ensure Ollama server is running: `ollama serve`
# Ensure you have pulled the model: `ollama pull gemma:latest` (or your specific tag)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest") # Use the desired Gemma model
UPLOAD_DIR = "temp_uploads" # Directory to temporarily store uploads
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- LLM Configuration ---
# Centralized LLM setup for CrewAI agents
# try:
#     shared_llm = LLM(model="ollama/llama3.2:latest", base_url="http://localhost:11434")
#     #shared_llm = Ollama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE_URL)
#     # Perform a quick test call
#     shared_llm.call("Hello, this is a test call to the Ollama model.")
#     print(f"Successfully connected to Ollama model '{OLLAMA_MODEL}' at {OLLAMA_BASE_URL}")
# except Exception as e:
#     print(f"ERROR: Failed to connect to Ollama model '{OLLAMA_MODEL}' at {OLLAMA_BASE_URL}.")
#     print(f"Ensure Ollama is running and the model '{OLLAMA_MODEL}' is pulled.")
#     print(f"Error details: {e}")
#     # Optionally exit or provide a fallback mechanism
#     shared_llm = None # Indicate LLM is not available


# --- LLM Configuration ---
# Centralized LLM setup for CrewAI agents
try:
    # Initialize LLM with correct configuration for Ollama
    shared_llm = LLM(
        model="ollama/llama2",  # Format: provider/model
        config={
            'api_base': "http://localhost:11434",
            'context_window': 4096,
            'temperature': 0.7,
            'max_tokens': 1024,
            'request_timeout': 120,
            'seed': 42
        }
    )
    
    # Test the LLM with proper message format
    response = shared_llm.call("Hello, please respond with OK if you can receive this message.")
    print(f"LLM Test Response: {response}")
    print("Successfully connected to Ollama LLM service")

except Exception as e:
    print(f"ERROR: Failed to initialize LLM.")
    print(f"Error details: {e}")
    print("Ensure Ollama is running and the model is available.")
    print("Run: ollama pull llama2")
    shared_llm = None


# --- WebSocket Connection Manager ---
class ConnectionManager:
    """Manages active WebSocket connections."""
    def __init__(self):
        # Store connections mapped by process_id
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, process_id: str):
        """Accepts a new connection and stores it."""
        await websocket.accept()
        self.active_connections[process_id] = websocket
        print(f"WebSocket connected for process ID: {process_id}")

    def disconnect(self, process_id: str):
        """Removes a connection."""
        if process_id in self.active_connections:
            del self.active_connections[process_id]
            print(f"WebSocket disconnected for process ID: {process_id}")

    async def send_update(self, process_id: str, update_data: dict):
        """Sends a JSON update to a specific client."""
        if process_id in self.active_connections:
            websocket = self.active_connections[process_id]
            try:
                await websocket.send_json(update_data)
                print(f"Sent update to {process_id}: {update_data.get('message', 'No message')}")
            except Exception as e:
                print(f"Error sending WebSocket update to {process_id}: {e}")
                # Consider disconnecting if send fails repeatedly
                self.disconnect(process_id)
        else:
            print(f"Warning: No active WebSocket connection found for process ID {process_id} to send update.")

manager = ConnectionManager()

# --- CrewAI Agent & Task Definitions (Simplified Placeholders) ---

# Placeholder Tool (Simulates an action)
def simple_placeholder_tool(input_data: str) -> str:
    """A simple tool that agents can 'use'. Replace with real tools."""
    print(f"[Tool Execution] simple_placeholder_tool called with: {input_data}")
    # Simulate some processing
    return f"Tool processed input: '{input_data}'. Result: Success."

# Define Agents (using the shared LLM)
# NOTE: These are basic structures. Real agents need more detailed goals, backstories,
#       and potentially specific tools passed via the `tools` parameter.
#       Error handling (e.g., with try-except around LLM calls or tool usage) is crucial.

kyc_orchestrator = Agent(
    role='KYC Process Orchestrator',
    goal='Manage the customer onboarding and KYC verification process efficiently, coordinating tasks between other agents and providing status updates.',
    backstory='You are the lead agent responsible for coordinating all KYC tasks, ensuring smooth execution and timely updates.',
    llm=shared_llm,
    verbose=True,
    allow_delegation=True # Allows this agent to assign tasks to others
)

document_analyzer = Agent(
    role='Document Analysis Specialist',
    goal='Analyze uploaded documents (e.g., ID cards, utility bills) to extract key information and check for basic validity markers.',
    backstory='You are skilled at processing documents. You receive file paths and extract relevant data points.',
    llm=shared_llm,
    verbose=True,
    #tools=[simple_placeholder_tool] # Example: Add real tools here (e.g., OCR, PDF reader)
)

risk_assessor = Agent(
    role='Risk Assessment Analyst',
    goal='Evaluate the overall risk profile of the customer based on provided data and document analysis results.',
    backstory='You specialize in identifying potential risks according to predefined rules and patterns.',
    llm=shared_llm,
    verbose=True,
    #tools=[simple_placeholder_tool] # Example: Add tools for rule engines or external checks
)

# --- KYC Process Management ---
class KYCProcessManager:
    """Manages the lifecycle and execution of KYC processes using CrewAI."""
    def __init__(self, llm):
        self.llm = llm
        # Store ongoing process states (e.g., tasks, status) if needed
        self.processes: Dict[str, Any] = {}

    async def _notify_ui(self, process_id: str, agent_name: str, message: str, data: dict = None):
        """Helper function to send updates via WebSocket manager."""
        print(f"Notify UI [{process_id}] from {agent_name}: {message}")
        update_payload = {"agent": agent_name, "message": message}
        if data:
            update_payload["data"] = data
        await manager.send_update(process_id, update_payload)

    async def run_kyc_crew(self, process_id: str, customer_data: dict, document_info: dict = None):
        """Defines and runs the CrewAI tasks for a KYC process."""
        if not self.llm:
             await self._notify_ui(process_id, "System", "Error: LLM not available. Cannot run KYC process.", {"severity": "error"})
             return

        await self._notify_ui(process_id, kyc_orchestrator.role, "KYC process starting...")

        # --- Define Tasks ---
        # Task 1: Initial Review (Orchestrator) - Could be implicit or explicit
        # Task 2: Document Analysis (Document Analyzer)
        doc_analysis_task = Task(
            description=f"Analyze the document provided for KYC process {process_id}. "
                        f"Document details: {document_info or 'Not yet provided'}. "
                        "Extract key information (like name, DOB, address if applicable) "
                        "and report any obvious issues.",
            expected_output="A summary of extracted information and any identified document issues.",
            agent=document_analyzer,
            # context = [] # Add context from previous tasks if needed
        )

        # Task 3: Risk Assessment (Risk Assessor) - Depends on document analysis
        risk_assessment_task = Task(
            description=f"Assess the risk profile for customer associated with process {process_id}. "
                        f"Initial customer data: {customer_data}. "
                        "Consider the results from the document analysis.",
            expected_output="A risk score (e.g., Low, Medium, High) and a brief justification.",
            agent=risk_assessor,
            context=[doc_analysis_task] # Make this task depend on the output of doc_analysis_task
        )

        # Task 4: Final Report (Orchestrator) - Consolidates results
        final_report_task = Task(
            description=f"Compile the final KYC report for process {process_id}. "
                        "Summarize the findings from document analysis and risk assessment.",
            expected_output="A concise final report summarizing the KYC outcome and key findings.",
            agent=kyc_orchestrator,
            context=[doc_analysis_task, risk_assessment_task] # Depends on both previous tasks
        )

        # --- Create and Run the Crew ---
        kyc_crew = Crew(
            agents=[kyc_orchestrator, document_analyzer, risk_assessor],
            tasks=[doc_analysis_task, risk_assessment_task, final_report_task],
            process=Process.sequential, # Start with sequential; explore hierarchical later
            verbose=True # Logs agent activity
            # memory=True # Enable memory for context persistence across tasks if needed
        )

        try:
            await self._notify_ui(process_id, "System", "CrewAI task execution started...")
            # Run CrewAI kickoff in a separate thread to avoid blocking asyncio event loop
            # Inputs are passed as a dictionary
            crew_inputs = {
                'process_id': process_id,
                'customer_data': customer_data,
                'document_info': document_info
            }
            # Using asyncio.to_thread for non-blocking execution
            result = await asyncio.to_thread(kyc_crew.kickoff, inputs=crew_inputs)

            await self._notify_ui(process_id, "System", "CrewAI task execution finished.", {"final_result": result})
            print(f"CrewAI Result for {process_id}: {result}")

        except OutputParserException as ope:
             await self._notify_ui(process_id, "System", f"Error: LLM output parsing failed during crew execution. Details: {ope}", {"severity": "error"})
             print(f"Output Parser Error in Crew for {process_id}: {ope}")
        except Exception as e:
            await self._notify_ui(process_id, "System", f"Error during CrewAI execution: {e}", {"severity": "error"})
            print(f"Error running Crew for {process_id}: {e}")
            # Consider more specific error handling based on potential CrewAI exceptions

    async def start_kyc_process(self, customer_data: dict) -> str:
        """Initiates a new KYC process, generates an ID, and stores initial data."""
        process_id = f"kyc_{uuid.uuid4()}"
        self.processes[process_id] = {"customer_data": customer_data, "status": "initiated", "documents": []}
        await self._notify_ui(process_id, "System", "KYC Process Initiated", customer_data)
        # Optionally, trigger the first step of the crew immediately or wait for document upload
        # For this example, we'll wait for document upload to trigger the main crew run
        return process_id

    async def add_document_to_process(self, process_id: str, file_path: str, details_str: str):
        """Adds document info and triggers the main CrewAI workflow."""
        if process_id not in self.processes:
            print(f"Error: Process ID {process_id} not found.")
            # Optionally notify UI about the error
            return

        try:
            details = json.loads(details_str)
        except json.JSONDecodeError:
            details = {"error": "Invalid details JSON provided"}

        document_info = {"file_path": file_path, "details": details}
        self.processes[process_id]["documents"].append(document_info)
        self.processes[process_id]["status"] = "document_received"

        await self._notify_ui(process_id, "System", f"Document '{os.path.basename(file_path)}' received. Starting analysis.", document_info)

        # Trigger the CrewAI workflow asynchronously
        customer_data = self.processes[process_id]["customer_data"]
        # Pass the latest document info
        asyncio.create_task(self.run_kyc_crew(process_id, customer_data, document_info))


# --- FastAPI Application Setup ---
app = FastAPI(title="KYC Agentic System API")

# CORS Middleware: Allows requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "[http://127.0.0.1:5173](http://127.0.0.1:5173)"], # React dev server origin(s)
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

# Instantiate the process manager
# Pass the shared LLM instance if it's available
kyc_manager = KYCProcessManager(llm=shared_llm)

# --- API Endpoints ---
class KYCInitiationPayload(BaseModel):
    """Request model for initiating KYC."""
    customer_name: str = Field(..., min_length=1, description="Full name of the customer")
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", description="Valid email address")

@app.post("/api/kyc/initiate", summary="Initiate a new KYC process")
async def initiate_kyc(payload: KYCInitiationPayload):
    """
    Starts a new KYC process, generates a unique process ID,
    and notifies via WebSocket upon initiation.
    """
    if not shared_llm:
         raise HTTPException(status_code=503, detail="LLM Service Unavailable. Cannot initiate KYC.")
    try:
        process_id = await kyc_manager.start_kyc_process(payload.dict())
        return {"process_id": process_id, "message": "KYC process initiated successfully."}
    except Exception as e:
        print(f"Error in /initiate endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error during initiation: {e}")


@app.post("/api/kyc/document/{process_id}", summary="Upload a document for a KYC process")
async def upload_kyc_document(
    process_id: str,
    file: UploadFile = File(..., description="The document file to upload"),
    details: str = Form("{}", description="JSON string with details about the document (e.g., {'documentType': 'ID_CARD'})")
):
    """
    Receives a document file and associated details for a specific KYC process ID.
    Saves the file temporarily and triggers the CrewAI analysis workflow.
    """
    if not shared_llm:
         raise HTTPException(status_code=503, detail="LLM Service Unavailable. Cannot process document.")
    if process_id not in kyc_manager.processes:
         raise HTTPException(status_code=404, detail=f"Process ID '{process_id}' not found.")

    try:
        # Secure filename and save the file
        safe_filename = f"{process_id}_{uuid.uuid4()}_{file.filename.replace(' ', '_')}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)

        # Write file content asynchronously if possible, or use a thread
        with open(file_path, "wb") as buffer:
             content = await file.read() # Read file content
             buffer.write(content)

        # Notify the manager to handle the document and trigger the crew
        # Run this in the background so the API can return quickly
        asyncio.create_task(kyc_manager.add_document_to_process(process_id, file_path, details))

        return {"filename": file.filename, "process_id": process_id, "status": "Document submitted for processing", "saved_path": file_path}
    except Exception as e:
        print(f"Error in /document/{process_id} endpoint: {e}")
        # Clean up saved file if error occurs?
        raise HTTPException(status_code=500, detail=f"Error processing document upload: {e}")


# --- WebSocket Endpoint ---
@app.websocket("/ws/kyc/{process_id}")
async def websocket_kyc_endpoint(websocket: WebSocket, process_id: str):
    """Handles WebSocket connections for real-time updates for a specific KYC process."""
    await manager.connect(websocket, process_id)
    try:
        while True:
            # Keep the connection alive. You can optionally receive messages from client here.
            # data = await websocket.receive_text()
            # await manager.send_update(process_id, {"message": f"Echo: {data}"}) # Example echo
            await asyncio.sleep(60) # Keep connection alive, prevent timeout
            # Send a ping or check connection status periodically if needed
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(process_id)
    except Exception as e:
        print(f"WebSocket error for {process_id}: {e}")
        manager.disconnect(process_id)


# --- Root Endpoint ---
@app.get("/", summary="Root endpoint")
async def read_root():
    """Provides a simple welcome message."""
    return {"message": "Welcome to the KYC Agentic System API"}

# --- Main Execution ---
if __name__ == "__main__":
    print("Starting KYC Agentic System API...")
    if not shared_llm:
         print("WARNING: LLM is not available. API will run but KYC processing will fail.")
    # Run the FastAPI server
    uvicorn.run("main_api:app", host="0.0.0.0", port=8000, reload=True)