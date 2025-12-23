from fastapi import APIRouter, HTTPException
from db import get_neo4j_client
from typing import List, Dict, Any

router = APIRouter(prefix="/catalog", tags=["catalog"])

@router.get("", response_model=List[Dict[str, Any]])
async def get_catalog():
    """
    获取整个记忆库的目录结构
    """
    client = get_neo4j_client()
    try:
        return client.get_catalog_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/relation/{viewer_id}/{target_id}")
async def get_relation_detail(viewer_id: str, target_id: str):
    """
    获取两个实体之间的详细关系结构（包含Direct Edge和Relay Edges）
    """
    client = get_neo4j_client()
    try:
        return client.get_relationship_structure(viewer_id, target_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
