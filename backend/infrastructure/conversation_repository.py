import os
import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class MessageRecord(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str


class ConversationRecord(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    files: List[str] = Field(default_factory=list)
    messages: List[MessageRecord] = Field(default_factory=list)


def _get_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConversationRepository:
    """
    Repositório SQLite local para persistência de conversas, mensagens e arquivos vinculados.
    """

    def __init__(self, db_path: str = "./data/conversations.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path) or ".", exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Tabela de Conversas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            # Tabela de Mensagens
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    citations_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                )
            """)
            # Tabela de Arquivos Vinculados à Conversa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversation_files (
                    conversation_id TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (conversation_id, file_name),
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                )
            """)
            conn.commit()

    def create_conversation(self, title: str = "Nova Conversa", conversation_id: Optional[str] = None) -> ConversationRecord:
        cid = conversation_id or f"conv-{uuid.uuid4().hex[:10]}"
        now = _get_utc_now()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (cid, title, now, now)
            )
            conn.commit()

        return ConversationRecord(
            id=cid,
            title=title,
            created_at=now,
            updated_at=now,
            files=[],
            messages=[]
        )

    def list_conversations(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    c.id, 
                    c.title, 
                    c.created_at, 
                    c.updated_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                    (SELECT COUNT(*) FROM conversation_files f WHERE f.conversation_id = c.id) as file_count
                FROM conversations c
                ORDER BY c.updated_at DESC
            """)
            rows = cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "title": r["title"],
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                    "message_count": r["message_count"],
                    "file_count": r["file_count"]
                }
                for r in rows
            ]

    def get_conversation(self, conversation_id: str) -> Optional[ConversationRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
            conv_row = cursor.fetchone()
            if not conv_row:
                return None

            cursor.execute(
                "SELECT file_name FROM conversation_files WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,)
            )
            files = [r["file_name"] for r in cursor.fetchall()]

            cursor.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,)
            )
            msg_rows = cursor.fetchall()
            messages = [
                MessageRecord(
                    id=r["id"],
                    conversation_id=r["conversation_id"],
                    role=r["role"],
                    content=r["content"],
                    citations=json.loads(r["citations_json"]),
                    created_at=r["created_at"]
                )
                for r in msg_rows
            ]

            return ConversationRecord(
                id=conv_row["id"],
                title=conv_row["title"],
                created_at=conv_row["created_at"],
                updated_at=conv_row["updated_at"],
                files=files,
                messages=messages
            )

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        citations: Optional[List[Dict[str, Any]]] = None
    ) -> MessageRecord:
        msg_id = f"msg-{uuid.uuid4().hex[:12]}"
        now = _get_utc_now()
        citations_json = json.dumps(citations or [])

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO messages (id, conversation_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (msg_id, conversation_id, role, content, citations_json, now)
            )
            cursor.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id)
            )
            conn.commit()

        return MessageRecord(
            id=msg_id,
            conversation_id=conversation_id,
            role=role,
            content=content,
            citations=citations or [],
            created_at=now
        )

    def add_file(self, conversation_id: str, file_name: str):
        now = _get_utc_now()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR IGNORE INTO conversation_files (conversation_id, file_name, created_at) VALUES (?, ?, ?)",
                (conversation_id, file_name, now)
            )
            cursor.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id)
            )
            conn.commit()

    def get_conversation_files(self, conversation_id: str) -> List[str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT file_name FROM conversation_files WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,)
            )
            return [r["file_name"] for r in cursor.fetchall()]

    def update_title(self, conversation_id: str, new_title: str):
        now = _get_utc_now()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (new_title, now, conversation_id)
            )
            conn.commit()

    def delete_conversation(self, conversation_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
            cursor.execute("DELETE FROM conversation_files WHERE conversation_id = ?", (conversation_id,))
            cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
