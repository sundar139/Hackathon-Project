from typing import List, Dict, Any, Optional
import random
from app.core.config import settings

# Try to import OpenAI, but don't fail if it's not installed
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

class AIService:
    """
    Service for handling AI/LLM interactions.
    Automatically uses OpenAI if API key is configured, otherwise falls back to mock responses.
    """

    def __init__(self):
        self.use_real_ai = OPENAI_AVAILABLE and settings.OPENAI_API_KEY is not None
        if self.use_real_ai:
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = settings.OPENAI_MODEL
            print(f"✓ AIService initialized with OpenAI ({self.model})")
        else:
            self.client = None
            print("⚠ AIService running in MOCK mode (no OpenAI API key configured)")

    async def generate_assignment_plan(self, assignment_title: str, assignment_description: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Breaks down an assignment into smaller, manageable subtasks.
        Uses OpenAI if available, otherwise returns mock data.
        """
        if self.use_real_ai:
            try:
                prompt = f"""You are an academic planning assistant. Break down the following assignment into 5-7 specific, actionable subtasks.

Assignment Title: {assignment_title}
{f'Description: {assignment_description}' if assignment_description else ''}

Return a JSON array of subtasks. Each subtask should have:
- title: A clear, actionable task description
- estimated_minutes: Realistic time estimate (15-120 minutes)
- order: Sequential number (1, 2, 3, etc.)

Example format:
[
  {{"title": "Research topic and gather sources", "estimated_minutes": 60, "order": 1}},
  {{"title": "Create outline", "estimated_minutes": 30, "order": 2}}
]

Only return the JSON array, no other text."""

                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful academic planning assistant. Always respond with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=800
                )
                
                import json
                content = response.choices[0].message.content.strip()
                # Remove markdown code blocks if present
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                    content = content.strip()
                
                subtasks = json.loads(content)
                return subtasks
            except Exception as e:
                print(f"Error calling OpenAI for assignment plan: {e}")
                # Fall back to mock on error
        
        # Mock logic (fallback)
        steps = [
            "Research topic and gather sources",
            "Create an outline",
            "Draft the introduction",
            "Write the main body paragraphs",
            "Write the conclusion",
            "Review and edit",
            "Final polish and submission"
        ]
        
        subtasks = []
        for i, step in enumerate(steps):
            subtasks.append({
                "title": step,
                "estimated_minutes": 60,
                "order": i + 1
            })
        
        return subtasks

    async def analyze_mood(self, mood_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyzes recent mood logs to provide insights and recommendations.
        Uses OpenAI if available, otherwise returns mock data.
        """
        if not mood_history:
            return {
                "insight": "Start logging your mood to get personalized insights!",
                "recommendation": "Try checking in once a day."
            }
        
        if self.use_real_ai:
            try:
                # Format mood history for the prompt
                history_text = "\n".join([
                    f"- Mood: {log.get('mood_valence', 'unknown')}, Energy: {log.get('energy_level', 'N/A')}, Stress: {log.get('stress_level', 'N/A')}"
                    for log in mood_history[:5]  # Last 5 entries
                ])
                
                prompt = f"""You are a supportive wellbeing coach. Analyze this student's recent mood check-ins and provide a brief insight and recommendation.

Recent mood logs:
{history_text}

Provide a response in JSON format with two fields:
- insight: A brief, empathetic observation about their mood patterns (1-2 sentences)
- recommendation: A specific, actionable suggestion to improve their wellbeing (1 sentence)

Example:
{{"insight": "Your energy seems lower in the evenings.", "recommendation": "Try taking a 10-minute walk after dinner."}}

Only return the JSON object, no other text."""

                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a supportive wellbeing coach. Always respond with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.8,
                    max_tokens=200
                )
                
                import json
                content = response.choices[0].message.content.strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                    content = content.strip()
                
                result = json.loads(content)
                return result
            except Exception as e:
                print(f"Error calling OpenAI for mood analysis: {e}")
                # Fall back to mock on error
        
        # Mock logic (fallback)
        last_log = mood_history[0]
        valence = last_log.get("mood_valence", "neutral")
        
        if valence in ["negative", "very_negative"]:
            return {
                "insight": "It seems like things have been tough recently.",
                "recommendation": "Consider taking a short walk or practicing deep breathing."
            }
        elif valence in ["positive", "very_positive"]:
            return {
                "insight": "You're doing great! Keep up the momentum.",
                "recommendation": "Use this energy to tackle your most challenging tasks."
            }
        else:
            return {
                "insight": "Your mood appears stable.",
                "recommendation": "Maintain a balanced routine."
            }

    async def chat_response(self, message: str, context: Dict[str, Any]) -> str:
        """
        Generates a therapist-style response to a user message.
        Uses OpenAI if available, otherwise returns mock data.
        """
        if self.use_real_ai:
            try:
                user_name = context.get("user_name", "friend")
                
                system_prompt = """You are AssignWell AI, a supportive academic and wellbeing assistant for students. You combine:
- Empathetic, therapist-style listening
- Practical academic planning advice
- Stress management techniques
- Encouragement and validation

Keep responses concise (2-3 sentences). Be warm, supportive, and actionable. If a student mentions stress or overwhelm, acknowledge their feelings and offer a specific coping strategy."""

                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message}
                    ],
                    temperature=0.9,
                    max_tokens=150
                )
                
                return response.choices[0].message.content.strip()
            except Exception as e:
                print(f"Error calling OpenAI for chat: {e}")
                # Fall back to mock on error
        
        # Mock logic (fallback)
        responses = [
            "I understand. How does that make you feel?",
            "That sounds challenging. What do you think is the best way to handle it?",
            f"I'm here to support you. Tell me more about what you're experiencing.",
            "It's okay to feel overwhelmed sometimes. Let's break it down together.",
            "Have you taken a break recently? It might help clear your mind."
        ]
        
        return random.choice(responses)

ai_service = AIService()
