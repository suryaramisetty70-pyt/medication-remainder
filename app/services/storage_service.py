import os
import uuid
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


async def save_proof_image(file: UploadFile, occurrence_id: int) -> Tuple[str, str, int, str]:
    """
    Validates MIME type, file size, and saves file to private storage.
    Returns: (file_path, file_name, file_size, mime_type)
    """
    content_type = file.content_type
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
        )

    ext = ALLOWED_MIME_TYPES[content_type]
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb}MB.",
        )

    os.makedirs(settings.upload_dir, exist_ok=True)
    unique_name = f"proof_occ_{occurrence_id}_{uuid.uuid4().hex[:10]}{ext}"
    file_path = os.path.join(settings.upload_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return (file_path, unique_name, file_size, content_type)
