from fastapi import FastAPI

from routers.auth import router as auth_router
from routers.calls import router as calls_router
from routers.contacts import router as contacts_router
from routers.first_aid import router as first_aid_router
from routers.sos import router as sos_router
from routers.users import router as users_router

app = FastAPI(title="Nkwa Backend API", version="0.1.0")

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(contacts_router, prefix="/api/v1/contacts", tags=["contacts"])
app.include_router(calls_router, prefix="/api/v1/calls", tags=["calls"])
app.include_router(sos_router, prefix="/api/v1", tags=["sos"])
app.include_router(first_aid_router, prefix="/api/v1/first-aid", tags=["first-aid"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
