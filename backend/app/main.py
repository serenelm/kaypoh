from dotenv import load_dotenv

load_dotenv()  # Must run before importing modules that read env vars

import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(name)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kaypoh")

from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.factcheck import router as factcheck_router
from app.api.routes.researcher import router as researcher_router
from app.api.routes.submissions import router as submissions_router
from app.api.routes.user import router as user_router
from app.db import Base, engine
import app.models.claim  # noqa: F401
import app.models.submission  # noqa: F401
import app.models.vote  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Kaypoh API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(factcheck_router)
app.include_router(submissions_router)
app.include_router(dashboard_router)
app.include_router(user_router)
app.include_router(researcher_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error("Unhandled exception on %s %s\n%s", request.method, request.url.path, tb)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) or "Internal server error", "type": type(exc).__name__},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
