
from pydantic_settings import BaseSettings
from typing import List, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "AssignWell"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "No3Prob4$"
    POSTGRES_DB: str = "assignwell"
    POSTGRES_PORT: str = "5432"
    SQLALCHEMY_DATABASE_URI: Union[str, None] = None
    DATABASE_URL: Union[str, None] = None

    # Auth
    SECRET_KEY: str = "YOUR_SECRET_KEY" # TODO: Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # AI / LLM Configuration
    OPENAI_API_KEY: Union[str, None] = None  # Set this in .env to enable real AI features
    OPENAI_MODEL: str = "gpt-4o-mini"  # Can be changed to gpt-4, gpt-3.5-turbo, etc.

    class Config:
        case_sensitive = True
        env_file = ".env"

    def __init__(self, **data):
        super().__init__(**data)
        if self.DATABASE_URL:
            self.SQLALCHEMY_DATABASE_URI = self.DATABASE_URL
        elif not self.SQLALCHEMY_DATABASE_URI:
            # Use SQLite for development (easier setup)
            self.SQLALCHEMY_DATABASE_URI = "sqlite:///./assignwell.db"
            # For PostgreSQL, use:
            # self.SQLALCHEMY_DATABASE_URI = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
