from crewai import Agent, Task, Crew, Process
import os

def setup_crew():
    # 1. Plant Disease Researcher Agent
    disease_researcher = Agent(
        role="Plant Pathologist",
        goal="Identify plant diseases and provide accurate, scientific information on causes and treatments.",
        backstory="You are an expert plant pathologist with years of experience studying plant diseases, pests, and agricultural science. You provide accurate, factual information.",
        verbose=True,
        allow_delegation=False
    )

    # 2. Farmer Support Agent
    farmer_support = Agent(
        role="Agricultural Advisor",
        goal="Communicate empathetically and clearly with farmers in a mix of Hindi and English (Hinglish). Provide practical, easy-to-understand solutions based on scientific data.",
        backstory="You are a friendly and experienced agricultural advisor who talks directly to farmers. You take complex scientific advice and simplify it so anyone can understand it. You always sound supportive and helpful.",
        verbose=True,
        allow_delegation=True
    )
    
    return disease_researcher, farmer_support

def run_farmer_query(farmer_message: str) -> str:
    # Ensure OPENAI_API_KEY is set or handle it gracefully
    if not os.environ.get("OPENAI_API_KEY"):
        return "⚠️ Please configure the OPENAI_API_KEY in the environment to use the AI agents."

    disease_researcher, farmer_support = setup_crew()

    # Task for the Researcher
    research_task = Task(
        description=f"Analyze the following query from a farmer regarding a potential plant issue. Identify the disease or pest, and outline the scientific treatment.\nFarmer Query: '{farmer_message}'",
        expected_output="A detailed scientific explanation of the disease, its causes, and standard treatments.",
        agent=disease_researcher
    )

    # Task for the Support Advisor
    support_task = Task(
        description="Take the scientific analysis from the researcher and create a friendly, supportive, and practical response for the farmer. Use a mix of Hindi and English (Hinglish) and keep it simple.",
        expected_output="A friendly, empathetic response in Hinglish providing clear, step-by-step advice to the farmer.",
        agent=farmer_support
    )

    # Instantiate the Crew
    farming_crew = Crew(
        agents=[disease_researcher, farmer_support],
        tasks=[research_task, support_task],
        process=Process.sequential
    )

    result = farming_crew.kickoff()
    return str(result)
