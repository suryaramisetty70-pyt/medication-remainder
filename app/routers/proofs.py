import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.occurrence import MedicineOccurrence
from app.models.proof import MedicineProof
from app.models.user import User

router = APIRouter(prefix="/api/proofs", tags=["Photo Proof Storage"])


@router.get("/{proof_id}/view")
def view_proof_image(
    proof_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proof = db.query(MedicineProof).filter(MedicineProof.id == proof_id).first()
    if not proof:
        raise HTTPException(status_code=404, detail="Proof image not found.")

    occ = db.query(MedicineOccurrence).filter(MedicineOccurrence.id == proof.occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Associated occurrence not found.")

    # Authorization Check: only child or parent can view
    if user.id != occ.child_id and user.id != occ.parent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this proof image.",
        )

    if not os.path.exists(proof.file_path):
        raise HTTPException(status_code=404, detail="Proof image file is missing from storage.")

    return FileResponse(
        path=proof.file_path,
        media_type=proof.mime_type,
        filename=proof.file_name,
    )
