import httpx
from backend.config import settings


class StorageError(ValueError):
    pass


def _url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.STORAGE_BUCKET}/{path}"


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}


async def upload_to_storage(owner_id: str, stored_name: str, data: bytes) -> None:
    path = f"{owner_id}/{stored_name}"
    async with httpx.AsyncClient() as client:
        try:
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
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:300]
            raise StorageError(
                f"Falha ao enviar arquivo para o storage (HTTP {exc.response.status_code}): {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise StorageError(f"Erro de conexão com o storage: {exc}") from exc


async def delete_folder_from_storage(owner_id: str) -> None:
    """Remove todos os arquivos de um usuário via deleção em lote por prefixo.

    Usa DELETE /object/{bucket} com body {"prefixes": ["uuid/"]} — uma única
    chamada HTTP apaga toda a pasta. Retorna sem erro se a pasta não existir
    (usuário sem arquivos é um estado válido).
    """
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.STORAGE_BUCKET}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(
                url,
                headers={**_auth_headers(), "Content-Type": "application/json"},
                json={"prefixes": [f"{owner_id}/"]},
                timeout=60.0,
            )
            if response.status_code not in (200, 404):
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:300]
            raise StorageError(
                f"Falha ao excluir arquivos do storage (HTTP {exc.response.status_code}): {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise StorageError(f"Erro de conexão com o storage: {exc}") from exc


async def download_from_storage(owner_id: str, stored_name: str) -> bytes:
    path = f"{owner_id}/{stored_name}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                _url(path),
                headers=_auth_headers(),
                timeout=180.0,
            )
            if response.status_code == 404:
                raise ValueError("Arquivo não encontrado no servidor")
            response.raise_for_status()
            return response.content
        except ValueError:
            raise
        except httpx.HTTPStatusError as exc:
            raise StorageError(
                f"Falha ao baixar arquivo do storage (HTTP {exc.response.status_code})"
            ) from exc
        except httpx.RequestError as exc:
            raise StorageError(f"Erro de conexão com o storage: {exc}") from exc
