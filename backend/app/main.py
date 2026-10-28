"""Main FastAPI application entry point for UK Wind Forecast Analysis."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wind_forecast_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    logger.info("Starting up %s v%s in %s mode...", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)
    logger.info("Elexon API Base URL: %s", settings.ELEXON_API_BASE_URL)
    logger.info("CORS Origins Allowed: %s", settings.CORS_ORIGINS)
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production-grade Backend for UK Wind Generation Forecast and Actual Outturn Analysis. "
        "Built for Day-Ahead wholesale electricity procurement planning using live and historical Elexon BMRS stream data."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware for seamless integration with React and other frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(router)


@app.get("/", tags=["Root"], summary="API Root Overview")
async def root():
    """Root endpoint offering high-level service status and quick links."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "online",
        "documentation": "/docs",
        "health": "/api/health",
        "endpoints": {
            "forecasts": "/api/forecasts",
            "forecast_detail": "/api/forecasts/{start_time}",
            "analytics": "/api/analytics",
        },
    }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Custom error response for schema and query parameter validation failures."""
    logger.warning("Validation error on %s: %s", request.url, exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "detail": exc.errors(),
            "path": str(request.url),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all unhandled exception handler to ensure JSON responses and prevent leakage."""
    logger.exception("Unhandled server error processing %s: %s", request.url, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected server error occurred while processing the request.",
            "path": str(request.url),
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
