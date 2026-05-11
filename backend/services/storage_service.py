import httpx
from backend.config import settings


def _url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.STORAGE_BUCKET}/{path}"


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}


async def upload_to_storage(owner_id: str, stored_name: str, data: bytes) -> None:
    path = f"{owner_id}/{stored_name}"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _url(path),
            content=data,
            headers={
                **_auth_headers(),
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            },
            timeout=180.0,
        )
        response.raise_for_status()


async def download_from_storage(owner_id: str, stored_name: str) -> bytes:
    path = f"{owner_id}/{stored_name}"
    async with httpx.AsyncClient() as client:
        response = await client.get(
            _url(path),
            headers=_auth_headers(),
            timeout=180.0,
        )
        if response.status_code == 404:
            raise ValueError("Arquivo não encontrado no servidor")
        response.raise_for_status()
        return response.content
